const router = require('express').Router();
const auth = require('../middleware/auth');
const economyService = require('../services/economyService');
const userService = require('../services/userService');
const { getDb } = require('../config/db');

// GET /api/economy/balance
router.get('/balance', auth, async (req, res) => {
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
});

// GET /api/economy/daily-checkin/status
router.get('/daily-checkin/status', auth, async (req, res) => {
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
});

// POST /api/economy/daily-checkin
router.post('/daily-checkin', auth, async (req, res) => {
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
});

// POST /api/economy/relief
router.post('/relief', auth, async (req, res) => {
  try {
    await economyService.applyRelief(req.userId);
    res.json({ message: 'Nhận cứu trợ thành công! +50 xu' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// GET /api/economy/leaderboard
router.get('/leaderboard', auth, async (req, res) => {
  try {
    const type = req.query.type || 'balance';
    const result = await economyService.getLeaderboard(type);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// GET /api/economy/transactions
router.get('/transactions', auth, async (req, res) => {
  try {
    const db = getDb();
    const transactions = await db.collection('transactions')
      .find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
    res.json(transactions);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
