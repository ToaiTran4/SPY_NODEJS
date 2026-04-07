/**
 * Room Model (Native MongoDB Reference)
 * 
 * Document Structure:
 * - _id: ObjectId
 * - roomCode: String (unique)
 * - hostId: String
 * - isPrivate: Boolean
 * - currentPlayers: Number
 * - maxPlayers: Number
 * - status: String ('waiting', 'in_game', 'finished')
 * - specialRound: Boolean
 * - adminSelectedSpyId: String
 * - createdAt: Date
 * - updatedAt: Date
 */

module.exports = {
  COLLECTION_NAME: 'rooms'
};
