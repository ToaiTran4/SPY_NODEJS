const { getDb } = require('../config/db');

const DEFAULTS = {
  describeDuration: 300,
  discussDuration: 300,
  voteDuration: 300,
  roleCheckDuration: 300,
  roleCheckResultDuration: 10,
};

async function find() {
  return getDb().collection('game_settings').findOne({});
}

async function getOrDefault() {
  const s = await find();
  return s ? { ...DEFAULTS, ...s } : { ...DEFAULTS };
}

async function save(settings) {
  const db = getDb();
  const existing = await db.collection('game_settings').findOne({});
  if (existing) {
    await db.collection('game_settings').updateOne({}, { $set: { ...settings, updatedAt: new Date() } });
  } else {
    await db.collection('game_settings').insertOne({ ...DEFAULTS, ...settings, updatedAt: new Date() });
  }
  return getOrDefault();
}

async function getDescribeDuration() {
  const s = await find();
  return (s && s.describeDuration) || DEFAULTS.describeDuration;
}

async function getDiscussDuration() {
  const s = await find();
  return (s && s.discussDuration) || DEFAULTS.discussDuration;
}

async function getVoteDuration() {
  const s = await find();
  return (s && s.voteDuration) || DEFAULTS.voteDuration;
}

async function getRoleCheckDuration() {
  const s = await find();
  return (s && s.roleCheckDuration) || DEFAULTS.roleCheckDuration;
}

async function getRoleCheckResultDuration() {
  const s = await find();
  return (s && s.roleCheckResultDuration) || DEFAULTS.roleCheckResultDuration;
}

module.exports = {
  DEFAULTS,
  find,
  getOrDefault,
  save,
  getDescribeDuration,
  getDiscussDuration,
  getVoteDuration,
  getRoleCheckDuration,
  getRoleCheckResultDuration,
};
