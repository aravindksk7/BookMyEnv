const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// All routes require authentication
router.use(authenticate);

// Statistics (must be before :id routes)
router.get('/statistics', bookingController.getStatistics);

// Bookings
router.get('/', bookingController.getAll);
router.get('/calendar', bookingController.getCalendar);
router.get('/my', bookingController.getMyBookings);
router.get('/conflicts', bookingController.checkConflicts);
router.get('/:id', bookingController.getById);
router.post('/', bookingController.create);
router.put('/:id', bookingController.update);
router.delete('/:id', bookingController.delete);

// Booking status
router.put('/:id/status', bookingController.updateStatus);

// Booking resources
router.post('/:id/resources', bookingController.addResource);
router.delete('/:id/resources/:resourceId', bookingController.removeResource);

module.exports = router;
