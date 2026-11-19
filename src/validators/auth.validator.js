
const Joi = require('joi');

const registerSchema = Joi.object({
  firstName: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required(),

  lastName: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required(),

  email: Joi.string()
    .trim()
    .lowercase()
    .email()
    .max(254)
    .required(),

  password: Joi.string()
    .min(8)
    .max(128)
    .required(),

  phoneNumber: Joi.string()
    .pattern(/^\+[1-9]\d{7,14}$/)
    .optional(),

}).unknown(false);

const verifyEmailSchema = Joi.object({
  email: Joi.string()
    .trim()
    .lowercase()
    .email()
    .required(),

  otp: Joi.string()
    .pattern(/^\d{6}$/)
    .required(),

}).unknown(false);

const resendOTPSchema = Joi.object({
  email: Joi.string()
    .trim()
    .lowercase()
    .email()
    .required(),

}).unknown(false);

const loginSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
  password: Joi.string().required(),
}).unknown(false);

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().trim().required(),
}).unknown(false);

// REQUEST PASSWORD RESET
const requestPasswordResetSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
}).unknown(false);

// RESET PASSWORD
const resetPasswordSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
  otp: Joi.string().pattern(/^\d{6}$/).required(),
  newPassword: Joi.string().min(8).max(128).required(),
}).unknown(false);

module.exports = {
  registerSchema,
  verifyEmailSchema,
  resendOTPSchema,
  loginSchema,
  refreshTokenSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
};
