// src/services/search.js
const pool = require("../../db");
const OpenAI = require("openai");
const { getIndex } = require("./indexer");
const {
  preprocessToTokens,
  preprocessToString,
  termFreq,
  tfidfVector,
  cosineSim,
  jaroFixTokens,
} = require("./nlp");

// ======== Konstanta ========
const SIM_T1 = parseFloat(process.env.SIMILARITY_THRESHOLD || "0.70"); // ambang yakin cosine
const FT_T2  = parseFloat(process.env.FULLTEXT_MIN || "0.20");          // ambang min fulltext
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL   = process.env.OPENAI_MODEL   || "gpt-5";
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

// ======== Helpers DB ========
async function shortlistByFulltext(rawQuery, limit = 50) {
  const [rows] = await pool.query(
    `SELECT id, pertanyaan, jawaban,
            MATCH(pertanyaan, jawaban) AGAINST (? IN NATURAL LANGUAGE MODE) AS ft_score
     FROM faq
     ORDER BY ft_score DESC
     LIMIT ?`,
    [rawQuery, limit]
  );
  return rows || [];
}

async function shortlistByKategori(kategoriId) {
  const [rows] = await pool.query(
    `SELECT id, pertanyaan, jawaban
     FROM faq
     WHERE kategori_id = ?`,
    [kategoriId]
  );
  return rows || [];
}

// ======== Ranking Cosine (0..1) + Dedupe by id ========
async function rankWithCosine(rawQuery, candidates) {
  const { IDF, vocab, vecById } = getIndex();

  let qTokens = normalizeQueryTokens(preprocessToTokens(rawQuery));
  let qVec    = tfidfVector(termFreq(qTokens), IDF);

  const scoreOnce = () => {
    const raw = candidates.map(c => ({
      id: c.id,
      jawaban: c.jawaban,
      pertanyaan: c.pertanyaan,
      skor: cosineSim(qVec, vecById.get(c.id) || {}) || 0,
    }));
    const byId = new Map();
    for (const it of raw) {
      const prev = byId.get(it.id);
      if (!prev || it.skor > prev.skor) byId.set(it.id, it);
    }
    return [...byId.values()].sort((a, b) => b.skor - a.skor);
  };

  let scored = scoreOnce();

  if (!scored[0] || scored[0].skor < SIM_T1) {
    const fixed = jaroFixTokens(qTokens, Array.from(vocab));
    if (fixed.join(" ") !== qTokens.join(" ")) {
      qTokens = fixed;
      qVec    = tfidfVector(termFreq(qTokens), IDF);
      scored  = scoreOnce();
    }
  }

  const top3 = scored.slice(0, 3).map(x => ({
    id: x.id,
    skor: Number(x.skor || 0),
    pertanyaan: x.pertanyaan || "",
    jawaban: x.jawaban || "",
  }));

  return { scored, qTokens, top3 };
}

// ======== Synonym Normalizer ========
const SYNONYM_MAP = {
  "pustaka": "perpustakaan",
  "perpus": "perpustakaan",
  "elib": "e-book",
  "ebook": "e-book",
  "skripsi": "tugas akhir",
};

function normalizeQueryTokens(tokens) {
  return tokens.map(tok => SYNONYM_MAP[tok] || tok);
}

// ======== Enrich Query ========
function enrichQuery(query) {
  let q = (query || "").trim().toLowerCase();
  if (!q.includes("halo perpustakaan")) {
    q = `halo perpustakaan ${q}`;
  }
  return q;
}

// ======== Pipeline Jawaban ========
async function answerPipeline({ query, kategori_id }) {
  const qTokensNorm = normalizeQueryTokens(preprocessToTokens(query));
  const qNormString = qTokensNorm.join(" ");
  const qRaw = enrichQuery(qNormString);
  const qNorm = preprocessToString(qRaw);

  // 1) Ambil kandidat
  const candidates = kategori_id
    ? await shortlistByKategori(kategori_id)
    : await shortlistByFulltext(qRaw, 50);

  let top3 = [];
  let bestCosine = { skor: 0, id: null, jawaban: null };
  let source = "abstain_empty";
  let answer = null;
  let qTokensForLog = normalizeQueryTokens(preprocessToTokens(qRaw));

  if (candidates.length) {
    const { scored, qTokens, top3: t3 } = await rankWithCosine(qRaw, candidates);
    qTokensForLog = qTokens;
    top3 = t3;
    bestCosine = scored[0] || bestCosine;

    // Kalau yakin, pakai jawaban database
    if (bestCosine && bestCosine.skor >= SIM_T1 && bestCosine.jawaban) {
      answer = bestCosine.jawaban;
      source = "db";
    }
  }

  // 2) GPT Hybrid Mode (pakai konteks dari database)
  if ((!answer || bestCosine.skor < SIM_T1) && openai) {
    try {
      console.log("[DEBUG] GPT Hybrid Mode aktif");
      const context = top3.map((x, i) => `(${i+1}) Pertanyaan: ${x.pertanyaan}\nJawaban: ${x.jawaban}`).join("\n\n");

      const completion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          {
            role: "system",
            content: `
            Kamu adalah asisten pustakawan Universitas Negeri Padang (UNP) yang ramah, profesional, dan informatif.
            Gunakan konteks FAQ berikut untuk membantu menjawab pertanyaan pengguna secara akurat.
            Jika kamu tidak yakin, katakan dengan jujur bahwa kamu tidak tahu dan sarankan pengguna menghubungi pustakawan.

            Konteks FAQ:
            ${context}
            `.trim(),
          },
          { role: "user", content: `Pertanyaan pengguna: ${query}` },
        ],
        temperature: 0.2,
      });

      const txt = completion.choices?.[0]?.message?.content?.trim();
      if (txt) {
        answer = txt;
        source = "gpt_hybrid";
      }
    } catch (e) {
      console.error("[OpenAI] Hybrid Error:", e?.message || e);
    }
  }

  // 3) Adaptive bilingual fallback (punyamu)
  if (!answer && openai) {
    try {
      console.log("[DEBUG] Fallback → OpenAI adaptive bilingual mode");
      const completion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          {
            role: "system",
            content: `
            Kamu adalah asisten pustakawan Universitas Negeri Padang (UNP) yang ramah, profesional, dan informatif.
            Tugasmu menjawab pertanyaan seputar layanan, fasilitas, dan sistem di perpustakaan UNP.
            
            Jika pertanyaan pengguna di luar topik perpustakaan (misalnya tentang makanan, benda, cuaca, atau istilah umum),
            Jawablah secara netral dan informatif seperti asisten AI yang sopan — tetap singkat dan jelas (maksimal 80 kata).
            Hindari menjawab hal yang berpotensi salah atau sensitif.

            Aturan adaptif:
            - Jika pengguna menulis dalam Bahasa Indonesia : jawab dalam Bahasa Indonesia.
            - Jika pengguna menulis dalam Bahasa Inggris : jawab dalam Bahasa Inggris.
            - Jika campuran (bilingual) : jawab bilingual juga.
            - Sesuaikan gaya bahasa dengan pengguna:
            - Formal : gunakan bahasa formal.
            - Santai : gunakan bahasa santai tapi sopan.
            - Akademik : gunakan gaya akademik dan rapi.
            
            Nada jawaban: sopan, informatif, ramah, profesional.
            Jika kamu tidak yakin, katakan dengan jujur bahwa kamu tidak tahu dan sarankan pengguna untuk menghubungi pustakawan.
            `.trim(),
          },
          { role: "user", content: `Pertanyaan pengguna: ${query}\nKonteks tambahan: ${qRaw}` },
        ],
      });
      const txt = completion.choices?.[0]?.message?.content?.trim();
      if (txt) {
        answer = txt;
        source = "openai_fallback_adaptive";
      }
    } catch (e) {
      console.error("[OpenAI] Error:", e?.message || e);
      answer = fallbackSafe();
      source = "openai_error";
    }
  }

  // 4) Jika tetap tidak ada
  if (!answer) {
    answer = fallbackSafe();
    source = "fallbackSafe";
  }

  // ======== Logging ========
  const lines = ["[TOP-3 MATCH]"];
  for (const x of top3) {
    lines.push(
      `id=${x.id} | skor=${Number(x.skor || 0).toFixed(4)} | pertanyaan="${(x.pertanyaan || "").replace(/\s+/g, " ").trim()}"`
    );
  }
  lines.push(
    `[ASK] ${new Date().toISOString()} | source=${source} | best=${Number(bestCosine.skor || 0).toFixed(4)} | q="${qRaw}" | qNorm="${qTokensForLog.join(" ")}"`
  );
  console.log(lines.join("\n"));

  return {
    answer,
    best: bestCosine.id != null
      ? { id: bestCosine.id, skor: Number((bestCosine.skor || 0).toFixed(4)) }
      : null,
    qNorm: qTokensForLog.join(" "),
    source,
    debug: { top3 },
  };
}

// ======== Fallback teks aman ========
function fallbackSafe() {
  return "Maaf, aku merupakan chatbot yang membantu pertanyaan seputar layanan perpustakaan.";
}

module.exports = { answerPipeline };