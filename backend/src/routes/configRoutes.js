const express = require('express');
const router = express.Router();
const configController = require('../controllers/configController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// All routes require authentication
router.use(authenticate);

// Config Sets
router.get('/', configController.getAll);
router.get('/:id', configController.getById);
router.post('/', requireRole('Admin', 'EnvironmentManager'), configController.create);
router.put('/:id', requireRole('Admin', 'EnvironmentManager'), configController.update);
router.delete('/:id', requireRole('Admin'), configController.delete);

// Config Items
router.get('/:id/items', configController.getItems);
router.post('/:id/items', requireRole('Admin', 'EnvironmentManager'), configController.createItem);
router.put('/:id/items/:itemId', requireRole('Admin', 'EnvironmentManager'), configController.updateItem);
router.delete('/:id/items/:itemId', requireRole('Admin'), configController.deleteItem);

module.exports = router;
