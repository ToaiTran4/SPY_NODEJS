const mongoose = require('mongoose');

const userStatsSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  totalGames: { type: Number, default: 0 },
  gamesWon: { type: Number, default: 0 },
  spyGames: { type: Number, default: 0 },
  spyWins: { type: Number, default: 0 },
  civilianGames: { type: Number, default: 0 },
  civilianWins: { type: Number, default: 0 },
  infectedCount: { type: Number, default: 0 },
  afkCount: { type: Number, default: 0 },
}, { collection: 'user_stats', timestamps: true });

const UserStats = mongoose.model('UserStats', userStatsSchema);

module.exports = UserStats;
