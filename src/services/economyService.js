const User = require('../models/User');
const Transaction = require('../models/Transaction');
const UserStats = require('../models/UserStats');

/**
 * Lấy chuỗi ngày YYYY-MM-DD theo múi giờ Việt Nam (GMT+7)
 */
function getVietnameseDateString(date = new Date()) {
  const vnTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return vnTime.toISOString().split('T')[0];
}

async function updateBalance(userId, delta) {
  return User.findByIdAndUpdate(userId, { $inc: { balance: delta } }, { new: true });
}

async function logTransaction(userId, amount, type, description) {
  return Transaction.create({
    userId,
    amount,
    type,
    description,
  });
}

async function deductEntryFee(userId, fee) {
  const user = await User.findById(userId);
  if (!user) throw new Error(`User not found: ${userId}`);
  if (user.balance < fee) throw new Error(`Insufficient balance for user: ${userId}`);
  
  await updateBalance(userId, -fee);
  if (fee > 0) await logTransaction(userId, -fee, 'BET', 'Phí vào cửa ván đấu');
}

async function addReward(userId, amount, type, description, addToRanking = false) {
  const updateFields = { balance: amount };
  if (addToRanking) updateFields.rankingPoints = amount;

  await User.findByIdAndUpdate(userId, { $inc: updateFields });
  await logTransaction(userId, amount, type, description);
}

async function deductBalance(userId, amount, type, description) {
  const user = await User.findById(userId);
  if (!user) throw new Error(`User not found: ${userId}`);
  if (user.balance < amount) throw new Error('Số dư không đủ');
  
  await updateBalance(userId, -amount);
  await logTransaction(userId, -amount, type, description);
}

async function applyRelief(userId) {
  const user = await User.findById(userId);
  if (!user) throw new Error(`User not found: ${userId}`);
  if (user.balance >= 10) throw new Error('User still has enough balance for relief');
  
  const reliefAmount = 50;
  await updateBalance(userId, reliefAmount);
  await logTransaction(userId, reliefAmount, 'RELIEF', 'Quà cứu trợ Bankruptcy Relief');
}

async function hasCheckedInToday(userId) {
  const user = await User.findById(userId);
  if (!user || !user.lastCheckinDate) return false;
  
  const todayStr = getVietnameseDateString();
  const lastDateStr = getVietnameseDateString(user.lastCheckinDate);
  return lastDateStr === todayStr;
}

async function dailyCheckin(userId) {
  const user = await User.findById(userId);
  if (!user) throw new Error(`User not found: ${userId}`);

  const todayStr = getVietnameseDateString();
  const lastDateStr = user.lastCheckinDate 
    ? getVietnameseDateString(user.lastCheckinDate)
    : null;

  if (lastDateStr === todayStr) throw new Error('Bạn đã điểm danh hôm nay rồi!');

  // Tính ngày hôm qua (GMT+7)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getVietnameseDateString(yesterday);

  let newStreak = 1;
  if (lastDateStr === yesterdayStr) {
    newStreak = ((user.checkinStreak || 0) % 7) + 1;
  }

  const rewards = [10, 10, 10, 10, 20, 20, 30];
  const checkinAmount = rewards[newStreak - 1];

  user.balance += checkinAmount;
  user.lastCheckinDate = new Date();
  user.checkinStreak = newStreak;
  await user.save();

  await logTransaction(userId, checkinAmount, 'DAILY_CHECKIN', `Điểm danh hàng ngày (Ngày ${newStreak}) +${checkinAmount} xu`);

  return { amount: checkinAmount, streak: newStreak };
}

async function getLeaderboard(type) {
  if (type === 'spy' || type === 'civilian') {
    const field = type === 'spy' ? 'spyWins' : 'civilianWins';
    const stats = await UserStats.find({}).sort({ [field]: -1 }).limit(50);
    
    const result = [];
    for (const s of stats) {
      const u = await User.findById(s.userId);
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
  const users = await User.find({}).sort({ balance: -1 }).limit(50);
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

