
const Verification = require('../models/Verification');
const User = require('../models/User');

const {
  generateOTP,
  hashOTP,
  compareOTP,
} = require('../utils/otp');

const { sendOTP } = require('./otp-delivery.service');

const createChallenge = async (user, channel = 'EMAIL') => {
  if (channel !== 'EMAIL') {
    const error = new Error('Only email verification is currently supported');
    error.statusCode = 400;
    throw error;
  }

  const now = new Date();

  // Check for an existing active challenge.
  const activeChallenge = await Verification.findOne({
    userId: user._id,
    channel,
    consumedAt: null,
  }).sort({ createdAt: -1 });

  // Enforce the 60-second resend cooldown.
  if (activeChallenge && activeChallenge.resendAfter > now) {
    const error = new Error('Please wait before requesting another code');
    error.statusCode = 429;
    throw error;
  }

  // Invalidate previous challenges.
  await Verification.updateMany(
    {
      userId: user._id,
      channel,
      consumedAt: null,
    },
    {
      $set: { consumedAt: now },
    }
  );

  const otp = generateOTP();

  const verification = await Verification.create({
    userId: user._id,
    channel,
    target: user.email,
    otpHash: hashOTP(otp),
    attempts: 0,
    expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
    resendAfter: new Date(now.getTime() + 60 * 1000),
  });

  try {
    await sendOTP({
      channel,
      target: user.email,
      otp,
    });
  } catch (error) {
    await Verification.deleteOne({ _id: verification._id });
    throw error;
  }

  return verification;
};

const verifyEmail = async ({ email, otp }) => {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await User.findOne({
    email: normalizedEmail,
  });

  if (!user) {
    const error = new Error('Invalid or expired verification code');
    error.statusCode = 400;
    throw error;
  }

  if (user.isEmailVerified) {
    const error = new Error('Email is already verified');
    error.statusCode = 409;
    throw error;
  }

  const now = new Date();

  const challenge = await Verification.findOne({
    userId: user._id,
    channel: 'EMAIL',
    target: normalizedEmail,
    consumedAt: null,
    expiresAt: { $gt: now },
    attempts: { $lt: 5 },
  }).sort({ createdAt: -1 });

  if (!challenge) {
    const error = new Error('Invalid or expired verification code');
    error.statusCode = 400;
    throw error;
  }

  const isValid = compareOTP(otp, challenge.otpHash);

  if (!isValid) {
    // Atomically increment failed attempts.
    const updatedChallenge = await Verification.findOneAndUpdate(
      {
        _id: challenge._id,
        consumedAt: null,
        expiresAt: { $gt: new Date() },
        attempts: { $lt: 5 },
      },
      {
        $inc: { attempts: 1 },
      },
      { new: true }
    );

    // Permanently consume the challenge after five failed attempts.
    if (updatedChallenge && updatedChallenge.attempts >= 5) {
      await Verification.updateOne(
        {
          _id: updatedChallenge._id,
          consumedAt: null,
        },
        {
          $set: { consumedAt: new Date() },
        }
      );
    }

    const error = new Error('Invalid or expired verification code');
    error.statusCode = 400;
    throw error;
  }

  // Atomically consume the OTP to prevent reuse.
  const consumedChallenge = await Verification.findOneAndUpdate(
    {
      _id: challenge._id,
      consumedAt: null,
      expiresAt: { $gt: new Date() },
      attempts: { $lt: 5 },
    },
    {
      $set: { consumedAt: new Date() },
    },
    { new: true }
  );

  if (!consumedChallenge) {
    const error = new Error('Invalid or expired verification code');
    error.statusCode = 400;
    throw error;
  }

  // Mark the user's email as verified.
  const updatedUser = await User.findOneAndUpdate(
    {
      _id: user._id,
      isEmailVerified: false,
    },
    {
      $set: { isEmailVerified: true },
    },
    { new: true }
  );

  if (!updatedUser) {
    const error = new Error('Email verification could not be completed');
    error.statusCode = 409;
    throw error;
  }

  // Invalidate any other outstanding email challenges.
  await Verification.updateMany(
    {
      userId: user._id,
      channel: 'EMAIL',
      consumedAt: null,
    },
    {
      $set: { consumedAt: new Date() },
    }
  );

  return {
    message: 'Email verified successfully',
  };
};

const resendOTP = async ({ email }) => {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await User.findOne({
    email: normalizedEmail,
  });

  // Avoid revealing whether an account exists.
  if (!user || user.isEmailVerified) {
    return {
      message: 'If the account exists and needs verification, a code will be sent.',
    };
  }

  // The challenge service enforces the cooldown.
  await createChallenge(user, 'EMAIL');

  return {
    message: 'If the account exists and needs verification, a code will be sent.',
  };
};

module.exports = {
  createChallenge,
  verifyEmail,
  resendOTP,
};

