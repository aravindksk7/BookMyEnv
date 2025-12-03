const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const bulkUploadController = require('../controllers/bulkUploadController');

// All bulk upload routes require authentication and Admin/EnvironmentManager role
const canBulkUpload = requireRole('Admin', 'EnvironmentManager');

// Get CSV template
router.get('/template/:type', authenticate, bulkUploadController.getTemplate);

// Bulk upload endpoints
router.post('/environments', authenticate, canBulkUpload, bulkUploadController.uploadEnvironments);
router.post('/instances', authenticate, canBulkUpload, bulkUploadController.uploadInstances);
router.post('/applications', authenticate, canBulkUpload, bulkUploadController.uploadApplications);
router.post('/interfaces', authenticate, canBulkUpload, bulkUploadController.uploadInterfaces);
router.post('/components', authenticate, canBulkUpload, bulkUploadController.uploadComponents);
router.post('/app-instances', authenticate, canBulkUpload, bulkUploadController.uploadAppInstances);
router.post('/infra-components', authenticate, canBulkUpload, bulkUploadController.uploadInfraComponents);

module.exports = router;
