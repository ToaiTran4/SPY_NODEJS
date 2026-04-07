const { getDb } = require('../config/db');
const { ObjectId } = require('mongodb');
const economyService = require('./economyService');
const settingsService = require('./settingsService');

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
  const db = getDb();
  const existing = await db.collection('rooms').findOne({ roomCode: base });
  if (existing) return ensureUniqueCode(generateRoomCode());
  return base;
}

async function createRoom(hostUserId, isPrivate, customRoomCode) {
  const db = getDb();
  const host = await db.collection('users').findOne({ _id: new ObjectId(hostUserId) });
  if (!host) throw new Error('User not found');

  let roomCode = customRoomCode && customRoomCode.trim() ? customRoomCode.trim() : generateRoomCode();

  if (customRoomCode && customRoomCode.trim()) {
    const existing = await db.collection('rooms').findOne({ roomCode });
    if (existing) throw new Error('Room code already exists');
  } else {
    roomCode = await ensureUniqueCode(roomCode);
  }

  const room = {
    roomCode,
    hostId: hostUserId,
    isPrivate: !!isPrivate,
    currentPlayers: 0,
    maxPlayers: 6,
    status: 'waiting',
    specialRound: false,
    adminSelectedSpyId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await db.collection('rooms').insertOne(room);
  room._id = result.insertedId;

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
  const db = getDb();
  await db.collection('rooms').updateOne(
    { _id: room._id },
    { $set: { specialRound: true, updatedAt: new Date() } }
  );
  room.specialRound = true;
  return room;
}

async function joinRoom(roomCode, userId) {
  const db = getDb();
  const room = await db.collection('rooms').findOne({ roomCode });
  if (!room) throw new Error('Room not found');

  if (room.status !== 'waiting') throw new Error('Room is not available');
  if (room.currentPlayers >= room.maxPlayers) throw new Error('Room is full');

  // Already in room?
  const existing = await db.collection('room_players').findOne({ roomId: room._id.toString(), userId });
  if (existing) return room;

  const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
  if (!user) throw new Error('User not found');

  const wsUsername = user.username || user.email;
  await db.collection('room_players').insertOne({
    roomId: room._id.toString(),
    userId,
    username: wsUsername,
    displayName: user.displayName || wsUsername,
    joinedAt: new Date(),
  });

  const updatedRoom = await db.collection('rooms').findOneAndUpdate(
    { _id: room._id },
    { $inc: { currentPlayers: 1 }, $set: { updatedAt: new Date() } },
    { returnDocument: 'after' }
  );

  broadcastRoomUpdate(updatedRoom);
  broadcastLobbyRoomEvent(updatedRoom, 'UPDATED');
  return updatedRoom;
}

async function leaveRoom(roomId, userId) {
  const db = getDb();
  const room = await db.collection('rooms').findOne({ _id: new ObjectId(roomId) });
  if (!room) throw new Error('Room not found');

  if (room.status === 'in_game' && _gameService) {
    _gameService.handlePlayerQuit(roomId, userId);
  }

  await db.collection('room_players').deleteOne({ roomId, userId });

  const newCount = Math.max(0, room.currentPlayers - 1);
  if (newCount <= 0) {
    await db.collection('rooms').deleteOne({ _id: room._id });
    broadcastLobbyRoomEvent(room, 'DELETED');
    return;
  }

  let updates = { currentPlayers: newCount, updatedAt: new Date() };
  if (room.hostId === userId) {
    const remaining = await db.collection('room_players').find({ roomId }).toArray();
    if (remaining.length > 0) {
      updates.hostId = remaining[0].userId;
    }
  }

  const updatedRoom = await db.collection('rooms').findOneAndUpdate(
    { _id: room._id },
    { $set: updates },
    { returnDocument: 'after' }
  );

  broadcastRoomUpdate(updatedRoom);
  broadcastLobbyRoomEvent(updatedRoom, 'UPDATED');
}

async function kickPlayer(roomId, hostId, targetUserId) {
  const db = getDb();
  const room = await db.collection('rooms').findOne({ _id: new ObjectId(roomId) });
  if (!room) throw new Error('Room not found');
  if (room.hostId !== hostId) throw new Error('Only host can kick players');
  if (hostId === targetUserId) throw new Error('Host cannot kick themselves');

  await db.collection('room_players').deleteOne({ roomId, userId: targetUserId });

  const updatedRoom = await db.collection('rooms').findOneAndUpdate(
    { _id: room._id },
    { $inc: { currentPlayers: -1 }, $set: { updatedAt: new Date() } },
    { returnDocument: 'after' }
  );

  // Notify via STOMP
  if (_io) {
    _io.sendToTopic(`/topic/room/${roomId}`, {
      type: 'PLAYER_KICKED',
      room_id: roomId,
      target_user_id: targetUserId,
    });
  }

  broadcastRoomUpdate(updatedRoom);
  broadcastLobbyRoomEvent(updatedRoom, 'UPDATED');
}

async function transferHost(roomId, currentHostId, newHostId) {
  const db = getDb();
  const room = await db.collection('rooms').findOne({ _id: new ObjectId(roomId) });
  if (!room) throw new Error('Room not found');
  if (room.hostId !== currentHostId) throw new Error('Only host can transfer rights');

  const inRoom = await db.collection('room_players').findOne({ roomId, userId: newHostId });
  if (!inRoom) throw new Error('New host must be in the room');

  const updatedRoom = await db.collection('rooms').findOneAndUpdate(
    { _id: room._id },
    { $set: { hostId: newHostId, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
  broadcastRoomUpdate(updatedRoom);
}

async function getPublicRooms() {
  return getDb().collection('rooms').find({ status: 'waiting', isPrivate: false }).toArray();
}

async function getPlayersInRoom(roomId) {
  return getDb().collection('room_players').find({ roomId }).toArray();
}

async function getRoomById(roomId) {
  const room = await getDb().collection('rooms').findOne({ _id: new ObjectId(roomId) });
  if (!room) throw new Error('Room not found');
  return room;
}

async function getRoomByCode(roomCode) {
  const room = await getDb().collection('rooms').findOne({ roomCode });
  if (!room) throw new Error(`Room not found with code: ${roomCode}`);
  return room;
}

async function findAllRooms() {
  return getDb().collection('rooms').find({}).toArray();
}

async function deleteRoom(roomId) {
  const db = getDb();
  const room = await db.collection('rooms').findOne({ _id: new ObjectId(roomId) });
  await db.collection('rooms').deleteOne({ _id: new ObjectId(roomId) });
  if (room) broadcastLobbyRoomEvent(room, 'DELETED');
}

async function countActiveRooms() {
  return getDb().collection('rooms').countDocuments();
}

async function addPlayerAdmin(roomId, identifier) {
  const db = getDb();
  const room = await db.collection('rooms').findOne({ _id: new ObjectId(roomId) });
  if (!room) throw new Error('Room not found');

  const user = await db.collection('users').findOne({
    $or: [{ username: identifier }, { email: identifier }]
  });
  if (!user) throw new Error(`User not found with username/email: ${identifier}`);

  const alreadyIn = await db.collection('room_players').findOne({ roomId, userId: user._id.toString() });
  if (!alreadyIn) {
    await db.collection('room_players').insertOne({
      roomId,
      userId: user._id.toString(),
      username: user.username || user.email,
      displayName: user.displayName || user.username,
      joinedAt: new Date(),
    });
    const updatedRoom = await db.collection('rooms').findOneAndUpdate(
      { _id: room._id },
      { $inc: { currentPlayers: 1 }, $set: { updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    broadcastRoomUpdate(updatedRoom);
    broadcastLobbyRoomEvent(updatedRoom, 'UPDATED');
    return updatedRoom;
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
