const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

// Public routes
router.post('/login', authController.login);
router.post('/register', authController.register);
router.get('/sso/:provider', authController.getSSOConfig);
router.post('/sso/callback', authController.ssoCallback);

// Protected routes
router.get('/me', authenticate, authController.getCurrentUser);
router.post('/logout', authenticate, authController.logout);
router.post('/refresh', authenticate, authController.refreshToken);

module.exports = router;
