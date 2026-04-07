'use strict';

const { getDb } = require('../config/db');
const { ObjectId } = require('mongodb');
const stateMachine = require('./gameStateMachine');
const voteManager = require('./voteManager');
const timerService = require('./timerService');
const keywordService = require('./keywordService');
const economyService = require('./economyService');
const aiService = require('./aiService');
const settingsService = require('./settingsService');

// In-memory game sessions: matchId → session object
const gameSessions = new Map();

let _io = null; // STOMP broadcast helper

function setIo(stompBroadcast) {
  _io = stompBroadcast;
  timerService.setGameService(module.exports);
}

// =========================================================
// SECTION 1: GAME SETUP
// =========================================================

const PLAYER_COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan', 'brown', 'gray', 'white', 'black'];

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function startGame(roomId, hostUserId) {
  const db = getDb();
  const room = await db.collection('rooms').findOne({ _id: new ObjectId(roomId) });
  if (!room) throw new Error('Room not found');
  if (room.hostId !== hostUserId) throw new Error('Only host can start the game');
  if (room.currentPlayers < 2) throw new Error('Need at least 2 players to start');

  const roomPlayers = await db.collection('room_players').find({ roomId }).toArray();
  // Entry fee is 0
  for (const rp of roomPlayers) {
    await economyService.deductEntryFee(rp.userId, 0);
  }

  const keyword = await keywordService.getRandomKeyword();

  const match = {
    roomId,
    civilianKeyword: keyword.civilianKeyword,
    spyKeyword: keyword.spyKeyword,
    isSpecialRound: room.specialRound,
    status: 'in_progress',
    startedAt: new Date(),
    spyUserId: null,
    infectedUserId: null,
    winnerRole: null,
    totalRounds: 0,
  };
  const matchResult = await db.collection('matches').insertOne(match);
  const matchId = matchResult.insertedId.toString();

  const session = createSession(matchId, room, keyword);

  // Assign players
  const players = createPlayers(roomPlayers);
  session.players = players;

  // Select spy
  let spyUserId = null;
  if (room.adminSelectedSpyId) {
    const found = players.find(p => p.userId === room.adminSelectedSpyId);
    if (found) spyUserId = room.adminSelectedSpyId;
  }
  if (!spyUserId) {
    const humanPlayers = players.filter(p => !p.isAi);
    const shuffled = shuffleArray(humanPlayers);
    spyUserId = shuffled[0]?.userId || players[0].userId;
  }

  session.spyUserId = spyUserId;
  players.forEach(p => {
    p.role = p.userId === spyUserId ? 'spy' : 'civilian';
  });
  // AI is always ai_civilian
  players.find(p => p.isAi).role = 'ai_civilian';

  // Update match with spy
  await db.collection('matches').updateOne(
    { _id: matchResult.insertedId },
    { $set: { spyUserId } }
  );

  // Reset admin selection
  await db.collection('rooms').updateOne(
    { _id: new ObjectId(roomId) },
    { $set: { adminSelectedSpyId: null, specialRound: false, status: 'in_game', updatedAt: new Date() } }
  );

  // Create match players
  for (const p of players) {
    if (p.isAi) continue;
    await db.collection('match_players').insertOne({
      matchId,
      userId: p.userId,
      color: p.color,
      role: p.role,
      eliminatedRound: null,
      isWinner: false,
      infected: false,
      afk: false,
    });
  }

  gameSessions.set(matchId, session);

  // Broadcast game start
  if (_io) {
    _io.sendToTopic(`/topic/room/${roomId}`, {
      type: 'GAME_START',
      room_id: roomId,
      match_id: matchId,
    });
  }

  moveToRoleAssign(session);
  return session;
}

function createSession(matchId, room, keyword) {
  return {
    matchId,
    roomId: room._id.toString(),
    roomCode: room.roomCode,
    state: 'WAITING',
    currentRound: 1,
    civilianKeyword: keyword.civilianKeyword,
    spyKeyword: keyword.spyKeyword,
    civilianDescription: keyword.civilianDescription || null,
    spyDescription: keyword.spyDescription || null,
    isSpecialRound: room.specialRound,
    isAnonymousVoting: false,
    keywordPairId: keyword._id?.toString() || null,
    players: [],
    spyUserId: null,
    aiPlayerId: null,
    infectedUserId: null,
    phaseStartTime: null,
    phaseEndTime: null,
    descriptions: {},
    fakeDescriptions: {},
    votes: {},
    roleCheckDone: false,
    roleCheckResults: {},
    spyKnowsRole: false,
    abilityType: null,
    spyAbilityDeclined: false,
    fakeMessageUsedThisRound: false,
    infectUsed: false,
    aiDiscussUsedThisRound: false,
    rewardCivilianGuess: 20,
    rewardSpyGuess: 50,
    rewardInfectedGuess: 30,
    eliminatedUserId: null,
    winnerRole: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createPlayers(roomPlayers) {
  const colors = shuffleArray([...PLAYER_COLORS]);
  const players = roomPlayers.map((rp, i) => ({
    userId: rp.userId,
    username: rp.username,
    displayName: rp.displayName,
    color: colors[i] || 'red',
    role: 'civilian',
    isAlive: true,
    isAi: false,
    isInfected: false,
    eliminatedRound: null,
    scoreGained: 0,
  }));

  // Always add exactly 1 AI player
  const aiColor = colors[players.length] || 'gray';
  players.push({
    userId: 'ai_official',
    username: 'AI KeywordSpy',
    displayName: 'AI KeywordSpy',
    color: aiColor,
    role: 'ai_civilian',
    isAlive: true,
    isAi: true,
    isInfected: false,
    eliminatedRound: null,
    scoreGained: 0,
  });

  return players;
}

// =========================================================
// SECTION 2: PHASE ACTIONS
// =========================================================

async function submitDescription(matchId, userId, content) {
  const session = getSession(matchId);
  if (session.state !== 'DESCRIBING') throw new Error('Not in describing phase');

  getAlivePlayer(session, userId);

  const words = content.trim().split(/\s+/);
  if (words.length < 1 || words.length > 30) throw new Error('Mô tả phải từ 1-30 từ');

  console.log(`[DESCRIPTIONS] Player ${userId} submitted: ${content}`);
  if (!session.descriptions[session.currentRound]) session.descriptions[session.currentRound] = {};
  session.descriptions[session.currentRound][userId] = content;

  broadcastDescriptions(session);

  // Trigger AI description if not manipulated
  if (session.abilityType !== 'fake_message' && isAiAlive(session)) {
    const ai = getAiPlayer(session);
    if (!session.descriptions[session.currentRound]?.[ai.userId]) {
      autoDescribeForAi(session, content);
    }
  }
}

async function submitChat(matchId, userId, content) {
  const session = getSession(matchId);
  if (session.state !== 'DISCUSSING') throw new Error('Not in discussing phase');

  const player = getAlivePlayer(session, userId);
  const name = getAnonymousName(player);

  if (_io) {
    _io.sendToTopic(`/topic/match/${matchId}/chat`, {
      match_id: matchId,
      sender_id: userId,
      sender_name: name,
      display_name: name,
      color: player.color || 'red',
      content,
      sent_at: new Date().toISOString(),
      timestamp: Date.now(),
    });
  }

  // Trigger AI discussion
  if (session.abilityType !== 'fake_message' && isAiAlive(session) && !session.aiDiscussUsedThisRound) {
    autoDiscussForAi(session, content);
  }
}

async function submitVote(matchId, voterId, targetId) {
  const session = getSession(matchId);
  if (session.state !== 'VOTING') return;

  getAlivePlayer(session, voterId);

  if (!session.votes[session.currentRound]) session.votes[session.currentRound] = {};
  session.votes[session.currentRound][voterId] = targetId;

  broadcastVoteCounts(session);
}

// =========================================================
// SECTION 3: ROLE CHECK
// =========================================================

async function submitRoleGuess(matchId, userId, guessedRole) {
  const session = getSession(matchId);
  if (session.state !== 'ROLE_CHECK') throw new Error('Không phải phase Đoán Vai Trò');
  if (session.roleCheckDone) throw new Error('Vòng Đoán Vai Trò đã kết thúc');
  if (session.roleCheckResults[userId] !== undefined) throw new Error('Bạn đã đoán rồi');

  getAlivePlayer(session, userId);

  const isSpy = userId === session.spyUserId;
  const guessedSpy = guessedRole.toLowerCase() === 'spy';
  const correct = (isSpy && guessedSpy) || (!isSpy && !guessedSpy);

  console.log(`[ROLE_GUESS] User ${userId} guessed ${guessedRole}. IsSpy: ${isSpy}, Correct: ${correct}`);
  session.roleCheckResults[userId] = correct;

  if (allPlayersGuessed(session)) {
    timerService.cancelTimer(matchId);
    moveToRoleCheckResult(session);
  }

  return { submitted: true, message: 'Đã ghi nhận lựa chọn của bạn' };
}

async function broadcastRoleCheckResults(session) {
  for (const player of getAlivePlayers(session)) {
    if (player.isAi) continue;

    const uid = player.userId;
    const isSpy = uid === session.spyUserId;
    const correct = session.roleCheckResults[uid] || false;

    const result = {
      type: 'ROLE_CHECK_RESULT',
      correct,
      actual_role: player.isInfected ? 'infected' : player.role,
    };

    if (!isSpy) {
      if (correct) {
        result.message = player.isInfected ? 'Chính xác! Bạn là Kẻ Bị Tha Hóa' : 'Chính xác! Bạn là Dân Thường';
        result.reward_coins = true;
        const reward = player.isInfected ? session.rewardInfectedGuess : session.rewardCivilianGuess;
        result.reward_amount = reward;
        const role = player.isInfected ? 'infected' : player.role;
        await economyService.addReward(uid, reward, 'GUESS_BONUS', `Đoán đúng vai ${role}`, true);
      } else {
        result.message = 'Sai rồi! Không nhận được xu';
        result.reward_coins = false;
      }
      result.abilities_available = null;
    } else {
      if (correct) {
        console.log(`[ROLE_GUESS] Spy ${uid} guessed correctly. Enabling abilities.`);
        session.spyKnowsRole = true;
        result.message = 'Chính xác! Bạn là Gián Điệp';
        result.reward_coins = true;
        result.reward_amount = session.rewardSpyGuess;
        await economyService.addReward(uid, session.rewardSpyGuess, 'GUESS_BONUS', 'Spy đoán đúng vai', true);
        result.abilities_available = getAvailableAbilities(session);
        result.alive_humans = getAliveCivilianList(session);
      } else {
        result.message = 'Sai rồi! Bạn không nhận ra bản thân.';
        result.reward_coins = false;
        result.abilities_available = null;
      }
    }

    if (player.username && _io) {
      _io.sendToUser(player.username, '/queue/role-check-result', result);
      _io.sendToUser(player.username, '/queue/role-result', result);
    }
  }
}

async function confirmSpyAbility(matchId, userId, abilityTypeStr) {
  console.log(`[ABILITY] Confirming for user ${userId}, match ${matchId}, type: ${abilityTypeStr}`);
  const session = getSession(matchId);
  const spy = getPlayer(session, userId);
  
  if (!spy) {
    console.warn(`[ABILITY] User ${userId} not found in session players`);
    throw new Error('Bạn không có trong ván đấu này');
  }
  
  if (spy.role !== 'spy') {
    console.warn(`[ABILITY] User ${userId} is not a spy (Role: ${spy.role})`);
    throw new Error('Chỉ Gián Điệp mới có thể xác nhận kỹ năng');
  }
  
  if (!session.spyKnowsRole) {
    console.warn(`[ABILITY] Spy ${userId} attempted ability but spyKnowsRole is false. Results:`, session.roleCheckResults);
    throw new Error('Bạn cần đoán đúng vai trò để sử dụng kỹ năng');
  }

  const result = { confirmed: true };
  const ability = (abilityTypeStr || '').toLowerCase();

  if (ability === 'fake_message') {
    if (!isAiAlive(session)) throw new Error('AI đã bị loại, không thể dùng kỹ năng Thao túng AI');
    session.abilityType = 'fake_message';
    result.ability = 'fake_message';
  } else if (ability === 'infection') {
    session.abilityType = 'infection';
    result.ability = 'infection';
  } else {
    session.abilityType = 'none';
    session.spyAbilityDeclined = true;
    result.ability = 'none';
  }

  skipPhase(matchId);
  
  // Re-broadcast private state to the spy with confirmed_ability & selected_ability
  // so the frontend knows to show the AI manipulation textbox
  const state = getGameState(matchId, userId);
  if (_io && spy.username) {
    _io.sendToUser(spy.username, '/queue/role-result', {
       ...state,
       type: 'ROLE_CHECK_RESULT',
       confirmed_ability: ability,
       selected_ability: ability,  // CRITICAL: FE reads this field to show AI manipulation
       actual_role: 'spy',
    });
  }

  // Also broadcast to all spy-team members (infected players)
  for (const p of session.players) {
    if (p.isInfected && !p.isAi && _io && p.username) {
      _io.sendToUser(p.username, '/queue/role-result', {
        type: 'ROLE_CHECK_RESULT',
        selected_ability: ability,
        confirmed_ability: ability,
        actual_role: 'infected',
      });
    }
  }

  return result;
}

// =========================================================
// SECTION 4: SPY ABILITIES
// =========================================================

async function useFakeMessageAbility(matchId, userId, content) {
  const session = getSession(matchId);
  if (session.state !== 'DESCRIBING' && session.state !== 'DISCUSSING')
    throw new Error('Chỉ dùng được trong phase Mô Tả hoặc Thảo Luận');
  if (userId !== session.spyUserId) throw new Error('Chỉ Gián Điệp mới có thể dùng khả năng này');
  if (!session.spyKnowsRole) throw new Error('Bạn cần đoán đúng vai trò để mở khóa kỹ năng');
  if (!isAiAlive(session)) throw new Error('AI đã bị loại, không thể thao túng');

  const aiPlayer = getAiPlayer(session);
  if (_io) {
    _io.sendToTopic(`/topic/match/${matchId}/chat`, {
      match_id: matchId,
      display_name: getAnonymousName(aiPlayer),
      color: aiPlayer.color,
      content,
      sent_at: new Date().toISOString(),
      is_manipulated: true,
    });
  }

  if (session.state === 'DESCRIBING') {
    if (!session.descriptions[session.currentRound]) session.descriptions[session.currentRound] = {};
    session.descriptions[session.currentRound][aiPlayer.userId] = content;
    broadcastDescriptions(session);
  }

  await economyService.addReward(userId, 30, 'SKILL_BONUS', 'Thao túng AI', true);
  return { sent: true, message: 'Đã gửi tin nhắn giả danh AI' };
}

async function infectPlayer(matchId, spyUserId, targetUserId) {
  const session = getSession(matchId);
  if (spyUserId !== session.spyUserId) throw new Error('Chỉ Gián Điệp mới có thể Tha Hóa');
  if (session.abilityType !== 'infection') throw new Error('Khả năng Tha Hóa chưa được kích hoạt');
  if (session.infectUsed) throw new Error('Đã Tha Hóa rồi');
  if (session.state !== 'ROLE_CHECK_RESULT') throw new Error('Chỉ có thể Tha Hóa trong phase kết quả Đoán Vai');

  const target = getPlayer(session, targetUserId);
  if (!target || !target.isAlive) throw new Error('Người chơi không tồn tại hoặc đã bị loại');
  if (targetUserId === spyUserId) throw new Error('Không thể Tha Hóa chính mình');

  target.isInfected = true;
  session.infectUsed = true;
  session.infectedUserId = targetUserId;

  const db = getDb();
  await db.collection('match_players').updateOne(
    { matchId: session.matchId, userId: targetUserId },
    { $set: { infected: true } }
  );

  if (target.username && _io) {
    _io.sendToUser(target.username, '/queue/infection', {
      type: 'INFECTED',
      spy_keyword: session.spyKeyword,
      win_condition: 'Gián Điệp thắng (Dân Thường còn 1) VÀ bạn vẫn còn sống',
      message: 'Bạn đã bị Tha Hóa!',
    });
  }

  return { infected: true, target: target.displayName };
}

// =========================================================
// SECTION 5: VOTE PROCESSING & WIN CONDITIONS
// =========================================================

function processVoteResult(session) {
  const eliminatedId = voteManager.processVotes(session);
  if (!eliminatedId) {
    // Tie
    stateMachine.transition(session, 'VOTE_TIE');
    session.phaseStartTime = new Date();
    session.phaseEndTime = new Date(Date.now() + timerService.VOTE_TIE_DURATION * 1000);
    timerService.startVoteTieTimer(session.matchId);
    broadcastRoundResult(session);
    broadcastPhase(session);
  } else {
    eliminatePlayer(session, eliminatedId);
  }
}

function eliminatePlayer(session, userId) {
  const player = getPlayer(session, userId);
  if (player) {
    player.isAlive = false;
    player.eliminatedRound = session.currentRound;
    session.eliminatedUserId = userId;

    const db = getDb();
    db.collection('match_players').updateOne(
      { matchId: session.matchId, userId },
      { $set: { eliminatedRound: session.currentRound } }
    ).catch(console.error);
  }

  stateMachine.transition(session, 'ROUND_RESULT');
  session.phaseStartTime = new Date();
  session.phaseEndTime = new Date(Date.now() + timerService.ROUND_RESULT_DURATION * 1000);
  timerService.startRoundResultTimer(session.matchId);
  broadcastRoundResult(session);
  broadcastPhase(session);
}

async function onRoundResultEnd(matchId) {
  const session = getSession(matchId);
  if (session.state === 'ROUND_RESULT') {
    await checkWinCondition(session);
  }
}

async function checkWinCondition(session) {
  const spy = getPlayer(session, session.spyUserId);

  // Spy eliminated → civilians win
  if (spy && !spy.isAlive) {
    session.winnerRole = 'civilians';
    stateMachine.transition(session, 'GAME_OVER');
    await broadcastGameOver(session);
    broadcastPhase(session);
    return;
  }

  // Spy wins when ≤ 1 human civilian alive
  const aliveHumanCivilians = getAlivePlayers(session).filter(
    p => p.role === 'civilian' && !p.isInfected && !p.isAi
  ).length;

  if (aliveHumanCivilians <= 1) {
    session.winnerRole = 'spy';
    stateMachine.transition(session, 'GAME_OVER');
    await broadcastGameOver(session);
    broadcastPhase(session);
    return;
  }

  startNextRound(session);
}

// =========================================================
// SECTION 6: ROUND & PHASE TRANSITIONS
// =========================================================

async function startNextRound(session) {
  session.currentRound++;
  session.eliminatedUserId = null;
  session.fakeMessageUsedThisRound = false;
  session.aiDiscussUsedThisRound = false;

  if (session.currentRound === 2 && !session.roleCheckDone) {
    moveToRoleCheck(session);
  } else {
    moveToDescribing(session);
  }
}

async function moveToRoleAssign(session) {
  stateMachine.transition(session, 'ROLE_ASSIGN');
  session.phaseStartTime = new Date();
  session.phaseEndTime = new Date(Date.now() + 10000);
  broadcastRoles(session);
  broadcastPhase(session);
  timerService.startTimer(session.matchId, 10, async () => {
    const s = getSession(session.matchId);
    if (s.state === 'ROLE_ASSIGN') moveToDescribing(s);
  });
}

async function moveToDescribing(session) {
  stateMachine.transition(session, 'DESCRIBING');
  const dur = await settingsService.getDescribeDuration();
  session.phaseStartTime = new Date();
  session.phaseEndTime = new Date(Date.now() + dur * 1000);
  broadcastPhase(session);
  timerService.startDescribeTimer(session.matchId);
}

async function moveToDiscussing(session) {
  stateMachine.transition(session, 'DISCUSSING');
  const dur = await settingsService.getDiscussDuration();
  session.phaseStartTime = new Date();
  session.phaseEndTime = new Date(Date.now() + dur * 1000);
  broadcastPhase(session);
  timerService.startDiscussTimer(session.matchId);
}

async function moveToVoting(session) {
  stateMachine.transition(session, 'VOTING');
  const dur = await settingsService.getVoteDuration();
  session.phaseStartTime = new Date();
  session.phaseEndTime = new Date(Date.now() + dur * 1000);
  autoVoteForAi(session);
  broadcastPhase(session);
  timerService.startVoteTimer(session.matchId);
}

async function moveToRoleCheck(session) {
  stateMachine.transition(session, 'ROLE_CHECK');
  const dur = await settingsService.getRoleCheckDuration();
  session.phaseStartTime = new Date();
  session.phaseEndTime = new Date(Date.now() + dur * 1000);
  autoRoleCheckForAi(session);
  broadcastPhase(session);
  timerService.startRoleCheckTimer(session.matchId);
}

async function moveToRoleCheckResult(session) {
  stateMachine.transition(session, 'ROLE_CHECK_RESULT');
  const dur = await settingsService.getRoleCheckResultDuration();
  session.phaseStartTime = new Date();
  session.phaseEndTime = new Date(Date.now() + dur * 1000);
  await broadcastRoleCheckResults(session);
  broadcastPhase(session);
  timerService.startRoleCheckResultTimer(session.matchId);
}

// =========================================================
// SECTION 7: TIMER CALLBACKS & ADMIN ACTIONS
// =========================================================

async function skipPhase(matchId) {
  const session = getSession(matchId);
  timerService.cancelTimer(matchId);
  if (session.state === 'GAME_OVER') return;

  switch (session.state) {
    case 'DESCRIBING': await onDescribePhaseEnd(matchId); break;
    case 'DISCUSSING': await onDiscussPhaseEnd(matchId); break;
    case 'VOTING': await onVotePhaseEnd(matchId); break;
    case 'VOTE_TIE': await onVoteTieEnd(matchId); break;
    case 'ROLE_CHECK': await onRoleCheckPhaseEnd(matchId); break;
    case 'ROLE_CHECK_RESULT': await onRoleCheckResultPhaseEnd(matchId); break;
    default: throw new Error(`Cannot skip phase in state: ${session.state}`);
  }
}

async function onDescribePhaseEnd(matchId) {
  const session = getSession(matchId);
  if (session.state !== 'DESCRIBING') return;

  if (!session.descriptions[session.currentRound]) session.descriptions[session.currentRound] = {};
  const roundDesc = session.descriptions[session.currentRound];
  for (const p of getAlivePlayers(session)) {
    if (!roundDesc[p.userId]) {
      roundDesc[p.userId] = 'Người này không nhắn gì cả';
    }
  }
  broadcastDescriptions(session);
  await moveToDiscussing(session);
}

async function onDiscussPhaseEnd(matchId) {
  const session = getSession(matchId);
  if (session.state === 'DISCUSSING') await moveToVoting(session);
}

async function onVotePhaseEnd(matchId) {
  const session = getSession(matchId);
  if (session.state === 'VOTING') {
    processVoteResult(session);
    session.isAnonymousVoting = false;
  }
}

async function onVoteTieEnd(matchId) {
  const session = getSession(matchId);
  if (session.state === 'VOTE_TIE') await startNextRound(session);
}

async function onRoleCheckPhaseEnd(matchId) {
  const session = getSession(matchId);
  if (session.state !== 'ROLE_CHECK') return;

  for (const player of getAlivePlayers(session)) {
    if (player.isAi) continue;
    if (session.roleCheckResults[player.userId] === undefined) {
      session.roleCheckResults[player.userId] = false;
    }
  }
  timerService.cancelTimer(matchId);
  await moveToRoleCheckResult(session);
}

async function onRoleCheckResultPhaseEnd(matchId) {
  const session = getSession(matchId);
  if (session.state !== 'ROLE_CHECK_RESULT') return;

  if (session.abilityType === 'infection' && !session.infectUsed) {
    session.abilityType = null;
    session.spyAbilityDeclined = true;

    const spyPlayer = getSpyPlayer(session);
    if (spyPlayer && spyPlayer.username && _io) {
      _io.sendToUser(spyPlayer.username, '/queue/ability', {
        type: 'INFECT_EXPIRED',
        message: 'Hết giờ! Bạn đã mất quyền Tha Hóa.',
      });
    }
  }

  session.roleCheckDone = true;
  await moveToDescribing(session);
}

// =========================================================
// SECTION 8: GAME STATE QUERY
// =========================================================

function getGameState(matchId, userId) {
  const session = getSession(matchId);
  const player = getPlayer(session, userId);

  const state = {
    room_id: session.roomId,
    room_code: session.roomCode,
    match_id: matchId,
    round: session.currentRound,
    phase: session.state || 'WAITING',
    is_special_round: session.isSpecialRound,
    is_anonymous_voting: session.isAnonymousVoting,
  };

  if (session.phaseEndTime) {
    state.phase_end_at = session.phaseEndTime.toISOString();
    state.remaining_seconds = timerService.getRemainingSeconds(session);
  }

  state.players = session.players.map(p => {
    const pm = { user_id: p.userId, is_alive: p.isAlive, role: p.role || 'civilian' };
    if (session.state && session.state !== 'GAME_OVER') {
      if (session.isAnonymousVoting && session.state === 'VOTING') {
        pm.display_name = 'Người chơi bí ẩn';
        pm.color = 'gray';
      } else {
        pm.display_name = getAnonymousName(p);
        pm.color = p.color || 'red';
      }
    } else {
      pm.display_name = p.displayName || p.username;
      pm.color = p.color || 'red';
    }
    return pm;
  });

  if (player) {
    state.role = player.isInfected ? 'infected' : (player.role || 'civilian');
    state.color = player.color || 'red';
    state.keyword = (player.role === 'spy' || player.isInfected)
      ? session.spyKeyword
      : session.civilianKeyword;
    
    // For compatibility with some older parts of FE if any
    state.your_role = state.role;
    state.your_keyword = state.keyword;

    if (session.isSpecialRound) {
      state.description = (player.role === 'spy' || player.isInfected)
        ? session.spyDescription
        : session.civilianDescription;
      state.your_description = state.description;
    }

    if (player.role === 'spy' || player.isInfected) {
      state.selected_ability = session.abilityType;
    }

    console.log(`[STATE] Delivery for user ${userId}: role=${state.role}, keyword=${state.keyword}, selected_ability=${state.selected_ability}`);

    if (session.state === 'ROLE_CHECK_RESULT') {
      state.role_check_correct = session.roleCheckResults[userId] || false;
      if (player.role === 'spy' && state.role_check_correct) {
        state.can_use_ability = true;
        state.abilities = getAvailableAbilities(session);
        state.alive_humans = getAliveCivilianList(session);
      }
    }
  }

  if (session.state === 'ROUND_RESULT' || session.state === 'VOTE_TIE') {
    const eliminated = getPlayer(session, session.eliminatedUserId);
    const result = { round: session.currentRound, type: 'ROUND_RESULT' };
    if (eliminated) {
      result.eliminated_user_id = eliminated.userId;
      result.eliminated_display_name = getAnonymousName(eliminated);
      result.color = eliminated.color;
      result.message = `${getAnonymousName(eliminated)} đã bị loại!`;
    } else {
      result.message = 'Không có ai bị loại vòng này (Hòa phiếu)';
    }
    state.eliminated_result = result;
  }

  return state;
}

// =========================================================
// SECTION 9: BROADCAST HELPERS
// =========================================================

function broadcastRoles(session) {
  if (!_io) return;
  for (const player of session.players) {
    if (player.isAi) continue;
    const isSpyTeam = player.role === 'spy' || player.isInfected;
    console.log(`[BROADCAST-ROLE] Sending to ${player.username}: role=${player.role}, keyword=${isSpyTeam ? session.spyKeyword : session.civilianKeyword}, ability=${isSpyTeam ? session.abilityType : null}`);
    _io.sendToUser(player.username, '/queue/role', {
      match_id: session.matchId,
      round: session.currentRound,
      role: player.isInfected ? 'infected' : player.role,
      color: player.color,
      keyword: isSpyTeam ? session.spyKeyword : session.civilianKeyword,
      your_keyword: isSpyTeam ? session.spyKeyword : session.civilianKeyword,
      selected_ability: isSpyTeam ? session.abilityType : null,
    });
  }
}

function broadcastPhase(session) {
  if (!_io) return;
  const msg = {
    room_code: session.roomCode,
    match_id: session.matchId,
    phase: session.state || 'WAITING',
    round: session.currentRound,
    is_special_round: session.isSpecialRound,
    is_anonymous_voting: session.isAnonymousVoting,
    debug_timestamp: new Date().toISOString(),
    debug_state: session.state,
  };

  if (session.phaseEndTime) {
    msg.phase_end_at = session.phaseEndTime.toISOString();
    msg.remaining_seconds = timerService.getRemainingSeconds(session);
  }

  // To avoid broadcasting secret ability to everyone, we don't put it in the main msg.
  // But each player's individual GET /state or /queue/role will have it.

  msg.players = session.players.map(p => {
    const pm = { user_id: p.userId, is_alive: p.isAlive, score_gained: p.scoreGained || 0 };
    if (session.state && session.state !== 'GAME_OVER') {
      if (session.isAnonymousVoting && session.state === 'VOTING') {
        pm.display_name = 'Người chơi bí ẩn';
        pm.color = 'gray';
      } else {
        pm.display_name = getAnonymousName(p);
        pm.color = p.color || 'red';
      }
    } else {
      pm.display_name = p.displayName || p.username;
      pm.color = p.color || 'red';
    }
    return pm;
  });

  _io.sendToTopic(`/topic/match/${session.matchId}`, msg);
}

function broadcastDescriptions(session) {
  if (!_io) return;
  const rawDescs = session.descriptions[session.currentRound] || {};
  const detailList = [];
  for (const p of session.players) {
    if (rawDescs[p.userId] !== undefined) {
      detailList.push({
        user_id: p.userId,
        content: rawDescs[p.userId],
        color: p.color || 'red',
        display_name: session.state !== 'GAME_OVER' ? getAnonymousName(p) : (p.displayName || p.username),
      });
    }
  }
  console.log(`[DESCRIPTIONS] Broadcasting to match ${session.matchId}, count: ${detailList.length}`);
  _io.sendToTopic(`/topic/match/${session.matchId}/descriptions`, {
    match_id: session.matchId,
    round: session.currentRound,
    all_submitted: allPlayersDescribed(session),
    descriptions: detailList,
  });
}

function broadcastVoteCounts(session) {
  if (!_io) return;
  const currentVotes = session.votes[session.currentRound] || {};
  const voteStatus = {};
  for (const p of getAlivePlayers(session)) {
    voteStatus[p.userId] = currentVotes[p.userId] !== undefined ? 1 : 0;
  }
  _io.sendToTopic(`/topic/match/${session.matchId}/votes`, voteStatus);
}

function broadcastRoundResult(session) {
  if (!_io) return;
  const eliminated = getPlayer(session, session.eliminatedUserId);
  const result = {
    match_id: session.matchId,
    round: session.currentRound,
    type: 'ROUND_RESULT',
  };
  if (eliminated) {
    const name = getAnonymousName(eliminated);
    result.eliminated_user_id = eliminated.userId;
    result.eliminated_display_name = name;
    result.message = `${name} đã bị loại!`;
  } else {
    result.message = 'Không có ai bị loại vòng này (Hòa phiếu)';
  }
  _io.sendToTopic(`/topic/match/${session.matchId}/round-result`, result);
}

async function broadcastGameOver(session) {
  if (!_io) return;

  const gameOver = {
    match_id: session.matchId,
    winner_role: session.winnerRole,
    spy_user_id: session.spyUserId,
    civilian_keyword: session.civilianKeyword,
    spy_keyword: session.spyKeyword,
    civilian_description: session.civilianDescription,
    spy_description: session.spyDescription,
    is_special_round: session.isSpecialRound,
  };

  await processEndGameRewards(session);

  if (session.infectedUserId) {
    const infected = getPlayer(session, session.infectedUserId);
    if (infected) {
      const infectedWins = session.winnerRole === 'spy' && infected.isAlive;
      gameOver.infected_user_id = session.infectedUserId;
      gameOver.infected_wins = infectedWins;
    }
  }

  // Reveal all roles and names for the final broadcast
  gameOver.players = session.players.map(p => ({
    user_id: p.userId,
    username: p.username,
    display_name: p.displayName || p.username,
    role: p.role,
    is_alive: p.isAlive,
    score_gained: p.scoreGained || 0,
    color: p.color
  }));

  _io.sendToTopic(`/topic/match/${session.matchId}/game-over`, gameOver);

  // Cleanup room status
  const db = getDb();
  await db.collection('rooms').updateOne(
    { _id: new ObjectId(session.roomId) },
    { $set: { status: 'waiting', updatedAt: new Date() } }
  );

  // Delay session cleanup (allow players to view results/fetch state for 5 mins)
  setTimeout(() => {
    gameSessions.delete(session.matchId);
    console.log(`[SESSION] Cleaned up match: ${session.matchId}`);
  }, 5 * 60 * 1000); 
}

// =========================================================
// SECTION 10: PRIVATE HELPERS
// =========================================================

function getAnonymousName(p) {
  const map = {
    red: 'Mèo Béo', blue: 'Cún Con', green: 'Gấu Trúc',
    yellow: 'Vịt Vàng', purple: 'Cáo Nhỏ', orange: 'Hổ Con',
    pink: 'Thỏ Ngọc', cyan: 'Chim Cánh Cụt', brown: 'Sóc Chuột',
    gray: 'Voi Con', white: 'Ngựa Vằn', black: 'Cá Heo',
  };
  return map[p.color] || `Người chơi ${p.color}`;
}

function getSession(matchId) {
  const session = gameSessions.get(matchId);
  if (!session) {
    console.error(`[SESSION] Match not found: ${matchId}. Available match IDs:`, Array.from(gameSessions.keys()));
    throw new Error(`Game session not found: ${matchId}`);
  }
  return session;
}

function getPlayer(session, userId) {
  return session.players.find(p => p.userId === userId) || null;
}

function getAlivePlayer(session, userId) {
  const player = getPlayer(session, userId);
  if (!player || !player.isAlive) throw new Error('Player not found or eliminated');
  return player;
}

function getAlivePlayers(session) {
  return session.players.filter(p => p.isAlive);
}

function getAiPlayer(session) {
  return session.players.find(p => p.isAi && p.isAlive);
}

function getSpyPlayer(session) {
  return session.players.find(p => p.userId === session.spyUserId);
}

function isAiAlive(session) {
  return session.players.some(p => p.isAi && p.isAlive);
}

function allPlayersDescribed(session) {
  const descs = session.descriptions[session.currentRound] || {};
  return getAlivePlayers(session).every(p => descs[p.userId] !== undefined);
}

function allPlayersGuessed(session) {
  return getAlivePlayers(session).every(p => p.isAi || session.roleCheckResults[p.userId] !== undefined);
}

function getAvailableAbilities(session) {
  const abilities = [];
  if (isAiAlive(session)) {
    abilities.push({
      type: 'fake_message',
      name: 'Thao túng AI',
      description: 'Bạn có thể chat thay cho AI (hoặc để AI tự chat) mỗi vòng 1 lần.',
    });
  }
  abilities.push({
    type: 'infection',
    name: 'Tha Hóa',
    description: 'Chọn 1 người chơi để biến thành đồng minh (nhận từ khóa của bạn).',
  });
  return abilities;
}

function getAliveCivilianList(session) {
  return getAlivePlayers(session)
    .filter(p => !p.isAi && p.userId !== session.spyUserId)
    .map(p => ({ user_id: p.userId, display_name: getAnonymousName(p), color: p.color || 'red' }));
}

function autoRoleCheckForAi(session) {
  for (const p of getAlivePlayers(session)) {
    if (p.isAi && session.roleCheckResults[p.userId] === undefined) {
      try { submitRoleGuess(session.matchId, p.userId, 'civilian'); } catch (_) {}
    }
  }
}

async function autoDescribeForAi(session, context) {
  if (session.state !== 'DESCRIBING') return;
  const ai = getAiPlayer(session);
  if (!ai) return;
  if (!session.descriptions[session.currentRound]) session.descriptions[session.currentRound] = {};
  if (session.descriptions[session.currentRound][ai.userId] !== undefined) return;

  try {
    const content = await aiService.getAiDescription(session.civilianKeyword, session.currentRound);
    session.descriptions[session.currentRound][ai.userId] = content;
    broadcastDescriptions(session);
  } catch (_) {}
}

async function autoDiscussForAi(session, context) {
  if (session.state !== 'DISCUSSING' || session.aiDiscussUsedThisRound) return;
  const ai = getAiPlayer(session);
  if (!ai) return;

  session.aiDiscussUsedThisRound = true;
  try {
    const content = await aiService.getAiDescription(session.civilianKeyword, session.currentRound);
    
    // Update session descriptions so it shows in the AI's bubble
    if (!session.descriptions[session.currentRound]) session.descriptions[session.currentRound] = {};
    session.descriptions[session.currentRound][ai.userId] = content;
    broadcastDescriptions(session);

    if (_io) {
      _io.sendToTopic(`/topic/match/${session.matchId}/chat`, {
        match_id: session.matchId,
        sender_id: ai.userId,
        sender_name: getAnonymousName(ai),
        display_name: getAnonymousName(ai),
        color: ai.color,
        content,
        sent_at: new Date().toISOString(),
        timestamp: Date.now(),
      });
    }
  } catch (e) {
    console.error('Error in autoDiscussForAi:', e);
  }
}

function autoVoteForAi() {
  // AI không vote
}

async function processEndGameRewards(session) {
  const matchId = session.matchId;
  const winner = session.winnerRole;
  const db = getDb();

  await db.collection('matches').updateOne(
    { _id: new ObjectId(matchId) },
    { $set: { winnerRole: winner, infectedUserId: session.infectedUserId, totalRounds: session.currentRound, status: 'finished', endedAt: new Date() } }
  );

  if (winner === 'spy') {
    const spyPlayer = getPlayer(session, session.spyUserId);
    if (spyPlayer && !spyPlayer.isAi) {
      spyPlayer.scoreGained = 25;
      await economyService.addReward(session.spyUserId, 25, 'WIN_REWARD', `Spy Thắng Ván: ${matchId}`, true);
      await updateUserStats(session.spyUserId, true, 'spy', db);
      await db.collection('match_players').updateOne({ matchId, userId: session.spyUserId }, { $set: { isWinner: true } });
    }

    if (session.infectedUserId) {
      const infected = getPlayer(session, session.infectedUserId);
      if (infected && infected.isAlive && !infected.isAi) {
        infected.scoreGained = 25;
        await economyService.addReward(session.infectedUserId, 25, 'WIN_REWARD', `Infected Thắng Ván: ${matchId}`, true);
        await updateUserStats(session.infectedUserId, true, 'civilian', db);
        await db.collection('match_players').updateOne({ matchId, userId: session.infectedUserId }, { $set: { isWinner: true } });
      }
    }

    for (const p of session.players) {
      if (p.isAi) continue;
      if (p.userId === session.spyUserId) continue;
      if (session.infectedUserId && p.userId === session.infectedUserId) continue;
      const afkRecord = await db.collection('match_players').findOne({ matchId, userId: p.userId });
      if (afkRecord && afkRecord.afk) continue;
      p.scoreGained = -5;
      await economyService.addReward(p.userId, -5, 'WIN_REWARD', `Thua ván: ${matchId}`, false);
      await updateUserStats(p.userId, false, p.role, db);
    }

  } else if (winner === 'civilians') {
    for (const p of session.players) {
      if (p.role !== 'civilian') continue;
      if (session.infectedUserId && p.userId === session.infectedUserId) continue;
      if (p.isAi) continue;
      p.scoreGained = 15;
      await economyService.addReward(p.userId, 15, 'WIN_REWARD', `Dân thường Thắng Ván: ${matchId}`, true);
      await updateUserStats(p.userId, true, 'civilian', db);
      await db.collection('match_players').updateOne({ matchId, userId: p.userId }, { $set: { isWinner: true } });
    }

    const spyPlayer = getPlayer(session, session.spyUserId);
    if (spyPlayer && !spyPlayer.isAi) {
      spyPlayer.scoreGained = -5;
      await economyService.addReward(session.spyUserId, -5, 'WIN_REWARD', `Thua ván: ${matchId}`, false);
      await updateUserStats(session.spyUserId, false, 'spy', db);
    }

    if (session.infectedUserId) {
      const infected = getPlayer(session, session.infectedUserId);
      if (infected && !infected.isAi) {
        const afkRecord = await db.collection('match_players').findOne({ matchId, userId: session.infectedUserId });
        if (!afkRecord || !afkRecord.afk) {
          infected.scoreGained = -5;
          await economyService.addReward(session.infectedUserId, -5, 'WIN_REWARD', `Thua ván: ${matchId}`, false);
          await updateUserStats(session.infectedUserId, false, 'civilian', db);
        }
      }
    }
  }
}

async function updateUserStats(userId, isWin, role, db) {
  const inc = { totalGames: 1 };
  if (isWin) {
    if (role === 'spy') inc.winsSpy = 1;
    else inc.winsCivilian = 1;
  }
  if (role === 'spy') inc.timesAsSpy = 1;

  await db.collection('user_stats').updateOne(
    { userId },
    { $inc: inc, $set: { updatedAt: new Date() } },
    { upsert: true }
  );
}

// =========================================================
// ADMIN FUNCTIONS
// =========================================================

async function handlePlayerQuit(roomId, userId) {
  // Mark as AFK in all active sessions for this player
  for (const [, session] of gameSessions) {
    if (session.roomId === roomId) {
      const player = getPlayer(session, userId);
      if (player) {
        const db = getDb();
        await db.collection('match_players').updateOne(
          { matchId: session.matchId, userId },
          { $set: { afk: true } }
        );
      }
    }
  }
}

function adminSetSpy(roomId, userId, targetId) {
  // This gets called before game starts, just marks in the room
  // Handled in startGame via room.adminSelectedSpyId
}

async function setAdminSpy(roomId, adminUserId, targetUserId) {
  const db = getDb();
  const room = await db.collection('rooms').findOne({ _id: new ObjectId(roomId) });
  if (!room) throw new Error('Room not found');
  await db.collection('rooms').updateOne(
    { _id: new ObjectId(roomId) },
    { $set: { adminSelectedSpyId: targetUserId, updatedAt: new Date() } }
  );
}

function setGameState(matchId, newState) {
  const session = getSession(matchId);
  session.state = newState;
  session.updatedAt = new Date();
}

function setGameSpyDebug(matchId, userId) {
  const session = getSession(matchId);
  session.players.forEach(p => {
    p.role = p.userId === userId ? 'spy' : 'civilian';
    if (p.isAi) p.role = 'ai_civilian';
  });
  session.spyUserId = userId;
}

function adjustRewards(matchId, adminUserId, civilian, spy, infected) {
  const session = getSession(matchId);
  if (civilian != null) session.rewardCivilianGuess = civilian;
  if (spy != null) session.rewardSpyGuess = spy;
  if (infected != null) session.rewardInfectedGuess = infected;
}

function enableSpecialRound(roomId, userId) {
  // Called via REST, updates DB
  const db = getDb();
  db.collection('rooms').updateOne(
    { _id: new ObjectId(roomId) },
    { $set: { specialRound: true, updatedAt: new Date() } }
  ).catch(console.error);

  if (_io) {
    _io.sendToTopic(`/topic/room/${roomId}`, {
      type: 'SPECIAL_ROUND_ENABLED',
      room_id: roomId,
    });
  }
}

function enableAnonymousVoting(matchId, userId) {
  const session = getSession(matchId);
  session.isAnonymousVoting = true;
  if (_io) {
    _io.sendToTopic(`/topic/match/${matchId}`, {
      type: 'ANONYMOUS_VOTING_ENABLED',
      match_id: matchId,
      user_id: userId,
    });
  }
}

module.exports = {
  setIo,
  startGame,
  getSession,
  getGameState,
  submitDescription,
  submitChat,
  submitVote,
  submitRoleGuess,
  confirmSpyAbility,
  useFakeMessageAbility,
  infectPlayer,
  skipPhase,
  onDescribePhaseEnd,
  onDiscussPhaseEnd,
  onVotePhaseEnd,
  onVoteTieEnd,
  onRoundResultEnd,
  onRoleCheckPhaseEnd,
  onRoleCheckResultPhaseEnd,
  handlePlayerQuit,
  setAdminSpy,
  setGameState,
  setGameSpyDebug,
  adjustRewards,
  enableSpecialRound,
  enableAnonymousVoting,
};
