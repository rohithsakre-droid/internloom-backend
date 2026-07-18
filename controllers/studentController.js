const Student = require('../models/Student');
const Application = require('../models/Application');
const AppError = require('../utils/AppError');
const { success } = require('../utils/responseEnvelope');
const { asyncHandler } = require('../middleware/errorHandler');
const { computeProfileCompleteness } = require('../services/matchingService');

const EDITABLE_FIELDS = [
  'name', 'college', 'branch', 'graduationYear', 'cgpa',
  'skills', 'githubUrl', 'linkedinUrl', 'bio', 'resumeUrl',
];

const getMyProfile = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.user.id).select('-passwordHash -refreshTokenHash -otpHash');
  if (!student) throw new AppError(404, 'NOT_FOUND', 'Student not found');

  // Completeness is computed on every fetch, never stored — per spec.
  const completenessScore = computeProfileCompleteness(student);

  return success(res, 200, { ...student.toObject(), completenessScore });
});

const updateMyProfile = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.user.id);
  if (!student) throw new AppError(404, 'NOT_FOUND', 'Student not found');

  for (const field of EDITABLE_FIELDS) {
    if (req.body[field] !== undefined) student[field] = req.body[field];
  }
  await student.save();

  const completenessScore = computeProfileCompleteness(student);
  return success(res, 200, { ...student.toObject(), completenessScore });
});

// A student cannot delete their profile while they have a pending or active
// application. "Active" here = anything not in a terminal state
// (Rejected / Offer Extended / Withdrawn are terminal; everything else blocks deletion).
const deleteMyProfile = asyncHandler(async (req, res) => {
  const blockingCount = await Application.countDocuments({
    student: req.user.id,
    status: { $in: ['Submitted', 'Under Review', 'Shortlisted'] },
  });

  if (blockingCount > 0) {
    throw new AppError(
      409,
      'ACTIVE_APPLICATIONS_EXIST',
      `Cannot delete profile: you have ${blockingCount} pending/active application(s). Withdraw them first.`
    );
  }

  await Student.findByIdAndDelete(req.user.id);
  return success(res, 200, { message: 'Profile deleted' });
});

module.exports = { getMyProfile, updateMyProfile, deleteMyProfile };
