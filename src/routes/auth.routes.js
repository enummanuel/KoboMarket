
const express = require('express');

const authController = require('../controllers/auth.controller');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/auth.middleware');
const authorize = require('../middleware/role.middleware');
const {
  registerSchema,
  verifyEmailSchema,
  resendOTPSchema,
  loginSchema,
  refreshTokenSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
} = require('../validators/auth.validator');


const router = express.Router();

router.post(
  '/register',
  validate(registerSchema),
  authController.register
);

router.post(
  '/verify-email',
  validate(verifyEmailSchema),
  authController.verifyEmail
);

router.post(
  '/resend-otp',
  validate(resendOTPSchema),
  authController.resendOTP
);

router.post(
  '/login', 
  validate(loginSchema), 
  authController.login);

router.post(
  '/refresh',
  validate(refreshTokenSchema),
  authController.refresh
);

router.post(
  '/logout',
  validate(refreshTokenSchema),
  authController.logout
);

router.post(
  '/forgot-password',
  validate(requestPasswordResetSchema),
  authController.requestPasswordReset
);

router.post(
  '/reset-password',
  validate(resetPasswordSchema),
  authController.resetPassword
);

router.get(
  '/me', 
  authenticate, 
  authController.getMe);

router.get(
  '/admin-test',
  authenticate,
  authorize('ADMIN'),
  (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Welcome, Admin!',
    });
  }
);

module.exports = router;
