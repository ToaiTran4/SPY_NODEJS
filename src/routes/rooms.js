const router = require('express').Router();
const auth = require('../middleware/auth');
const roomController = require('../controllers/roomController');

// POST /api/rooms — create room
router.post('/', auth, roomController.createRoom);

// POST /api/rooms/create-special
router.post('/create-special', auth, roomController.createSpecialRoom);

// GET /api/rooms — public waiting rooms
router.get('/', auth, roomController.getPublicRooms);

// GET /api/rooms/code/:roomCode
router.get('/code/:roomCode', auth, roomController.getRoomByCode);

// GET /api/rooms/:roomId
router.get('/:roomId', auth, roomController.getRoomById);

// POST /api/rooms/:roomCode/join
router.post('/:roomCode/join', auth, roomController.joinRoom);

// POST /api/rooms/:roomId/leave
router.post('/:roomId/leave', auth, roomController.leaveRoom);

// POST /api/rooms/:roomId/kick
router.post('/:roomId/kick', auth, roomController.kickPlayer);

// POST /api/rooms/:roomId/transfer-host
router.post('/:roomId/transfer-host', auth, roomController.transferHost);

// GET /api/rooms/:roomId/players
router.get('/:roomId/players', auth, roomController.getPlayers);

module.exports = router;
