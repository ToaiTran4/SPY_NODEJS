/**
 * User Model (Native MongoDB Reference)
 * 
 * Document Structure:
 * - _id: ObjectId
 * - username: String (unique)
 * - email: String (unique)
 * - password: String (hashed)
 * - displayName: String
 * - avatarUrl: String
 * - role: String ('ROLE_USER', 'ROLE_ADMIN')
 * - balance: Number
 * - rankingPoints: Number
 * - active: Boolean
 * - resetToken: String
 * - resetTokenExpiry: Date
 * - createdAt: Date
 * - updatedAt: Date
 */

module.exports = {
  COLLECTION_NAME: 'users',
  
  // Helper to format user for response (remove sensitive data)
  formatUserResponse: (user, accessToken, refreshToken) => {
    const response = {
      user_id: user._id.toString(),
      username: user.username,
      display_name: user.displayName || '',
      avatar_url: user.avatarUrl || '',
      role: user.role,
      balance: user.balance || 0,
      ranking_points: user.rankingPoints || 0,
    };

    if (accessToken) response.access_token = accessToken;
    if (refreshToken) response.refresh_token = refreshToken;
    
    return response;
  }
};
