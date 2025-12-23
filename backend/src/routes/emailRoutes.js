const express = require('express');
const router = express.Router();
const emailController = require('../controllers/emailController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// Middleware for admin-only routes
const isAdmin = requireRole('Admin');

// All routes require authentication
router.use(authenticate);

// Get email configuration status (admin only)
router.get('/status', isAdmin, emailController.getEmailStatus);

// Get email configuration (admin only)
router.get('/config', isAdmin, emailController.getEmailConfig);

// Update email configuration (admin only)
router.put('/config', isAdmin, emailController.updateEmailConfig);

// Test email connection (admin only)
router.post('/test-connection', isAdmin, emailController.testEmailConnection);

// Send test email (admin only)
router.post('/test', isAdmin, emailController.sendTestEmail);

// Get available templates (admin only)
router.get('/templates', isAdmin, emailController.getTemplates);

// Preview a specific template (admin only)
router.get('/templates/:templateName/preview', isAdmin, emailController.previewTemplate);

// Get notification preferences for current user
router.get('/preferences', emailController.getNotificationPreferences);

// Update notification preferences for current user
router.put('/preferences', emailController.updateNotificationPreferences);

module.exports = router;
