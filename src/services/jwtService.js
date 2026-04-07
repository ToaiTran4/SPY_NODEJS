const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'default_secret';
const ACCESS_EXPIRY_MS = parseInt(process.env.JWT_EXPIRATION || '3600000'); // 1h
const REFRESH_EXPIRY_MS = parseInt(process.env.JWT_REFRESH_EXPIRATION || '604800000'); // 7d

function generateAccessToken(user) {
  return jwt.sign(
    { sub: user.username || user.email, role: user.role, userId: user._id?.toString() || user.id },
    SECRET,
    { expiresIn: Math.floor(ACCESS_EXPIRY_MS / 1000) }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { sub: user.username || user.email, type: 'refresh' },
    SECRET,
    { expiresIn: Math.floor(REFRESH_EXPIRY_MS / 1000) }
  );
}

function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

function extractUsername(token) {
  try {
    const decoded = jwt.decode(token);
    return decoded?.sub || null;
  } catch {
    return null;
  }
}

function isTokenValid(token) {
  try {
    jwt.verify(token, SECRET);
    return true;
  } catch {
    return false;
  }
}

function getAccessTokenExpirationInSeconds() {
  return Math.floor(ACCESS_EXPIRY_MS / 1000);
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  extractUsername,
  isTokenValid,
  getAccessTokenExpirationInSeconds,
};
