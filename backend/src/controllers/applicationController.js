const db = require('../config/database');

const applicationController = {
  // Get all applications
  getAll: async (req, res) => {
    try {
      const { criticality, business_domain, search } = req.query;
      
      let query = `
        SELECT a.*, 
               COUNT(DISTINCT ac.component_id) as component_count,
               COUNT(DISTINCT aei.env_instance_id) as deployment_count
        FROM applications a
        LEFT JOIN app_components ac ON a.application_id = ac.application_id
        LEFT JOIN application_environment_instances aei ON a.application_id = aei.application_id
        WHERE 1=1
      `;
      const params = [];

      if (criticality) {
        params.push(criticality);
        query += ` AND a.criticality = $${params.length}`;
      }

      if (business_domain) {
        params.push(business_domain);
        query += ` AND a.business_domain = $${params.length}`;
      }

      if (search) {
        params.push(`%${search}%`);
        query += ` AND (a.name ILIKE $${params.length} OR a.description ILIKE $${params.length})`;
      }

      query += ' GROUP BY a.application_id ORDER BY a.name ASC';

      const result = await db.query(query, params);
      res.json({ applications: result.rows });
    } catch (error) {
      console.error('Get applications error:', error);
      res.status(500).json({ error: 'Failed to fetch applications' });
    }
  },

  // Get application by ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;

      const result = await db.query(
        'SELECT * FROM applications WHERE application_id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Application not found' });
      }

      // Get components
      const components = await db.query(
        `SELECT ac.*, COUNT(ci.component_instance_id) as instance_count
         FROM app_components ac
         LEFT JOIN component_instances ci ON ac.component_id = ci.component_id
         WHERE ac.application_id = $1
         GROUP BY ac.component_id
         ORDER BY ac.name`,
        [id]
      );

      // Get environment deployments
      const deployments = await db.query(
        `SELECT aei.*, ei.name as instance_name, e.name as environment_name
         FROM application_environment_instances aei
         JOIN environment_instances ei ON aei.env_instance_id = ei.env_instance_id
         JOIN environments e ON ei.environment_id = e.environment_id
         WHERE aei.application_id = $1
         ORDER BY e.name, ei.name`,
        [id]
      );

      res.json({
        ...result.rows[0],
        components: components.rows,
        deployments: deployments.rows
      });
    } catch (error) {
      console.error('Get application error:', error);
      res.status(500).json({ error: 'Failed to fetch application' });
    }
  },

  // Create application
  create: async (req, res) => {
    try {
      const { name, business_domain, description, criticality, data_sensitivity, owner_team, test_owner } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Application name is required' });
      }

      // Handle empty strings as null for fields with check constraints
      const criticalityValue = criticality || null;
      const dataSensitivityValue = data_sensitivity || null;

      const result = await db.query(
        `INSERT INTO applications (name, business_domain, description, criticality, data_sensitivity, owner_team, test_owner)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [name, business_domain || null, description || null, criticalityValue, dataSensitivityValue, owner_team || null, test_owner || null]
      );

      // Log activity
      await db.query(
        `INSERT INTO activities (user_id, action, entity_type, entity_id, entity_name)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.user_id, 'CREATE', 'Application', result.rows[0].application_id, name]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Create application error:', error);
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Application name already exists' });
      }
      res.status(500).json({ error: 'Failed to create application' });
    }
  },

  // Update application
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, business_domain, description, criticality, data_sensitivity, owner_team, test_owner } = req.body;

      // Handle empty strings as null for fields with check constraints
      const criticalityValue = criticality || null;
      const dataSensitivityValue = data_sensitivity || null;

      const result = await db.query(
        `UPDATE applications 
         SET name = COALESCE($1, name),
             business_domain = COALESCE($2, business_domain),
             description = COALESCE($3, description),
             criticality = $4,
             data_sensitivity = $5,
             owner_team = COALESCE($6, owner_team),
             test_owner = COALESCE($7, test_owner),
             updated_at = NOW()
         WHERE application_id = $8
         RETURNING *`,
        [name, business_domain || null, description || null, criticalityValue, dataSensitivityValue, owner_team || null, test_owner || null, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Application not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Update application error:', error);
      res.status(500).json({ error: 'Failed to update application' });
    }
  },

  // Delete application
  delete: async (req, res) => {
    try {
      const { id } = req.params;

      const result = await db.query(
        'DELETE FROM applications WHERE application_id = $1 RETURNING name',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Application not found' });
      }

      res.json({ message: 'Application deleted successfully' });
    } catch (error) {
      console.error('Delete application error:', error);
      res.status(500).json({ error: 'Failed to delete application' });
    }
  },

  // Get components for an application
  getComponents: async (req, res) => {
    try {
      const { id } = req.params;

      const result = await db.query(
        `SELECT ac.*, COUNT(ci.component_instance_id) as instance_count
         FROM app_components ac
         LEFT JOIN component_instances ci ON ac.component_id = ci.component_id
         WHERE ac.application_id = $1
         GROUP BY ac.component_id
         ORDER BY ac.name`,
        [id]
      );

      res.json({ components: result.rows });
    } catch (error) {
      console.error('Get components error:', error);
      res.status(500).json({ error: 'Failed to fetch components' });
    }
  },

  // Create component
  createComponent: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, component_type, source_repo, build_pipeline_id, runtime_platform, owner_team } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Component name is required' });
      }

      // Handle empty strings as null for fields with check constraints
      const componentTypeValue = component_type || null;

      const result = await db.query(
        `INSERT INTO app_components (application_id, name, component_type, source_repo, build_pipeline_id, runtime_platform, owner_team)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [id, name, componentTypeValue, source_repo || null, build_pipeline_id || null, runtime_platform || null, owner_team || null]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Create component error:', error);
      res.status(500).json({ error: 'Failed to create component' });
    }
  },

  // Update component
  updateComponent: async (req, res) => {
    try {
      const { componentId } = req.params;
      const { name, component_type, source_repo, build_pipeline_id, runtime_platform, owner_team } = req.body;

      const result = await db.query(
        `UPDATE app_components 
         SET name = COALESCE($1, name),
             component_type = COALESCE($2, component_type),
             source_repo = COALESCE($3, source_repo),
             build_pipeline_id = COALESCE($4, build_pipeline_id),
             runtime_platform = COALESCE($5, runtime_platform),
             owner_team = COALESCE($6, owner_team),
             updated_at = NOW()
         WHERE component_id = $7
         RETURNING *`,
        [name, component_type, source_repo, build_pipeline_id, runtime_platform, owner_team, componentId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Component not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Update component error:', error);
      res.status(500).json({ error: 'Failed to update component' });
    }
  },

  // Delete component
  deleteComponent: async (req, res) => {
    try {
      const { componentId } = req.params;

      const result = await db.query(
        'DELETE FROM app_components WHERE component_id = $1 RETURNING name',
        [componentId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Component not found' });
      }

      res.json({ message: 'Component deleted successfully' });
    } catch (error) {
      console.error('Delete component error:', error);
      res.status(500).json({ error: 'Failed to delete component' });
    }
  },

  // Deploy application to environment instance
  deployToInstance: async (req, res) => {
    try {
      const { id } = req.params;
      const { env_instance_id, deployment_model, version } = req.body;

      if (!env_instance_id) {
        return res.status(400).json({ error: 'Environment instance ID is required' });
      }

      const result = await db.query(
        `INSERT INTO application_environment_instances (application_id, env_instance_id, deployment_model, version, deployment_status)
         VALUES ($1, $2, $3, $4, 'Aligned')
         ON CONFLICT (application_id, env_instance_id) 
         DO UPDATE SET deployment_model = EXCLUDED.deployment_model, version = EXCLUDED.version, updated_at = NOW()
         RETURNING *`,
        [id, env_instance_id, deployment_model, version]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Deploy to instance error:', error);
      res.status(500).json({ error: 'Failed to deploy application' });
    }
  },

  // Get component instances
  getComponentInstances: async (req, res) => {
    try {
      const { componentId } = req.params;

      const result = await db.query(
        `SELECT ci.*, ei.name as instance_name, e.name as environment_name
         FROM component_instances ci
         JOIN environment_instances ei ON ci.env_instance_id = ei.env_instance_id
         JOIN environments e ON ei.environment_id = e.environment_id
         WHERE ci.component_id = $1
         ORDER BY e.name, ei.name`,
        [componentId]
      );

      res.json({ instances: result.rows });
    } catch (error) {
      console.error('Get component instances error:', error);
      res.status(500).json({ error: 'Failed to fetch component instances' });
    }
  },

  // Create component instance
  createComponentInstance: async (req, res) => {
    try {
      const { componentId } = req.params;
      const { env_instance_id, version, endpoint_url, config_reference, status } = req.body;

      if (!env_instance_id) {
        return res.status(400).json({ error: 'Environment instance ID is required' });
      }

      const result = await db.query(
        `INSERT INTO component_instances (component_id, env_instance_id, version, endpoint_url, config_reference, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [componentId, env_instance_id, version, endpoint_url, config_reference, status || 'Active']
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Create component instance error:', error);
      res.status(500).json({ error: 'Failed to create component instance' });
    }
  },

  // Update component instance
  updateComponentInstance: async (req, res) => {
    try {
      const { instanceId } = req.params;
      const { version, endpoint_url, config_reference, status } = req.body;

      const result = await db.query(
        `UPDATE component_instances 
         SET version = COALESCE($1, version),
             endpoint_url = COALESCE($2, endpoint_url),
             config_reference = COALESCE($3, config_reference),
             status = COALESCE($4, status),
             updated_at = NOW()
         WHERE component_instance_id = $5
         RETURNING *`,
        [version, endpoint_url, config_reference, status, instanceId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Component instance not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Update component instance error:', error);
      res.status(500).json({ error: 'Failed to update component instance' });
    }
  },

  // Delete component instance
  deleteComponentInstance: async (req, res) => {
    try {
      const { instanceId } = req.params;

      const result = await db.query(
        'DELETE FROM component_instances WHERE component_instance_id = $1 RETURNING *',
        [instanceId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Component instance not found' });
      }

      res.json({ message: 'Component instance deleted successfully' });
    } catch (error) {
      console.error('Delete component instance error:', error);
      res.status(500).json({ error: 'Failed to delete component instance' });
    }
  },

  // Get related configs for an application
  getRelatedConfigs: async (req, res) => {
    try {
      const { id } = req.params;

      // Get configs where scope is Application or ComponentInstance of this app
      const result = await db.query(
        `SELECT cs.*, u.display_name as created_by_name,
                COUNT(DISTINCT ci.config_item_id) as item_count
         FROM config_sets cs
         LEFT JOIN config_items ci ON cs.config_set_id = ci.config_set_id
         LEFT JOIN users u ON cs.created_by = u.user_id
         WHERE (cs.scope_type = 'Application' AND cs.scope_ref_id = $1)
            OR (cs.scope_type = 'ComponentInstance' AND cs.scope_ref_id IN (
                SELECT component_instance_id FROM component_instances comp_ci
                JOIN app_components ac ON comp_ci.component_id = ac.component_id
                WHERE ac.application_id = $1
            ))
         GROUP BY cs.config_set_id, u.display_name
         ORDER BY cs.name`,
        [id]
      );

      res.json({ configs: result.rows });
    } catch (error) {
      console.error('Get related configs error:', error);
      res.status(500).json({ error: 'Failed to fetch related configs' });
    }
  },

  // Get related interfaces for an application (via direct link or component instances)
  getRelatedInterfaces: async (req, res) => {
    try {
      const { id } = req.params;

      // Get interfaces where:
      // 1. source_application_id or target_application_id directly references this app, OR
      // 2. source or target component instance belongs to this app
      const result = await db.query(
        `SELECT DISTINCT i.*, 
                COALESCE(src_app.name, src_a.name) as source_app_name,
                COALESCE(tgt_app.name, tgt_a.name) as target_app_name,
                COUNT(DISTINCT ie.interface_endpoint_id) as endpoint_count
         FROM interfaces i
         LEFT JOIN applications src_app ON i.source_application_id = src_app.application_id
         LEFT JOIN applications tgt_app ON i.target_application_id = tgt_app.application_id
         LEFT JOIN interface_endpoints ie ON i.interface_id = ie.interface_id
         LEFT JOIN component_instances src_ci ON ie.source_component_instance_id = src_ci.component_instance_id
         LEFT JOIN app_components src_ac ON src_ci.component_id = src_ac.component_id
         LEFT JOIN applications src_a ON src_ac.application_id = src_a.application_id
         LEFT JOIN component_instances tgt_ci ON ie.target_component_instance_id = tgt_ci.component_instance_id
         LEFT JOIN app_components tgt_ac ON tgt_ci.component_id = tgt_ac.component_id
         LEFT JOIN applications tgt_a ON tgt_ac.application_id = tgt_a.application_id
         WHERE i.source_application_id = $1 
            OR i.target_application_id = $1
            OR src_ac.application_id = $1 
            OR tgt_ac.application_id = $1
         GROUP BY i.interface_id, src_app.name, tgt_app.name, src_a.name, tgt_a.name
         ORDER BY i.name`,
        [id]
      );

      res.json({ interfaces: result.rows });
    } catch (error) {
      console.error('Get related interfaces error:', error);
      res.status(500).json({ error: 'Failed to fetch related interfaces' });
    }
  },

  // Get related test data for an application
  getRelatedTestData: async (req, res) => {
    try {
      const { id } = req.params;

      const result = await db.query(
        `SELECT tds.*, ei.name as env_instance_name
         FROM test_data_sets tds
         LEFT JOIN environment_instances ei ON tds.env_instance_id = ei.env_instance_id
         WHERE tds.application_id = $1
         ORDER BY tds.name`,
        [id]
      );

      res.json({ testDataSets: result.rows });
    } catch (error) {
      console.error('Get related test data error:', error);
      res.status(500).json({ error: 'Failed to fetch related test data' });
    }
  }
};

module.exports = applicationController;
