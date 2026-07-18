/**
 * Throw this anywhere in a controller/service for an expected, handled error
 * (bad input, forbidden action, duplicate resource, etc). The global error
 * handler middleware catches it and turns it into the standard envelope.
 *
 * Anything that is NOT an AppError is treated as an unexpected bug and
 * logged + returned as a generic 500 — this is what satisfies the hard
 * constraint "API must not crash on invalid input."
 */
class AppError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }
}

module.exports = AppError;
