
const express = require('express');

const authController = require('../controllers/auth.controller');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/auth.middleware');

const {
  registerSchema,
  verifyEmailSchema,
  resendOTPSchema,
  loginSchema,
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

router.get(
  '/me', 
  authenticate, 
  authController.getMe);

module.exports = router;
