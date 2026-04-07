const User = require('../models/User');
const economyService = require('./economyService');

const SKILL_ANONYMOUS_VOTE = 'ANONYMOUS_VOTE';
const SKILL_SPECIAL_ROUND = 'SPECIAL_ROUND';
const PRICE_ANONYMOUS_VOTE = 200;
const PRICE_SPECIAL_ROUND = 500;

function getSkillPrice(skillId) {
  if (skillId === SKILL_ANONYMOUS_VOTE) return PRICE_ANONYMOUS_VOTE;
  if (skillId === SKILL_SPECIAL_ROUND) return PRICE_SPECIAL_ROUND;
  throw new Error('Invalid skill ID');
}

async function buySkill(userId, skillId) {
  const price = getSkillPrice(skillId);
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');
  if (user.balance < price) throw new Error('Insufficient balance');

  await economyService.deductBalance(userId, price, 'BUY_SKILL', `Mua kỹ năng: ${skillId}`);

  // Update inventory
  const currentQuantity = user.inventory.get(skillId) || 0;
  user.inventory.set(skillId, currentQuantity + 1);
  await user.save();
}

async function getInventory(userId) {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');
  return Object.fromEntries(user.inventory || new Map());
}

async function useSkill(userId, skillId) {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  const quantity = user.inventory.get(skillId) || 0;
  if (quantity <= 0) throw new Error('Skill not available in inventory');

  user.inventory.set(skillId, quantity - 1);
  await user.save();
}

module.exports = {
  SKILL_ANONYMOUS_VOTE,
  SKILL_SPECIAL_ROUND,
  PRICE_ANONYMOUS_VOTE,
  PRICE_SPECIAL_ROUND,
  buySkill,
  getInventory,
  useSkill,
};

