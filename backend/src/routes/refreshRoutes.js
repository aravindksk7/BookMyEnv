const express = require('express');
const router = express.Router();
const refreshController = require('../controllers/refreshController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// All routes require authentication
router.use(authenticate);

// =====================================================
// STATISTICS & DASHBOARD (must be before parameterized routes)
// =====================================================
router.get('/statistics', refreshController.getStatistics);
router.get('/calendar', refreshController.getCalendar);

// =====================================================
// REFRESH HISTORY ROUTES
// =====================================================

// Get all refresh history (with filters)
router.get('/history', refreshController.getAllHistory);

// Get history for specific entity
router.get('/history/:entityType/:entityId', refreshController.getHistory);

// Create new history record (manual entry)
router.post('/history', requireRole('Admin', 'EnvironmentManager', 'ReleaseManager'), refreshController.createHistory);

// =====================================================
// REFRESH INTENTS ROUTES
// =====================================================

// Get all intents (with filters)
router.get('/intents', refreshController.getIntents);

// Get intents pending approval (convenience endpoint)
router.get('/intents/pending-approval', (req, res, next) => {
  req.query.pendingApproval = 'true';
  next();
}, refreshController.getIntents);

// Get intents for specific entity
router.get('/intents/entity/:entityType/:entityId', refreshController.getEntityIntents);

// Get single intent by ID
router.get('/intents/:id', refreshController.getIntentById);

// Create new intent
router.post('/intents', requireRole('Admin', 'EnvironmentManager', 'ReleaseManager', 'QA_Lead', 'QA_Tester'), refreshController.createIntent);

// Update intent (only DRAFT or REQUESTED status)
router.put('/intents/:id', requireRole('Admin', 'EnvironmentManager', 'ReleaseManager'), refreshController.updateIntent);

// Approve intent (Admin, EnvironmentManager only)
router.post('/intents/:id/approve', requireRole('Admin', 'EnvironmentManager'), refreshController.approveIntent);

// Reject intent (Admin, EnvironmentManager only)
router.post('/intents/:id/reject', requireRole('Admin', 'EnvironmentManager'), refreshController.rejectIntent);

// Start execution
router.post('/intents/:id/start', requireRole('Admin', 'EnvironmentManager', 'ReleaseManager'), refreshController.startExecution);

// Complete execution
router.post('/intents/:id/complete', requireRole('Admin', 'EnvironmentManager', 'ReleaseManager'), refreshController.completeExecution);

// Cancel intent
router.post('/intents/:id/cancel', requireRole('Admin', 'EnvironmentManager', 'ReleaseManager'), refreshController.cancelIntent);

// =====================================================
// CONFLICT MANAGEMENT ROUTES
// =====================================================

// Get conflicts for an intent
router.get('/intents/:id/conflicts', refreshController.getConflicts);

// Get detailed conflicts for an intent (enhanced view)
router.get('/intents/:id/conflicts/detailed', refreshController.getDetailedConflicts);

// Revalidate conflicts for an intent (manual trigger)
router.post('/intents/:id/conflicts/revalidate', requireRole('Admin', 'EnvironmentManager'), refreshController.revalidateIntentConflicts);

// Resolve a conflict (legacy endpoint)
router.post('/conflicts/:conflictId/resolve', requireRole('Admin', 'EnvironmentManager'), refreshController.resolveConflict);

// Resolve a conflict (enhanced endpoint)
router.post('/conflicts/:conflictId/resolve-enhanced', requireRole('Admin', 'EnvironmentManager'), refreshController.resolveConflictEnhanced);

// Bulk resolve conflicts
router.post('/conflicts/bulk-resolve', requireRole('Admin', 'EnvironmentManager'), refreshController.bulkResolveConflicts);

// Get all unresolved conflicts (for dashboard)
router.get('/conflicts/unresolved', refreshController.getAllUnresolvedConflicts);

// =====================================================
// CONFLICT DETECTION API (Preview before creating)
// =====================================================

// Check conflicts preview (before creating an intent)
router.post('/conflicts/check', refreshController.checkConflictsPreview);

// Suggest alternative time slots
router.get('/conflicts/suggest-slots', refreshController.suggestTimeSlots);

module.exports = router;
