const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();


const ADMIN_USER = process.env.ADMIN_USER || "administratorperpustakaan";
const ADMIN_PASS = process.env.ADMIN_PASS || "uptperpustakaan";
const JWT_SECRET = process.env.JWT_SECRET || "iniadminperpustakaan123";
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

console.log("[AUTH] Expecting user from env:", ADMIN_USER);

// Optional: beri respons informatif saat orang GET di browser
router.get("/login", (req, res) => {
  res.status(405).json({ message: "Use POST /api/login" });
});

router.post("/login", async (req, res) => {
  try {
    const username = (req.body?.username || "").trim();
    const password = (req.body?.password || "").trim();
    console.log("[AUTH] content-type:", req.headers["content-type"]);
    console.log("[AUTH] body has keys:", Object.keys(req.body || {}));

    if (!username || !password) {
      return res.status(400).json({ message: "username/password kosong" });
    }

    if (username !== ADMIN_USER || password !== ADMIN_PASS) {
      return res.status(401).json({ message: "Login gagal. Username atau password salah." });
    }

    const token = jwt.sign({ u: username, role: "admin" }, JWT_SECRET, { expiresIn: "8h" });
    return res.json({ token });
  } catch (e) {
    console.error("[AUTH] Login error:", e);
    res.status(500).json({ message: "Terjadi kesalahan" });
  }
});

module.exports = router;