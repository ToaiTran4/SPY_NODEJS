const mongoose = require('mongoose');

const matchPlayerSchema = new mongoose.Schema({
  matchId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  username: { type: String },
  displayName: { type: String },
  color: { type: String },
  role: { type: String },
  isAlive: { type: Boolean, default: true },
  eliminatedRound: { type: Number },
  isWinner: { type: Boolean, default: false },
  infected: { type: Boolean, default: false },
  afk: { type: Boolean, default: false },
  scoreGained: { type: Number, default: 0 },
}, { collection: 'match_players', timestamps: true });

const MatchPlayer = mongoose.model('MatchPlayer', matchPlayerSchema);

module.exports = MatchPlayer;
