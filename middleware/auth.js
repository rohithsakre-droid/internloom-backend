const { verifyAccessToken } = require('../services/tokenService');
const AppError = require('../utils/AppError');

/** Verifies the access token and attaches { id, role } to req.user. */
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError(401, 'NO_TOKEN', 'Authorization header missing or malformed'));
  }
  const token = header.split(' ')[1];
  try {
    const decoded = verifyAccessToken(token);
    req.user = { id: decoded.sub, role: decoded.role };
    next();
  } catch (err) {
    return next(new AppError(401, 'INVALID_TOKEN', 'Access token is invalid or expired'));
  }
}

/** Restricts a route to one or more roles, e.g. requireRole('student'). */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action'));
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
