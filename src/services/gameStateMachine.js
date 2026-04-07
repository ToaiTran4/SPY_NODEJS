// Game State Machine — validates transitions
const VALID_TRANSITIONS = {
  WAITING: ['ROLE_ASSIGN'],
  ROLE_ASSIGN: ['DESCRIBING'],
  DESCRIBING: ['DISCUSSING'],
  DISCUSSING: ['VOTING'],
  VOTING: ['VOTE_TIE', 'ROUND_RESULT'],
  VOTE_TIE: ['ROLE_CHECK', 'DESCRIBING', 'ROUND_RESULT'],
  ROUND_RESULT: ['ROLE_CHECK', 'DESCRIBING', 'GAME_OVER'],
  ROLE_CHECK: ['ROLE_CHECK_RESULT'],
  ROLE_CHECK_RESULT: ['DESCRIBING'],
  GAME_OVER: [],
};

function transition(session, newState) {
  const current = session.state;
  const allowed = VALID_TRANSITIONS[current] || [];
  if (!allowed.includes(newState)) {
    throw new Error(`Invalid state transition: ${current} -> ${newState}`);
  }
  session.state = newState;
  session.updatedAt = new Date();
}

function isPhase(session, state) {
  return session.state === state;
}

module.exports = { transition, isPhase };
