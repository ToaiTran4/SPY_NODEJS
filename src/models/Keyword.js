/**
 * Keyword Model (Native MongoDB Reference)
 * 
 * Document Structure:
 * - _id: ObjectId
 * - civilianKeyword: String
 * - spyKeyword: String
 * - civilianDescription: String
 * - spyDescription: String
 * - isSpecial: Boolean (optional)
 * - createdAt: Date
 */

module.exports = {
  COLLECTION_NAME: 'keyword_pairs'
};
