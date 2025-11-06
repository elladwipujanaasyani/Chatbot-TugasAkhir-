// src/routes/logs.js
const express = require("express");
const pool = require("../../db");
const router = express.Router();

router.get("/log-pertanyaan", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT lp.id, 
              lp.pertanyaan_user,
              lp.skor_kemiripan,
              lp.waktu_ditanyakan,
              lp.faq_id,
              lp.source,
              f.pertanyaan AS faq_pertanyaan,
              f.jawaban AS faq_jawaban
       FROM log_pertanyaan lp
       LEFT JOIN faq f ON lp.faq_id = f.id
       ORDER BY lp.id DESC
       LIMIT 500`
    );

    res.json(rows);
  } catch (e) {
    console.error("[DB] Gagal mengambil log_pertanyaan:", e?.message || e);
    res.status(500).json({ message: "Gagal mengambil log_pertanyaan" });
  }
});

module.exports = router;