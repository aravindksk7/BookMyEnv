const db = require('../config/database');

// Actual DB schema for interfaces table:
// interface_id, name, direction (Inbound/Outbound/Bidirectional), pattern (REST/SOAP/MQ/Kafka/FileDrop/FTP/SFTP/FIX/Other), 
// frequency (RealTime/NearRealTime/Batch), external_party, sla, contract_id, created_at, updated_at

// Actual DB schema for interface_endpoints table:
// interface_endpoint_id, interface_id, env_instance_id, source_component_instance_id, target_component_instance_id,
// external_stub_id, endpoint, enabled, test_mode (Live/Virtualised/Stubbed/Disabled), created_at, updated_at

const interfaceController = {
  // Get all interfaces
  getAll: async (req, res) => {
    try {
      const { direction, pattern, search } = req.query;
      
      let query = `
        SELECT i.*, 
               src_app.name as source_application_name,
               tgt_app.name as target_application_name,
               COUNT(DISTINCT ie.interface_endpoint_id)::integer as endpoint_count
        FROM interfaces i
        LEFT JOIN interface_endpoints ie ON i.interface_id = ie.interface_id
        LEFT JOIN applications src_app ON i.source_application_id = src_app.application_id
        LEFT JOIN applications tgt_app ON i.target_application_id = tgt_app.application_id
        WHERE 1=1
      `;
      const params = [];

      if (direction) {
        params.push(direction);
        query += ` AND i.direction = $${params.length}`;
      }

      if (pattern) {
        params.push(pattern);
        query += ` AND i.pattern = $${params.length}`;
      }

      if (search) {
        params.push(`%${search}%`);
        query += ` AND (i.name ILIKE $${params.length} OR i.external_party ILIKE $${params.length})`;
      }

      query += ' GROUP BY i.interface_id, src_app.name, tgt_app.name ORDER BY i.name ASC';

      const result = await db.query(query, params);
      res.json({ interfaces: result.rows });
    } catch (error) {
      console.error('Get interfaces error:', error);
      res.status(500).json({ error: 'Failed to fetch interfaces' });
    }
  },

  // Get interface by ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;

      const result = await db.query(
        `SELECT i.*
         FROM interfaces i
         WHERE i.interface_id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Interface not found' });
      }

      // Get endpoints with environment instance info
      const endpoints = await db.query(
        `SELECT ie.*, ei.name as env_instance_name
         FROM interface_endpoints ie
         LEFT JOIN environment_instances ei ON ie.env_instance_id = ei.env_instance_id
         WHERE ie.interface_id = $1 
         ORDER BY ie.created_at`,
        [id]
      );

      res.json({ ...result.rows[0], endpoints: endpoints.rows });
    } catch (error) {
      console.error('Get interface error:', error);
      res.status(500).json({ error: 'Failed to fetch interface' });
    }
  },

  // Create interface
  create: async (req, res) => {
    try {
      const { name, direction, pattern, frequency, external_party, sla, contract_id, source_application_id, target_application_id } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Interface name is required' });
      }

      const result = await db.query(
        `INSERT INTO interfaces (name, direction, pattern, frequency, external_party, sla, contract_id, source_application_id, target_application_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [name, direction || 'Outbound', pattern || 'REST', frequency || 'RealTime', external_party, sla, contract_id, source_application_id || null, target_application_id || null]
      );

      // Log activity
      await db.query(
        `INSERT INTO activities (user_id, action, entity_type, entity_id, entity_name)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.user_id, 'CREATE', 'Interface', result.rows[0].interface_id, name]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Create interface error:', error);
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Interface name already exists' });
      }
      res.status(500).json({ error: 'Failed to create interface' });
    }
  },

  // Update interface
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, direction, pattern, frequency, external_party, sla, contract_id, source_application_id, target_application_id } = req.body;

      const result = await db.query(
        `UPDATE interfaces 
         SET name = COALESCE($1, name),
             direction = COALESCE($2, direction),
             pattern = COALESCE($3, pattern),
             frequency = COALESCE($4, frequency),
             external_party = COALESCE($5, external_party),
             sla = COALESCE($6, sla),
             contract_id = COALESCE($7, contract_id),
             source_application_id = $8,
             target_application_id = $9,
             updated_at = NOW()
         WHERE interface_id = $10
         RETURNING *`,
        [name, direction, pattern, frequency, external_party, sla, contract_id, source_application_id || null, target_application_id || null, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Interface not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Update interface error:', error);
      res.status(500).json({ error: 'Failed to update interface' });
    }
  },

  // Delete interface
  delete: async (req, res) => {
    try {
      const { id } = req.params;

      const result = await db.query(
        'DELETE FROM interfaces WHERE interface_id = $1 RETURNING name',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Interface not found' });
      }

      res.json({ message: 'Interface deleted successfully' });
    } catch (error) {
      console.error('Delete interface error:', error);
      res.status(500).json({ error: 'Failed to delete interface' });
    }
  },

  // Get all endpoints across all interfaces
  getAllEndpoints: async (req, res) => {
    try {
      const result = await db.query(
        `SELECT ie.*, 
                i.name as interface_name,
                ei.name as env_instance_name,
                e.name as environment_name
         FROM interface_endpoints ie
         JOIN interfaces i ON ie.interface_id = i.interface_id
         LEFT JOIN environment_instances ei ON ie.env_instance_id = ei.env_instance_id
         LEFT JOIN environments e ON ei.environment_id = e.environment_id
         ORDER BY i.name, e.name, ei.name`
      );
      res.json({ endpoints: result.rows });
    } catch (error) {
      console.error('Get all endpoints error:', error);
      res.status(500).json({ error: 'Failed to fetch endpoints' });
    }
  },

  // Get endpoints for an interface
  getEndpoints: async (req, res) => {
    try {
      const { id } = req.params;

      const result = await db.query(
        `SELECT ie.*, 
                ei.name as env_instance_name,
                e.name as environment_name,
                src_ci.version as source_version,
                src_ac.name as source_component_name,
                src_app.name as source_application_name,
                tgt_ci.version as target_version,
                tgt_ac.name as target_component_name,
                tgt_app.name as target_application_name
         FROM interface_endpoints ie
         LEFT JOIN environment_instances ei ON ie.env_instance_id = ei.env_instance_id
         LEFT JOIN environments e ON ei.environment_id = e.environment_id
         LEFT JOIN component_instances src_ci ON ie.source_component_instance_id = src_ci.component_instance_id
         LEFT JOIN app_components src_ac ON src_ci.component_id = src_ac.component_id
         LEFT JOIN applications src_app ON src_ac.application_id = src_app.application_id
         LEFT JOIN component_instances tgt_ci ON ie.target_component_instance_id = tgt_ci.component_instance_id
         LEFT JOIN app_components tgt_ac ON tgt_ci.component_id = tgt_ac.component_id
         LEFT JOIN applications tgt_app ON tgt_ac.application_id = tgt_app.application_id
         WHERE ie.interface_id = $1 
         ORDER BY e.name, ei.name`,
        [id]
      );

      res.json({ endpoints: result.rows });
    } catch (error) {
      console.error('Get endpoints error:', error);
      res.status(500).json({ error: 'Failed to fetch endpoints' });
    }
  },

  // Create endpoint
  createEndpoint: async (req, res) => {
    try {
      const { id } = req.params;
      const { env_instance_id, source_component_instance_id, target_component_instance_id, external_stub_id, endpoint, enabled, test_mode } = req.body;

      if (!env_instance_id) {
        return res.status(400).json({ error: 'Environment instance is required' });
      }

      const result = await db.query(
        `INSERT INTO interface_endpoints (interface_id, env_instance_id, source_component_instance_id, target_component_instance_id, external_stub_id, endpoint, enabled, test_mode)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [id, env_instance_id, source_component_instance_id, target_component_instance_id, external_stub_id, endpoint, enabled !== false, test_mode || 'Live']
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Create endpoint error:', error);
      res.status(500).json({ error: 'Failed to create endpoint' });
    }
  },

  // Update endpoint
  updateEndpoint: async (req, res) => {
    try {
      const { endpointId } = req.params;
      const { env_instance_id, source_component_instance_id, target_component_instance_id, external_stub_id, endpoint, enabled, test_mode } = req.body;

      const result = await db.query(
        `UPDATE interface_endpoints 
         SET env_instance_id = COALESCE($1, env_instance_id),
             source_component_instance_id = COALESCE($2, source_component_instance_id),
             target_component_instance_id = COALESCE($3, target_component_instance_id),
             external_stub_id = COALESCE($4, external_stub_id),
             endpoint = COALESCE($5, endpoint),
             enabled = COALESCE($6, enabled),
             test_mode = COALESCE($7, test_mode),
             updated_at = NOW()
         WHERE interface_endpoint_id = $8
         RETURNING *`,
        [env_instance_id, source_component_instance_id, target_component_instance_id, external_stub_id, endpoint, enabled, test_mode, endpointId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Endpoint not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Update endpoint error:', error);
      res.status(500).json({ error: 'Failed to update endpoint' });
    }
  },

  // Delete endpoint
  deleteEndpoint: async (req, res) => {
    try {
      const { endpointId } = req.params;

      const result = await db.query(
        'DELETE FROM interface_endpoints WHERE interface_endpoint_id = $1 RETURNING interface_endpoint_id',
        [endpointId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Endpoint not found' });
      }

      res.json({ message: 'Endpoint deleted successfully' });
    } catch (error) {
      console.error('Delete endpoint error:', error);
      res.status(500).json({ error: 'Failed to delete endpoint' });
    }
  }
};

module.exports = interfaceController;
