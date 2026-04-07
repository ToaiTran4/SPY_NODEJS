const router = require('express').Router();
const auth = require('../middleware/auth');
const adminController = require('../controllers/adminController');

// GET /api/admin/users
router.get('/users', auth, adminController.getUsers);

// GET /api/admin/users/count
router.get('/users/count', auth, adminController.getUsersCount);

// PATCH /api/admin/users/:id/ban
router.patch('/users/:id/ban', auth, adminController.banUser);

// PATCH /api/admin/users/:id/role
router.patch('/users/:id/role', auth, adminController.updateUserRole);

// POST /api/admin/users/:id/reset-password
router.post('/users/:id/reset-password', auth, adminController.resetUserPassword);

// POST /api/admin/users/add-coins
router.post('/users/add-coins', auth, adminController.addCoins);

// GET /api/admin/rooms
router.get('/rooms', auth, adminController.getRooms);

// DELETE /api/admin/rooms/:id
router.delete('/rooms/:id', auth, adminController.deleteRoom);

// POST /api/admin/rooms/:id/add-player
router.post('/rooms/:id/add-player', auth, adminController.addPlayerToRoom);

// POST /api/admin/matches/:matchId/skip-phase
router.post('/matches/:matchId/skip-phase', auth, adminController.skipMatchPhase);

// POST /api/admin/ai-test
router.post('/ai-test', auth, adminController.testAi);

// GET /api/admin/stats
router.get('/stats', auth, adminController.getStats);

// GET /api/admin/keywords
router.get('/keywords', auth, adminController.getKeywords);

// POST /api/admin/keywords
router.post('/keywords', auth, adminController.addKeyword);

// DELETE /api/admin/keywords/:id
router.delete('/keywords/:id', auth, adminController.deleteKeyword);

// GET /api/admin/settings
router.get('/settings', auth, adminController.getSettings);

// PATCH /api/admin/settings
router.patch('/settings', auth, adminController.updateSettings);

module.exports = router;


module.exports = router;
