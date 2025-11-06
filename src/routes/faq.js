const express = require("express");
const pool = require("../../db");
const { authenticateToken } = require("../middleware/auth");
const { rebuildIndex } = require("../services/indexer");

const router = express.Router();

router.get("/faq", authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM faq ORDER BY id ASC");
        res.json(rows);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Gagal mengambil FAQ" });
    }
});

router.post("/faq", authenticateToken, async (req, res) => {
    try {
        const { pertanyaan, jawaban, kategori_id } = req.body || {};
        if (!pertanyaan || !jawaban) return res.status(400).json({ message: "pertanyaan & jawaban wajib" });
        await pool.query("INSERT INTO faq (pertanyaan, jawaban, kategori_id) VALUES (?,?,?)", [pertanyaan, jawaban, kategori_id ?? null]);
        await rebuildIndex();
        res.json({ message: "FAQ ditambahkan" });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Gagal menambah FAQ" });
    }
});

router.put("/faq/:id", authenticateToken, async (req, res) => {
    try {
        const { pertanyaan, jawaban, kategori_id } = req.body || {};
        await pool.query(
            "UPDATE faq SET pertanyaan=COALESCE(?, pertanyaan), jawaban=COALESCE(?, jawaban), kategori_id=COALESCE(?, kategori_id) WHERE id=?",
            [pertanyaan ?? null, jawaban ?? null, kategori_id ?? null, req.params.id]
        );
        await rebuildIndex();
        res.json({ message: "FAQ diupdate" });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Gagal update FAQ" });
    }
});

router.delete("/faq/:id", authenticateToken, async (req, res) => {
    try {
        await pool.query("DELETE FROM faq WHERE id=?", [req.params.id]);
        await rebuildIndex();
        res.json({ message: "FAQ dihapus" });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Gagal hapus FAQ" });
    }
});


router.post("/reindex", authenticateToken, async (req, res) => {
    try { await rebuildIndex(); res.json({ message: "Reindex OK" }); }
    catch (e) { console.error(e); res.status(500).json({ message: "Reindex gagal" }); }
});

module.exports = router;