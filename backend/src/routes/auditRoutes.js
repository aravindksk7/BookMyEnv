/**
 * Audit Routes - API routes for Audit & Compliance
 * Version: 4.2
 */

const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// All audit routes require authentication
router.use(authenticate);

// Filter options (accessible to all authenticated users for UI dropdowns)
router.get('/options', auditController.getFilterOptions);

// Audit event search and view (Admin, EnvironmentManager, ProjectLead)
router.get('/events', 
  requireRole('Admin', 'EnvironmentManager', 'ProjectLead'),
  auditController.searchEvents
);

router.get('/events/:id', 
  requireRole('Admin', 'EnvironmentManager', 'ProjectLead'),
  auditController.getEventById
);

// Statistics (Admin, EnvironmentManager)
router.get('/stats', 
  requireRole('Admin', 'EnvironmentManager'),
  auditController.getStats
);

// Report templates (Admin, EnvironmentManager)
router.get('/reports/templates', 
  requireRole('Admin', 'EnvironmentManager'),
  auditController.getReportTemplates
);

// Generate report (Admin, EnvironmentManager)
router.post('/reports/generate', 
  requireRole('Admin', 'EnvironmentManager'),
  auditController.generateReport
);

// Export audit data (Admin only)
router.post('/export', 
  requireRole('Admin'),
  auditController.exportEvents
);

// Saved filters (all authenticated users who can view audit)
router.get('/filters', 
  requireRole('Admin', 'EnvironmentManager', 'ProjectLead'),
  auditController.getSavedFilters
);

router.post('/filters', 
  requireRole('Admin', 'EnvironmentManager', 'ProjectLead'),
  auditController.saveFilter
);

module.exports = router;
