const bcrypt = require('bcryptjs');
const db = require('../config/database');

const userController = {
  // Get all users
  getAll: async (req, res) => {
    try {
      const { role, is_active, search } = req.query;
      
      let query = `
        SELECT u.user_id, u.username, u.display_name, u.email, u.role, 
               u.auth_mode, u.is_active, u.time_zone, u.last_login_at,
               u.created_at, ug.name as default_group_name
        FROM users u
        LEFT JOIN user_groups ug ON u.default_group_id = ug.group_id
        WHERE 1=1
      `;
      const params = [];

      if (role) {
        params.push(role);
        query += ` AND u.role = $${params.length}`;
      }

      if (is_active !== undefined) {
        params.push(is_active === 'true');
        query += ` AND u.is_active = $${params.length}`;
      }

      if (search) {
        params.push(`%${search}%`);
        query += ` AND (u.display_name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR u.username ILIKE $${params.length})`;
      }

      query += ' ORDER BY u.display_name ASC';

      const result = await db.query(query, params);
      res.json({ users: result.rows });
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  },

  // Get user by ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;

      const result = await db.query(
        `SELECT u.*, ug.name as default_group_name
         FROM users u
         LEFT JOIN user_groups ug ON u.default_group_id = ug.group_id
         WHERE u.user_id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = result.rows[0];
      delete user.password_hash;

      // Get user's groups
      const groups = await db.query(
        `SELECT ug.*, ugm.membership_role, ugm.joined_at
         FROM user_groups ug
         JOIN user_group_memberships ugm ON ug.group_id = ugm.group_id
         WHERE ugm.user_id = $1`,
        [id]
      );

      res.json({ ...user, groups: groups.rows });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  },

  // Create user
  create: async (req, res) => {
    try {
      const { username, display_name, email, password, role, default_group_id } = req.body;

      if (!username || !display_name || !email || !role) {
        return res.status(400).json({ error: 'Username, display name, email, and role are required' });
      }

      // Check if email or username exists
      const existing = await db.query(
        'SELECT user_id FROM users WHERE email = $1 OR username = $2',
        [email.toLowerCase(), username.toLowerCase()]
      );

      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Email or username already exists' });
      }

      // Hash password if provided
      let password_hash = null;
      if (password) {
        password_hash = await bcrypt.hash(password, 10);
      }

      const result = await db.query(
        `INSERT INTO users (username, display_name, email, password_hash, role, default_group_id, auth_mode)
         VALUES ($1, $2, $3, $4, $5, $6, 'Local')
         RETURNING user_id, username, display_name, email, role, is_active, created_at`,
        [username.toLowerCase(), display_name, email.toLowerCase(), password_hash, role, default_group_id]
      );

      // Log activity
      await db.query(
        `INSERT INTO activities (user_id, action, entity_type, entity_id, entity_name)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.user_id, 'CREATE', 'User', result.rows[0].user_id, display_name]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Create user error:', error);
      res.status(500).json({ error: 'Failed to create user' });
    }
  },

  // Update user
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { display_name, role, is_active, default_group_id, time_zone } = req.body;

      const result = await db.query(
        `UPDATE users 
         SET display_name = COALESCE($1, display_name),
             role = COALESCE($2, role),
             is_active = COALESCE($3, is_active),
             default_group_id = COALESCE($4, default_group_id),
             time_zone = COALESCE($5, time_zone),
             updated_at = NOW()
         WHERE user_id = $6
         RETURNING user_id, username, display_name, email, role, is_active`,
        [display_name, role, is_active, default_group_id, time_zone, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Log activity
      await db.query(
        `INSERT INTO activities (user_id, action, entity_type, entity_id, entity_name)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.user_id, 'UPDATE', 'User', id, result.rows[0].display_name]
      );

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  },

  // Delete (deactivate) user
  delete: async (req, res) => {
    try {
      const { id } = req.params;

      // Don't allow deleting self
      if (id === req.user.user_id) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
      }

      const result = await db.query(
        `UPDATE users SET is_active = false, updated_at = NOW() 
         WHERE user_id = $1 
         RETURNING user_id, display_name`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Log activity
      await db.query(
        `INSERT INTO activities (user_id, action, entity_type, entity_id, entity_name)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.user_id, 'DEACTIVATE', 'User', id, result.rows[0].display_name]
      );

      res.json({ message: 'User deactivated successfully' });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  },

  // Reset user password
  resetPassword: async (req, res) => {
    try {
      const { id } = req.params;
      const { new_password } = req.body;

      if (!new_password) {
        return res.status(400).json({ error: 'New password is required' });
      }

      const password_hash = await bcrypt.hash(new_password, 10);

      const result = await db.query(
        `UPDATE users SET password_hash = $1, updated_at = NOW() 
         WHERE user_id = $2 
         RETURNING user_id, display_name`,
        [password_hash, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ message: 'Password reset successfully' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  },

  // Get user's SSO identities
  getUserIdentities: async (req, res) => {
    try {
      const { id } = req.params;

      // Verify user exists
      const userResult = await db.query(
        'SELECT user_id FROM users WHERE user_id = $1',
        [id]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const result = await db.query(
        `SELECT ui.*, ipc.name as provider_name, ipc.idp_type as provider_type
         FROM user_identities ui
         JOIN identity_provider_configs ipc ON ui.idp_id = ipc.idp_id
         WHERE ui.user_id = $1
         ORDER BY ui.last_login_at DESC NULLS LAST`,
        [id]
      );

      res.json(result.rows);
    } catch (error) {
      console.error('Get user identities error:', error);
      res.status(500).json({ error: 'Failed to fetch user identities' });
    }
  },

  // Link SSO identity to user
  linkUserIdentity: async (req, res) => {
    try {
      const { id } = req.params;
      const { idp_id, subject_id, idp_username, idp_email } = req.body;

      if (!idp_id || !subject_id) {
        return res.status(400).json({ error: 'Identity provider and subject ID are required' });
      }

      // Verify user exists
      const userResult = await db.query(
        'SELECT user_id, display_name FROM users WHERE user_id = $1',
        [id]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Verify IDP exists
      const idpResult = await db.query(
        'SELECT idp_id FROM identity_provider_configs WHERE idp_id = $1',
        [idp_id]
      );

      if (idpResult.rows.length === 0) {
        return res.status(404).json({ error: 'Identity provider not found' });
      }

      // Create the identity link
      const result = await db.query(
        `INSERT INTO user_identities (user_id, idp_id, subject_id, idp_username, idp_email)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (idp_id, subject_id) DO UPDATE SET
           idp_username = EXCLUDED.idp_username,
           idp_email = EXCLUDED.idp_email
         RETURNING *`,
        [id, idp_id, subject_id, idp_username, idp_email]
      );

      // Update user auth_mode to SSO
      await db.query(
        'UPDATE users SET auth_mode = $1, updated_at = NOW() WHERE user_id = $2',
        ['SSO', id]
      );

      // Log activity
      await db.query(
        `INSERT INTO activities (user_id, action, entity_type, entity_id, entity_name)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.user_id, 'LINK_SSO', 'User', id, userResult.rows[0].display_name]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Link user identity error:', error);
      if (error.code === '23505') {
        return res.status(400).json({ error: 'This SSO identity is already linked to another user' });
      }
      res.status(500).json({ error: 'Failed to link SSO identity' });
    }
  }
};

module.exports = userController;
