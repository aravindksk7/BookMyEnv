const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// All routes require authentication
router.use(authenticate);

// Statistics (must be before :id routes)
router.get('/statistics', bookingController.getStatistics);

// Conflict management routes (must be before :id routes)
router.get('/all-conflicts', bookingController.getConflictingBookings);

// Refresh awareness routes (v4.1 - must be before :id routes)
router.post('/check-refresh-conflicts', bookingController.checkRefreshConflicts);

// Bookings
router.get('/', bookingController.getAll);
router.get('/calendar', bookingController.getCalendar);
router.get('/my', bookingController.getMyBookings);
router.post('/check-conflicts', bookingController.checkConflicts);
router.get('/:id', bookingController.getById);
router.post('/', bookingController.create);
router.put('/:id', bookingController.update);
router.delete('/:id', bookingController.delete);

// Booking status
router.put('/:id/status', bookingController.updateStatus);

// Booking conflict management
router.get('/:id/conflicts', bookingController.getConflicts);
router.post('/:id/conflicts/resolve', bookingController.resolveConflict);

// Refresh awareness for existing booking
router.get('/:id/refresh-conflicts', bookingController.getRefreshesForBooking);

// Booking resources
router.post('/:id/resources', bookingController.addResource);
router.delete('/:id/resources/:resourceId', bookingController.removeResource);

// Booking relationships
router.get('/:id/applications', bookingController.getRelatedApplications);
router.post('/:id/applications', bookingController.addApplication);
router.delete('/:id/applications/:applicationId', bookingController.removeApplication);
router.get('/:id/interfaces', bookingController.getRelatedInterfaces);
router.get('/:id/instances', bookingController.getRelatedInstances);

module.exports = router;
