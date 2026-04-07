const router = require('express').Router();
const auth = require('../middleware/auth');
const userController = require('../controllers/userController');

// GET /api/users/me
router.get('/me', auth, userController.getMe);

// PUT /api/users/me
router.put('/me', auth, userController.updateMe);

// GET /api/users/:id/stats (public stats)
router.get('/:id/stats', userController.getStats);

module.exports = router;


module.exports = router;
