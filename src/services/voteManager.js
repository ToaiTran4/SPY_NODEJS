// VoteManager — processes votes and finds the eliminated player

function processVotes(session) {
  const roundVotes = session.votes[session.currentRound] || {};
  const voteCounts = {}; // targetId -> count

  for (const [, targetId] of Object.entries(roundVotes)) {
    voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
  }

  if (Object.keys(voteCounts).length === 0) return null;

  const maxVotes = Math.max(...Object.values(voteCounts));
  const topTargets = Object.entries(voteCounts)
    .filter(([, count]) => count === maxVotes)
    .map(([id]) => id);

  if (topTargets.length > 1) return null; // Tie

  return topTargets[0]; // The eliminated player ID
}

function allVoted(session) {
  const roundVotes = session.votes[session.currentRound] || {};
  const alivePlayers = session.players.filter(p => p.isAlive);
  return alivePlayers.every(p => roundVotes[p.userId] !== undefined);
}

module.exports = { processVotes, allVoted };
