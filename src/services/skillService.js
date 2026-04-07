const { getDb } = require('../config/db');
const { ObjectId } = require('mongodb');
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
  const db = getDb();
  const price = getSkillPrice(skillId);
  const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
  if (!user) throw new Error('User not found');
  if (user.balance < price) throw new Error('Insufficient balance');

  await economyService.deductBalance(userId, price, 'BUY_SKILL', `Mua kỹ năng: ${skillId}`);

  const inventoryKey = `inventory.${skillId}`;
  await db.collection('users').updateOne(
    { _id: new ObjectId(userId) },
    { $inc: { [inventoryKey]: 1 } }
  );
}

async function getInventory(userId) {
  const db = getDb();
  const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
  if (!user) throw new Error('User not found');
  return user.inventory || {};
}

async function useSkill(userId, skillId) {
  const db = getDb();
  const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
  if (!user) throw new Error('User not found');

  const inventory = user.inventory || {};
  const quantity = inventory[skillId] || 0;
  if (quantity <= 0) throw new Error('Skill not available in inventory');

  const inventoryKey = `inventory.${skillId}`;
  await db.collection('users').updateOne(
    { _id: new ObjectId(userId) },
    { $inc: { [inventoryKey]: -1 } }
  );
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
