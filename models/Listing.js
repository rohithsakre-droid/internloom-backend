const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },

    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },

    requiredSkills: {
      type: [String],
      default: [],
      set: (arr) => (arr || []).map((s) => s.trim().toLowerCase()).filter(Boolean),
    },
    preferredSkills: {
      type: [String],
      default: [],
      set: (arr) => (arr || []).map((s) => s.trim().toLowerCase()).filter(Boolean),
    },

    // Explicit, documented assumption: the problem statement requires the
    // matching algorithm to score "branch and graduation year alignment"
    // but the listing schema in the spec doesn't define what to compare
    // against. These two optional fields are what a company sets to express
    // that preference. If left empty, matching treats alignment as neutral
    // (see services/matchingService.js).
    preferredBranches: { type: [String], default: [] },
    targetGraduationYear: { type: Number, default: null },

    stipend: { type: Number, default: 0 },
    location: { type: String, enum: ['remote', 'hybrid', 'on-site'], required: true },
    applicationDeadline: { type: Date, required: true },
    maxApplicantCap: { type: Number, required: true, min: 1 },
    currentApplicantCount: { type: Number, default: 0 },

    status: { type: String, enum: ['Draft', 'Active', 'Closed'], default: 'Draft' },

    // True only when the system (not the company) closed this listing
    // because currentApplicantCount hit maxApplicantCap. This is the only
    // condition under which we ever allow Closed -> Active again
    // (a withdrawal bringing the count back under cap). A company-initiated
    // close, or a listing closed due to a passed deadline, never reopens.
    autoClosedByCap: { type: Boolean, default: false },
  },
  { timestamps: true }
);

listingSchema.index({ status: 1, applicationDeadline: 1 });
listingSchema.index({ requiredSkills: 1 });

const ALLOWED_TRANSITIONS = {
  Draft: ['Active'],
  Active: ['Closed'],
  Closed: [],
};

listingSchema.statics.ALLOWED_TRANSITIONS = ALLOWED_TRANSITIONS;

module.exports = mongoose.model('Listing', listingSchema);
