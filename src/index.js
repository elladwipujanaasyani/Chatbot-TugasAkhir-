"use strict";

const express = require("express");
const path = require("path");
const cors = require("cors");

const { authenticateToken } = require("./middleware/auth");
const authRoutes = require("./routes/auth"); // /api/login (PUBLIC)
const faqRoutes  = require("./routes/faq");  // /api/faq,... (PRIVATE)
const askRoutes  = require("./routes/ask");  // /api/ask (PUBLIC)
const logRoutes  = require("./routes/logs"); // /api/log-pertanyaan (PRIVATE)

const { rebuildIndex, getIndexSize } = require("./services/indexer");

const app  = express();
const PORT = parseInt(process.env.PORT || "9000", 10);

if (process.env.ENABLE_CORS === "1") app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "..", "public")));
app.use("/admin", express.static(path.join(__dirname, "..", "admin")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "dashboard.html"));
});

// ---- PUBLIC
app.use("/api", authRoutes);  // /api/login
app.use("/api", askRoutes);   // /api/ask

// ---- PRIVATE (JWT)
app.use("/api", authenticateToken, faqRoutes); // /api/faq, /api/reindex, /api/kategori
app.use("/api", authenticateToken, logRoutes); // /api/log-pertanyaan

// Health
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    faq_index_size: typeof getIndexSize === "function" ? getIndexSize() : undefined,
    threshold: process.env.SIMILARITY_THRESHOLD || "0.70",
  });
});

// JSON 404 untuk /api/*
app.use("/api", (req, res) => res.status(404).json({ message: "Not Found" }));

// Error handler
app.use((err, req, res, next) => {
  console.error("[ERROR]", err?.stack || err?.message || err);
  if (res.headersSent) return next(err);
  res.status(500).json({ message: "Internal Server Error" });
});

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`Chatbot NLP aktif di http://localhost:${PORT}`);
  try {
    if (typeof rebuildIndex === "function") {
      await rebuildIndex();
      console.log(`[TF-IDF] Index awal terbangun. Size: ${getIndexSize?.()}`);
    }
  } catch (e) {
    console.error("[TF-IDF] Gagal build index awal:", e?.message || e);
  }
});