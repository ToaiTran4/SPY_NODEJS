const gameService = require('../services/gameService');
const skillService = require('../services/skillService');
const User = require('../models/User');

const startGame = async (req, res) => {
  try {
    const session = await gameService.startGame(req.params.roomId, req.userId);
    res.json({ match_id: session.matchId, message: 'Game started' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const setAdminSpy = async (req, res) => {
  try {
    await gameService.setAdminSpy(req.params.roomId, req.userId, req.body.user_id);
    res.json({ message: 'Spy set successfully' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const getGameState = async (req, res) => {
  try {
    const state = gameService.getGameState(req.params.matchId, req.userId);
    res.json(state);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const submitDescription = async (req, res) => {
  try {
    const content = req.body.content;
    await gameService.submitDescription(req.params.matchId, req.userId, content);
    res.json({ submitted: true, word_count: content.trim().split(/\s+/).length });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const submitChat = async (req, res) => {
  try {
    await gameService.submitChat(req.params.matchId, req.userId, req.body.content);
    res.json({ submitted: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const submitVote = async (req, res) => {
  try {
    await gameService.submitVote(req.params.matchId, req.userId, req.body.target_user_id);
    res.json({ voted: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const submitRoleGuess = async (req, res) => {
  try {
    const result = await gameService.submitRoleGuess(req.params.matchId, req.userId, req.body.guessed_role);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const confirmSpyAbility = async (req, res) => {
  try {
    const result = await gameService.confirmSpyAbility(req.params.matchId, req.userId, req.body.ability_type);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const useFakeMessageAbility = async (req, res) => {
  try {
    const result = await gameService.useFakeMessageAbility(req.params.matchId, req.userId, req.body.content);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const infectPlayer = async (req, res) => {
  try {
    const result = await gameService.infectPlayer(req.params.matchId, req.userId, req.body.target_user_id);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const adjustRewards = async (req, res) => {
  try {
    gameService.adjustRewards(req.params.matchId, req.userId, req.body.civilian, req.body.spy, req.body.infected);
    res.json({ message: 'Rewards adjusted successfully' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const skipPhase = async (req, res) => {
  try {
    await gameService.skipPhase(req.params.matchId);
    res.json({ message: 'Phase skipped' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const useSpecialRoundSkill = async (req, res) => {
  try {
    const roomId = req.query.roomId;
    await skillService.useSkill(req.userId, 'SPECIAL_ROUND');
    gameService.enableSpecialRound(roomId, req.userId);
    res.json({ message: 'Đã kích hoạt Vòng Đặc Biệt', room_id: roomId });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const useAnonymousVoteSkill = async (req, res) => {
  try {
    const matchId = req.query.matchId;
    await skillService.useSkill(req.userId, 'ANONYMOUS_VOTE');
    gameService.enableAnonymousVoting(matchId, req.userId);
    res.json({ message: 'Đã kích hoạt Ẩn Danh Bỏ Phiếu cho vòng tiếp theo', match_id: matchId });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const getShopInventory = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const inventory = user.inventory || new Map();
    const result = [];
    inventory.forEach((quantity, skillId) => {
      result.push({
        skill_id: skillId,
        skill_type: skillId === 'SPECIAL_ROUND' ? 'ROOM' : 'MATCH',
        quantity: quantity,
      });
    });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const buySkill = async (req, res) => {
  try {
    const skillId = req.query.skillId || req.body.skillId;
    await skillService.buySkill(req.userId, skillId);
    res.json({ message: 'Mua kỹ năng thành công' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

module.exports = {
  startGame,
  setAdminSpy,
  getGameState,
  submitDescription,
  submitChat,
  submitVote,
  submitRoleGuess,
  confirmSpyAbility,
  useFakeMessageAbility,
  infectPlayer,
  adjustRewards,
  skipPhase,
  useSpecialRoundSkill,
  useAnonymousVoteSkill,
  getShopInventory,
  buySkill
};
