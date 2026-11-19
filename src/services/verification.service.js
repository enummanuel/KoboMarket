
const Verification = require('../models/Verification');
const User = require('../models/User');

const {
  generateOTP,
  hashOTP,
  compareOTP,
} = require('../utils/otp');

const { sendOTP } = require('./otp-delivery.service');

// CREATE OTP CHALLENGE
const createChallenge = async (
  user,
  channel = 'EMAIL',
  purpose = 'EMAIL_VERIFICATION'
) => {
  if (channel !== 'EMAIL') {
    const error = new Error('Only email OTP delivery is currently supported');
    error.statusCode = 400;
    throw error;
  }

  if (!['EMAIL_VERIFICATION', 'PASSWORD_RESET'].includes(purpose)) {
    const error = new Error('Invalid verification purpose');
    error.statusCode = 400;
    throw error;
  }

  const now = new Date();

  // Find an active challenge for this specific purpose.
  const activeChallenge = await Verification.findOne({
    userId: user._id,
    channel,
    purpose,
    consumedAt: null,
  }).sort({ createdAt: -1 });

  // Enforce the 60-second resend cooldown.
  if (activeChallenge && activeChallenge.resendAfter > now) {
    const error = new Error('Please wait before requesting another code');
    error.statusCode = 429;
    throw error;
  }

  // Invalidate previous challenges for the same purpose only.
  await Verification.updateMany(
    {
      userId: user._id,
      channel,
      purpose,
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
    purpose,
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

// VERIFY EMAIL
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
    purpose: 'EMAIL_VERIFICATION',
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

  // Invalidate other outstanding email-verification challenges.
  await Verification.updateMany(
    {
      userId: user._id,
      channel: 'EMAIL',
      purpose: 'EMAIL_VERIFICATION',
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

// RESEND EMAIL VERIFICATION OTP
const resendOTP = async ({ email }) => {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await User.findOne({
    email: normalizedEmail,
  });

  if (!user || user.isEmailVerified) {
    return {
      message: 'If the account exists and needs verification, a code will be sent.',
    };
  }

  await createChallenge(user, 'EMAIL', 'EMAIL_VERIFICATION');

  return {
    message: 'If the account exists and needs verification, a code will be sent.',
  };
};

// REQUEST PASSWORD RESET OTP
const requestPasswordReset = async ({ email }) => {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await User.findOne({
    email: normalizedEmail,
  });

  // Do not reveal whether an account exists.
  if (!user || !user.isEmailVerified || !user.isActive) {
    return {
      message: 'If the account exists, a password reset code will be sent.',
    };
  }

  try {
    await createChallenge(user, 'EMAIL', 'PASSWORD_RESET');
  } catch (error) {
    // Keep the response generic during the resend cooldown.
    if (error.statusCode !== 429) {
      throw error;
    }
  }

  return {
    message: 'If the account exists, a password reset code will be sent.',
  };
};


module.exports = {
  createChallenge,
  verifyEmail,
  resendOTP,
  requestPasswordReset,
};
