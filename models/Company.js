const mongoose = require('mongoose');

const companySchema = new mongoose.Schema(
  {
    companyName: { type: String, required: true, trim: true },
    companyEmail: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },

    // No OTP required for companies, but their listings stay invisible to
    // students until an admin approves the company. Admin endpoints are out
    // of scope, so we seed one pre-approved company (see seed/seedCompany.js)
    // and simply leave this field on the schema so admin approval can be
    // added later as a single PATCH endpoint without a migration.
    isApproved: { type: Boolean, default: false },

    description: { type: String, trim: true },
    website: { type: String, trim: true },

    refreshTokenHash: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Company', companySchema);
