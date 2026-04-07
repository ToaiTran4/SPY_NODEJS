const economyService = require('../services/economyService');
const userService = require('../services/userService');
const Transaction = require('../models/Transaction');

const getBalance = async (req, res) => {
  try {
    const user = await userService.findById(req.userId);
    res.json({
      balance: user.balance,
      ranking_points: user.rankingPoints || 0,
      rank_tier: economyService.calculateRankTier(user.rankingPoints || 0),
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const getCheckinStatus = async (req, res) => {
  try {
    const user = await userService.findById(req.userId);
    const alreadyCheckedIn = await economyService.hasCheckedInToday(req.userId);
    const today = new Date().toISOString().split('T')[0];
    const lastDate = user.lastCheckinDate instanceof Date
      ? user.lastCheckinDate.toISOString().split('T')[0]
      : (user.lastCheckinDate || null);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let currentStreak = user.checkinStreak || 0;
    let nextStreak = alreadyCheckedIn
      ? (currentStreak % 7) + 1
      : (currentStreak === 0 ? 1 : currentStreak);

    if (!alreadyCheckedIn && lastDate && lastDate !== yesterdayStr) {
      nextStreak = 1;
    }

    const rewards = [10, 10, 10, 10, 20, 20, 30];
    const displayStreak = alreadyCheckedIn ? currentStreak : nextStreak;
    res.json({
      can_checkin: !alreadyCheckedIn,
      streak: displayStreak,
      today_reward: rewards[Math.max(0, displayStreak - 1)],
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const dailyCheckin = async (req, res) => {
  try {
    const result = await economyService.dailyCheckin(req.userId);
    res.json({
      message: `Điểm danh thành công! +${result.amount} xu`,
      amount: result.amount,
      streak: result.streak,
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const applyRelief = async (req, res) => {
  try {
    await economyService.applyRelief(req.userId);
    res.json({ message: 'Nhận cứu trợ thành công! +50 xu' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const getLeaderboard = async (req, res) => {
  try {
    const type = req.query.type || 'balance';
    const result = await economyService.getLeaderboard(type);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const getTransactions = async (req, res) => {
  try {
    const transactions = await Transaction
      .find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(transactions);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};


module.exports = {
  getBalance,
  getCheckinStatus,
  dailyCheckin,
  applyRelief,
  getLeaderboard,
  getTransactions
};
