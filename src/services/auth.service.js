
const bcrypt = require('bcrypt');
const User = require('../models/User');
const verificationService = require('./verification.service');
const jwt = require('jsonwebtoken');

const registerUser = async ({
  firstName,
  lastName,
  email,
  password,
  phoneNumber,
}) => {
  const normalizedEmail = email.trim().toLowerCase();

  let user = await User.findOne({ email: normalizedEmail });

  // Don't create another account if this email is already verified.
  if (user && user.isEmailVerified) {
    const error = new Error('Email is already registered');
    error.statusCode = 409;
    throw error;
  }

  // Hash the password before saving it.
  const hashedPassword = await bcrypt.hash(password, 12);

  if (!user) {
    try {
      user = await User.create({
        firstName,
        lastName,
        email: normalizedEmail,
        phoneNumber,
        password: hashedPassword,
        role: 'BUYER',
        isEmailVerified: false,
      });
    } catch (error) {
      // Handle a duplicate email caused by simultaneous registrations.
      if (error.code === 11000) {
        const duplicateError = new Error('Email is already registered');
        duplicateError.statusCode = 409;
        throw duplicateError;
      }

      throw error;
    }
  }

  // Send an email verification challenge.
  await verificationService.createChallenge(user, 'EMAIL');

  return {
    id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
  };
};


// LOGIN USERS

const loginUser = async ({ email, password }) => {
  const normalizedEmail = email.trim().toLowerCase();

  // Find the user and explicitly include the password hash.
  const user = await User.findOne({
    email: normalizedEmail,
  }).select('+password');

  // Use a generic error so we don't reveal whether an email exists.
  if (!user) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  // Compare the submitted password with the stored bcrypt hash.
  const isPasswordValid = await bcrypt.compare(
    password,
    user.password
  );

  if (!isPasswordValid) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  // Prevent unverified users from logging in.
  if (!user.isEmailVerified) {
    const error = new Error('Please verify your email before logging in');
    error.statusCode = 403;
    throw error;
  }

  // Prevent deactivated accounts from logging in.
  if (!user.isActive) {
    const error = new Error('This account is currently inactive');
    error.statusCode = 403;
    throw error;
  }

  // Generate a short-lived access token.
  const accessToken = jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m',
    }
  );

  return {
    accessToken,
    user: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
    },
  };
};

module.exports = { registerUser, loginUser, };



