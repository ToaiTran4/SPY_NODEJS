// Timer service — in-memory setTimeout-based phase timers
const activeTimers = new Map();

const VOTE_TIE_DURATION = 10;
const ROUND_RESULT_DURATION = 5;

let _gameService = null;

function setGameService(gs) {
  _gameService = gs;
}

function startTimer(matchId, durationSeconds, onComplete) {
  cancelTimer(matchId); // Cancel any existing timer
  const handle = setTimeout(async () => {
    activeTimers.delete(matchId);
    try {
      await onComplete();
    } catch (err) {
      console.error(`[TIMER-ERROR] Error in timer callback for match ${matchId}:`, err.message);
    }
  }, durationSeconds * 1000);
  activeTimers.set(matchId, handle);
}

function cancelTimer(matchId) {
  const handle = activeTimers.get(matchId);
  if (handle) {
    clearTimeout(handle);
    activeTimers.delete(matchId);
  }
}

function getRemainingSeconds(session) {
  if (!session.phaseEndTime) return 0;
  const remaining = Math.floor((new Date(session.phaseEndTime) - Date.now()) / 1000);
  return Math.max(0, remaining);
}

// Convenience starters (lazy — gameService injected at runtime)
async function startDescribeTimer(matchId) {
  const { getDescribeDuration } = require('./settingsService');
  const duration = await getDescribeDuration();
  startTimer(matchId, duration, () => _gameService.onDescribePhaseEnd(matchId));
}

async function startDiscussTimer(matchId) {
  const { getDiscussDuration } = require('./settingsService');
  const duration = await getDiscussDuration();
  startTimer(matchId, duration, () => _gameService.onDiscussPhaseEnd(matchId));
}

async function startVoteTimer(matchId) {
  const { getVoteDuration } = require('./settingsService');
  const duration = await getVoteDuration();
  startTimer(matchId, duration, () => _gameService.onVotePhaseEnd(matchId));
}

function startVoteTieTimer(matchId) {
  startTimer(matchId, VOTE_TIE_DURATION, () => _gameService.onVoteTieEnd(matchId));
}

function startRoundResultTimer(matchId) {
  startTimer(matchId, ROUND_RESULT_DURATION, () => _gameService.onRoundResultEnd(matchId));
}

async function startRoleCheckTimer(matchId) {
  const { getRoleCheckDuration } = require('./settingsService');
  const duration = await getRoleCheckDuration();
  startTimer(matchId, duration, () => _gameService.onRoleCheckPhaseEnd(matchId));
}

async function startRoleCheckResultTimer(matchId) {
  const { getRoleCheckResultDuration } = require('./settingsService');
  const duration = await getRoleCheckResultDuration();
  startTimer(matchId, duration, () => _gameService.onRoleCheckResultPhaseEnd(matchId));
}

module.exports = {
  VOTE_TIE_DURATION,
  ROUND_RESULT_DURATION,
  setGameService,
  startTimer,
  cancelTimer,
  getRemainingSeconds,
  startDescribeTimer,
  startDiscussTimer,
  startVoteTimer,
  startVoteTieTimer,
  startRoundResultTimer,
  startRoleCheckTimer,
  startRoleCheckResultTimer,
};
