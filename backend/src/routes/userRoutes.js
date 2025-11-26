const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');
const { requireRole, checkResourceAccess } = require('../middleware/rbac');

// All routes require authentication
router.use(authenticate);

// Get all users (Admin only)
router.get('/', requireRole('Admin'), userController.getAll);

// Get user by ID
router.get('/:id', userController.getById);

// Create user (Admin only)
router.post('/', requireRole('Admin'), userController.create);

// Update user
router.put('/:id', userController.update);

// Deactivate user (Admin only)
router.delete('/:id', requireRole('Admin'), userController.delete);

// Reset user password (Admin only)
router.post('/:id/reset-password', requireRole('Admin'), userController.resetPassword);

// Get user's SSO identities
router.get('/:id/identities', userController.getUserIdentities);

// Link SSO identity to user (Admin only)
router.post('/:id/identities', requireRole('Admin'), userController.linkUserIdentity);

module.exports = router;
