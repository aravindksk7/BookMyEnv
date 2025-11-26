const express = require('express');
const router = express.Router();
const changeController = require('../controllers/changeController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// All routes require authentication
router.use(authenticate);

// Changes
router.get('/', changeController.getAll);
router.get('/statistics', changeController.getStatistics);
router.get('/:id', changeController.getById);
router.post('/', changeController.create);
router.put('/:id', changeController.update);
router.delete('/:id', changeController.delete);

// Change status
router.put('/:id/status', changeController.updateStatus);

// Approvals
router.post('/:id/approval', changeController.requestApproval);
router.put('/:id/approval/:approvalId', changeController.processApproval);

module.exports = router;
