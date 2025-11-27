const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');

// Password validation regex: min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const BCRYPT_ROUNDS = 12;

const authController = {
  // Login
  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      // Find user by email
      const result = await db.query(
        'SELECT * FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = result.rows[0];

      if (!user.is_active) {
        return res.status(401).json({ error: 'Account is disabled' });
      }

      // Verify password using bcrypt
      let isValidPassword = false;
      
      if (user.password_hash && user.password_hash.startsWith('$2')) {
        try {
          isValidPassword = await bcrypt.compare(password, user.password_hash);
        } catch (e) {
          // Log error but don't expose details
          console.error('Password verification error');
        }
      }

      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Update last login
      await db.query(
        'UPDATE users SET last_login_at = NOW() WHERE user_id = $1',
        [user.user_id]
      );

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.user_id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      );

      // Log activity
      await db.query(
        `INSERT INTO activities (user_id, action, entity_type, entity_id, entity_name, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [user.user_id, 'LOGIN', 'User', user.user_id, user.display_name, JSON.stringify({ ip: req.ip })]
      );

      res.json({
        token,
        user: {
          user_id: user.user_id,
          username: user.username,
          display_name: user.display_name,
          email: user.email,
          role: user.role,
          default_group_id: user.default_group_id
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  },

  // Input validation for registration
  registerValidation: [
    body('username').trim().isLength({ min: 3, max: 50 }).matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username must be 3-50 alphanumeric characters'),
    body('email').isEmail().normalizeEmail().withMessage('Invalid email format'),
    body('password').matches(PASSWORD_REGEX)
      .withMessage('Password must be 8+ chars with uppercase, lowercase, number, and special char'),
    body('display_name').trim().isLength({ min: 1, max: 100 }).escape()
  ],

  // Register new user
  register: async (req, res) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, display_name, email, password } = req.body;
      // Force safe role - don't allow role from request body
      const role = 'Tester';

      if (!username || !display_name || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
      }

      // Check if email already exists
      const existing = await db.query(
        'SELECT user_id FROM users WHERE email = $1 OR username = $2',
        [email.toLowerCase(), username.toLowerCase()]
      );

      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Email or username already exists' });
      }

      // Hash password with secure rounds
      const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

      // Create user
      const result = await db.query(
        `INSERT INTO users (username, display_name, email, password_hash, role, auth_mode)
         VALUES ($1, $2, $3, $4, $5, 'Local')
         RETURNING user_id, username, display_name, email, role`,
        [username.toLowerCase(), display_name, email.toLowerCase(), password_hash, role]
      );

      const user = result.rows[0];

      // Generate token
      const token = jwt.sign(
        { userId: user.user_id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      );

      res.status(201).json({ token, user });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  },

  // Get current user
  getCurrentUser: async (req, res) => {
    try {
      const result = await db.query(
        `SELECT u.*, ug.name as default_group_name
         FROM users u
         LEFT JOIN user_groups ug ON u.default_group_id = ug.group_id
         WHERE u.user_id = $1`,
        [req.user.user_id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = result.rows[0];
      delete user.password_hash;

      // Get user's groups
      const groups = await db.query(
        `SELECT ug.*, ugm.membership_role
         FROM user_groups ug
         JOIN user_group_memberships ugm ON ug.group_id = ugm.group_id
         WHERE ugm.user_id = $1`,
        [req.user.user_id]
      );

      res.json({ ...user, groups: groups.rows });
    } catch (error) {
      console.error('Get me error:', error);
      res.status(500).json({ error: 'Failed to get user' });
    }
  },

  // Logout
  logout: async (req, res) => {
    try {
      // Log activity
      await db.query(
        `INSERT INTO activities (user_id, action, entity_type, entity_id, entity_name)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.user_id, 'LOGOUT', 'User', req.user.user_id, req.user.display_name || 'User']
      );
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Logout failed' });
    }
  },

  // Refresh token
  refreshToken: async (req, res) => {
    try {
      const token = jwt.sign(
        { userId: req.user.user_id, role: req.user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      );
      res.json({ token });
    } catch (error) {
      console.error('Refresh token error:', error);
      res.status(500).json({ error: 'Failed to refresh token' });
    }
  },

  // Get SSO config
  getSSOConfig: async (req, res) => {
    try {
      const { provider } = req.params;
      const result = await db.query(
        'SELECT provider_name, provider_type, login_url FROM identity_provider_configs WHERE provider_name = $1 AND is_enabled = true',
        [provider]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'SSO provider not found' });
      }
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Get SSO config error:', error);
      res.status(500).json({ error: 'Failed to get SSO configuration' });
    }
  },

  // SSO callback
  ssoCallback: async (req, res) => {
    try {
      // In production, validate SSO token and create/update user
      const { provider, token, user_info } = req.body;
      res.json({ message: 'SSO callback received', provider });
    } catch (error) {
      console.error('SSO callback error:', error);
      res.status(500).json({ error: 'SSO callback failed' });
    }
  },

  // Update current user
  updateMe: async (req, res) => {
    try {
      const { display_name, time_zone } = req.body;
      
      const result = await db.query(
        `UPDATE users 
         SET display_name = COALESCE($1, display_name),
             time_zone = COALESCE($2, time_zone),
             updated_at = NOW()
         WHERE user_id = $3
         RETURNING user_id, username, display_name, email, role, time_zone`,
        [display_name, time_zone, req.user.user_id]
      );

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Update me error:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  },

  // Change password
  changePassword: async (req, res) => {
    try {
      const { current_password, new_password } = req.body;

      if (!current_password || !new_password) {
        return res.status(400).json({ error: 'Current and new passwords are required' });
      }

      // Get user with password
      const result = await db.query(
        'SELECT password_hash FROM users WHERE user_id = $1',
        [req.user.user_id]
      );

      const user = result.rows[0];

      // Verify current password using bcrypt only
      let isValid = false;
      
      if (user.password_hash && user.password_hash.startsWith('$2')) {
        isValid = await bcrypt.compare(current_password, user.password_hash);
      }

      if (!isValid) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }

      // Validate new password strength
      if (!PASSWORD_REGEX.test(new_password)) {
        return res.status(400).json({ 
          error: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character (@$!%*?&)' 
        });
      }

      // Hash new password with secure rounds
      const password_hash = await bcrypt.hash(new_password, BCRYPT_ROUNDS);

      await db.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE user_id = $2',
        [password_hash, req.user.user_id]
      );

      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ error: 'Failed to change password' });
    }
  }
};

module.exports = authController;
