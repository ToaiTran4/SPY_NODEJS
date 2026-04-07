const router = require('express').Router();
const auth = require('../middleware/auth');
const gameService = require('../services/gameService');

// POST /api/rooms/:roomId/start
router.post('/rooms/:roomId/start', auth, async (req, res) => {
  try {
    const session = await gameService.startGame(req.params.roomId, req.userId);
    res.json({ match_id: session.matchId, message: 'Game started' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/rooms/:roomId/admin/set-spy
router.post('/rooms/:roomId/admin/set-spy', auth, async (req, res) => {
  try {
    await gameService.setAdminSpy(req.params.roomId, req.userId, req.body.user_id);
    res.json({ message: 'Spy set successfully' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// GET /api/game/:matchId/state
router.get('/game/:matchId/state', auth, async (req, res) => {
  try {
    const state = gameService.getGameState(req.params.matchId, req.userId);
    res.json(state);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/game/:matchId/describe
router.post('/game/:matchId/describe', auth, async (req, res) => {
  try {
    const content = req.body.content;
    await gameService.submitDescription(req.params.matchId, req.userId, content);
    res.json({ submitted: true, word_count: content.trim().split(/\s+/).length });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/game/:matchId/chat
router.post('/game/:matchId/chat', auth, async (req, res) => {
  try {
    await gameService.submitChat(req.params.matchId, req.userId, req.body.content);
    res.json({ submitted: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/game/:matchId/vote
router.post('/game/:matchId/vote', auth, async (req, res) => {
  try {
    await gameService.submitVote(req.params.matchId, req.userId, req.body.target_user_id);
    res.json({ voted: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/game/:matchId/rolecheck
router.post('/game/:matchId/rolecheck', auth, async (req, res) => {
  try {
    const result = await gameService.submitRoleGuess(req.params.matchId, req.userId, req.body.guessed_role);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/game/:matchId/rolecheck/confirm-ability
router.post('/game/:matchId/rolecheck/confirm-ability', auth, async (req, res) => {
  try {
    console.log(`[ROUTE] POST /rolecheck/confirm-ability - matchId: ${req.params.matchId}, userId: ${req.userId}, body:`, req.body);
    const result = await gameService.confirmSpyAbility(req.params.matchId, req.userId, req.body.ability_type);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/game/:matchId/ability/fake-message
router.post('/game/:matchId/ability/fake-message', auth, async (req, res) => {
  try {
    const result = await gameService.useFakeMessageAbility(req.params.matchId, req.userId, req.body.content);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/game/:matchId/ability/infect
router.post('/game/:matchId/ability/infect', auth, async (req, res) => {
  try {
    const result = await gameService.infectPlayer(req.params.matchId, req.userId, req.body.target_user_id);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/game/:matchId/admin/adjust-rewards
router.post('/game/:matchId/admin/adjust-rewards', auth, async (req, res) => {
  try {
    gameService.adjustRewards(req.params.matchId, req.userId, req.body.civilian, req.body.spy, req.body.infected);
    res.json({ message: 'Rewards adjusted successfully' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/game/:matchId/skip-phase (admin)
router.post('/game/:matchId/skip-phase', auth, async (req, res) => {
  try {
    await gameService.skipPhase(req.params.matchId);
    res.json({ message: 'Phase skipped' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/skill/special-round
router.post('/skill/special-round', auth, async (req, res) => {
  try {
    const roomId = req.query.roomId;
    const skillService = require('../services/skillService');
    await skillService.useSkill(req.userId, 'SPECIAL_ROUND');
    gameService.enableSpecialRound(roomId, req.userId);
    res.json({ message: 'Đã kích hoạt Vòng Đặc Biệt', room_id: roomId });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/skill/anonymous-vote
router.post('/skill/anonymous-vote', auth, async (req, res) => {
  try {
    const matchId = req.query.matchId;
    const skillService = require('../services/skillService');
    await skillService.useSkill(req.userId, 'ANONYMOUS_VOTE');
    gameService.enableAnonymousVoting(matchId, req.userId);
    res.json({ message: 'Đã kích hoạt Ẩn Danh Bỏ Phiếu cho vòng tiếp theo', match_id: matchId });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// GET /api/shop/inventory
router.get('/shop/inventory', auth, async (req, res) => {
  try {
    const db = require('../config/db').getDb();
    const inv = await db.collection('user_inventory').find({ userId: req.userId }).toArray();
    res.json(inv.map(item => ({
      skill_id: item.skillId,
      skill_type: item.skillType,
      quantity: item.quantity || 1,
    })));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/shop/buy
router.post('/shop/buy', auth, async (req, res) => {
  try {
    const skillId = req.query.skillId || req.body.skillId;
    const skillService = require('../services/skillService');
    await skillService.buySkill(req.userId, skillId);
    res.json({ message: 'Mua kỹ năng thành công' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
