const express = require('express');
const router = express.Router();
const listing = require('../controllers/listingController');
const application = require('../controllers/applicationController');
const { authenticate, requireRole } = require('../middleware/auth');

// Student: ranked, paginated, matched listings
router.get('/', authenticate, requireRole('student'), listing.getActiveListingsForStudent);

// Company: manage own listings
router.post('/', authenticate, requireRole('company'), listing.createListing);
router.get('/mine', authenticate, requireRole('company'), listing.getMyListings);
router.put('/:id', authenticate, requireRole('company'), listing.updateListing);
router.patch('/:id/status', authenticate, requireRole('company'), listing.transitionListingStatus);
router.get('/:id/applicants', authenticate, requireRole('company'), listing.getApplicantsForListing);

// Either role can view a single listing's public detail
router.get('/:id', authenticate, listing.getListingById);

// Student applies to a listing (action lives on the listing resource, RESTfully)
router.post('/:listingId/apply', authenticate, requireRole('student'), application.applyToListing);

module.exports = router;
