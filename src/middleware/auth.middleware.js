const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  try {
    // Get the Authorization header.
    const authHeader = req.headers.authorization;

    // Ensure the header contains a Bearer token.
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Extract the token.
    const token = authHeader.split(' ')[1];

    // Verify the token.
    const decoded = jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET
    );

    // Attach authenticated user information to the request.
    req.user = {
      id: decoded.sub,
      role: decoded.role,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired access token',
    });
  }
};

module.exports = authenticate;