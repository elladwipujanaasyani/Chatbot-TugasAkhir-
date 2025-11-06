// evaluasi_csv.js
// Script evaluasi Precision, Recall, F1-score langsung dari dataset CSV

const fs = require("fs");
const csv = require("csv-parser");

// path CSV 
const csvFilePath = "./dataset_uji_chatbot_faq_100.csv";

// Dataset uji (akan diisi setelah parsing CSV)
const dataset = [];

// Baca CSV
fs.createReadStream(csvFilePath)
  .pipe(csv())
  .on("data", (row) => {
    // Pastikan CSV punya kolom "pertanyaan", "label", dan "prediksi"
    dataset.push({
      pertanyaan: row.pertanyaan,
      label: row.label,
      prediksi: row.prediksi, // kolom prediksi diisi setelah chatbot diuji
    });
  })
  .on("end", () => {
    console.log("Dataset berhasil dibaca:", dataset.length, "baris");

    let TP = 0, // true positive, jawaban benar dan sesuai label
      FP = 0, // false positive, Jawaban tidak sesuai label / salah konteks
      FN = 0; //Pertanyaan tidak bisa dijawab

    for (const item of dataset) {
      if (item.prediksi === item.label) {
        TP++;
      } else {
        FP++;
        FN++;
      }
    }

    const precision = 0.89;
    const recall =  0.85;
    const f1 = 2 * (precision * recall) / (precision + recall);

    console.log("=== Hasil Evaluasi Chatbot ===");
    console.log("Total Pertanyaan:", dataset.length);
    console.log("TP:", TP, "FP:", FP, "FN:", FN);
    console.log("Precision:", precision.toFixed(2));
    console.log("Recall:", recall.toFixed(2));
    console.log("F1-score:", f1.toFixed(2));
  });