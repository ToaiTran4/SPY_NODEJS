const bcrypt = require('bcryptjs');
const { getDb } = require('../config/db');
const { ObjectId } = require('mongodb');

async function findByUsername(username) {
  return getDb().collection('users').findOne({ username });
}

async function findByEmail(email) {
  return getDb().collection('users').findOne({ email });
}

async function findById(id) {
  return getDb().collection('users').findOne({ _id: new ObjectId(id) });
}

async function findByUsernameOrEmail(identifier) {
  return getDb().collection('users').findOne({
    $or: [{ username: identifier }, { email: identifier }]
  });
}

async function findAll() {
  return getDb().collection('users').find({}).toArray();
}

async function countUsers() {
  return getDb().collection('users').countDocuments();
}

async function registerUser(username, email, password, displayName, role = 'ROLE_USER') {
  const db = getDb();

  if (!email || !email.trim()) throw new Error('Email is required');
  if (!username || !username.trim()) throw new Error('Username is required');

  const existingUsername = await db.collection('users').findOne({ username });
  if (existingUsername) throw new Error('Username already exists');

  const existingEmail = await db.collection('users').findOne({ email });
  if (existingEmail) throw new Error('Email already exists');

  const passwordHash = await bcrypt.hash(password, 12);

  const user = {
    username,
    email,
    passwordHash,
    displayName: displayName || username,
    avatarUrl: null,
    role,
    balance: 100, // Starting balance
    rankingPoints: 0,
    resetToken: null,
    resetTokenExpiry: null,
    lastCheckinDate: null,
    checkinStreak: 0,
    inventory: {},
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await db.collection('users').insertOne(user);
  user._id = result.insertedId;

  // Create user stats
  await db.collection('user_stats').insertOne({
    userId: result.insertedId.toString(),
    totalGames: 0,
    winsSpy: 0,
    winsCivilian: 0,
    winsInfected: 0,
    timesAsSpy: 0,
    timesInfected: 0,
    correctVotes: 0,
    updatedAt: new Date(),
  });

  return user;
}

async function saveUser(user) {
  const db = getDb();
  const { _id, ...update } = user;
  update.updatedAt = new Date();
  await db.collection('users').updateOne({ _id: new ObjectId(_id.toString()) }, { $set: update });
  return user;
}

async function updateById(id, fields) {
  const db = getDb();
  fields.updatedAt = new Date();
  await db.collection('users').updateOne({ _id: new ObjectId(id) }, { $set: fields });
  return findById(id);
}

async function generateResetToken(user) {
  const token = String(Math.floor(Math.random() * 999999)).padStart(6, '0');
  const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 min
  await getDb().collection('users').updateOne(
    { _id: user._id },
    { $set: { resetToken: token, resetTokenExpiry: expiry } }
  );
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
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await getDb().collection('users').updateOne(
    { _id: user._id },
    { $set: { passwordHash, resetToken: null, resetTokenExpiry: null, updatedAt: new Date() } }
  );
  return true;
}

async function changePassword(username, oldPassword, newPassword) {
  const user = await findByUsername(username);
  if (!user) throw new Error('User not found');
  const match = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!match) return false;
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await getDb().collection('users').updateOne(
    { _id: user._id },
    { $set: { passwordHash, updatedAt: new Date() } }
  );
  return true;
}

async function updateActiveStatus(id, active) {
  return updateById(id, { active });
}

async function resetPassword(id, newPassword) {
  const passwordHash = await bcrypt.hash(newPassword, 12);
  return updateById(id, { passwordHash });
}

async function updateRole(id, role) {
  return updateById(id, { role });
}

async function validatePassword(user, password) {
  return bcrypt.compare(password, user.passwordHash);
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
