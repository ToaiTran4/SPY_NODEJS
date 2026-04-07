const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  describeDuration: { type: Number, default: 60 },
  discussDuration: { type: Number, default: 90 },
  voteDuration: { type: Number, default: 30 },
  roleCheckDuration: { type: Number, default: 30 },
  roleCheckResultDuration: { type: Number, default: 15 },
}, { collection: 'game_settings', timestamps: true });

const Settings = mongoose.model('Settings', settingsSchema);

module.exports = Settings;
