/**
 * Transaction Model (Native MongoDB Reference)
 * 
 * Document Structure:
 * - _id: ObjectId
 * - userId: String
 * - amount: Number
 * - type: String ('WIN_REWARD', 'DAILY_CHECKIN', 'BANKRUPTCY_RELIEF', 'SHOP_BUY', 'ADMIN_ADD', etc.)
 * - description: String
 * - createdAt: Date
 */

module.exports = {
  COLLECTION_NAME: 'transactions'
};
