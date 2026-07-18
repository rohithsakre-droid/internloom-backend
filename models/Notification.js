const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipientType: { type: String, enum: ['Student', 'Company'], required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'recipientType', index: true },

    type: {
      type: String,
      enum: ['APPLICATION_STATUS_CHANGED', 'NEW_MATCH', 'NEW_APPLICANT', 'LISTING_AUTO_CLOSED'],
      required: true,
    },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
