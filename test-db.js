const db = require('./db');

async function testConnection() {
  try {
    const [rows] = await db.query('SELECT 1 + 1 AS result');
    console.log('✅ Koneksi berhasil. Hasil query:', rows[0].result);
  } catch (err) {
    console.error('❌ Gagal konek ke database:', err.message);
  }
}

testConnection();