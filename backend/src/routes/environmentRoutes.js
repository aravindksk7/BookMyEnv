const express = require('express');
const router = express.Router();
const environmentController = require('../controllers/environmentController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// All routes require authentication
router.use(authenticate);

// Statistics (must be before :id routes)
router.get('/statistics', environmentController.getStatistics);

// Environments
router.get('/', environmentController.getAll);
router.get('/:id', environmentController.getById);
router.post('/', requireRole('Admin', 'EnvironmentManager'), environmentController.create);
router.put('/:id', requireRole('Admin', 'EnvironmentManager'), environmentController.update);
router.delete('/:id', requireRole('Admin'), environmentController.delete);

// Environment Instances
router.get('/:id/instances', environmentController.getInstances);
router.post('/:id/instances', requireRole('Admin', 'EnvironmentManager'), environmentController.createInstance);
router.get('/:id/instances/:instanceId', environmentController.getInstanceById);
router.put('/:id/instances/:instanceId', requireRole('Admin', 'EnvironmentManager'), environmentController.updateInstance);
router.delete('/:id/instances/:instanceId', requireRole('Admin'), environmentController.deleteInstance);

// Instance status
router.put('/:id/instances/:instanceId/status', requireRole('Admin', 'EnvironmentManager'), environmentController.updateInstanceStatus);

// Infra components
router.get('/:id/instances/:instanceId/infra', environmentController.getInfraComponents);
router.post('/:id/instances/:instanceId/infra', requireRole('Admin', 'EnvironmentManager'), environmentController.createInfraComponent);
router.put('/:id/instances/:instanceId/infra/:infraId', requireRole('Admin', 'EnvironmentManager'), environmentController.updateInfraComponent);
router.delete('/:id/instances/:instanceId/infra/:infraId', requireRole('Admin'), environmentController.deleteInfraComponent);

// Booking status
router.get('/:id/instances/:instanceId/booking-status', environmentController.getInstanceBookingStatus);

// Application environment instances - get all apps linked to environment's instances
router.get('/:id/applications', environmentController.getAppEnvInstances);

module.exports = router;
