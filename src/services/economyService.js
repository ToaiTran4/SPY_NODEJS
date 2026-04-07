const { getDb } = require('../config/db');
const { ObjectId } = require('mongodb');

async function findById(id) {
  return getDb().collection('users').findOne({ _id: new ObjectId(id) });
}

async function updateBalance(userId, delta) {
  await getDb().collection('users').updateOne(
    { _id: new ObjectId(userId) },
    { $inc: { balance: delta }, $set: { updatedAt: new Date() } }
  );
}

async function logTransaction(userId, amount, type, description) {
  await getDb().collection('transactions').insertOne({
    userId,
    amount,
    type,
    description,
    createdAt: new Date(),
  });
}

async function deductEntryFee(userId, fee) {
  const user = await findById(userId);
  if (!user) throw new Error(`User not found: ${userId}`);
  if (user.balance < fee) throw new Error(`Insufficient balance for user: ${userId}`);
  await updateBalance(userId, -fee);
  if (fee > 0) await logTransaction(userId, -fee, 'BET', 'Phí vào cửa ván đấu');
}

async function addReward(userId, amount, type, description, addToRanking = false) {
  const updateFields = { balance: amount };
  if (addToRanking) updateFields.rankingPoints = amount;

  await getDb().collection('users').updateOne(
    { _id: new ObjectId(userId) },
    { $inc: updateFields, $set: { updatedAt: new Date() } }
  );
  await logTransaction(userId, amount, type, description);
}

async function deductBalance(userId, amount, type, description) {
  const user = await findById(userId);
  if (!user) throw new Error(`User not found: ${userId}`);
  if (user.balance < amount) throw new Error('Số dư không đủ');
  await updateBalance(userId, -amount);
  await logTransaction(userId, -amount, type, description);
}

async function applyRelief(userId) {
  const user = await findById(userId);
  if (!user) throw new Error(`User not found: ${userId}`);
  if (user.balance >= 10) throw new Error('User still has enough balance for relief');
  const reliefAmount = 50;
  await updateBalance(userId, reliefAmount);
  await logTransaction(userId, reliefAmount, 'RELIEF', 'Quà cứu trợ Bankruptcy Relief');
}

async function hasCheckedInToday(userId) {
  const user = await findById(userId);
  if (!user) return false;
  if (!user.lastCheckinDate) return false;
  const today = new Date().toISOString().split('T')[0];
  const lastDate = user.lastCheckinDate instanceof Date
    ? user.lastCheckinDate.toISOString().split('T')[0]
    : user.lastCheckinDate;
  return lastDate === today;
}

async function dailyCheckin(userId) {
  const user = await findById(userId);
  if (!user) throw new Error(`User not found: ${userId}`);

  const today = new Date().toISOString().split('T')[0];
  const lastDate = user.lastCheckinDate instanceof Date
    ? user.lastCheckinDate.toISOString().split('T')[0]
    : (user.lastCheckinDate || null);

  if (lastDate === today) throw new Error('Bạn đã điểm danh hôm nay rồi!');

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  let newStreak = 1;
  if (lastDate === yesterdayStr) {
    newStreak = ((user.checkinStreak || 0) % 7) + 1;
  }

  const rewards = [10, 10, 10, 10, 20, 20, 30];
  const checkinAmount = rewards[newStreak - 1];

  await getDb().collection('users').updateOne(
    { _id: new ObjectId(userId) },
    {
      $inc: { balance: checkinAmount },
      $set: { lastCheckinDate: new Date(), checkinStreak: newStreak, updatedAt: new Date() }
    }
  );

  await logTransaction(userId, checkinAmount, 'DAILY_CHECKIN', `Điểm danh hàng ngày (Ngày ${newStreak}) +${checkinAmount} xu`);

  return { amount: checkinAmount, streak: newStreak };
}

async function getLeaderboard(type) {
  const db = getDb();

  if (type === 'spy' || type === 'civilian') {
    const field = type === 'spy' ? 'winsSpy' : 'winsCivilian';
    const stats = await db.collection('user_stats').find({}).sort({ [field]: -1 }).limit(50).toArray();
    const result = [];
    for (const s of stats) {
      const u = await db.collection('users').findOne({ _id: new ObjectId(s.userId) });
      if (u) {
        result.push({
          username: u.username,
          display_name: u.displayName,
          avatar_url: u.avatarUrl,
          score: s[field],
        });
      }
    }
    return result;
  }

  // Default: balance
  const users = await db.collection('users').find({}).sort({ balance: -1 }).limit(50).toArray();
  return users.map(u => ({
    username: u.username,
    display_name: u.displayName,
    avatar_url: u.avatarUrl,
    score: u.balance,
  }));
}

function calculateRankTier(points) {
  if (points <= 1000) return 'Bronze';
  if (points <= 3000) return 'Silver';
  if (points <= 7000) return 'Gold';
  if (points <= 15000) return 'Platinum';
  return 'Diamond';
}

module.exports = {
  SPECIAL_ROOM_COST: 500,
  deductEntryFee,
  addReward,
  deductBalance,
  applyRelief,
  hasCheckedInToday,
  dailyCheckin,
  getLeaderboard,
  calculateRankTier,
};
