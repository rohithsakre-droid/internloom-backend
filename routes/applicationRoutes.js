const express = require('express');
const router = express.Router();
const application = require('../controllers/applicationController');
const { authenticate, requireRole } = require('../middleware/auth');

// Student: own applications + withdraw
router.get('/mine', authenticate, requireRole('student'), application.getMyApplications);
router.post('/:id/withdraw', authenticate, requireRole('student'), application.withdrawApplication);

// Company: move status forward, single or bulk
router.patch('/:id/status', authenticate, requireRole('company'), application.updateApplicationStatus);
router.patch('/bulk-status', authenticate, requireRole('company'), application.bulkUpdateApplications);

module.exports = router;
