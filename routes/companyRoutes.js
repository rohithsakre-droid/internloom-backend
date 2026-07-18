const express = require('express');
const router = express.Router();
const company = require('../controllers/companyController');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate, requireRole('company'));

router.get('/me', company.getMyCompany);
router.put('/me', company.updateMyCompany);

module.exports = router;
