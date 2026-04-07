const router = require('express').Router();
const auth = require('../middleware/auth');
const matchController = require('../controllers/matchController');

// GET /api/matches/history
router.get('/history', auth, matchController.getHistory);

module.exports = router;


module.exports = router;
