const AppError = require('../utils/AppError');

/**
 * Single place where every error in the app is turned into the standard
 * envelope. This is what satisfies the hard constraint "API must not crash
 * on invalid input" — every controller can just `next(err)` or throw inside
 * an async wrapper, and it lands here instead of taking the process down.
 */
function errorHandler(err, req, res, next) {
  // Known, expected errors we threw ourselves
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
  }

  // Mongoose validation errors -> 400, not 500
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: err.message },
    });
  }

  // Mongo duplicate key error -> 409, not 500
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      error: { code: 'DUPLICATE_RESOURCE', message: 'This resource already exists' },
    });
  }

  // Malformed ObjectId in a URL param -> 400, not 500
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_ID', message: `Invalid identifier: ${err.value}` },
    });
  }

  // Anything unanticipated: log it, return a generic 500, never crash.
  console.error('UNEXPECTED ERROR:', err);
  return res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our end' },
  });
}

/** Wraps async controller functions so thrown errors reach errorHandler instead of crashing the process. */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { errorHandler, asyncHandler };
