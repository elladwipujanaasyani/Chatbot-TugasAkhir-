// uji_waktu_respon.js
const fetch = require("node-fetch");
const fs = require("fs");
const csv = require("csv-parser");

const API_URL = "http://localhost:9000/api/ask";
const PERTANYAAN_FILE = "./dataset_uji_chatbot_faq_100.csv"; // nama file csv
const pertanyaanList = [];

console.log("Mulai uji waktu respon untuk 101 pertanyaan...");

// Baca file CSV berisi daftar pertanyaan
fs.createReadStream(PERTANYAAN_FILE)
  .pipe(csv({ separator: ';' }))
  .on("data", (row) => {
    // pastikan kolomnya sesuai dengan nama kolom di CSV kamu
    if (row.test_question) pertanyaanList.push(row.test_question);
  })
  .on("end", async () => {
    if (pertanyaanList.length === 0) {
      console.error(" Tidak ada data pertanyaan yang terbaca dari file CSV!");
      return;
    }

    let totalWaktu = 0;

    for (let i = 0; i < 101; i++) {
      const test_question = pertanyaanList[i % pertanyaanList.length];

      const start = performance.now();
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test_question }),
      });

      await response.json().catch(() => ({}));
      const end = performance.now();

      const waktu = Math.round(end - start);
      totalWaktu += waktu;
      console.log(`${i + 1}. Pertanyaan: "${test_question}" → Waktu respon: ${waktu} ms`);
    }

    const rata = (totalWaktu / 101).toFixed(2);
    console.log(`\n=== HASIL AKHIR ===`);
    console.log(`Total pertanyaan: 101`);
    console.log(`Rata-rata waktu respon: ${rata} ms`);
  });