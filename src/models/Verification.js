
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
  {
    timestamps: true,
  }
);

// Automatically clean up expired verification records.
verificationSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

verificationSchema.index({ userId: 1, channel: 1 });

module.exports = mongoose.model('Verification', verificationSchema);
