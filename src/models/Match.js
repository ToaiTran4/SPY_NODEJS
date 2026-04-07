/**
 * Match Model (Native MongoDB Reference)
 * 
 * Document Structure:
 * - _id: ObjectId
 * - roomId: String
 * - civilianKeyword: String
 * - spyKeyword: String
 * - civilianDescription: String
 * - spyDescription: String
 * - spyUserId: String
 * - infectedUserId: String
 * - status: String ('in_progress', 'finished')
 * - winnerRole: String ('spy', 'civilian')
 * - totalRounds: Number
 * - isSpecialRound: Boolean
 * - startedAt: Date
 * - endedAt: Date
 */

module.exports = {
  COLLECTION_NAME: 'matches'
};
