const Listing = require('../models/Listing');
const Student = require('../models/Student');
const Application = require('../models/Application');
const Notification = require('../models/Notification');
const AppError = require('../utils/AppError');
const { success } = require('../utils/responseEnvelope');
const { asyncHandler } = require('../middleware/errorHandler');
const { computeMatchScore } = require('../services/matchingService');

const MATCH_NOTIFICATION_THRESHOLD = 70;

// Fired once, when a listing goes Draft -> Active. Scans verified students
// and queues a notification for anyone scoring above the threshold.
// At hackathon scale this is a synchronous loop; documented in
// DESIGN_DECISIONS.md as the first thing to move to a background job
// (e.g. a queue worker) once the student base grows.
async function notifyMatchingStudents(listing) {
  const verifiedStudents = await Student.find({ isVerified: true });
  const toInsert = [];
  for (const student of verifiedStudents) {
    const score = computeMatchScore(student, listing);
    if (score > MATCH_NOTIFICATION_THRESHOLD) {
      toInsert.push({
        recipientType: 'Student',
        recipient: student._id,
        type: 'NEW_MATCH',
        message: `New listing "${listing.title}" is a ${Math.round(score)}% match for you.`,
      });
    }
  }
  if (toInsert.length > 0) await Notification.insertMany(toInsert);
}

// Company creates a listing. Always starts in Draft — must be explicitly
// activated via the transition endpoint, enforcing Draft -> Active -> Closed.
const createListing = asyncHandler(async (req, res) => {
  const {
    title, description, requiredSkills, preferredSkills,
    preferredBranches, targetGraduationYear,
    stipend, location, applicationDeadline, maxApplicantCap,
  } = req.body;

  if (!title || !description || !location || !applicationDeadline || !maxApplicantCap) {
    throw new AppError(400, 'MISSING_FIELDS', 'title, description, location, applicationDeadline and maxApplicantCap are required');
  }
  if (new Date(applicationDeadline) <= new Date()) {
    throw new AppError(400, 'INVALID_DEADLINE', 'applicationDeadline must be in the future');
  }

  const listing = await Listing.create({
    company: req.user.id,
    title, description,
    requiredSkills: requiredSkills || [],
    preferredSkills: preferredSkills || [],
    preferredBranches: preferredBranches || [],
    targetGraduationYear: targetGraduationYear || null,
    stipend: stipend || 0,
    location,
    applicationDeadline,
    maxApplicantCap,
    status: 'Draft',
  });

  return success(res, 201, listing);
});

// Explicit state-machine endpoint. Only Draft->Active and Active->Closed are
// ever allowed here (company-initiated). System-initiated reopening on
// withdrawal happens separately in applicationController and is NOT exposed
// through this endpoint — a company can never manually reopen a Closed listing.
const transitionListingStatus = asyncHandler(async (req, res) => {
  const { status: targetStatus } = req.body;
  const listing = await Listing.findOne({ _id: req.params.id, company: req.user.id });
  if (!listing) throw new AppError(404, 'NOT_FOUND', 'Listing not found');

  const allowed = Listing.ALLOWED_TRANSITIONS[listing.status] || [];
  if (!allowed.includes(targetStatus)) {
    throw new AppError(
      400,
      'INVALID_TRANSITION',
      `Cannot move listing from ${listing.status} to ${targetStatus}`
    );
  }

  listing.status = targetStatus;
  if (targetStatus === 'Closed') listing.autoClosedByCap = false; // manual close, not a cap close
  await listing.save();

  if (targetStatus === 'Active') {
    await notifyMatchingStudents(listing);
  }

  return success(res, 200, listing);
});

// Editing an Active listing's skills: match scores are NEVER cached or
// stored against a listing, so there is no "stale data" problem — every
// GET /listings and every applicant view recomputes the score live from
// whatever the listing currently says. Existing applications keep their
// original matchScoreAtApplication as a historical record, but any live
// view (including the company's own applicant ranking) reflects the edit
// immediately. See DESIGN_DECISIONS.md, tricky part 2.
const updateListing = asyncHandler(async (req, res) => {
  const listing = await Listing.findOne({ _id: req.params.id, company: req.user.id });
  if (!listing) throw new AppError(404, 'NOT_FOUND', 'Listing not found');
  if (listing.status === 'Closed') {
    throw new AppError(400, 'LISTING_CLOSED', 'Cannot edit a closed listing');
  }

  const editable = [
    'title', 'description', 'requiredSkills', 'preferredSkills',
    'preferredBranches', 'targetGraduationYear', 'stipend',
    'location', 'applicationDeadline', 'maxApplicantCap',
  ];
  for (const field of editable) {
    if (req.body[field] !== undefined) listing[field] = req.body[field];
  }
  await listing.save();

  return success(res, 200, listing);
});

const getMyListings = asyncHandler(async (req, res) => {
  const listings = await Listing.find({ company: req.user.id }).sort({ createdAt: -1 });
  return success(res, 200, listings);
});

// Student-facing: paginated, ranked by live match score, descending.
// Only Active listings with a future deadline are candidates — filtered at
// the DB level via the {status, applicationDeadline} index before any
// scoring happens, keeping the scoring loop small. See matchingService.js
// for the full complexity note.
const getActiveListingsForStudent = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));

  const student = await Student.findById(req.user.id);
  if (!student) throw new AppError(404, 'NOT_FOUND', 'Student not found');

  const candidates = await Listing.find({
    status: 'Active',
    applicationDeadline: { $gt: new Date() },
  }).populate('company', 'companyName isApproved');

  const approvedOnly = candidates.filter((l) => l.company && l.company.isApproved);

  const scored = approvedOnly.map((listing) => ({
    listing,
    matchScore: computeMatchScore(student, listing),
  }));

  scored.sort((a, b) => b.matchScore - a.matchScore);

  const start = (page - 1) * limit;
  const paged = scored.slice(start, start + limit);

  return success(
    res,
    200,
    paged.map((s) => ({ ...s.listing.toObject(), matchScore: s.matchScore })),
    { page, limit, total: scored.length, totalPages: Math.ceil(scored.length / limit) }
  );
});

const getListingById = asyncHandler(async (req, res) => {
  const listing = await Listing.findById(req.params.id).populate('company', 'companyName');
  if (!listing) throw new AppError(404, 'NOT_FOUND', 'Listing not found');
  return success(res, 200, listing);
});

// Company view of applicants, sorted by live match score.
const getApplicantsForListing = asyncHandler(async (req, res) => {
  const listing = await Listing.findOne({ _id: req.params.id, company: req.user.id });
  if (!listing) throw new AppError(404, 'NOT_FOUND', 'Listing not found or not yours');

  const applications = await Application.find({ listing: listing._id }).populate('student');

  const scored = applications.map((app) => ({
    applicationId: app._id,
    status: app.status,
    appliedAt: app.createdAt,
    matchScoreAtApplication: app.matchScoreAtApplication,
    liveMatchScore: computeMatchScore(app.student, listing),
    student: {
      id: app.student._id,
      name: app.student.name,
      branch: app.student.branch,
      graduationYear: app.student.graduationYear,
      skills: app.student.skills,
      resumeUrl: app.student.resumeUrl,
    },
  }));

  scored.sort((a, b) => b.liveMatchScore - a.liveMatchScore);

  return success(res, 200, scored);
});

module.exports = {
  createListing,
  transitionListingStatus,
  updateListing,
  getMyListings,
  getActiveListingsForStudent,
  getListingById,
  getApplicantsForListing,
};
