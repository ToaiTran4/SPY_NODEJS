const mongoose = require('mongoose');

const roomPlayerSchema = new mongoose.Schema({
  roomId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  displayName: { type: String },
  joinedAt: { type: Date, default: Date.now },
}, { collection: 'room_players', timestamps: true });

const RoomPlayer = mongoose.model('RoomPlayer', roomPlayerSchema);

module.exports = RoomPlayer;
