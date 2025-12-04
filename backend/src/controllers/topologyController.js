const db = require('../config/database');

const topologyController = {
  // Get full topology view - environments with their instances, applications, and interfaces
  getTopology: async (req, res) => {
    try {
      // Get all environments with instance counts
      const environments = await db.query(`
        SELECT e.*, 
               COUNT(DISTINCT ei.env_instance_id)::integer as instance_count
        FROM environments e
        LEFT JOIN environment_instances ei ON e.environment_id = ei.environment_id
        GROUP BY e.environment_id
        ORDER BY e.name
      `);

      // Get all instances with their environment info and app counts
      const instances = await db.query(`
        SELECT ei.*, 
               e.name as environment_name,
               e.environment_category,
               COUNT(DISTINCT aei.application_id)::integer as application_count,
               COUNT(DISTINCT ic.infra_id)::integer as infra_count
        FROM environment_instances ei
        JOIN environments e ON ei.environment_id = e.environment_id
        LEFT JOIN application_environment_instances aei ON ei.env_instance_id = aei.env_instance_id
        LEFT JOIN infra_components ic ON ei.env_instance_id = ic.env_instance_id
        GROUP BY ei.env_instance_id, e.name, e.environment_category
        ORDER BY e.name, ei.name
      `);

      // Get all applications with their instance and interface counts
      const applications = await db.query(`
        SELECT a.*,
               COUNT(DISTINCT aei.env_instance_id)::integer as instance_count,
               COUNT(DISTINCT CASE WHEN i.source_application_id = a.application_id OR i.target_application_id = a.application_id THEN i.interface_id END)::integer as interface_count
        FROM applications a
        LEFT JOIN application_environment_instances aei ON a.application_id = aei.application_id
        LEFT JOIN interfaces i ON i.source_application_id = a.application_id OR i.target_application_id = a.application_id
        GROUP BY a.application_id
        ORDER BY a.name
      `);

      // Get all interfaces with application names
      const interfaces = await db.query(`
        SELECT i.*,
               sa.name as source_application_name,
               ta.name as target_application_name,
               COUNT(DISTINCT ie.interface_endpoint_id)::integer as endpoint_count
        FROM interfaces i
        LEFT JOIN applications sa ON i.source_application_id = sa.application_id
        LEFT JOIN applications ta ON i.target_application_id = ta.application_id
        LEFT JOIN interface_endpoints ie ON i.interface_id = ie.interface_id
        GROUP BY i.interface_id, sa.name, ta.name
        ORDER BY i.name
      `);

      // Get application-instance mappings
      const appInstanceMappings = await db.query(`
        SELECT aei.*, 
               a.name as application_name,
               ei.name as instance_name,
               e.name as environment_name
        FROM application_environment_instances aei
        JOIN applications a ON aei.application_id = a.application_id
        JOIN environment_instances ei ON aei.env_instance_id = ei.env_instance_id
        JOIN environments e ON ei.environment_id = e.environment_id
        ORDER BY e.name, ei.name, a.name
      `);

      // Get interface endpoints (interface-instance mappings)
      const interfaceEndpoints = await db.query(`
        SELECT ie.*,
               i.name as interface_name,
               ei.name as instance_name,
               e.name as environment_name,
               ie.endpoint as endpoint_url,
               ie.test_mode as status
        FROM interface_endpoints ie
        JOIN interfaces i ON ie.interface_id = i.interface_id
        JOIN environment_instances ei ON ie.env_instance_id = ei.env_instance_id
        JOIN environments e ON ei.environment_id = e.environment_id
        ORDER BY i.name, e.name
      `);

      res.json({
        environments: environments.rows,
        instances: instances.rows,
        applications: applications.rows,
        interfaces: interfaces.rows,
        appInstanceMappings: appInstanceMappings.rows,
        interfaceEndpoints: interfaceEndpoints.rows,
        summary: {
          totalEnvironments: environments.rows.length,
          totalInstances: instances.rows.length,
          totalApplications: applications.rows.length,
          totalInterfaces: interfaces.rows.length
        }
      });
    } catch (error) {
      console.error('Get topology error:', error);
      res.status(500).json({ error: 'Failed to fetch topology' });
    }
  },

  // Get topology for a specific environment
  getEnvironmentTopology: async (req, res) => {
    try {
      const { id } = req.params;

      // Get environment
      const environment = await db.query(
        'SELECT * FROM environments WHERE environment_id = $1',
        [id]
      );

      if (environment.rows.length === 0) {
        return res.status(404).json({ error: 'Environment not found' });
      }

      // Get instances
      const instances = await db.query(`
        SELECT ei.*,
               COUNT(DISTINCT aei.application_id)::integer as application_count,
               COUNT(DISTINCT ic.infra_id)::integer as infra_count
        FROM environment_instances ei
        LEFT JOIN application_environment_instances aei ON ei.env_instance_id = aei.env_instance_id
        LEFT JOIN infra_components ic ON ei.env_instance_id = ic.env_instance_id
        WHERE ei.environment_id = $1
        GROUP BY ei.env_instance_id
        ORDER BY ei.name
      `, [id]);

      // Get applications deployed to this environment's instances
      const applications = await db.query(`
        SELECT DISTINCT a.*, aei.version, aei.deployment_status
        FROM applications a
        JOIN application_environment_instances aei ON a.application_id = aei.application_id
        JOIN environment_instances ei ON aei.env_instance_id = ei.env_instance_id
        WHERE ei.environment_id = $1
        ORDER BY a.name
      `, [id]);

      // Get interfaces with endpoints on this environment
      const interfaces = await db.query(`
        SELECT DISTINCT i.*,
               sa.name as source_application_name,
               ta.name as target_application_name
        FROM interfaces i
        LEFT JOIN applications sa ON i.source_application_id = sa.application_id
        LEFT JOIN applications ta ON i.target_application_id = ta.application_id
        JOIN interface_endpoints ie ON i.interface_id = ie.interface_id
        JOIN environment_instances ei ON ie.env_instance_id = ei.env_instance_id
        WHERE ei.environment_id = $1
        ORDER BY i.name
      `, [id]);

      res.json({
        environment: environment.rows[0],
        instances: instances.rows,
        applications: applications.rows,
        interfaces: interfaces.rows
      });
    } catch (error) {
      console.error('Get environment topology error:', error);
      res.status(500).json({ error: 'Failed to fetch environment topology' });
    }
  },

  // Get topology for a specific application
  getApplicationTopology: async (req, res) => {
    try {
      const { id } = req.params;

      // Get application
      const application = await db.query(`
        SELECT a.*
        FROM applications a
        WHERE a.application_id = $1
      `, [id]);

      if (application.rows.length === 0) {
        return res.status(404).json({ error: 'Application not found' });
      }

      // Get environments/instances where this app is deployed
      const deployments = await db.query(`
        SELECT aei.*, ei.name as instance_name, e.name as environment_name, e.environment_category
        FROM application_environment_instances aei
        JOIN environment_instances ei ON aei.env_instance_id = ei.env_instance_id
        JOIN environments e ON ei.environment_id = e.environment_id
        WHERE aei.application_id = $1
        ORDER BY e.name, ei.name
      `, [id]);

      // Get interfaces where this app is source or target
      const interfaces = await db.query(`
        SELECT i.*,
               sa.name as source_application_name,
               ta.name as target_application_name,
               CASE WHEN i.source_application_id = $1 THEN 'source' ELSE 'target' END as role
        FROM interfaces i
        LEFT JOIN applications sa ON i.source_application_id = sa.application_id
        LEFT JOIN applications ta ON i.target_application_id = ta.application_id
        WHERE i.source_application_id = $1 OR i.target_application_id = $1
        ORDER BY i.name
      `, [id]);

      // Get connected applications (via interfaces)
      const connectedApps = await db.query(`
        SELECT DISTINCT a.*, 
               CASE WHEN i.source_application_id = $1 THEN 'downstream' ELSE 'upstream' END as relationship
        FROM applications a
        JOIN interfaces i ON (i.source_application_id = a.application_id OR i.target_application_id = a.application_id)
        WHERE (i.source_application_id = $1 OR i.target_application_id = $1)
          AND a.application_id != $1
        ORDER BY a.name
      `, [id]);

      res.json({
        application: application.rows[0],
        deployments: deployments.rows,
        interfaces: interfaces.rows,
        connectedApplications: connectedApps.rows
      });
    } catch (error) {
      console.error('Get application topology error:', error);
      res.status(500).json({ error: 'Failed to fetch application topology' });
    }
  }
};

module.exports = topologyController;
