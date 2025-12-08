const express = require('express');
const router = express.Router();
const interfaceController = require('../controllers/interfaceController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// All routes require authentication
router.use(authenticate);

// Interfaces
router.get('/', interfaceController.getAll);
router.get('/endpoints/all', interfaceController.getAllEndpoints);  // Must be before /:id
router.get('/:id', interfaceController.getById);
router.post('/', requireRole('Admin', 'ProjectLead'), interfaceController.create);
router.put('/:id', requireRole('Admin', 'ProjectLead'), interfaceController.update);
router.delete('/:id', requireRole('Admin'), interfaceController.delete);

// Endpoints
router.get('/:id/endpoints', interfaceController.getEndpoints);
router.post('/:id/endpoints', requireRole('Admin', 'ProjectLead'), interfaceController.createEndpoint);
router.put('/:id/endpoints/:endpointId', requireRole('Admin', 'ProjectLead'), interfaceController.updateEndpoint);
router.delete('/:id/endpoints/:endpointId', requireRole('Admin'), interfaceController.deleteEndpoint);

module.exports = router;
