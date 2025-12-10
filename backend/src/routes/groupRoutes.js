const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// All routes require authentication
router.use(authenticate);

// Get all groups (all authenticated users can view)
router.get('/', groupController.getAll);

// Get group by ID (all authenticated users can view)
router.get('/:id', groupController.getById);

// Create group (Admin only)
router.post('/', requireRole('Admin'), groupController.create);

// Update group (Admin only)
router.put('/:id', requireRole('Admin'), groupController.update);

// Delete group (Admin only)
router.delete('/:id', requireRole('Admin'), groupController.delete);

// Member management
router.post('/:id/members', requireRole('Admin'), groupController.addMember);
router.delete('/:id/members/:userId', requireRole('Admin'), groupController.removeMember);

// SSO group mappings
router.get('/:id/sso-mappings', groupController.getSSOGroupMappings);
router.post('/:id/sso-mappings', requireRole('Admin'), groupController.addSSOGroupMapping);
router.delete('/:id/sso-mappings/:mappingId', requireRole('Admin'), groupController.removeSSOGroupMapping);

module.exports = router;
