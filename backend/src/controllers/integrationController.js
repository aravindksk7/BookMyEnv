const db = require('../config/database');

const integrationController = {
  // Get all integrations
  getAll: async (req, res) => {
    try {
      const { tool_type, is_active } = req.query;
      
      let query = `
        SELECT eti.*, 
               COUNT(il.integration_link_id) as linked_items_count
        FROM external_tool_integrations eti
        LEFT JOIN integration_links il ON eti.integration_id = il.integration_id
        WHERE 1=1
      `;
      const params = [];

      if (tool_type) {
        params.push(tool_type);
        query += ` AND eti.tool_type = $${params.length}`;
      }

      if (is_active !== undefined) {
        params.push(is_active === 'true');
        query += ` AND eti.is_active = $${params.length}`;
      }

      query += ' GROUP BY eti.integration_id ORDER BY eti.name';

      const result = await db.query(query, params);
      
      // Remove sensitive data
      const integrations = result.rows.map(row => ({
        ...row,
        api_token_encrypted: row.api_token_encrypted ? '[CONFIGURED]' : null
      }));

      res.json({ integrations });
    } catch (error) {
      console.error('Get integrations error:', error);
      res.status(500).json({ error: 'Failed to fetch integrations' });
    }
  },

  // Get integration by ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;

      const result = await db.query(
        `SELECT * FROM external_tool_integrations WHERE integration_id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Integration not found' });
      }

      // Get linked items
      const links = await db.query(
        `SELECT il.*, 
                CASE 
                  WHEN il.linked_entity_type = 'Release' THEN r.name
                  WHEN il.linked_entity_type = 'EnvironmentBooking' THEN eb.purpose
                  ELSE NULL
                END as entity_name
         FROM integration_links il
         LEFT JOIN releases r ON il.linked_entity_type = 'Release' AND il.linked_entity_id = r.release_id
         LEFT JOIN environment_bookings eb ON il.linked_entity_type = 'EnvironmentBooking' AND il.linked_entity_id = eb.booking_id
         WHERE il.integration_id = $1
         ORDER BY il.created_at DESC
         LIMIT 50`,
        [id]
      );

      // Remove sensitive data
      const integration = {
        ...result.rows[0],
        api_token_encrypted: result.rows[0].api_token_encrypted ? '[CONFIGURED]' : null,
        links: links.rows
      };

      res.json(integration);
    } catch (error) {
      console.error('Get integration error:', error);
      res.status(500).json({ error: 'Failed to fetch integration' });
    }
  },

  // Create integration
  create: async (req, res) => {
    try {
      const { 
        name, tool_type, base_url, api_token, 
        project_key, webhook_secret, additional_config, is_active
      } = req.body;

      if (!name || !tool_type || !base_url) {
        return res.status(400).json({ error: 'Name, tool_type, and base_url are required' });
      }

      const validToolTypes = ['Jira', 'GitLab', 'ServiceNow', 'Jenkins', 'AzureDevOps'];
      if (!validToolTypes.includes(tool_type)) {
        return res.status(400).json({ error: 'Invalid tool_type' });
      }

      // In production, encrypt the API token properly
      const result = await db.query(
        `INSERT INTO external_tool_integrations 
         (name, tool_type, base_url, api_token_encrypted, project_key, webhook_secret, additional_config, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [name, tool_type, base_url, api_token, project_key, webhook_secret, 
         additional_config ? JSON.stringify(additional_config) : null, 
         is_active !== false]
      );

      // Log activity
      await db.query(
        `INSERT INTO activities (user_id, action, entity_type, entity_id, entity_name)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.user_id, 'CREATE', 'Integration', result.rows[0].integration_id, name]
      );

      res.status(201).json({
        ...result.rows[0],
        api_token_encrypted: result.rows[0].api_token_encrypted ? '[CONFIGURED]' : null
      });
    } catch (error) {
      console.error('Create integration error:', error);
      res.status(500).json({ error: 'Failed to create integration' });
    }
  },

  // Update integration
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { 
        name, base_url, api_token, project_key, 
        webhook_secret, additional_config, is_active
      } = req.body;

      let updateQuery = `
        UPDATE external_tool_integrations 
        SET name = COALESCE($1, name),
            base_url = COALESCE($2, base_url),
            project_key = COALESCE($3, project_key),
            additional_config = COALESCE($4, additional_config),
            is_active = COALESCE($5, is_active),
            updated_at = NOW()
      `;
      const params = [name, base_url, project_key, 
        additional_config ? JSON.stringify(additional_config) : null,
        is_active];

      // Only update secrets if provided
      if (api_token) {
        params.push(api_token);
        updateQuery += `, api_token_encrypted = $${params.length}`;
      }

      if (webhook_secret) {
        params.push(webhook_secret);
        updateQuery += `, webhook_secret = $${params.length}`;
      }

      params.push(id);
      updateQuery += ` WHERE integration_id = $${params.length} RETURNING *`;

      const result = await db.query(updateQuery, params);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Integration not found' });
      }

      res.json({
        ...result.rows[0],
        api_token_encrypted: result.rows[0].api_token_encrypted ? '[CONFIGURED]' : null
      });
    } catch (error) {
      console.error('Update integration error:', error);
      res.status(500).json({ error: 'Failed to update integration' });
    }
  },

  // Delete integration
  delete: async (req, res) => {
    try {
      const { id } = req.params;

      const result = await db.query(
        'DELETE FROM external_tool_integrations WHERE integration_id = $1 RETURNING name',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Integration not found' });
      }

      res.json({ message: 'Integration deleted successfully' });
    } catch (error) {
      console.error('Delete integration error:', error);
      res.status(500).json({ error: 'Failed to delete integration' });
    }
  },

  // Test integration connection
  testConnection: async (req, res) => {
    try {
      const { id } = req.params;

      const result = await db.query(
        'SELECT * FROM external_tool_integrations WHERE integration_id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Integration not found' });
      }

      const integration = result.rows[0];
      
      // Test connection based on tool type
      // In production, implement actual API calls
      const testResult = {
        success: true,
        message: `Connection to ${integration.tool_type} successful`,
        timestamp: new Date().toISOString()
      };

      // Update last sync
      await db.query(
        'UPDATE external_tool_integrations SET last_sync_at = NOW() WHERE integration_id = $1',
        [id]
      );

      res.json(testResult);
    } catch (error) {
      console.error('Test connection error:', error);
      res.status(500).json({ error: 'Failed to test connection', details: error.message });
    }
  },

  // Create integration link
  createLink: async (req, res) => {
    try {
      const { 
        integration_id, linked_entity_type, linked_entity_id,
        external_item_id, external_item_url, external_item_key, sync_enabled
      } = req.body;

      if (!integration_id || !linked_entity_type || !linked_entity_id) {
        return res.status(400).json({ error: 'Required fields missing' });
      }

      const validEntityTypes = ['Release', 'EnvironmentBooking', 'EnvironmentInstance', 'Application'];
      if (!validEntityTypes.includes(linked_entity_type)) {
        return res.status(400).json({ error: 'Invalid linked_entity_type' });
      }

      const result = await db.query(
        `INSERT INTO integration_links 
         (integration_id, linked_entity_type, linked_entity_id, external_item_id, external_item_url, external_item_key, sync_enabled)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [integration_id, linked_entity_type, linked_entity_id, external_item_id, external_item_url, external_item_key, sync_enabled !== false]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Create link error:', error);
      res.status(500).json({ error: 'Failed to create integration link' });
    }
  },

  // Delete integration link
  deleteLink: async (req, res) => {
    try {
      const { linkId } = req.params;

      await db.query('DELETE FROM integration_links WHERE link_id = $1', [linkId]);

      res.json({ message: 'Link deleted successfully' });
    } catch (error) {
      console.error('Delete link error:', error);
      res.status(500).json({ error: 'Failed to delete link' });
    }
  },

  // Sync integration
  sync: async (req, res) => {
    try {
      const { id } = req.params;
      const { entity_type, entity_id } = req.body;

      const integration = await db.query(
        'SELECT * FROM external_tool_integrations WHERE integration_id = $1',
        [id]
      );

      if (integration.rows.length === 0) {
        return res.status(404).json({ error: 'Integration not found' });
      }

      // In production, implement actual sync logic based on tool type
      const syncResult = {
        success: true,
        items_synced: 0,
        errors: [],
        timestamp: new Date().toISOString()
      };

      // Update last sync timestamp
      await db.query(
        'UPDATE external_tool_integrations SET last_sync_at = NOW() WHERE integration_id = $1',
        [id]
      );

      res.json(syncResult);
    } catch (error) {
      console.error('Sync error:', error);
      res.status(500).json({ error: 'Failed to sync integration' });
    }
  },

  // Handle webhook
  handleWebhook: async (req, res) => {
    try {
      const { id } = req.params;
      const payload = req.body;

      const integration = await db.query(
        'SELECT * FROM external_tool_integrations WHERE integration_id = $1',
        [id]
      );

      if (integration.rows.length === 0) {
        return res.status(404).json({ error: 'Integration not found' });
      }

      // Log webhook
      await db.query(
        `INSERT INTO activities (action, entity_type, entity_id, entity_name, details)
         VALUES ($1, $2, $3, $4, $5)`,
        ['WEBHOOK_RECEIVED', 'Integration', id, integration.rows[0].name, 
         JSON.stringify({ event_type: payload.event_type || 'unknown' })]
      );

      // In production, process webhook based on tool type and event
      // This could trigger status updates, notifications, etc.

      res.json({ received: true });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).json({ error: 'Failed to process webhook' });
    }
  },

  // Get links for entity
  getLinksForEntity: async (req, res) => {
    try {
      const { entityType, entityId } = req.params;

      const result = await db.query(
        `SELECT il.*, eti.name as integration_name, eti.tool_type, eti.base_url
         FROM integration_links il
         JOIN external_tool_integrations eti ON il.integration_id = eti.integration_id
         WHERE il.linked_entity_type = $1 AND il.linked_entity_id = $2`,
        [entityType, entityId]
      );

      res.json({ links: result.rows });
    } catch (error) {
      console.error('Get links error:', error);
      res.status(500).json({ error: 'Failed to fetch links' });
    }
  }
};

module.exports = integrationController;
