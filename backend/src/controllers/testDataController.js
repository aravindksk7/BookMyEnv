const db = require('../config/database');

// Actual DB schema for test_data_sets table:
// test_data_set_id, name, env_instance_id (required FK), application_id (FK), 
// data_generation_method (Masked/Synthetic/Hybrid), refresh_frequency, last_refreshed_date,
// data_completeness_score, constraints, created_at, updated_at

const testDataController = {
  // Get all test data sets
  getAll: async (req, res) => {
    try {
      const { application_id, env_instance_id, data_generation_method, search } = req.query;
      
      let query = `
        SELECT tds.*, 
               a.name as application_name,
               ei.name as env_instance_name,
               e.name as environment_name
        FROM test_data_sets tds
        LEFT JOIN applications a ON tds.application_id = a.application_id
        LEFT JOIN environment_instances ei ON tds.env_instance_id = ei.env_instance_id
        LEFT JOIN environments e ON ei.environment_id = e.environment_id
        WHERE 1=1
      `;
      const params = [];

      if (application_id) {
        params.push(application_id);
        query += ` AND tds.application_id = $${params.length}`;
      }

      if (env_instance_id) {
        params.push(env_instance_id);
        query += ` AND tds.env_instance_id = $${params.length}`;
      }

      if (data_generation_method) {
        params.push(data_generation_method);
        query += ` AND tds.data_generation_method = $${params.length}`;
      }

      if (search) {
        params.push(`%${search}%`);
        query += ` AND tds.name ILIKE $${params.length}`;
      }

      query += ' ORDER BY tds.name ASC';

      const result = await db.query(query, params);
      res.json({ testDataSets: result.rows });
    } catch (error) {
      console.error('Get test data sets error:', error);
      res.status(500).json({ error: 'Failed to fetch test data sets' });
    }
  },

  // Get test data set by ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;

      const result = await db.query(
        `SELECT tds.*, 
                a.name as application_name,
                ei.name as env_instance_name,
                e.name as environment_name
         FROM test_data_sets tds
         LEFT JOIN applications a ON tds.application_id = a.application_id
         LEFT JOIN environment_instances ei ON tds.env_instance_id = ei.env_instance_id
         LEFT JOIN environments e ON ei.environment_id = e.environment_id
         WHERE tds.test_data_set_id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Test data set not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Get test data set error:', error);
      res.status(500).json({ error: 'Failed to fetch test data set' });
    }
  },

  // Create test data set
  create: async (req, res) => {
    try {
      const { name, env_instance_id, application_id, data_generation_method, refresh_frequency, data_completeness_score, constraints } = req.body;

      if (!name || !env_instance_id) {
        return res.status(400).json({ error: 'Test data set name and environment instance are required' });
      }

      const result = await db.query(
        `INSERT INTO test_data_sets (name, env_instance_id, application_id, data_generation_method, refresh_frequency, data_completeness_score, constraints)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [name, env_instance_id, application_id, data_generation_method || 'Synthetic', refresh_frequency, data_completeness_score, constraints]
      );

      // Log activity
      await db.query(
        `INSERT INTO activities (user_id, action, entity_type, entity_id, entity_name)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.user_id, 'CREATE', 'TestDataSet', result.rows[0].test_data_set_id, name]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Create test data set error:', error);
      res.status(500).json({ error: 'Failed to create test data set' });
    }
  },

  // Update test data set
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, env_instance_id, application_id, data_generation_method, refresh_frequency, data_completeness_score, constraints } = req.body;

      const result = await db.query(
        `UPDATE test_data_sets 
         SET name = COALESCE($1, name),
             env_instance_id = COALESCE($2, env_instance_id),
             application_id = COALESCE($3, application_id),
             data_generation_method = COALESCE($4, data_generation_method),
             refresh_frequency = COALESCE($5, refresh_frequency),
             data_completeness_score = COALESCE($6, data_completeness_score),
             constraints = COALESCE($7, constraints),
             updated_at = NOW()
         WHERE test_data_set_id = $8
         RETURNING *`,
        [name, env_instance_id, application_id, data_generation_method, refresh_frequency, data_completeness_score, constraints, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Test data set not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Update test data set error:', error);
      res.status(500).json({ error: 'Failed to update test data set' });
    }
  },

  // Delete test data set
  delete: async (req, res) => {
    try {
      const { id } = req.params;

      const result = await db.query(
        'DELETE FROM test_data_sets WHERE test_data_set_id = $1 RETURNING name',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Test data set not found' });
      }

      res.json({ message: 'Test data set deleted successfully' });
    } catch (error) {
      console.error('Delete test data set error:', error);
      res.status(500).json({ error: 'Failed to delete test data set' });
    }
  },

  // Mark test data as refreshed
  markRefreshed: async (req, res) => {
    try {
      const { id } = req.params;

      const result = await db.query(
        `UPDATE test_data_sets 
         SET last_refreshed_date = NOW(),
             updated_at = NOW()
         WHERE test_data_set_id = $1
         RETURNING *`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Test data set not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Mark refreshed error:', error);
      res.status(500).json({ error: 'Failed to mark test data as refreshed' });
    }
  }
};

module.exports = testDataController;
