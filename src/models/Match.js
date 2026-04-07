const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  roomId: { type: String, required: true, index: true },
  civilianKeyword: { type: String },
  spyKeyword: { type: String },
  civilianDescription: { type: String },
  spyDescription: { type: String },
  spyUserId: { type: String, index: true },
  infectedUserId: { type: String, index: true },
  status: { type: String, default: 'in_progress' },
  winnerRole: { type: String },
  totalRounds: { type: Number, default: 0 },
  isSpecialRound: { type: Boolean, default: false },
  endedAt: { type: Date },
}, { timestamps: { createdAt: 'startedAt', updatedAt: 'updatedAt' } });

const Match = mongoose.model('Match', matchSchema);

module.exports = Match;
