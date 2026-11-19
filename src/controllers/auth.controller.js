
const authService = require('../services/auth.service');
const verificationService = require('../services/verification.service');

const register = async (req, res) => {
  const user = await authService.registerUser(req.body);

  return res.status(202).json({
    success: true,
    message: 'Account created. Check your email for a verification code.',
    data: user,
  });
};

const verifyEmail = async (req, res) => {
  const result = await verificationService.verifyEmail(req.body);

  return res.status(200).json({
    success: true,
    message: result.message,
  });
};

const resendOTP = async (req, res) => {
  const result = await verificationService.resendOTP(req.body);

  return res.status(200).json({
    success: true,
    message: result.message,
  });
};

const login = async (req, res) => {
  const result = await authService.loginUser(req.body);

  return res.status(200).json({
    success: true,
    message: 'Login successful',
    data: result,
  });
};

const refresh = async (req, res) => {
  const result = await authService.refreshAccessToken(req.body);

  return res.status(200).json({
    success: true,
    message: 'Token refreshed successfully',
    data: result,
  });
};

const logout = async (req, res) => {
  const result = await authService.logoutUser(req.body);

  return res.status(200).json({
    success: true,
    message: result.message,
  });
};

// REQUEST PASSWORD RESET
const requestPasswordReset = async (req, res) => {
  const result = await verificationService.requestPasswordReset(req.body);

  return res.status(200).json({
    success: true,
    message: result.message,
  });
};

// RESET PASSWORD
const resetPassword = async (req, res) => {
  const result = await authService.resetPassword(req.body);

  return res.status(200).json({
    success: true,
    message: result.message,
  });
};

const getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      id: req.user.id,
      role: req.user.role,
    },
  });
};

module.exports = {
  register,
  verifyEmail,
  resendOTP,
  login,
  refresh,
  logout,
  requestPasswordReset,
  resetPassword,
  getMe,
};
