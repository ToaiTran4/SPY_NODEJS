const bcrypt = require('bcryptjs');
const User = require('../models/User');
const UserStats = require('../models/UserStats');

async function findByUsername(username) {
  return User.findOne({ username });
}

async function findByEmail(email) {
  return User.findOne({ email });
}

async function findById(id) {
  return User.findById(id);
}

async function findByUsernameOrEmail(identifier) {
  return User.findOne({
    $or: [{ username: identifier }, { email: identifier }]
  });
}

async function findAll() {
  return User.find({});
}

async function countUsers() {
  return User.countDocuments();
}

async function registerUser(username, email, password, displayName, role = 'ROLE_USER') {
  if (!email || !email.trim()) throw new Error('Email is required');
  if (!username || !username.trim()) throw new Error('Username is required');

  const existingUsername = await User.findOne({ username });
  if (existingUsername) throw new Error('Username already exists');

  const existingEmail = await User.findOne({ email });
  if (existingEmail) throw new Error('Email already exists');

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = new User({
    username,
    email,
    password: hashedPassword,
    displayName: displayName || username,
    role,
    balance: 100, // Starting balance
    rankingPoints: 0,
    active: true,
  });

  await user.save();

  // Create user stats
  await UserStats.create({
    userId: user._id.toString(),
    totalGames: 0,
    gamesWon: 0,
    spyGames: 0,
    spyWins: 0,
    civilianGames: 0,
    civilianWins: 0,
    infectedCount: 0,
    afkCount: 0,
  });

  return user;
}

async function saveUser(user) {
  if (user instanceof User) {
    return user.save();
  }
  // If it's a plain object, we need to find and update
  const { _id, ...updateData } = user;
  return User.findByIdAndUpdate(_id, updateData, { new: true });
}

async function updateById(id, fields) {
  return User.findByIdAndUpdate(id, { $set: fields }, { new: true });
}

async function generateResetToken(user) {
  const token = String(Math.floor(Math.random() * 999999)).padStart(6, '0');
  const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 min
  
  if (user instanceof User) {
    user.resetToken = token;
    user.resetTokenExpiry = expiry;
    await user.save();
  } else {
    await User.findByIdAndUpdate(user._id, { $set: { resetToken: token, resetTokenExpiry: expiry } });
  }
  return token;
}

async function verifyResetToken(email, token) {
  const user = await findByEmail(email);
  if (!user) return false;
  return (
    user.resetToken === token &&
    user.resetTokenExpiry &&
    user.resetTokenExpiry > new Date()
  );
}

async function processPasswordReset(email, token, newPassword) {
  const user = await findByEmail(email);
  if (!user) return false;
  if (user.resetToken !== token || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
    return false;
  }
  const hashedPassword = await bcrypt.hash(newPassword, 12);
  user.password = hashedPassword;
  user.resetToken = null;
  user.resetTokenExpiry = null;
  await user.save();
  return true;
}

async function changePassword(username, oldPassword, newPassword) {
  const user = await findByUsername(username);
  if (!user) throw new Error('User not found');
  const match = await bcrypt.compare(oldPassword, user.password);
  if (!match) return false;
  const hashedPassword = await bcrypt.hash(newPassword, 12);
  user.password = hashedPassword;
  await user.save();
  return true;
}

async function updateActiveStatus(id, active) {
  return updateById(id, { active });
}

async function resetPassword(id, newPassword) {
  const hashedPassword = await bcrypt.hash(newPassword, 12);
  return updateById(id, { password: hashedPassword });
}

async function updateRole(id, role) {
  return updateById(id, { role });
}

async function validatePassword(user, password) {
  return bcrypt.compare(password, user.password);
}

module.exports = {
  findByUsername,
  findByEmail,
  findById,
  findByUsernameOrEmail,
  findAll,
  countUsers,
  registerUser,
  saveUser,
  updateById,
  generateResetToken,
  verifyResetToken,
  processPasswordReset,
  changePassword,
  updateActiveStatus,
  resetPassword,
  updateRole,
  validatePassword,
};


module.exports = {
  findByUsername,
  findByEmail,
  findById,
  findByUsernameOrEmail,
  findAll,
  countUsers,
  registerUser,
  saveUser,
  updateById,
  generateResetToken,
  verifyResetToken,
  processPasswordReset,
  changePassword,
  updateActiveStatus,
  resetPassword,
  updateRole,
  validatePassword,
};
