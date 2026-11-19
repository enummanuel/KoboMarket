const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    // Ensure the user is authenticated first.
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Check whether the user's role is permitted.
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action',
      });
    }

    next();
  };
};

module.exports = authorize;