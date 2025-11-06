require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'chatbot_perpus_versi_dua', 
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306
});

module.exports = pool;

(async () => {
  let conn;
  try {
    conn = await pool.getConnection();
    console.log('Koneksi ke database berhasil!');
  } catch (err) {
    console.error('Gagal koneksi ke database:', err);
  } finally {
    if (conn) conn.release();
  }
})();