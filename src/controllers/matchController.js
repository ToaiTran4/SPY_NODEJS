const Match = require('../models/Match');
const MatchPlayer = require('../models/MatchPlayer');

const getHistory = async (req, res) => {
  try {
    // Find last 20 match player entries for this user
    const playerEntries = await MatchPlayer
      .find({ userId: req.userId })
      .sort({ _id: -1 })
      .limit(20);

    if (playerEntries.length === 0) {
      return res.json([]);
    }

    // Get the corresponding match metadata for these entries
    const matchIds = playerEntries.map(e => e.matchId);
    const matches = await Match.find({ _id: { $in: matchIds } });

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

