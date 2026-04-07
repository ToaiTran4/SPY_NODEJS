const roomService = require('../services/roomService');

const createRoom = async (req, res) => {
  try {
    const body = req.body || {};
    const isPrivate = Boolean(body.is_private);
    const customRoomCode = body.room_code || null;
    const room = await roomService.createRoom(req.userId, isPrivate, customRoomCode);
    const user = req.user;
    res.status(201).json({
      room_id: room._id.toString(),
      room_code: room.roomCode,
      host: { user_id: req.userId, display_name: user.displayName || user.username },
      status: room.status,
      current_players: room.currentPlayers,
      is_special_round: room.specialRound,
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const createSpecialRoom = async (req, res) => {
  try {
    const body = req.body || {};
    const room = await roomService.createSpecialRoom(req.userId, Boolean(body.is_private), body.room_code || null);
    const user = req.user;
    res.status(201).json({
      room_id: room._id.toString(),
      room_code: room.roomCode,
      host: { user_id: req.userId, display_name: user.displayName || user.username },
      status: room.status,
      current_players: room.currentPlayers,
      is_special_round: room.specialRound,
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const getPublicRooms = async (req, res) => {
  try {
    const rooms = await roomService.getPublicRooms();
    const roomList = rooms.map(r => ({
      room_id: r._id.toString(),
      room_code: r.roomCode,
      current_players: r.currentPlayers,
      max_players: r.maxPlayers,
      status: r.status,
    }));
    res.json({ rooms: roomList, total: roomList.length });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const getRoomByCode = async (req, res) => {
  try {
    const room = await roomService.getRoomByCode(req.params.roomCode);
    res.json({
      room_id: room._id.toString(),
      room_code: room.roomCode,
      current_players: room.currentPlayers,
      max_players: room.maxPlayers,
      status: room.status,
      is_private: room.isPrivate,
      is_special_round: room.specialRound,
    });
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
};

const getRoomById = async (req, res) => {
  try {
    const room = await roomService.getRoomById(req.params.roomId);
    const players = await roomService.getPlayersInRoom(req.params.roomId);
    res.json({
      room_id: room._id.toString(),
      room_code: room.roomCode,
      host_id: room.hostId,
      current_players: room.currentPlayers,
      max_players: room.maxPlayers,
      status: room.status,
      is_private: room.isPrivate,
      is_special_round: room.specialRound,
      players: players.map(p => ({ user_id: p.userId, display_name: p.displayName })),
    });
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
};

const joinRoom = async (req, res) => {
  try {
    const room = await roomService.joinRoom(req.params.roomCode, req.userId);
    const players = await roomService.getPlayersInRoom(room._id.toString());
    res.json({
      room_id: room._id.toString(),
      room_code: room.roomCode,
      current_players: room.currentPlayers,
      is_special_round: room.specialRound,
      players: players.map(p => ({ user_id: p.userId, display_name: p.displayName })),
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const leaveRoom = async (req, res) => {
  try {
    await roomService.leaveRoom(req.params.roomId, req.userId);
    res.json({ message: 'Left room' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const kickPlayer = async (req, res) => {
  try {
    await roomService.kickPlayer(req.params.roomId, req.userId, req.body.user_id);
    res.json({ message: 'Player kicked' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const transferHost = async (req, res) => {
  try {
    await roomService.transferHost(req.params.roomId, req.userId, req.body.user_id);
    res.json({ message: 'Host rights transferred' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const getPlayers = async (req, res) => {
  try {
    const players = await roomService.getPlayersInRoom(req.params.roomId);
    res.json({
      room_id: req.params.roomId,
      players: players.map(p => ({ user_id: p.userId, display_name: p.displayName })),
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

module.exports = {
  createRoom,
  createSpecialRoom,
  getPublicRooms,
  getRoomByCode,
  getRoomById,
  joinRoom,
  leaveRoom,
  kickPlayer,
  transferHost,
  getPlayers
};
