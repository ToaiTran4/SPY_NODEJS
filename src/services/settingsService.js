const Settings = require('../models/Settings');

const DEFAULTS = {
  describeDuration: 60,
  discussDuration: 90,
  voteDuration: 30,
  roleCheckDuration: 30,
  roleCheckResultDuration: 15,
};

async function find() {
  return Settings.findOne({});
}

async function getOrDefault() {
  const s = await find();
  return s || { ...DEFAULTS };
}

async function save(settingsData) {
  let s = await find();
  if (s) {
    Object.assign(s, settingsData);
    await s.save();
  } else {
    s = await Settings.create({ ...DEFAULTS, ...settingsData });
  }
  return s;
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

