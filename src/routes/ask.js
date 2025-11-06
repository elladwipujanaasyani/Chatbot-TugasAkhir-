// src/routes/ask.js
const express = require("express");
const pool = require("../../db");
const { answerPipeline } = require("../services/search");

const router = express.Router();

router.post("/ask", async (req, res) => {
  try {
    // --- Ambil & validasi input ---
    const rawQ = (req.body?.q || "").trim();
    const q = rawQ.length > 500 ? rawQ.slice(0, 500) : rawQ; // batasi panjang biar aman
    const kategori_id_raw = req.body?.kategori_id;
    const sourceHint = (req.body?.source || "web").toString(); // web/mobile/wa/dll

    const kategori_id =
      kategori_id_raw === null || kategori_id_raw === undefined || kategori_id_raw === ""
        ? null
        : Number.isFinite(Number(kategori_id_raw))
          ? Number(kategori_id_raw)
          : null;

    if (!q) {
      return res.json({ answer: "Silakan tulis pertanyaan Anda." });
    }

    // --- Jalankan pipeline utama (sudah mengurus TOP-3 & [ASK] logging di search.js) ---
    const { answer, best, qNorm, source } =
      await answerPipeline({ query: q, kategori_id, sourceHint });

    // --- Logging ke DB ---
    try {
      if (!best || typeof best.id === "undefined" || best.id === null) {
        await pool.query(
          `INSERT INTO log_pertanyaan
          (pertanyaan_user, skor_kemiripan, source, waktu_ditanyakan)
          VALUES (?,?,?, NOW())`,
          [q, null, sourceHint]
        );
      }
    } catch (e) {
      console.error("[DB] Gagal menulis log_pertanyaan:", e?.message || e);
    }

    // --- Response ke user ---
    return res.json({
      answer,
      score: Number(best?.skor || 0),
      matched_faq_id: best?.id ?? null,
      source, // asal jawaban yang dipakai: "db" | "fulltext" | "openai" | ...
      qNorm,  // front-end tampilkan norm query bila perlu
    });
  } catch (err) {
    console.error("[ASK] Error:", err?.message || err);
    return res.status(500).json({ answer: "Terjadi kesalahan di server." });
  }
});

module.exports = router;