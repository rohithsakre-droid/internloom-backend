const express = require('express');
const router = express.Router();
const notification = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate); // both students and companies have notifications

router.get('/', notification.getMyNotifications);
router.patch('/:id/read', notification.markOneAsRead);
router.patch('/read-all', notification.markAllAsRead);

module.exports = router;
