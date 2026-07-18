const express = require('express');
const router = express.Router();
const student = require('../controllers/studentController');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate, requireRole('student'));

router.get('/me', student.getMyProfile);
router.put('/me', student.updateMyProfile);
router.delete('/me', student.deleteMyProfile);

module.exports = router;
