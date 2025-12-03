const db = require('../config/database');

// Actual DB schema for config_sets table:
// config_set_id, scope_type (EnvironmentInstance/Application/ComponentInstance/InterfaceEndpoint), scope_ref_id, 
// name, version, status (Draft/Active/Deprecated), created_by, created_at, updated_at

// Actual DB schema for config_items table:
// config_item_id, config_set_id, key, value, data_type (String/Int/Boolean/JSON/SecretRef), description, created_at, updated_at

const configController = {
  // Get all config sets with related entity names
  getAll: async (req, res) => {
    try {
      const { scope_type, status, search } = req.query;
      
      let query = `
        SELECT cs.*, 
               u.display_name as created_by_name,
               COUNT(DISTINCT ci.config_item_id)::integer as item_count,
               CASE 
                 WHEN cs.scope_type = 'Application' THEN app.name
                 WHEN cs.scope_type = 'EnvironmentInstance' THEN ei.name
                 WHEN cs.scope_type = 'ComponentInstance' THEN CONCAT(comp_app.name, ' / ', ac.name)
                 WHEN cs.scope_type = 'InterfaceEndpoint' THEN i.name
                 ELSE NULL
               END as scope_entity_name,
               CASE 
                 WHEN cs.scope_type = 'EnvironmentInstance' THEN e.name
                 ELSE NULL
               END as parent_name
        FROM config_sets cs
        LEFT JOIN config_items ci ON cs.config_set_id = ci.config_set_id
        LEFT JOIN users u ON cs.created_by = u.user_id
        LEFT JOIN applications app ON cs.scope_type = 'Application' AND cs.scope_ref_id = app.application_id
        LEFT JOIN environment_instances ei ON cs.scope_type = 'EnvironmentInstance' AND cs.scope_ref_id = ei.env_instance_id
        LEFT JOIN environments e ON ei.environment_id = e.environment_id
        LEFT JOIN component_instances comp_ci ON cs.scope_type = 'ComponentInstance' AND cs.scope_ref_id = comp_ci.component_instance_id
        LEFT JOIN app_components ac ON comp_ci.component_id = ac.component_id
        LEFT JOIN applications comp_app ON ac.application_id = comp_app.application_id
        LEFT JOIN interface_endpoints iep ON cs.scope_type = 'InterfaceEndpoint' AND cs.scope_ref_id = iep.interface_endpoint_id
        LEFT JOIN interfaces i ON iep.interface_id = i.interface_id
        WHERE 1=1
      `;
      const params = [];

      if (scope_type) {
        params.push(scope_type);
        query += ` AND cs.scope_type = $${params.length}`;
      }

      if (status) {
        params.push(status);
        query += ` AND cs.status = $${params.length}`;
      }

      if (search) {
        params.push(`%${search}%`);
        query += ` AND cs.name ILIKE $${params.length}`;
      }

      query += ' GROUP BY cs.config_set_id, u.display_name, app.name, ei.name, e.name, comp_app.name, ac.name, i.name ORDER BY cs.name ASC';

      const result = await db.query(query, params);
      res.json({ configSets: result.rows });
    } catch (error) {
      console.error('Get config sets error:', error);
      res.status(500).json({ error: 'Failed to fetch config sets' });
    }
  },

  // Get config set by ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;

      const result = await db.query(
        `SELECT cs.*, u.display_name as created_by_name
         FROM config_sets cs
         LEFT JOIN users u ON cs.created_by = u.user_id
         WHERE cs.config_set_id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Config set not found' });
      }

      // Get config items
      const items = await db.query(
        `SELECT * FROM config_items WHERE config_set_id = $1 ORDER BY key`,
        [id]
      );

      res.json({ ...result.rows[0], items: items.rows });
    } catch (error) {
      console.error('Get config set error:', error);
      res.status(500).json({ error: 'Failed to fetch config set' });
    }
  },

  // Create config set
  create: async (req, res) => {
    try {
      const { name, scope_type, scope_ref_id, version, status } = req.body;

      if (!name || !scope_ref_id) {
        return res.status(400).json({ error: 'Config set name and scope reference are required' });
      }

      const result = await db.query(
        `INSERT INTO config_sets (name, scope_type, scope_ref_id, version, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [name, scope_type || 'Application', scope_ref_id, version || '1.0', status || 'Draft', req.user.user_id]
      );

      // Log activity
      await db.query(
        `INSERT INTO activities (user_id, action, entity_type, entity_id, entity_name)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.user_id, 'CREATE', 'ConfigSet', result.rows[0].config_set_id, name]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Create config set error:', error);
      res.status(500).json({ error: 'Failed to create config set' });
    }
  },

  // Update config set
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, scope_type, scope_ref_id, version, status } = req.body;

      const result = await db.query(
        `UPDATE config_sets 
         SET name = COALESCE($1, name),
             scope_type = COALESCE($2, scope_type),
             scope_ref_id = COALESCE($3, scope_ref_id),
             version = COALESCE($4, version),
             status = COALESCE($5, status),
             updated_at = NOW()
         WHERE config_set_id = $6
         RETURNING *`,
        [name, scope_type, scope_ref_id, version, status, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Config set not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Update config set error:', error);
      res.status(500).json({ error: 'Failed to update config set' });
    }
  },

  // Delete config set
  delete: async (req, res) => {
    try {
      const { id } = req.params;

      const result = await db.query(
        'DELETE FROM config_sets WHERE config_set_id = $1 RETURNING name',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Config set not found' });
      }

      res.json({ message: 'Config set deleted successfully' });
    } catch (error) {
      console.error('Delete config set error:', error);
      res.status(500).json({ error: 'Failed to delete config set' });
    }
  },

  // Get items for a config set
  getItems: async (req, res) => {
    try {
      const { id } = req.params;

      const result = await db.query(
        `SELECT * FROM config_items WHERE config_set_id = $1 ORDER BY key`,
        [id]
      );

      res.json({ items: result.rows });
    } catch (error) {
      console.error('Get config items error:', error);
      res.status(500).json({ error: 'Failed to fetch config items' });
    }
  },

  // Create config item
  createItem: async (req, res) => {
    try {
      const { id } = req.params;
      const { key, value, data_type, description } = req.body;

      if (!key || !value) {
        return res.status(400).json({ error: 'Config item key and value are required' });
      }

      const result = await db.query(
        `INSERT INTO config_items (config_set_id, key, value, data_type, description)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [id, key, value, data_type || 'String', description]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Create config item error:', error);
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Config item key already exists in this set' });
      }
      res.status(500).json({ error: 'Failed to create config item' });
    }
  },

  // Update config item
  updateItem: async (req, res) => {
    try {
      const { itemId } = req.params;
      const { key, value, data_type, description } = req.body;

      const result = await db.query(
        `UPDATE config_items 
         SET key = COALESCE($1, key),
             value = COALESCE($2, value),
             data_type = COALESCE($3, data_type),
             description = COALESCE($4, description),
             updated_at = NOW()
         WHERE config_item_id = $5
         RETURNING *`,
        [key, value, data_type, description, itemId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Config item not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Update config item error:', error);
      res.status(500).json({ error: 'Failed to update config item' });
    }
  },

  // Delete config item
  deleteItem: async (req, res) => {
    try {
      const { itemId } = req.params;

      const result = await db.query(
        'DELETE FROM config_items WHERE config_item_id = $1 RETURNING key',
        [itemId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Config item not found' });
      }

      res.json({ message: 'Config item deleted successfully' });
    } catch (error) {
      console.error('Delete config item error:', error);
      res.status(500).json({ error: 'Failed to delete config item' });
    }
  }
};

module.exports = configController;
