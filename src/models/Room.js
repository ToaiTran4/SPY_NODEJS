const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  roomCode: { type: String, required: true, unique: true, index: true },
  hostId: { type: String, required: true, index: true },
  isPrivate: { type: Boolean, default: false },
  currentPlayers: { type: Number, default: 0 },
  maxPlayers: { type: Number, default: 12 },
  status: { type: String, default: 'waiting' }, // waiting, in_game, finished
  specialRound: { type: Boolean, default: false },
  adminSelectedSpyId: { type: String },
}, { timestamps: true });

const Room = mongoose.model('Room', roomSchema);

module.exports = Room;
