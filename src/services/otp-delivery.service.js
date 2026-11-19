const sendOTP = async ({ channel, target, otp }) => {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('OTP delivery provider is not configured');
  }

  if (channel !== 'EMAIL') {
    throw new Error('Only email OTP delivery is currently supported');
  }

  console.log('-------------------------------');
  console.log('KOBO MARKET - EMAIL VERIFICATION');
  console.log(`Recipient: ${target}`);
  console.log(`Verification code: ${otp}`);
  console.log('This code expires in 10 minutes.');
  console.log('-------------------------------');
};

module.exports = { sendOTP };