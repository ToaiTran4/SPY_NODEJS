const { getDb } = require('../config/db');
const { ObjectId } = require('mongodb');

const getHistory = async (req, res) => {
  try {
    const db = getDb();
    
    // Find last 20 match player entries for this user
    const playerEntries = await db.collection('match_players')
      .find({ userId: req.userId })
      .sort({ _id: -1 })
      .limit(20)
      .toArray();

    if (playerEntries.length === 0) {
      return res.json([]);
    }

    // Get the corresponding match metadata for these entries
    const matchIds = playerEntries.map(e => new ObjectId(e.matchId));
    const matches = await db.collection('matches')
      .find({ _id: { $in: matchIds } })
      .toArray();

    // Map matches for easy lookup
    const matchMap = {};
    matches.forEach(m => {
      matchMap[m._id.toString()] = m;
    });

    // Format for frontend
    const history = playerEntries.map(entry => {
      const match = matchMap[entry.matchId] || {};
      return {
        role: entry.role === 'spy' ? 'spy' : (entry.infected ? 'infected' : 'civilian'),
        did_win: entry.isWinner || false,
        status: entry.afk ? 'AFK' : (entry.isWinner ? 'WIN' : 'LOSE'),
        started_at: match.startedAt || new Date(),
        match_id: entry.matchId
      };
    });

    res.json(history);
  } catch (e) {
    console.error('[HISTORY-ERROR]', e.message);
    res.status(500).json({ error: 'Failed to fetch match history', message: e.message });
  }
};

module.exports = {
  getHistory
};
