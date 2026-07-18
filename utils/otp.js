const crypto = require('crypto');

/** Generates a 6-digit numeric OTP and its SHA-256 hash (we never store the raw OTP). */
function generateOtp() {
  const otp = String(crypto.randomInt(100000, 999999));
  const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min validity
  return { otp, otpHash, expiresAt };
}

function hashOtp(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

module.exports = { generateOtp, hashOtp };
