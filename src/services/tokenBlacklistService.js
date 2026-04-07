// In-memory blacklist (server-side only — resets on restart)
// For production, use Redis or persist to MongoDB
const blacklist = new Set();

function blacklistToken(token) {
  blacklist.add(token);
}

function isBlacklisted(token) {
  return blacklist.has(token);
}

module.exports = { blacklistToken, isBlacklisted };
