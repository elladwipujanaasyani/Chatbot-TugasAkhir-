"use strict";

const pool = require("../../db");
const { preprocessToTokens, termFreq, inverseDocFreq, tfidfVector } = require("./nlp");

const { embed } = require("./embeddings");

let faqRows = []; // {id, pertanyaan, jawaban}
let faqTokens = []; // tokens per faq (pertanyaan)
let faqTF = []; // TF per faq
let IDF = {}; // global IDF
let faqVec = []; // vektor tf-idf per faq (map token->weight)
let vocab = new Set(); // kosakata korpus (untuk typo-fix)
let vecById = new Map(); // cache id -> vector

let embById = new Map();

async function rebuildIndex(){
const [rows] = await pool.query("SELECT id, pertanyaan, jawaban FROM faq");
faqRows = rows.map(r => ({ id: r.id, pertanyaan: r.pertanyaan || "", jawaban: r.jawaban || "" }));
faqTokens = faqRows.map(r => preprocessToTokens(r.pertanyaan));
faqTF = faqTokens.map(termFreq);
IDF = inverseDocFreq(faqTokens);
faqVec = faqTF.map(tf => tfidfVector(tf, IDF));

vocab = new Set();
faqTokens.forEach(toks => toks.forEach(t => vocab.add(t)));

vecById = new Map();
faqRows.forEach((r, i) => vecById.set(r.id, faqVec[i] || {}));

console.log(`[TF-IDF] Index built for ${faqRows.length} FAQ (normalized)`);
}

// ===== NEW: Rebuild & simpan embeddings ke DB + (opsional) cache ke memori =====
async function rebuildEmbeddings({ cacheInMemory = true } = {}) {
  const [rows] = await pool.query("SELECT id, pertanyaan, jawaban FROM faq");

  let done = 0;
  for (const r of rows) {
    // gabungkan Q+A agar representasi makna lebih kaya
    const text = `${r.pertanyaan || ""} ${r.jawaban || ""}`.trim();
    const vec = await embed(text); // Float32Array (sudah dinormalisasi)

    // simpan ke DB (BLOB)
    await pool.query(
      "REPLACE INTO faq_embedding (faq_id, model, vec) VALUES (?, ?, ?)",
      [r.id, "Xenova/all-MiniLM-L6-v2", Buffer.from(vec.buffer)]
    );

    // (opsional) cache ke memori
    if (cacheInMemory) {
      embById.set(r.id, vec);
    }

    done++;
    if (done % 20 === 0) console.log(`[EMB] ${done}/${rows.length} done`);
  }

  console.log(`[EMB] Rebuilt ${rows.length} embeddings`);
}

function getIndex(){ return { faqRows, faqTokens, faqTF, IDF, faqVec, vocab, vecById, embById  }; }
function getIndexSize(){ return faqRows.length; }

module.exports = { rebuildIndex, rebuildEmbeddings, getIndex, getIndexSize };

if (require.main === module) {
  rebuildEmbeddings().catch(err => {
    console.error("Error rebuild embeddings:", err);
  });
}