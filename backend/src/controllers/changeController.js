const db = require('../config/database');

const changeController = {
  // Get all changes
  getAll: async (req, res) => {
    try {
      const { status, type, env_instance_id, search } = req.query;
      
      let query = `
        SELECT c.*, 
               u.display_name as requested_by_name,
               ei.name as instance_name,
               e.name as environment_name,
               r.name as release_name
        FROM changes c
        LEFT JOIN users u ON c.requested_by = u.user_id
        LEFT JOIN environment_instances ei ON c.env_instance_id = ei.env_instance_id
        LEFT JOIN environments e ON ei.environment_id = e.environment_id
        LEFT JOIN releases r ON c.release_id = r.release_id
        WHERE 1=1
      `;
      const params = [];

      if (status) {
        params.push(status);
        query += ` AND c.status = $${params.length}`;
      }

      if (type) {
        params.push(type);
        query += ` AND c.type = $${params.length}`;
      }

      if (env_instance_id) {
        params.push(env_instance_id);
        query += ` AND c.env_instance_id = $${params.length}`;
      }

      if (search) {
        params.push(`%${search}%`);
        query += ` AND c.change_ticket_ref ILIKE $${params.length}`;
      }

      query += ' ORDER BY c.created_at DESC';

      const result = await db.query(query, params);
      res.json({ changes: result.rows });
    } catch (error) {
      console.error('Get changes error:', error);
      res.status(500).json({ error: 'Failed to fetch changes' });
    }
  },

  // Get change by ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;

      const result = await db.query(
        `SELECT c.*, 
                u.display_name as requested_by_name,
                ei.name as instance_name,
                e.name as environment_name,
                r.name as release_name
         FROM changes c
         LEFT JOIN users u ON c.requested_by = u.user_id
         LEFT JOIN environment_instances ei ON c.env_instance_id = ei.env_instance_id
         LEFT JOIN environments e ON ei.environment_id = e.environment_id
         LEFT JOIN releases r ON c.release_id = r.release_id
         WHERE c.change_id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Change not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Get change error:', error);
      res.status(500).json({ error: 'Failed to fetch change' });
    }
  },

  // Create change
  create: async (req, res) => {
    try {
      const { 
        type, env_instance_id, release_id,
        planned_datetime, risk_level, change_ticket_ref
      } = req.body;

      if (!type || !env_instance_id) {
        return res.status(400).json({ error: 'Type and environment instance are required' });
      }

      const validTypes = ['Deployment', 'Config', 'DataRefresh', 'Other'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({ error: 'Invalid type. Must be: Deployment, Config, DataRefresh, or Other' });
      }

      const result = await db.query(
        `INSERT INTO changes 
         (type, env_instance_id, release_id, planned_datetime, 
          risk_level, change_ticket_ref, requested_by, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'Planned')
         RETURNING *`,
        [type, env_instance_id, release_id, planned_datetime,
         risk_level || 'Medium', change_ticket_ref, req.user.user_id]
      );

      // Log activity
      await db.query(
        `INSERT INTO activities (user_id, action, entity_type, entity_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.user_id, 'CREATE', 'Change', result.rows[0].change_id, 
         JSON.stringify({ type, change_ticket_ref })]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Create change error:', error);
      res.status(500).json({ error: 'Failed to create change' });
    }
  },

  // Update change
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { 
        type, env_instance_id, release_id,
        planned_datetime, risk_level, change_ticket_ref
      } = req.body;

      const result = await db.query(
        `UPDATE changes 
         SET type = COALESCE($1, type),
             env_instance_id = COALESCE($2, env_instance_id),
             release_id = COALESCE($3, release_id),
             planned_datetime = COALESCE($4, planned_datetime),
             risk_level = COALESCE($5, risk_level),
             change_ticket_ref = COALESCE($6, change_ticket_ref),
             updated_at = NOW()
         WHERE change_id = $7
         RETURNING *`,
        [type, env_instance_id, release_id, planned_datetime, 
         risk_level, change_ticket_ref, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Change not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Update change error:', error);
      res.status(500).json({ error: 'Failed to update change' });
    }
  },

  // Update change status
  updateStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const validStatuses = ['Planned', 'Approved', 'InProgress', 'Completed', 'Failed', 'Cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const updates = ['status = $1', 'updated_at = NOW()'];
      const params = [status];

      if (status === 'Completed' || status === 'Failed') {
        updates.push(`actual_datetime = NOW()`);
      }

      params.push(id);

      const result = await db.query(
        `UPDATE changes SET ${updates.join(', ')} WHERE change_id = $${params.length} RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Change not found' });
      }

      // Log activity
      await db.query(
        `INSERT INTO activities (user_id, action, entity_type, entity_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.user_id, 'STATUS_CHANGE', 'Change', id, JSON.stringify({ status })]
      );

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Update status error:', error);
      res.status(500).json({ error: 'Failed to update status' });
    }
  },

  // Request approval (simplified - just updates status)
  requestApproval: async (req, res) => {
    try {
      const { id } = req.params;

      const result = await db.query(
        `UPDATE changes SET status = 'PendingApproval', updated_at = NOW() 
         WHERE change_id = $1 AND status = 'Planned'
         RETURNING *`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Change not found or not in Planned status' });
      }

      res.json({ message: 'Approval requested', change: result.rows[0] });
    } catch (error) {
      console.error('Request approval error:', error);
      res.status(500).json({ error: 'Failed to request approval' });
    }
  },

  // Process approval (approve/reject)
  processApproval: async (req, res) => {
    try {
      const { id } = req.params;
      const { decision } = req.body;

      if (!['Approved', 'Rejected'].includes(decision)) {
        return res.status(400).json({ error: 'Decision must be Approved or Rejected' });
      }

      const newStatus = decision === 'Approved' ? 'Approved' : 'Planned';

      const result = await db.query(
        `UPDATE changes SET status = $1, updated_at = NOW() 
         WHERE change_id = $2
         RETURNING *`,
        [newStatus, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Change not found' });
      }

      // Log activity
      await db.query(
        `INSERT INTO activities (user_id, action, entity_type, entity_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.user_id, 'APPROVAL', 'Change', id, JSON.stringify({ decision })]
      );

      res.json({ message: `Change ${decision.toLowerCase()}`, change: result.rows[0] });
    } catch (error) {
      console.error('Process approval error:', error);
      res.status(500).json({ error: 'Failed to process approval' });
    }
  },

  // Delete change
  delete: async (req, res) => {
    try {
      const { id } = req.params;

      const result = await db.query(
        `DELETE FROM changes WHERE change_id = $1 AND status IN ('Planned', 'Cancelled') 
         RETURNING change_id, type`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Change not found or cannot be deleted' });
      }

      res.json({ message: 'Change deleted successfully' });
    } catch (error) {
      console.error('Delete change error:', error);
      res.status(500).json({ error: 'Failed to delete change' });
    }
  },

  // Get statistics
  getStatistics: async (req, res) => {
    try {
      const stats = await db.query(`
        SELECT 
          (SELECT COUNT(*) FROM changes) as total_changes,
          (SELECT COUNT(*) FROM changes WHERE status = 'Planned') as planned,
          (SELECT COUNT(*) FROM changes WHERE status = 'Approved') as approved,
          (SELECT COUNT(*) FROM changes WHERE status = 'InProgress') as in_progress,
          (SELECT COUNT(*) FROM changes WHERE status = 'Completed') as completed,
          (SELECT COUNT(*) FROM changes WHERE status = 'Failed') as failed,
          (SELECT COUNT(*) FROM changes WHERE status = 'Cancelled') as cancelled
      `);

      res.json(stats.rows[0]);
    } catch (error) {
      console.error('Get statistics error:', error);
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  }
};

module.exports = changeController;
