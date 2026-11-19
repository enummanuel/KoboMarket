
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const sendOTP = async ({ channel, target, otp }) => {
  if (channel !== 'EMAIL') {
    throw new Error('Only email OTP delivery is currently supported');
  }

  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  if (!process.env.FROM_EMAIL) {
    throw new Error('FROM_EMAIL is not configured');
  }

  const { data, error } = await resend.emails.send({
    from: process.env.FROM_EMAIL,
    to: target,
    subject: 'Your KoboMarket Verification Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto;">
        <h2>Welcome to KoboMarket</h2>
        <p>Use the verification code below to verify your email address:</p>
        <h1 style="letter-spacing: 8px;">${otp}</h1>
        <p>This code expires in 10 minutes.</p>
        <p>If you didn't request this code, you can ignore this email.</p>
      </div>
    `,
  });

  if (error) {
    throw new Error(`OTP email delivery failed: ${error.message}`);
  }

  return data;
};

module.exports = { sendOTP };
