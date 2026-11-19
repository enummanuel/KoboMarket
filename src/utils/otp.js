const crypto = require('crypto');

// Generate a random 6-digit OTP
const generateOTP = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

// Securely hash the OTP using our secret key
const hashOTP = (otp) => {
  const secret = process.env.OTP_SECRET;

  if (!secret) {
    throw new Error('OTP_SECRET is not configured');
  }

  return crypto
    .createHmac('sha256', secret)
    .update(otp)
    .digest('hex');
};

// Compare a submitted OTP with the stored hash
const compareOTP = (otp, storedHash) => {
  const submittedHash = hashOTP(otp);

  const submittedBuffer = Buffer.from(submittedHash, 'hex');
  const storedBuffer = Buffer.from(storedHash, 'hex');

  if (submittedBuffer.length !== storedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(submittedBuffer, storedBuffer);
};

module.exports = {
  generateOTP,
  hashOTP,
  compareOTP,
};