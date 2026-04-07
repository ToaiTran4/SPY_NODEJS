const router = require('express').Router();
const auth = require('../middleware/auth');
const economyController = require('../controllers/economyController');

// GET /api/economy/balance
router.get('/balance', auth, economyController.getBalance);

// GET /api/economy/daily-checkin/status
router.get('/daily-checkin/status', auth, economyController.getCheckinStatus);

// POST /api/economy/daily-checkin
router.post('/daily-checkin', auth, economyController.dailyCheckin);

// POST /api/economy/relief
router.post('/relief', auth, economyController.applyRelief);

// GET /api/economy/leaderboard
router.get('/leaderboard', auth, economyController.getLeaderboard);

// GET /api/economy/transactions
router.get('/transactions', auth, economyController.getTransactions);

module.exports = router;


module.exports = router;
