const Room = require('../models/Room');
const RoomPlayer = require('../models/RoomPlayer');
const User = require('../models/User');
const economyService = require('./economyService');

let _io = null; // STOMP server broadcast helper
let _gameService = null;

function setIo(stompBroadcast) { _io = stompBroadcast; }
function setGameService(gs) { _gameService = gs; }

function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function ensureUniqueCode(base) {
  const existing = await Room.findOne({ roomCode: base });
  if (existing) return ensureUniqueCode(generateRoomCode());
  return base;
}

async function createRoom(hostUserId, isPrivate, customRoomCode) {
  const host = await User.findById(hostUserId);
  if (!host) throw new Error('User not found');

  let roomCode = customRoomCode && customRoomCode.trim() ? customRoomCode.trim() : generateRoomCode();

  if (customRoomCode && customRoomCode.trim()) {
    const existing = await Room.findOne({ roomCode });
    if (existing) throw new Error('Room code already exists');
  } else {
    roomCode = await ensureUniqueCode(roomCode);
  }

  const room = new Room({
    roomCode,
    hostId: hostUserId,
    isPrivate: !!isPrivate,
    currentPlayers: 0,
    maxPlayers: 6,
    status: 'waiting',
    specialRound: false,
    adminSelectedSpyId: null,
  });

  await room.save();

  return joinRoom(room.roomCode, hostUserId);
}

async function createSpecialRoom(hostUserId, isPrivate, customRoomCode) {
  await economyService.deductBalance(
    hostUserId,
    economyService.SPECIAL_ROOM_COST,
    'CREATE_SPECIAL_ROOM',
    'Phí tạo phòng đặc biệt'
  );

  const room = await createRoom(hostUserId, isPrivate, customRoomCode);
  room.specialRound = true;
  await room.save();
  return room;
}

async function joinRoom(roomCode, userId) {
  const room = await Room.findOne({ roomCode });
  if (!room) throw new Error('Room not found');

  if (room.status !== 'waiting') throw new Error('Room is not available');
  if (room.currentPlayers >= room.maxPlayers) throw new Error('Room is full');

  // Already in room?
  const existing = await RoomPlayer.findOne({ roomId: room._id.toString(), userId });
  if (existing) return room;

  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  const wsUsername = user.username || user.email;
  await RoomPlayer.create({
    roomId: room._id.toString(),
    userId,
    displayName: user.displayName || wsUsername,
  });

  room.currentPlayers += 1;
  await room.save();

  broadcastRoomUpdate(room);
  broadcastLobbyRoomEvent(room, 'UPDATED');
  return room;
}

async function leaveRoom(roomId, userId) {
  const room = await Room.findById(roomId);
  if (!room) throw new Error('Room not found');

  if (room.status === 'in_game' && _gameService) {
    _gameService.handlePlayerQuit(roomId, userId);
  }

  await RoomPlayer.deleteOne({ roomId, userId });

  const newCount = Math.max(0, room.currentPlayers - 1);
  if (newCount <= 0) {
    await Room.deleteOne({ _id: room._id });
    broadcastLobbyRoomEvent(room, 'DELETED');
    return;
  }

  room.currentPlayers = newCount;
  if (room.hostId === userId) {
    const remaining = await RoomPlayer.find({ roomId });
    if (remaining.length > 0) {
      room.hostId = remaining[0].userId;
    }
  }

  await room.save();

  broadcastRoomUpdate(room);
  broadcastLobbyRoomEvent(room, 'UPDATED');
}

async function kickPlayer(roomId, hostId, targetUserId) {
  const room = await Room.findById(roomId);
  if (!room) throw new Error('Room not found');
  if (room.hostId !== hostId) throw new Error('Only host can kick players');
  if (hostId === targetUserId) throw new Error('Host cannot kick themselves');

  await RoomPlayer.deleteOne({ roomId, userId: targetUserId });

  room.currentPlayers = Math.max(0, room.currentPlayers - 1);
  await room.save();

  // Notify via STOMP
  if (_io) {
    _io.sendToTopic(`/topic/room/${roomId}`, {
      type: 'PLAYER_KICKED',
      room_id: roomId,
      target_user_id: targetUserId,
    });
  }

  broadcastRoomUpdate(room);
  broadcastLobbyRoomEvent(room, 'UPDATED');
}

async function transferHost(roomId, currentHostId, newHostId) {
  const room = await Room.findById(roomId);
  if (!room) throw new Error('Room not found');
  if (room.hostId !== currentHostId) throw new Error('Only host can transfer rights');

  const inRoom = await RoomPlayer.findOne({ roomId, userId: newHostId });
  if (!inRoom) throw new Error('New host must be in the room');

  room.hostId = newHostId;
  await room.save();
  broadcastRoomUpdate(room);
}

async function getPublicRooms() {
  return Room.find({ status: 'waiting', isPrivate: false });
}

async function getPlayersInRoom(roomId) {
  return RoomPlayer.find({ roomId });
}

async function getRoomById(roomId) {
  const room = await Room.findById(roomId);
  if (!room) throw new Error('Room not found');
  return room;
}

async function getRoomByCode(roomCode) {
  const room = await Room.findOne({ roomCode });
  if (!room) throw new Error(`Room not found with code: ${roomCode}`);
  return room;
}

async function findAllRooms() {
  return Room.find({});
}

async function deleteRoom(roomId) {
  const room = await Room.findById(roomId);
  if (room) {
    await Room.deleteOne({ _id: roomId });
    broadcastLobbyRoomEvent(room, 'DELETED');
  }
}

async function countActiveRooms() {
  return Room.countDocuments();
}

async function addPlayerAdmin(roomId, identifier) {
  const room = await Room.findById(roomId);
  if (!room) throw new Error('Room not found');

  const user = await User.findOne({
    $or: [{ username: identifier }, { email: identifier }]
  });
  if (!user) throw new Error(`User not found with username/email: ${identifier}`);

  const alreadyIn = await RoomPlayer.findOne({ roomId, userId: user._id.toString() });
  if (!alreadyIn) {
    await RoomPlayer.create({
      roomId,
      userId: user._id.toString(),
      displayName: user.displayName || user.username,
    });
    
    room.currentPlayers += 1;
    await room.save();
    
    broadcastRoomUpdate(room);
    broadcastLobbyRoomEvent(room, 'UPDATED');
    return room;
  }

  broadcastRoomUpdate(room);
  broadcastLobbyRoomEvent(room, 'UPDATED');
  return room;
}

async function broadcastRoomUpdate(room) {
  if (!_io) return;
  const players = await getPlayersInRoom(room._id.toString());
  _io.sendToTopic(`/topic/room/${room._id.toString()}`, {
    room_id: room._id.toString(),
    room_code: room.roomCode,
    host_id: room.hostId,
    current_players: room.currentPlayers,
    status: room.status,
    players: players.map(p => ({ user_id: p.userId, display_name: p.displayName })),
  });
}

function broadcastLobbyRoomEvent(room, type) {
  if (!_io) return;
  _io.sendToTopic('/topic/rooms/lobby', {
    type: `ROOM_${type}`,
    room_id: room._id.toString(),
    room_code: room.roomCode,
    current_players: room.currentPlayers,
    max_players: room.maxPlayers,
    status: room.status,
    is_private: room.isPrivate,
  });
}

module.exports = {
  setIo,
  setGameService,
  createRoom,
  createSpecialRoom,
  joinRoom,
  leaveRoom,
  kickPlayer,
  transferHost,
  getPublicRooms,
  getPlayersInRoom,
  getRoomById,
  getRoomByCode,
  findAllRooms,
  deleteRoom,
  countActiveRooms,
  addPlayerAdmin,
  broadcastRoomUpdate,
};

