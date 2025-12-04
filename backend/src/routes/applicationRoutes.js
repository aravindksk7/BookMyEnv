const express = require('express');
const router = express.Router();
const applicationController = require('../controllers/applicationController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// All routes require authentication
router.use(authenticate);

// Applications
router.get('/', applicationController.getAll);
router.get('/:id', applicationController.getById);
router.post('/', requireRole('Admin', 'ProjectLead'), applicationController.create);
router.put('/:id', requireRole('Admin', 'ProjectLead'), applicationController.update);
router.delete('/:id', requireRole('Admin'), applicationController.delete);

// Related entities
router.get('/:id/related-configs', applicationController.getRelatedConfigs);
router.get('/:id/related-interfaces', applicationController.getRelatedInterfaces);
router.get('/:id/related-testdata', applicationController.getRelatedTestData);

// Application instances (deployments to environment instances)
router.get('/:id/instances', applicationController.getAppInstances);
router.post('/:id/instances', requireRole('Admin', 'EnvironmentManager'), applicationController.createAppInstance);
router.put('/:id/instances/:appEnvInstanceId', requireRole('Admin', 'EnvironmentManager'), applicationController.updateAppInstance);
router.delete('/:id/instances/:appEnvInstanceId', requireRole('Admin'), applicationController.deleteAppInstance);

// Application components
router.get('/:id/components', applicationController.getComponents);
router.post('/:id/components', requireRole('Admin', 'ProjectLead'), applicationController.createComponent);
router.put('/:id/components/:componentId', requireRole('Admin', 'ProjectLead'), applicationController.updateComponent);
router.delete('/:id/components/:componentId', requireRole('Admin'), applicationController.deleteComponent);

// Component instances
router.get('/:id/components/:componentId/instances', applicationController.getComponentInstances);
router.post('/:id/components/:componentId/instances', requireRole('EnvironmentManager'), applicationController.createComponentInstance);
router.put('/:id/components/:componentId/instances/:instanceId', requireRole('EnvironmentManager'), applicationController.updateComponentInstance);
router.delete('/:id/components/:componentId/instances/:instanceId', requireRole('Admin'), applicationController.deleteComponentInstance);

module.exports = router;
