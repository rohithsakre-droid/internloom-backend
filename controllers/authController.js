const bcrypt = require('bcryptjs');
const Student = require('../models/Student');
const Company = require('../models/Company');
const AppError = require('../utils/AppError');
const { success } = require('../utils/responseEnvelope');
const { asyncHandler } = require('../middleware/errorHandler');
const { generateOtp, hashOtp } = require('../utils/otp');
const { issueTokenPair, verifyRefreshToken, hashToken } = require('../services/tokenService');

const BLOCKED_PERSONAL_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];
const VALID_COLLEGE_SUFFIXES = ['.edu', '.ac.in', '.edu.in'];

function isValidCollegeEmail(email) {
  const domain = email.split('@')[1] || '';
  if (BLOCKED_PERSONAL_DOMAINS.includes(domain.toLowerCase())) return false;
  return VALID_COLLEGE_SUFFIXES.some((suffix) => domain.toLowerCase().endsWith(suffix));
}

// ---------- STUDENT ----------

const registerStudent = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    throw new AppError(400, 'MISSING_FIELDS', 'name, email and password are required');
  }
  const normalizedEmail = email.toLowerCase().trim();

  if (!isValidCollegeEmail(normalizedEmail)) {
    throw new AppError(
      400,
      'INVALID_EMAIL_DOMAIN',
      'Please register with a college email ending in .edu, .ac.in or .edu.in. Personal email providers are not accepted.'
    );
  }

  const existing = await Student.findOne({ collegeEmail: normalizedEmail });
  if (existing) throw new AppError(409, 'EMAIL_IN_USE', 'An account with this email already exists');

  const passwordHash = await bcrypt.hash(password, 10);
  const { otp, otpHash, expiresAt } = generateOtp();

  const student = await Student.create({
    name,
    collegeEmail: normalizedEmail,
    passwordHash,
    isVerified: false,
    otpHash,
    otpExpiresAt: expiresAt,
  });

  // No real email service in scope — OTP is returned directly for demo/testing.
  // In production this would be sent via an email provider, never in the response.
  return success(res, 201, {
    studentId: student._id,
    message: 'Registered. Verify your email with the OTP to unlock job applications.',
    demoOtp: otp,
  });
});

const verifyStudentOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) throw new AppError(400, 'MISSING_FIELDS', 'email and otp are required');

  const student = await Student.findOne({
    $or: [{ collegeEmail: email.toLowerCase() }, { pendingEmail: email.toLowerCase() }],
  });
  if (!student) throw new AppError(404, 'NOT_FOUND', 'No account found for this email');

  if (!student.otpHash || !student.otpExpiresAt || student.otpExpiresAt < new Date()) {
    throw new AppError(400, 'OTP_EXPIRED', 'OTP has expired, request a new one');
  }
  if (hashOtp(otp) !== student.otpHash) {
    throw new AppError(400, 'OTP_INVALID', 'Incorrect OTP');
  }

  // If this OTP was for a pending email change, complete the swap now.
  if (student.pendingEmail && student.pendingEmail === email.toLowerCase()) {
    student.collegeEmail = student.pendingEmail;
    student.pendingEmail = null;
  }

  student.isVerified = true;
  student.otpHash = null;
  student.otpExpiresAt = null;
  await student.save();

  return success(res, 200, { message: 'Email verified successfully' });
});

const loginStudent = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new AppError(400, 'MISSING_FIELDS', 'email and password are required');

  const student = await Student.findOne({ collegeEmail: email.toLowerCase() });
  if (!student) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');

  const match = await bcrypt.compare(password, student.passwordHash);
  if (!match) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');

  const { accessToken, refreshToken, refreshTokenHash } = issueTokenPair(student._id.toString(), 'student');
  student.refreshTokenHash = refreshTokenHash;
  await student.save();

  return success(res, 200, { accessToken, refreshToken, isVerified: student.isVerified });
});

// Tricky part handler: student requests an email change. We stage it in
// pendingEmail and send a fresh OTP — collegeEmail (and isVerified) stay
// untouched until the new address is confirmed via verifyStudentOtp above.
const requestEmailChange = asyncHandler(async (req, res) => {
  const { newEmail } = req.body;
  if (!newEmail) throw new AppError(400, 'MISSING_FIELDS', 'newEmail is required');
  const normalized = newEmail.toLowerCase().trim();

  if (!isValidCollegeEmail(normalized)) {
    throw new AppError(400, 'INVALID_EMAIL_DOMAIN', 'New email must be a valid college email');
  }
  const inUse = await Student.findOne({ collegeEmail: normalized });
  if (inUse) throw new AppError(409, 'EMAIL_IN_USE', 'This email is already registered');

  const student = await Student.findById(req.user.id);
  const { otp, otpHash, expiresAt } = generateOtp();

  student.pendingEmail = normalized;
  student.otpHash = otpHash;
  student.otpExpiresAt = expiresAt;
  await student.save();

  return success(res, 200, {
    message: 'OTP sent to new email. Your account remains active under your current email until confirmed.',
    demoOtp: otp,
  });
});

// ---------- COMPANY ----------

const registerCompany = asyncHandler(async (req, res) => {
  const { companyName, email, password } = req.body;
  if (!companyName || !email || !password) {
    throw new AppError(400, 'MISSING_FIELDS', 'companyName, email and password are required');
  }
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await Company.findOne({ companyEmail: normalizedEmail });
  if (existing) throw new AppError(409, 'EMAIL_IN_USE', 'An account with this email already exists');

  const passwordHash = await bcrypt.hash(password, 10);
  const company = await Company.create({
    companyName,
    companyEmail: normalizedEmail,
    passwordHash,
    isApproved: false, // listings stay pending until admin approval (out of scope, seeded demo company is pre-approved)
  });

  return success(res, 201, {
    companyId: company._id,
    message: 'Company registered. Listings will be visible once admin-approved.',
  });
});

const loginCompany = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new AppError(400, 'MISSING_FIELDS', 'email and password are required');

  const company = await Company.findOne({ companyEmail: email.toLowerCase() });
  if (!company) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');

  const match = await bcrypt.compare(password, company.passwordHash);
  if (!match) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');

  const { accessToken, refreshToken, refreshTokenHash } = issueTokenPair(company._id.toString(), 'company');
  company.refreshTokenHash = refreshTokenHash;
  await company.save();

  return success(res, 200, { accessToken, refreshToken, isApproved: company.isApproved });
});

// ---------- SHARED ----------

// Real refresh endpoint: validates the refresh token AND checks it matches
// the hash stored at login time, so a revoked/rotated token can't be reused.
const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken: token } = req.body;
  if (!token) throw new AppError(400, 'MISSING_FIELDS', 'refreshToken is required');

  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch (err) {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired');
  }

  const Model = decoded.role === 'student' ? Student : Company;
  const user = await Model.findById(decoded.sub);
  if (!user || user.refreshTokenHash !== hashToken(token)) {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token has been revoked');
  }

  const issued = issueTokenPair(user._id.toString(), decoded.role);
  user.refreshTokenHash = issued.refreshTokenHash;
  await user.save();

  return success(res, 200, { accessToken: issued.accessToken, refreshToken: issued.refreshToken });
});

module.exports = {
  registerStudent,
  verifyStudentOtp,
  loginStudent,
  requestEmailChange,
  registerCompany,
  loginCompany,
  refreshToken,
};
