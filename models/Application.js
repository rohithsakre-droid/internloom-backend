const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true, index: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },

    status: {
      type: String,
      enum: ['Submitted', 'Under Review', 'Shortlisted', 'Rejected', 'Offer Extended', 'Withdrawn'],
      default: 'Submitted',
    },

    // Score at time of application, stored for reference/audit — the live
    // score shown in listings is always recomputed, this is just a record.
    matchScoreAtApplication: { type: Number, default: null },
  },
  { timestamps: true }
);

// A student can only apply to a given listing once. This is enforced at the
// DB level (not just app logic) so it survives concurrent requests — see
// controllers/applicationController.js for how the duplicate-key error
// (Mongo code 11000) is turned into a clean 409, not a generic 500.
applicationSchema.index({ student: 1, listing: 1 }, { unique: true });

const ALLOWED_STATUS_TRANSITIONS = {
  Submitted: ['Under Review', 'Shortlisted', 'Rejected', 'Offer Extended', 'Withdrawn'],
  'Under Review': ['Shortlisted', 'Rejected', 'Offer Extended'],
  Shortlisted: ['Rejected', 'Offer Extended'],
  Rejected: [],
  'Offer Extended': [],
  Withdrawn: [],
};

applicationSchema.statics.ALLOWED_STATUS_TRANSITIONS = ALLOWED_STATUS_TRANSITIONS;

module.exports = mongoose.model('Application', applicationSchema);
