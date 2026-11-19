
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const Session = require('../models/Session');
const verificationService = require('./verification.service');

const {
  generateRefreshToken,
  hashRefreshToken,
} = require('../utils/refresh-token');

const Verification = require('../models/Verification');
const { compareOTP } = require('../utils/otp');

// REGISTER USER
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


// LOGIN USER
const loginUser = async ({ email, password }) => {
  const normalizedEmail = email.trim().toLowerCase();

  // Find the user and explicitly include the password hash.
  const user = await User.findOne({
    email: normalizedEmail,
  }).select('+password');

  // Reject unknown email.
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

  // Require email verification.
  if (!user.isEmailVerified) {
    const error = new Error('Please verify your email before logging in');
    error.statusCode = 403;
    throw error;
  }

  // Reject deactivated accounts.
  if (!user.isActive) {
    const error = new Error('This account is currently inactive');
    error.statusCode = 403;
    throw error;
  }

  // Generate the access token.
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

  // Generate a secure refresh token.
  const refreshToken = generateRefreshToken();

  // Hash the refresh token before storing it.
  const refreshTokenHash = hashRefreshToken(refreshToken);

  // Set the session expiry to seven days.
  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
  );

  // Create the user's session in MongoDB.
  await Session.create({
    userId: user._id,
    refreshTokenHash,
    expiresAt,
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
    },
  };
};

// REFRESH TOKEN

// REFRESH ACCESS TOKEN WITH ROTATION AND REUSE DETECTION
const refreshAccessToken = async ({ refreshToken }) => {
  if (!refreshToken) {
    const error = new Error('Refresh token is required');
    error.statusCode = 400;
    throw error;
  }

  const oldTokenHash = hashRefreshToken(refreshToken);
  const now = new Date();

  // Find the session containing the current refresh token.
  const session = await Session.findOne({
    refreshTokenHash: oldTokenHash,
    revokedAt: null,
    expiresAt: { $gt: now },
  });

  // If no active session exists, check whether this token was already used.
  if (!session) {
    const usedSession = await Session.findOne({
      usedRefreshTokenHashes: oldTokenHash,
    });

    if (usedSession) {
      // A previously used token was presented again.
      // Revoke every active session belonging to that user.
      await Session.updateMany(
        { userId: usedSession.userId, revokedAt: null },
        { $set: { revokedAt: now } }
      );

      const error = new Error('Refresh token reuse detected. Please log in again.');
      error.statusCode = 401;
      throw error;
    }

    const error = new Error('Invalid or expired refresh token');
    error.statusCode = 401;
    throw error;
  }

  // Confirm that the account is still allowed to access the platform.
  const user = await User.findById(session.userId);

  if (!user || !user.isActive || !user.isEmailVerified) {
    await Session.updateMany(
      { userId: session.userId, revokedAt: null },
      { $set: { revokedAt: now } }
    );

    const error = new Error('Account is unavailable. Please log in again.');
    error.statusCode = 401;
    throw error;
  }

  // Generate the replacement refresh token.
  const newRefreshToken = generateRefreshToken();
  const newRefreshTokenHash = hashRefreshToken(newRefreshToken);
  const newExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Atomically replace the old token.
  const updatedSession = await Session.findOneAndUpdate(
    {
      _id: session._id,
      refreshTokenHash: oldTokenHash,
      revokedAt: null,
      expiresAt: { $gt: now },
    },
    {
      $set: {
        refreshTokenHash: newRefreshTokenHash,
        expiresAt: newExpiresAt,
      },
      $push: {
        usedRefreshTokenHashes: oldTokenHash,
      },
    },
    { new: true }
  );

  // Another request may have rotated this token first.
  if (!updatedSession) {
    const usedSession = await Session.findOne({
      usedRefreshTokenHashes: oldTokenHash,
    });

    if (usedSession) {
      await Session.updateMany(
        { userId: usedSession.userId, revokedAt: null },
        { $set: { revokedAt: now } }
      );
    }

    const error = new Error('Refresh token is invalid or has already been used');
    error.statusCode = 401;
    throw error;
  }

  // Issue a new short-lived access token.
  const accessToken = jwt.sign(
    { sub: user._id.toString(), role: user.role },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m' }
  );

  return {
    accessToken,
    refreshToken: newRefreshToken,
  };
};

// LOGOUT USER
const logoutUser = async ({ refreshToken }) => {
  if (!refreshToken) {
    const error = new Error('Refresh token is required');
    error.statusCode = 400;
    throw error;
  }

  const refreshTokenHash = hashRefreshToken(refreshToken);

  await Session.findOneAndUpdate(
    {
      refreshTokenHash,
      revokedAt: null,
    },
    {
      $set: { revokedAt: new Date() },
    }
  );

  return {
    message: 'Logout successful',
  };
};

// RESET USER PASSWORD
const resetPassword = async ({ email, otp, newPassword }) => {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await User.findOne({
    email: normalizedEmail,
    isEmailVerified: true,
    isActive: true,
  });

  if (!user) {
    const error = new Error('Invalid or expired password reset code');
    error.statusCode = 400;
    throw error;
  }

  const challenge = await Verification.findOne({
    userId: user._id,
    channel: 'EMAIL',
    purpose: 'PASSWORD_RESET',
    target: normalizedEmail,
    consumedAt: null,
    expiresAt: { $gt: new Date() },
    attempts: { $lt: 5 },
  }).sort({ createdAt: -1 });

  if (!challenge) {
    const error = new Error('Invalid or expired password reset code');
    error.statusCode = 400;
    throw error;
  }

  const isValid = compareOTP(otp, challenge.otpHash);

  if (!isValid) {
    const updatedChallenge = await Verification.findOneAndUpdate(
      {
        _id: challenge._id,
        consumedAt: null,
        expiresAt: { $gt: new Date() },
        attempts: { $lt: 5 },
      },
      { $inc: { attempts: 1 } },
      { new: true }
    );

    if (updatedChallenge && updatedChallenge.attempts >= 5) {
      await Verification.updateOne(
        {
          _id: updatedChallenge._id,
          consumedAt: null,
        },
        { $set: { consumedAt: new Date() } }
      );
    }

    const error = new Error('Invalid or expired password reset code');
    error.statusCode = 400;
    throw error;
  }

  // Consume the OTP atomically to prevent reuse.
  const consumedChallenge = await Verification.findOneAndUpdate(
    {
      _id: challenge._id,
      consumedAt: null,
      expiresAt: { $gt: new Date() },
      attempts: { $lt: 5 },
    },
    { $set: { consumedAt: new Date() } },
    { new: true }
  );

  if (!consumedChallenge) {
    const error = new Error('Invalid or expired password reset code');
    error.statusCode = 400;
    throw error;
  }

  // Hash and update the new password.
  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await User.updateOne(
    { _id: user._id },
    { $set: { password: hashedPassword } }
  );

  // Revoke all active sessions after a password change.
  await Session.updateMany(
    { userId: user._id, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );

  return {
    message: 'Password reset successful. Please log in again.',
  };
};


module.exports = {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  resetPassword,
};
