const userService = require('../services/userService');
const roomService = require('../services/roomService');
const keywordService = require('../services/keywordService');
const economyService = require('../services/economyService');
const gameService = require('../services/gameService');
const settingsService = require('../services/settingsService');
const aiService = require('../services/aiService');
const Match = require('../models/Match');

const getUsers = async (req, res) => {
  res.json(await userService.findAll());
};

const getUsersCount = async (req, res) => {
  res.json(await userService.countUsers());
};

const banUser = async (req, res) => {
  try {
    const active = req.body.active !== undefined ? Boolean(req.body.active) : true;
    res.json(await userService.updateActiveStatus(req.params.id, active));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const updateUserRole = async (req, res) => {
  try {
    const role = req.body.role;
    if (!role) return res.status(400).json({ error: 'role required' });
    res.json(await userService.updateRole(req.params.id, role.toUpperCase().startsWith('ROLE_') ? role : `ROLE_${role.toUpperCase()}`));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const resetUserPassword = async (req, res) => {
  try {
    const newPassword = req.body.new_password;
    if (!newPassword) return res.status(400).json({ error: 'New password is required' });
    await userService.resetPassword(req.params.id, newPassword);
    res.json({ message: 'Password reset successfully' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const addCoins = async (req, res) => {
  try {
    const { identifier, amount } = req.body;
    if (!identifier || amount == null) return res.status(400).json({ error: 'identifier and amount required' });
    const user = await userService.findByUsernameOrEmail(identifier);
    if (!user) throw new Error(`User not found: ${identifier}`);
    await economyService.addReward(user._id.toString(), amount, 'ADMIN_ADD', 'Admin tặng xu (Test)', false);
    const updated = await userService.findById(user._id.toString());
    res.json({ message: `Added ${amount} coins to ${identifier}`, new_balance: updated.balance });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const getRooms = async (req, res) => {
  res.json(await roomService.findAllRooms());
};

const deleteRoom = async (req, res) => {
  try {
    await roomService.deleteRoom(req.params.id);
    res.json({ message: 'Room ended/deleted successfully' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const addPlayerToRoom = async (req, res) => {
  try {
    const identifier = req.body.identifier;
    if (!identifier) return res.status(400).json({ error: 'identifier required' });
    const room = await roomService.addPlayerAdmin(req.params.id, identifier);
    res.json(room);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const skipMatchPhase = async (req, res) => {
  try {
    await gameService.skipPhase(req.params.matchId);
    res.json({ message: 'Phase skipped successfully' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const testAi = async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });
    const response = await aiService.askAi(prompt);
    res.json({ status: 'success', prompt, response });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const getStats = async (req, res) => {
  try {
    res.json({
      total_users: await userService.countUsers(),
      active_rooms: await roomService.countActiveRooms(),
      total_matches: await Match.countDocuments(),
      total_keywords: await keywordService.countKeywords(),
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};


const getKeywords = async (req, res) => {
  res.json(await keywordService.getAllKeywords());
};

const addKeyword = async (req, res) => {
  try {
    const kw = await keywordService.addKeyword(req.body);
    res.json(kw);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const deleteKeyword = async (req, res) => {
  try {
    await keywordService.deleteKeyword(req.params.id);
    res.status(204).send();
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const getSettings = async (req, res) => {
  res.json(await settingsService.getOrDefault());
};

const updateSettings = async (req, res) => {
  try {
    const current = await settingsService.getOrDefault();
    const fields = ['describe_duration', 'discuss_duration', 'vote_duration', 'role_check_duration', 'role_check_result_duration'];
    const keys = ['describeDuration', 'discussDuration', 'voteDuration', 'roleCheckDuration', 'roleCheckResultDuration'];
    fields.forEach((f, i) => {
      if (req.body[f] != null) current[keys[i]] = Number(req.body[f]);
    });
    res.json(await settingsService.save(current));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

module.exports = {
  getUsers,
  getUsersCount,
  banUser,
  updateUserRole,
  resetUserPassword,
  addCoins,
  getRooms,
  deleteRoom,
  addPlayerToRoom,
  skipMatchPhase,
  testAi,
  getStats,
  getKeywords,
  addKeyword,
  deleteKeyword,
  getSettings,
  updateSettings
};
