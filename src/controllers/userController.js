const userService = require('../services/userService');
const UserStats = require('../models/UserStats');

const getMe = async (req, res) => {
  try {
    const user = await userService.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const stats = await UserStats.findOne({ userId: req.userId }) || {};
    
    res.json({
      user_id: user._id.toString(),
      username: user.username,
      display_name: user.displayName || '',
      avatar_url: user.avatarUrl || '',
      email: user.email,
      created_at: user.createdAt,
      balance: user.balance,
      ranking_points: user.rankingPoints || 0,
      stats: {
        total_games: stats.totalGames || 0,
        wins_civilian: stats.civilianWins || 0,
        wins_spy: stats.spyWins || 0,
        wins_infected: stats.infectedCount || 0,
        times_as_spy: stats.spyGames || 0,
        times_infected: stats.infectedCount || 0,
        correct_votes: 0, // Placeholder as it was not in my schema
      },
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const updateMe = async (req, res) => {
  try {
    const updates = {};
    if (req.body.display_name !== undefined) {
      if (!req.body.display_name || !req.body.display_name.trim()) {
        return res.status(400).json({ error: 'Display name cannot be empty' });
      }
      updates.displayName = req.body.display_name;
    }
    if (req.body.avatar_url !== undefined) {
      updates.avatarUrl = req.body.avatar_url;
    }
    const user = await userService.updateById(req.userId, updates);
    res.json({
      user_id: user._id.toString(),
      username: user.username,
      display_name: user.displayName || '',
      avatar_url: user.avatarUrl || '',
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const getStats = async (req, res) => {
  try {
    const stats = await UserStats.findOne({ userId: req.params.id });
    if (!stats) return res.status(404).json({ error: 'Stats not found' });
    res.json(stats);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

module.exports = {
  getMe,
  updateMe,
  getStats
};

