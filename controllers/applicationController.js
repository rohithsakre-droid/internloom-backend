const Application = require('../models/Application');
const Listing = require('../models/Listing');
const Student = require('../models/Student');
const Notification = require('../models/Notification');
const AppError = require('../utils/AppError');
const { success } = require('../utils/responseEnvelope');
const { asyncHandler } = require('../middleware/errorHandler');
const { computeMatchScore } = require('../services/matchingService');
const { notify } = require('../services/notificationService');

/**
 * APPLY TO A LISTING — race-condition-safe by construction.
 *
 * Step 1: Insert the Application document first. The unique compound index
 *         on (student, listing) makes duplicate applications fail at the DB
 *         level (Mongo error 11000), which we turn into a clean 409.
 * Step 2: Atomically claim a slot on the listing using findOneAndUpdate with
 *         a $expr condition (currentApplicantCount < maxApplicantCap) in the
 *         SAME query as the $inc. MongoDB executes a document's update
 *         atomically, so under N simultaneous requests only as many can
 *         succeed as there are remaining slots — the rest get back `null`
 *         from findOneAndUpdate (the filter no longer matched) and we roll
 *         back their Application record. This is exactly the "5 requests,
 *         1 slot, exactly 1 succeeds" scenario Bonus B asks you to prove.
 */
const applyToListing = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.user.id);
  if (!student.isVerified) {
    throw new AppError(403, 'NOT_VERIFIED', 'Verify your email before applying to jobs');
  }

  const listing = await Listing.findById(req.params.listingId);
  if (!listing) throw new AppError(404, 'NOT_FOUND', 'Listing not found');
  if (listing.status !== 'Active') {
    throw new AppError(400, 'LISTING_NOT_ACTIVE', 'This listing is not currently accepting applications');
  }
  if (listing.applicationDeadline <= new Date()) {
    throw new AppError(400, 'DEADLINE_PASSED', 'The application deadline for this listing has passed');
  }

  const matchScore = computeMatchScore(student, listing);

  let application;
  try {
    application = await Application.create({
      student: student._id,
      listing: listing._id,
      company: listing.company,
      matchScoreAtApplication: matchScore,
    });
  } catch (err) {
    if (err.code === 11000) {
      throw new AppError(409, 'ALREADY_APPLIED', 'You have already applied to this listing');
    }
    throw err;
  }

  const claimedListing = await Listing.findOneAndUpdate(
    {
      _id: listing._id,
      status: 'Active',
      $expr: { $lt: ['$currentApplicantCount', '$maxApplicantCap'] },
    },
    { $inc: { currentApplicantCount: 1 } },
    { new: true }
  );

  if (!claimedListing) {
    // Cap filled (or listing closed) between our read and this write. Roll back cleanly.
    await Application.deleteOne({ _id: application._id });
    throw new AppError(409, 'LISTING_FULL', 'This listing just reached its applicant cap');
  }

  if (claimedListing.currentApplicantCount >= claimedListing.maxApplicantCap) {
    claimedListing.status = 'Closed';
    claimedListing.autoClosedByCap = true;
    await claimedListing.save();
    await notify(
      'Company',
      claimedListing.company,
      'LISTING_AUTO_CLOSED',
      `Your listing "${claimedListing.title}" reached its applicant cap and was auto-closed.`
    );
  }

  await notify('Company', listing.company, 'NEW_APPLICANT', `A new student applied to "${listing.title}".`);

  return success(res, 201, { applicationId: application._id, matchScore, status: application.status });
});

const getMyApplications = asyncHandler(async (req, res) => {
  const applications = await Application.find({ student: req.user.id })
    .populate('listing', 'title company status')
    .sort({ createdAt: -1 });
  return success(res, 200, applications);
});

// A student may only withdraw a Submitted application. Withdrawing
// decrements the listing's count and — only if that listing was auto-closed
// by hitting the cap (never a manual or deadline close) and there's now room
// and the deadline hasn't passed — reopens it. See DESIGN_DECISIONS.md.
const withdrawApplication = asyncHandler(async (req, res) => {
  const application = await Application.findOne({ _id: req.params.id, student: req.user.id });
  if (!application) throw new AppError(404, 'NOT_FOUND', 'Application not found');
  if (application.status !== 'Submitted') {
    throw new AppError(400, 'CANNOT_WITHDRAW', 'Only applications in Submitted state can be withdrawn');
  }

  application.status = 'Withdrawn';
  await application.save();

  const listing = await Listing.findByIdAndUpdate(
    application.listing,
    { $inc: { currentApplicantCount: -1 } },
    { new: true }
  );

  if (
    listing &&
    listing.status === 'Closed' &&
    listing.autoClosedByCap &&
    listing.currentApplicantCount < listing.maxApplicantCap &&
    listing.applicationDeadline > new Date()
  ) {
    listing.status = 'Active';
    listing.autoClosedByCap = false;
    await listing.save();
  }

  return success(res, 200, { message: 'Application withdrawn' });
});

// Company moves a single application forward through its lifecycle.
const updateApplicationStatus = asyncHandler(async (req, res) => {
  const { status: targetStatus } = req.body;
  const application = await Application.findById(req.params.id);
  if (!application) throw new AppError(404, 'NOT_FOUND', 'Application not found');
  if (application.company.toString() !== req.user.id) {
    throw new AppError(403, 'FORBIDDEN', 'This application does not belong to one of your listings');
  }

  const allowed = Application.ALLOWED_STATUS_TRANSITIONS[application.status] || [];
  if (!allowed.includes(targetStatus)) {
    throw new AppError(400, 'INVALID_TRANSITION', `Cannot move application from ${application.status} to ${targetStatus}`);
  }

  application.status = targetStatus;
  await application.save();

  await notify('Student', application.student, 'APPLICATION_STATUS_CHANGED', `Your application status changed to "${targetStatus}".`);

  return success(res, 200, application);
});

// Bulk endpoint, e.g. "move all Submitted applications older than 7 days to Rejected"
// for one listing, in a single call rather than N individual PATCH requests.
const bulkUpdateApplications = asyncHandler(async (req, res) => {
  const { listingId, fromStatus, toStatus, olderThanDays } = req.body;
  if (!listingId || !fromStatus || !toStatus) {
    throw new AppError(400, 'MISSING_FIELDS', 'listingId, fromStatus and toStatus are required');
  }

  const listing = await Listing.findOne({ _id: listingId, company: req.user.id });
  if (!listing) throw new AppError(404, 'NOT_FOUND', 'Listing not found or not yours');

  const allowed = Application.ALLOWED_STATUS_TRANSITIONS[fromStatus] || [];
  if (!allowed.includes(toStatus)) {
    throw new AppError(400, 'INVALID_TRANSITION', `Cannot bulk-move applications from ${fromStatus} to ${toStatus}`);
  }

  const filter = { listing: listingId, status: fromStatus };
  if (olderThanDays) {
    filter.createdAt = { $lte: new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000) };
  }

  // Capture affected IDs before mutating, since the filter (status: fromStatus)
  // would no longer match anything after the update.
  const affected = await Application.find(filter).select('_id student');
  if (affected.length === 0) return success(res, 200, { updatedCount: 0 });

  await Application.updateMany({ _id: { $in: affected.map((a) => a._id) } }, { $set: { status: toStatus } });

  await Notification.insertMany(
    affected.map((a) => ({
      recipientType: 'Student',
      recipient: a.student,
      type: 'APPLICATION_STATUS_CHANGED',
      message: `Your application status changed to "${toStatus}".`,
    }))
  );

  return success(res, 200, { updatedCount: affected.length });
});

module.exports = {
  applyToListing,
  getMyApplications,
  withdrawApplication,
  updateApplicationStatus,
  bulkUpdateApplications,
};
