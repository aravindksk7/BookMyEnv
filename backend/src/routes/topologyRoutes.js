const express = require('express');
const router = express.Router();
const topologyController = require('../controllers/topologyController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Get full topology
router.get('/', topologyController.getTopology);

// Get environment-specific topology
router.get('/environments/:id', topologyController.getEnvironmentTopology);

// Get application-specific topology
router.get('/applications/:id', topologyController.getApplicationTopology);

module.exports = router;
