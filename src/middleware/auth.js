const jwtService = require('../services/jwtService');
const { isBlacklisted } = require('../services/tokenBlacklistService');
const { getDb } = require('../config/db');
const { ObjectId } = require('mongodb');

async function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.substring(7);

  if (isBlacklisted(token)) {
    return res.status(401).json({ error: 'Token has been invalidated' });
  }

  try {
    const decoded = jwtService.verifyToken(token);
    const db = getDb();
    const user = await db.collection('users').findOne({
      $or: [{ username: decoded.sub }, { email: decoded.sub }]
    });

    if (!user) return res.status(401).json({ error: 'User not found' });
    if (!user.active) return res.status(403).json({ error: 'Account is banned' });

    req.user = user;
    req.userId = user._id.toString();
    req.username = user.username || user.email;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = authMiddleware;
