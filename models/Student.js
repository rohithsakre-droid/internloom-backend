const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    collegeEmail: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },

    // Re-verification flow: when a student changes their email, we do NOT
    // overwrite collegeEmail immediately. We stage it here until the OTP
    // sent to the new address is confirmed. This means the student is never
    // locked out mid-change — they keep using their old, already-verified
    // email/session until the swap completes.
    pendingEmail: { type: String, default: null, lowercase: true, trim: true },
    isVerified: { type: Boolean, default: false },
    otpHash: { type: String, default: null },
    otpExpiresAt: { type: Date, default: null },

    college: { type: String, trim: true },
    branch: { type: String, trim: true },
    graduationYear: { type: Number },
    cgpa: { type: Number, min: 0, max: 10 },

    // Skills stored as a normalized array of lowercase strings, NOT a
    // comma-separated blob. This lets a company filter with an exact
    // { skills: "react.js" } match instead of a fragile regex/substring
    // search. Indexed for fast filtering at scale.
    skills: {
      type: [String],
      default: [],
      set: (arr) => (arr || []).map((s) => s.trim().toLowerCase()).filter(Boolean),
    },

    githubUrl: { type: String, trim: true },
    linkedinUrl: { type: String, trim: true },
    bio: { type: String, trim: true },
    resumeUrl: { type: String, trim: true },

    refreshTokenHash: { type: String, default: null },
  },
  { timestamps: true }
);

studentSchema.index({ skills: 1 });
studentSchema.index({ branch: 1, graduationYear: 1 });

module.exports = mongoose.model('Student', studentSchema);
