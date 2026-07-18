const express = require('express');
const router = express.Router();
const auth = require('../controllers/authController');
const { authenticate, requireRole } = require('../middleware/auth');

router.post('/student/register', auth.registerStudent);
router.post('/student/verify-otp', auth.verifyStudentOtp);
router.post('/student/login', auth.loginStudent);
router.post('/student/change-email', authenticate, requireRole('student'), auth.requestEmailChange);

router.post('/company/register', auth.registerCompany);
router.post('/company/login', auth.loginCompany);

router.post('/refresh', auth.refreshToken);

module.exports = router;
