
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
  getMe,
};
