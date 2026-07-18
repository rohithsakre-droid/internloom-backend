/**
 * Every API response follows this shape, success or failure.
 * This is what the "consistent envelope" requirement in the problem
 * statement (4.1) is checking for.
 *
 * Success:
 * { success: true, data: {...} | [...], meta: {...} | null }
 *
 * Error:
 * { success: false, error: { code: "SOME_CODE", message: "human readable" } }
 */

function success(res, statusCode, data, meta = null) {
  return res.status(statusCode).json({
    success: true,
    data,
    meta,
  });
}

function failure(res, statusCode, code, message) {
  return res.status(statusCode).json({
    success: false,
    error: { code, message },
  });
}

module.exports = { success, failure };
