const router = require('express').Router();
const auth = require('../middleware/auth');
const gameController = require('../controllers/gameController');

// POST /api/rooms/:roomId/start
router.post('/rooms/:roomId/start', auth, gameController.startGame);

// POST /api/rooms/:roomId/admin/set-spy
router.post('/rooms/:roomId/admin/set-spy', auth, gameController.setAdminSpy);

// GET /api/game/:matchId/state
router.get('/game/:matchId/state', auth, gameController.getGameState);

// POST /api/game/:matchId/describe
router.post('/game/:matchId/describe', auth, gameController.submitDescription);

// POST /api/game/:matchId/chat
router.post('/game/:matchId/chat', auth, gameController.submitChat);

// POST /api/game/:matchId/vote
router.post('/game/:matchId/vote', auth, gameController.submitVote);

// POST /api/game/:matchId/rolecheck
router.post('/game/:matchId/rolecheck', auth, gameController.submitRoleGuess);

// POST /api/game/:matchId/rolecheck/confirm-ability
router.post('/game/:matchId/rolecheck/confirm-ability', auth, gameController.confirmSpyAbility);

// POST /api/game/:matchId/ability/fake-message
router.post('/game/:matchId/ability/fake-message', auth, gameController.useFakeMessageAbility);

// POST /api/game/:matchId/ability/infect
router.post('/game/:matchId/ability/infect', auth, gameController.infectPlayer);

// POST /api/game/:matchId/admin/adjust-rewards
router.post('/game/:matchId/admin/adjust-rewards', auth, gameController.adjustRewards);

// POST /api/game/:matchId/skip-phase (admin)
router.post('/game/:matchId/skip-phase', auth, gameController.skipPhase);

// POST /api/skill/special-round
router.post('/skill/special-round', auth, gameController.useSpecialRoundSkill);

// POST /api/skill/anonymous-vote
router.post('/skill/anonymous-vote', auth, gameController.useAnonymousVoteSkill);

// GET /api/shop/inventory
router.get('/shop/inventory', auth, gameController.getShopInventory);

// POST /api/shop/buy
router.post('/shop/buy', auth, gameController.buySkill);

module.exports = router;


module.exports = router;
