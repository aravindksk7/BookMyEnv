const express = require('express');
const router = express.Router();
const integrationController = require('../controllers/integrationController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// Webhook endpoint (no auth - uses webhook secret)
router.post('/webhook/:id', integrationController.handleWebhook);

// All other routes require authentication
router.use(authenticate);

// Integrations
router.get('/', integrationController.getAll);
router.get('/:id', integrationController.getById);
router.post('/', requireRole('Admin'), integrationController.create);
router.put('/:id', requireRole('Admin'), integrationController.update);
router.delete('/:id', requireRole('Admin'), integrationController.delete);

// Integration actions
router.post('/:id/test', requireRole('Admin'), integrationController.testConnection);
router.post('/:id/sync', requireRole('EnvironmentManager'), integrationController.sync);

// Integration links
router.post('/links', integrationController.createLink);
router.delete('/links/:linkId', integrationController.deleteLink);
router.get('/links/:entityType/:entityId', integrationController.getLinksForEntity);

module.exports = router;
