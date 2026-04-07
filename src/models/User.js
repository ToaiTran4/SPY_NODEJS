const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  displayName: { type: String, default: '' },
  avatarUrl: { type: String, default: '' },
  role: { type: String, default: 'ROLE_USER' },
  balance: { type: Number, default: 0 },
  rankingPoints: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  resetToken: { type: String },
  resetTokenExpiry: { type: Date },
  lastCheckinDate: { type: Date },
  checkinStreak: { type: Number, default: 0 },
  inventory: { type: Map, of: Number, default: {} },
}, { timestamps: true });

// Helper to format user for response (remove sensitive data)
userSchema.methods.toResponse = function(accessToken, refreshToken) {
  const response = {
    user_id: this._id.toString(),
    username: this.username,
    display_name: this.displayName || '',
    avatar_url: this.avatarUrl || '',
    role: this.role,
    balance: this.balance || 0,
    ranking_points: this.rankingPoints || 0,
  };

  if (accessToken) response.access_token = accessToken;
  if (refreshToken) response.refresh_token = refreshToken;
  
  return response;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
