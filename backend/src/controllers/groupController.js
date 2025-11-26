const db = require('../config/database');

const groupController = {
  // Get all groups
  getAll: async (req, res) => {
    try {
      const { group_type, search } = req.query;
      
      let query = `
        SELECT ug.*, 
               COUNT(DISTINCT ugm.user_id) as member_count
        FROM user_groups ug
        LEFT JOIN user_group_memberships ugm ON ug.group_id = ugm.group_id
        WHERE 1=1
      `;
      const params = [];

      if (group_type) {
        params.push(group_type);
        query += ` AND ug.group_type = $${params.length}`;
      }

      if (search) {
        params.push(`%${search}%`);
        query += ` AND (ug.name ILIKE $${params.length} OR ug.description ILIKE $${params.length})`;
      }

      query += ' GROUP BY ug.group_id ORDER BY ug.name ASC';

      const result = await db.query(query, params);
      res.json({ groups: result.rows });
    } catch (error) {
      console.error('Get groups error:', error);
      res.status(500).json({ error: 'Failed to fetch groups' });
    }
  },

  // Get group by ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;

      const result = await db.query(
        'SELECT * FROM user_groups WHERE group_id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Group not found' });
      }

      // Get members
      const members = await db.query(
        `SELECT u.user_id, u.username, u.display_name, u.email, u.role,
                ugm.membership_role, ugm.joined_at
         FROM users u
         JOIN user_group_memberships ugm ON u.user_id = ugm.user_id
         WHERE ugm.group_id = $1
         ORDER BY u.display_name`,
        [id]
      );

      res.json({ ...result.rows[0], members: members.rows });
    } catch (error) {
      console.error('Get group error:', error);
      res.status(500).json({ error: 'Failed to fetch group' });
    }
  },

  // Create group
  create: async (req, res) => {
    try {
      const { name, description, group_type } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Group name is required' });
      }

      const result = await db.query(
        `INSERT INTO user_groups (name, description, group_type)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [name, description, group_type || 'Team']
      );

      // Log activity
      await db.query(
        `INSERT INTO activities (user_id, action, entity_type, entity_id, entity_name)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.user_id, 'CREATE', 'UserGroup', result.rows[0].group_id, name]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Create group error:', error);
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Group name already exists' });
      }
      res.status(500).json({ error: 'Failed to create group' });
    }
  },

  // Update group
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, group_type } = req.body;

      const result = await db.query(
        `UPDATE user_groups 
         SET name = COALESCE($1, name),
             description = COALESCE($2, description),
             group_type = COALESCE($3, group_type),
             updated_at = NOW()
         WHERE group_id = $4
         RETURNING *`,
        [name, description, group_type, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Group not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Update group error:', error);
      res.status(500).json({ error: 'Failed to update group' });
    }
  },

  // Delete group
  delete: async (req, res) => {
    try {
      const { id } = req.params;

      const result = await db.query(
        'DELETE FROM user_groups WHERE group_id = $1 RETURNING name',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Group not found' });
      }

      res.json({ message: 'Group deleted successfully' });
    } catch (error) {
      console.error('Delete group error:', error);
      res.status(500).json({ error: 'Failed to delete group' });
    }
  },

  // Add member to group
  addMember: async (req, res) => {
    try {
      const { id } = req.params;
      const { user_id, membership_role = 'Member' } = req.body;

      if (!user_id) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      const result = await db.query(
        `INSERT INTO user_group_memberships (user_id, group_id, membership_role)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [user_id, id, membership_role]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Add member error:', error);
      if (error.code === '23505') {
        return res.status(400).json({ error: 'User is already a member of this group' });
      }
      res.status(500).json({ error: 'Failed to add member' });
    }
  },

  // Remove member from group
  removeMember: async (req, res) => {
    try {
      const { id, userId } = req.params;

      const result = await db.query(
        'DELETE FROM user_group_memberships WHERE group_id = $1 AND user_id = $2 RETURNING *',
        [id, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Membership not found' });
      }

      res.json({ message: 'Member removed successfully' });
    } catch (error) {
      console.error('Remove member error:', error);
      res.status(500).json({ error: 'Failed to remove member' });
    }
  },

  // Update member role
  updateMemberRole: async (req, res) => {
    try {
      const { id, userId } = req.params;
      const { membership_role } = req.body;

      const result = await db.query(
        `UPDATE user_group_memberships 
         SET membership_role = $1
         WHERE group_id = $2 AND user_id = $3
         RETURNING *`,
        [membership_role, id, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Membership not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Update member role error:', error);
      res.status(500).json({ error: 'Failed to update member role' });
    }
  },

  // Get SSO group mappings
  getSSOGroupMappings: async (req, res) => {
    try {
      const { id } = req.params;

      const result = await db.query(
        `SELECT sgm.*, sso.provider_name, sso.provider_type
         FROM sso_group_mappings sgm
         JOIN sso_providers sso ON sgm.provider_id = sso.provider_id
         WHERE sgm.group_id = $1
         ORDER BY sgm.created_at DESC`,
        [id]
      );

      res.json(result.rows);
    } catch (error) {
      console.error('Get SSO group mappings error:', error);
      res.status(500).json({ error: 'Failed to fetch SSO group mappings' });
    }
  },

  // Add SSO group mapping
  addSSOGroupMapping: async (req, res) => {
    try {
      const { id } = req.params;
      const { provider_id, external_group_name, auto_assign_role } = req.body;

      if (!provider_id || !external_group_name) {
        return res.status(400).json({ error: 'Provider ID and external group name are required' });
      }

      const result = await db.query(
        `INSERT INTO sso_group_mappings (provider_id, external_group_name, group_id, auto_assign_role)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [provider_id, external_group_name, id, auto_assign_role || 'Viewer']
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Add SSO group mapping error:', error);
      if (error.code === '23505') {
        return res.status(400).json({ error: 'This mapping already exists' });
      }
      res.status(500).json({ error: 'Failed to add SSO group mapping' });
    }
  },

  // Remove SSO group mapping
  removeSSOGroupMapping: async (req, res) => {
    try {
      const { id, mappingId } = req.params;

      const result = await db.query(
        'DELETE FROM sso_group_mappings WHERE mapping_id = $1 AND group_id = $2 RETURNING *',
        [mappingId, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Mapping not found' });
      }

      res.json({ message: 'SSO group mapping removed successfully' });
    } catch (error) {
      console.error('Remove SSO group mapping error:', error);
      res.status(500).json({ error: 'Failed to remove SSO group mapping' });
    }
  }
};

module.exports = groupController;
