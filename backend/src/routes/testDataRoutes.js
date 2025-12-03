const express = require('express');
const router = express.Router();
const testDataController = require('../controllers/testDataController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// All routes require authentication
router.use(authenticate);

// Test Data Sets
router.get('/', testDataController.getAll);
router.get('/:id', testDataController.getById);
router.post('/', requireRole('Admin', 'ProjectLead', 'Tester'), testDataController.create);
router.put('/:id', requireRole('Admin', 'ProjectLead', 'Tester'), testDataController.update);
router.delete('/:id', requireRole('Admin'), testDataController.delete);

// Mark as refreshed
router.post('/:id/refresh', requireRole('Admin', 'ProjectLead', 'Tester'), testDataController.markRefreshed);

module.exports = router;
