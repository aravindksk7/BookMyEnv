const express = require('express');
const router = express.Router();
const releaseController = require('../controllers/releaseController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// All routes require authentication
router.use(authenticate);

// Releases
router.get('/', releaseController.getAll);
router.get('/statistics', releaseController.getStatistics);
router.get('/:id', releaseController.getById);
router.post('/', requireRole('Admin', 'EnvironmentManager', 'ProjectLead'), releaseController.create);
router.put('/:id', requireRole('Admin', 'EnvironmentManager', 'ProjectLead'), releaseController.update);
router.delete('/:id', requireRole('Admin'), releaseController.delete);

// Release status
router.put('/:id/status', requireRole('Admin', 'EnvironmentManager', 'ProjectLead'), releaseController.updateStatus);

// Release applications
router.post('/:id/applications', requireRole('Admin', 'EnvironmentManager', 'ProjectLead'), releaseController.addApplication);
router.delete('/:id/applications/:applicationId', requireRole('Admin', 'EnvironmentManager', 'ProjectLead'), releaseController.removeApplication);

// Release environments
router.post('/:id/environments', requireRole('Admin', 'EnvironmentManager', 'ProjectLead'), releaseController.addEnvironment);
router.put('/:id/environments/:envId', requireRole('Admin', 'EnvironmentManager', 'ProjectLead'), releaseController.updateEnvironmentStatus);
router.delete('/:id/environments/:envId', requireRole('Admin', 'EnvironmentManager', 'ProjectLead'), releaseController.removeEnvironment);

module.exports = router;
