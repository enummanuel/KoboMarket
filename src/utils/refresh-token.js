const crypto = require('crypto');

// Generate a cryptographically secure refresh token.
const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString('hex');
};

// Hash the refresh token before storing it.
const hashRefreshToken = (token) => {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
};

module.exports = {
  generateRefreshToken,
  hashRefreshToken,
};