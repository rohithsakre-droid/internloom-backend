const Notification = require('../models/Notification');
const AppError = require('../utils/AppError');
const { success } = require('../utils/responseEnvelope');
const { asyncHandler } = require('../middleware/errorHandler');

const recipientTypeFor = (role) => (role === 'student' ? 'Student' : 'Company');

const getMyNotifications = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const filter = { recipient: req.user.id, recipientType: recipientTypeFor(req.user.role) };

  if (req.query.isRead === 'true') filter.isRead = true;
  if (req.query.isRead === 'false') filter.isRead = false;

  const [items, total] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Notification.countDocuments(filter),
  ]);

  return success(res, 200, items, { page, limit, total, totalPages: Math.ceil(total / limit) });
});

const markOneAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user.id, recipientType: recipientTypeFor(req.user.role) },
    { $set: { isRead: true } },
    { new: true }
  );
  if (!notification) throw new AppError(404, 'NOT_FOUND', 'Notification not found');
  return success(res, 200, notification);
});

const markAllAsRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    { recipient: req.user.id, recipientType: recipientTypeFor(req.user.role), isRead: false },
    { $set: { isRead: true } }
  );
  return success(res, 200, { updatedCount: result.modifiedCount });
});

module.exports = { getMyNotifications, markOneAsRead, markAllAsRead };
