const jwtService = require('../services/jwtService');
const userService = require('../services/userService');
const emailService = require('../services/emailService');
const { blacklistToken } = require('../services/tokenBlacklistService');

const register = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    const confirmPassword = req.body.confirmPassword || req.body.confirm_password;
    const displayName = req.body.displayName || req.body.display_name;

    if (!password || password !== confirmPassword) {
      return res.status(400).json({ error: 'Mật khẩu xác nhận không khớp.' });
    }
    const user = await userService.registerUser(username, email, password, displayName, role);
    const accessToken = jwtService.generateAccessToken(user);
    const refreshToken = jwtService.generateRefreshToken(user);
    
    return res.status(201).json({
      user_id: user._id.toString(),
      username: user.username,
      display_name: user.displayName,
      avatar_url: user.avatarUrl,
      role: user.role,
      balance: user.balance,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: jwtService.getAccessTokenExpirationInSeconds(),
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const login = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const identifier = (username && username.trim()) ? username : email;
    const user = await userService.findByUsernameOrEmail(identifier);
    if (!user) return res.status(401).json({ error: 'Invalid username or password' });
    if (!user.active) return res.status(403).json({ error: 'Account is banned' });
    const valid = await userService.validatePassword(user, password);
    if (!valid) return res.status(401).json({ error: 'Invalid username or password' });

    const accessToken = jwtService.generateAccessToken(user);
    const refreshToken = jwtService.generateRefreshToken(user);
    return res.json({
      user_id: user._id.toString(),
      username: user.username,
      display_name: user.displayName,
      avatar_url: user.avatarUrl,
      role: user.role,
      balance: user.balance,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: jwtService.getAccessTokenExpirationInSeconds(),
    });
  } catch (e) {
    res.status(401).json({ error: 'Invalid username or password' });
  }
};

const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const username = jwtService.extractUsername(refreshToken);
    if (!username) return res.status(401).json({ error: 'Invalid refresh token' });
    if (!jwtService.isTokenValid(refreshToken)) return res.status(401).json({ error: 'Invalid refresh token' });
    const user = await userService.findByUsernameOrEmail(username);
    if (!user) return res.status(401).json({ error: 'User not found' });
    const accessToken = jwtService.generateAccessToken(user);
    res.json({
      user_id: user._id.toString(),
      username: user.username,
      display_name: user.displayName,
      avatar_url: user.avatarUrl,
      role: user.role,
      balance: user.balance,
      access_token: accessToken,
      expires_in: jwtService.getAccessTokenExpirationInSeconds(),
    });
  } catch (e) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
};

const me = (req, res) => {
  const u = req.user;
  res.json({
    user_id: u._id.toString(),
    username: u.username,
    display_name: u.displayName,
    avatar_url: u.avatarUrl,
    role: u.role,
    balance: u.balance,
  });
};

const logout = (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.substring(7);
  const username = jwtService.extractUsername(token);
  if (!username) return res.status(401).json({ error: 'Invalid token' });
  blacklistToken(token);
  res.json({ message: 'Logged out' });
};

const forgotPassword = async (req, res) => {
  try {
    const { email, username } = req.body;
    const user = await userService.findByEmail(email);
    if (!user || user.username !== username) {
      return res.json({ message: 'Nếu thông tin khớp với hệ thống, mã xác nhận sẽ được gửi đi.' });
    }
    const token = await userService.generateResetToken(user);
    await emailService.sendResetPasswordEmail(user.email, token);
    res.json({ message: 'Mã xác nhận đã được gửi đến email của bạn.' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const verifyResetToken = async (req, res) => {
  try {
    const { email, username, token } = req.body;
    const user = await userService.findByEmail(email);
    if (!user || user.username !== username) {
      return res.status(400).json({ error: 'Thông tin tài khoản không khớp.' });
    }
    const isValid = await userService.verifyResetToken(email, token);
    if (isValid) {
      res.json({ message: 'Mã xác nhận hợp lệ.' });
    } else {
      res.status(400).json({ error: 'Mã xác nhận không hợp lệ hoặc đã hết hạn.' });
    }
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;
    const success = await userService.processPasswordReset(email, token, newPassword);
    if (success) {
      res.json({ message: 'Mật khẩu đã được đặt lại thành công.' });
    } else {
      res.status(400).json({ error: 'Yêu cầu không hợp lệ. Vui lòng thử lại từ đầu.' });
    }
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const success = await userService.changePassword(req.username, oldPassword, newPassword);
    if (success) {
      res.json({ message: 'Đổi mật khẩu thành công.' });
    } else {
      res.status(400).json({ error: 'Mật khẩu cũ không chính xác.' });
    }
  } catch (e) {
    res.status(500).json({ error: 'Đã có lỗi xảy ra, vui lòng thử lại.' });
  }
};

module.exports = {
  register,
  login,
  refresh,
  me,
  logout,
  forgotPassword,
  verifyResetToken,
  resetPassword,
  changePassword
};
