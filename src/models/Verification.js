
const mongoose = require('mongoose');

const verificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    channel: {
      type: String,
      enum: ['EMAIL', 'SMS'],
      required: true,
    },

    purpose: {
      type: String,
      enum: ['EMAIL_VERIFICATION', 'PASSWORD_RESET'],
      default: 'EMAIL_VERIFICATION',
      required: true,
    },

    target: {
      type: String,
      required: true,
    },

    otpHash: {
      type: String,
      required: true,
    },

    attempts: {
      type: Number,
      default: 0,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    resendAfter: {
      type: Date,
      required: true,
    },

    consumedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Automatically delete expired verification records.
verificationSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

// Find verification records belonging to a user and channel.
verificationSchema.index({
  userId: 1,
  channel: 1,
  purpose: 1,
});

module.exports = mongoose.model('Verification', verificationSchema);
