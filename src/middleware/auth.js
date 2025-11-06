const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'iniadminperpustakaan123';

// Ambil token dari header Authorization: "Bearer <JWT>"
function extractBearerToken(req) {
  const header = req.headers['authorization'] || req.headers['Authorization'];
  if (!header) return null;
  const parts = header.split(' ');
  if (parts.length !== 2) return null;
  const [scheme, token] = parts;
  if (!/^Bearer$/i.test(scheme)) return null;
  return token;
}

/**
 * Middleware: validasi JWT
 * - 401 jika token tidak ada / format salah
 * - 401/403 jika verifikasi gagal / expired
 * - req.user diisi payload JWT bila valid
 */
function authenticateToken(req, res, next) {
  // Lewatkan preflight CORS (kalau ada)
  if (req.method === 'OPTIONS') return next();

  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ message: 'Missing Authorization header (use: Bearer <token>)' });
  }

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) {
      // Token invalid atau expired
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    req.user = payload; // { role, username, iat, exp }
    next();
  });
}

module.exports = { authenticateToken };