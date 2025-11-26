const db = require('../config/database');

const releaseController = {
  // Get all releases
  getAll: async (req, res) => {
    try {
      const { status, release_type, search } = req.query;
      
      let query = `
        SELECT r.*, 
               u.display_name as release_manager_name,
               ug.name as owning_group_name,
               COUNT(DISTINCT ra.application_id) as application_count,
               COUNT(DISTINCT re.env_instance_id) as environment_count
        FROM releases r
        LEFT JOIN users u ON r.release_manager_user_id = u.user_id
        LEFT JOIN user_groups ug ON r.owning_group_id = ug.group_id
        LEFT JOIN release_applications ra ON r.release_id = ra.release_id
        LEFT JOIN release_environments re ON r.release_id = re.release_id
        WHERE 1=1
      `;
      const params = [];

      if (status) {
        params.push(status);
        query += ` AND r.status = $${params.length}`;
      }

      if (release_type) {
        params.push(release_type);
        query += ` AND r.release_type = $${params.length}`;
      }

      if (search) {
        params.push(`%${search}%`);
        query += ` AND (r.name ILIKE $${params.length} OR r.description ILIKE $${params.length})`;
      }

      query += ' GROUP BY r.release_id, u.display_name, ug.name ORDER BY r.planned_start_datetime DESC NULLS LAST';

      const result = await db.query(query, params);
      res.json({ releases: result.rows });
    } catch (error) {
      console.error('Get releases error:', error);
      res.status(500).json({ error: 'Failed to fetch releases' });
    }
  },

  // Get release by ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;

      const result = await db.query(
        `SELECT r.*, 
                u.display_name as release_manager_name,
                ug.name as owning_group_name
         FROM releases r
         LEFT JOIN users u ON r.release_manager_user_id = u.user_id
         LEFT JOIN user_groups ug ON r.owning_group_id = ug.group_id
         WHERE r.release_id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Release not found' });
      }

      // Get applications
      const applications = await db.query(
        `SELECT ra.*, a.name as application_name, a.criticality
         FROM release_applications ra
         JOIN applications a ON ra.application_id = a.application_id
         WHERE ra.release_id = $1`,
        [id]
      );

      // Get environments
      const environments = await db.query(
        `SELECT re.*, ei.name as instance_name, e.name as environment_name
         FROM release_environments re
         JOIN environment_instances ei ON re.env_instance_id = ei.env_instance_id
         JOIN environments e ON ei.environment_id = e.environment_id
         WHERE re.release_id = $1
         ORDER BY re.deployment_window_start`,
        [id]
      );

      // Get component instances
      const components = await db.query(
        `SELECT rci.*, ac.name as component_name, ci.version as current_version,
                ei.name as instance_name
         FROM release_component_instances rci
         JOIN component_instances ci ON rci.component_instance_id = ci.component_instance_id
         JOIN app_components ac ON ci.component_id = ac.component_id
         JOIN environment_instances ei ON ci.env_instance_id = ei.env_instance_id
         WHERE rci.release_id = $1`,
        [id]
      );

      // Get integration links
      const links = await db.query(
        `SELECT il.*, eti.name as integration_name, eti.tool_type
         FROM integration_links il
         JOIN external_tool_integrations eti ON il.integration_id = eti.integration_id
         WHERE il.linked_entity_type = 'Release' AND il.linked_entity_id = $1`,
        [id]
      );

      res.json({
        ...result.rows[0],
        applications: applications.rows,
        environments: environments.rows,
        components: components.rows,
        integration_links: links.rows
      });
    } catch (error) {
      console.error('Get release error:', error);
      res.status(500).json({ error: 'Failed to fetch release' });
    }
  },

  // Create release
  create: async (req, res) => {
    try {
      const { 
        name, description, release_type, status,
        planned_start_datetime, planned_end_datetime,
        release_manager_user_id, owning_group_id,
        jira_release_key, git_tag, servicenow_change_batch_id
      } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Release name is required' });
      }

      const result = await db.query(
        `INSERT INTO releases 
         (name, description, release_type, status, planned_start_datetime, planned_end_datetime,
          release_manager_user_id, owning_group_id, jira_release_key, git_tag, servicenow_change_batch_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [name, description, release_type || 'Minor', status || 'Planned',
         planned_start_datetime, planned_end_datetime,
         release_manager_user_id || req.user.user_id, owning_group_id,
         jira_release_key, git_tag, servicenow_change_batch_id]
      );

      // Log activity
      await db.query(
        `INSERT INTO activities (user_id, action, entity_type, entity_id, entity_name)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.user_id, 'CREATE', 'Release', result.rows[0].release_id, name]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Create release error:', error);
      res.status(500).json({ error: 'Failed to create release' });
    }
  },

  // Update release
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { 
        name, description, release_type, 
        planned_start_datetime, planned_end_datetime,
        actual_start_datetime, actual_end_datetime,
        release_manager_user_id, owning_group_id,
        jira_release_key, git_tag, servicenow_change_batch_id
      } = req.body;

      const result = await db.query(
        `UPDATE releases 
         SET name = COALESCE($1, name),
             description = COALESCE($2, description),
             release_type = COALESCE($3, release_type),
             planned_start_datetime = COALESCE($4, planned_start_datetime),
             planned_end_datetime = COALESCE($5, planned_end_datetime),
             actual_start_datetime = COALESCE($6, actual_start_datetime),
             actual_end_datetime = COALESCE($7, actual_end_datetime),
             release_manager_user_id = COALESCE($8, release_manager_user_id),
             owning_group_id = COALESCE($9, owning_group_id),
             jira_release_key = COALESCE($10, jira_release_key),
             git_tag = COALESCE($11, git_tag),
             servicenow_change_batch_id = COALESCE($12, servicenow_change_batch_id),
             updated_at = NOW()
         WHERE release_id = $13
         RETURNING *`,
        [name, description, release_type, planned_start_datetime, planned_end_datetime,
         actual_start_datetime, actual_end_datetime, release_manager_user_id, owning_group_id,
         jira_release_key, git_tag, servicenow_change_batch_id, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Release not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Update release error:', error);
      res.status(500).json({ error: 'Failed to update release' });
    }
  },

  // Update release status
  updateStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const validStatuses = ['Planned', 'InProgress', 'CodeComplete', 'Testing', 'ReadyForProd', 'Deployed', 'Failed', 'RolledBack', 'Cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const updates = ['status = $1', 'updated_at = NOW()'];
      const params = [status];

      if (status === 'InProgress' || status === 'Testing') {
        updates.push(`actual_start_datetime = COALESCE(actual_start_datetime, NOW())`);
      }

      if (['Deployed', 'Failed', 'RolledBack', 'Cancelled'].includes(status)) {
        updates.push(`actual_end_datetime = NOW()`);
      }

      params.push(id);

      const result = await db.query(
        `UPDATE releases SET ${updates.join(', ')} WHERE release_id = $${params.length} RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Release not found' });
      }

      // Log activity
      await db.query(
        `INSERT INTO activities (user_id, action, entity_type, entity_id, entity_name, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.user.user_id, 'STATUS_CHANGE', 'Release', id, result.rows[0].name, 
         JSON.stringify({ new_status: status })]
      );

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Update release status error:', error);
      res.status(500).json({ error: 'Failed to update release status' });
    }
  },

  // Delete release
  delete: async (req, res) => {
    try {
      const { id } = req.params;

      const result = await db.query(
        'DELETE FROM releases WHERE release_id = $1 RETURNING name',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Release not found' });
      }

      res.json({ message: 'Release deleted successfully' });
    } catch (error) {
      console.error('Delete release error:', error);
      res.status(500).json({ error: 'Failed to delete release' });
    }
  },

  // Add application to release
  addApplication: async (req, res) => {
    try {
      const { id } = req.params;
      const { application_id, planned_version } = req.body;

      const result = await db.query(
        `INSERT INTO release_applications (release_id, application_id, planned_version)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [id, application_id, planned_version]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Add application error:', error);
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Application already added to this release' });
      }
      res.status(500).json({ error: 'Failed to add application' });
    }
  },

  // Remove application from release
  removeApplication: async (req, res) => {
    try {
      const { id, applicationId } = req.params;

      await db.query(
        'DELETE FROM release_applications WHERE release_id = $1 AND application_id = $2',
        [id, applicationId]
      );

      res.json({ message: 'Application removed from release' });
    } catch (error) {
      console.error('Remove application error:', error);
      res.status(500).json({ error: 'Failed to remove application' });
    }
  },

  // Add environment to release
  addEnvironment: async (req, res) => {
    try {
      const { id } = req.params;
      const { env_instance_id, deployment_window_start, deployment_window_end, status } = req.body;

      const result = await db.query(
        `INSERT INTO release_environments (release_id, env_instance_id, deployment_window_start, deployment_window_end, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [id, env_instance_id, deployment_window_start, deployment_window_end, status || 'Planned']
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Add environment error:', error);
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Environment already added to this release' });
      }
      res.status(500).json({ error: 'Failed to add environment' });
    }
  },

  // Update release environment status
  updateEnvironmentStatus: async (req, res) => {
    try {
      const { id, envId } = req.params;
      const { status, associated_booking_id } = req.body;

      const result = await db.query(
        `UPDATE release_environments 
         SET status = COALESCE($1, status),
             associated_booking_id = COALESCE($2, associated_booking_id)
         WHERE release_id = $3 AND env_instance_id = $4
         RETURNING *`,
        [status, associated_booking_id, id, envId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Release environment not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Update environment status error:', error);
      res.status(500).json({ error: 'Failed to update environment status' });
    }
  },

  // Remove environment from release
  removeEnvironment: async (req, res) => {
    try {
      const { id, envId } = req.params;

      await db.query(
        'DELETE FROM release_environments WHERE release_id = $1 AND env_instance_id = $2',
        [id, envId]
      );

      res.json({ message: 'Environment removed from release' });
    } catch (error) {
      console.error('Remove environment error:', error);
      res.status(500).json({ error: 'Failed to remove environment' });
    }
  },

  // Get statistics
  getStatistics: async (req, res) => {
    try {
      const stats = await db.query(`
        SELECT 
          (SELECT COUNT(*) FROM releases WHERE status = 'Planned') as planned_releases,
          (SELECT COUNT(*) FROM releases WHERE status IN ('InProgress', 'Testing')) as in_progress_releases,
          (SELECT COUNT(*) FROM releases WHERE status = 'Deployed' AND actual_end_datetime > NOW() - INTERVAL '30 days') as recent_deployments,
          (SELECT COUNT(*) FROM releases WHERE status = 'Failed') as failed_releases,
          (SELECT COUNT(*) FROM releases WHERE planned_start_datetime BETWEEN NOW() AND NOW() + INTERVAL '7 days') as upcoming_releases
      `);

      res.json(stats.rows[0]);
    } catch (error) {
      console.error('Get statistics error:', error);
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  }
};

module.exports = releaseController;
