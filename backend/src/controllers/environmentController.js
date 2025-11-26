const db = require('../config/database');

const environmentController = {
  // Get all environments
  getAll: async (req, res) => {
    try {
      const { category, lifecycle_stage, search } = req.query;
      
      let query = `
        SELECT e.*, 
               COUNT(DISTINCT ei.env_instance_id) as instance_count
        FROM environments e
        LEFT JOIN environment_instances ei ON e.environment_id = ei.environment_id
        WHERE 1=1
      `;
      const params = [];

      if (category) {
        params.push(category);
        query += ` AND e.environment_category = $${params.length}`;
      }

      if (lifecycle_stage) {
        params.push(lifecycle_stage);
        query += ` AND e.lifecycle_stage = $${params.length}`;
      }

      if (search) {
        params.push(`%${search}%`);
        query += ` AND (e.name ILIKE $${params.length} OR e.description ILIKE $${params.length})`;
      }

      query += ' GROUP BY e.environment_id ORDER BY e.name ASC';

      const result = await db.query(query, params);
      res.json({ environments: result.rows });
    } catch (error) {
      console.error('Get environments error:', error);
      res.status(500).json({ error: 'Failed to fetch environments' });
    }
  },

  // Get environment by ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;

      const result = await db.query(
        'SELECT * FROM environments WHERE environment_id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Environment not found' });
      }

      // Get instances
      const instances = await db.query(
        `SELECT ei.*, 
                COUNT(DISTINCT ic.infra_id) as infra_count,
                COUNT(DISTINCT ci.component_instance_id) as component_count
         FROM environment_instances ei
         LEFT JOIN infra_components ic ON ei.env_instance_id = ic.env_instance_id
         LEFT JOIN component_instances ci ON ei.env_instance_id = ci.env_instance_id
         WHERE ei.environment_id = $1
         GROUP BY ei.env_instance_id
         ORDER BY ei.name`,
        [id]
      );

      res.json({ ...result.rows[0], instances: instances.rows });
    } catch (error) {
      console.error('Get environment error:', error);
      res.status(500).json({ error: 'Failed to fetch environment' });
    }
  },

  // Create environment
  create: async (req, res) => {
    try {
      const { name, description, environment_category, lifecycle_stage, owner_team, support_group, data_sensitivity, usage_policies } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Environment name is required' });
      }

      const result = await db.query(
        `INSERT INTO environments (name, description, environment_category, lifecycle_stage, owner_team, support_group, data_sensitivity, usage_policies)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [name, description, environment_category, lifecycle_stage || 'Active', owner_team, support_group, data_sensitivity, usage_policies]
      );

      // Log activity
      await db.query(
        `INSERT INTO activities (user_id, action, entity_type, entity_id, entity_name)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.user_id, 'CREATE', 'Environment', result.rows[0].environment_id, name]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Create environment error:', error);
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Environment name already exists' });
      }
      res.status(500).json({ error: 'Failed to create environment' });
    }
  },

  // Update environment
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, environment_category, lifecycle_stage, owner_team, support_group, data_sensitivity, usage_policies } = req.body;

      const result = await db.query(
        `UPDATE environments 
         SET name = COALESCE($1, name),
             description = COALESCE($2, description),
             environment_category = COALESCE($3, environment_category),
             lifecycle_stage = COALESCE($4, lifecycle_stage),
             owner_team = COALESCE($5, owner_team),
             support_group = COALESCE($6, support_group),
             data_sensitivity = COALESCE($7, data_sensitivity),
             usage_policies = COALESCE($8, usage_policies),
             updated_at = NOW()
         WHERE environment_id = $9
         RETURNING *`,
        [name, description, environment_category, lifecycle_stage, owner_team, support_group, data_sensitivity, usage_policies, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Environment not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Update environment error:', error);
      res.status(500).json({ error: 'Failed to update environment' });
    }
  },

  // Delete environment
  delete: async (req, res) => {
    try {
      const { id } = req.params;

      const result = await db.query(
        'DELETE FROM environments WHERE environment_id = $1 RETURNING name',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Environment not found' });
      }

      res.json({ message: 'Environment deleted successfully' });
    } catch (error) {
      console.error('Delete environment error:', error);
      res.status(500).json({ error: 'Failed to delete environment' });
    }
  },

  // Get instances for an environment
  getInstances: async (req, res) => {
    try {
      const { id } = req.params;

      const result = await db.query(
        `SELECT ei.*, 
                COUNT(DISTINCT ic.infra_id) as infra_count,
                COUNT(DISTINCT ci.component_instance_id) as component_count
         FROM environment_instances ei
         LEFT JOIN infra_components ic ON ei.env_instance_id = ic.env_instance_id
         LEFT JOIN component_instances ci ON ei.env_instance_id = ci.env_instance_id
         WHERE ei.environment_id = $1
         GROUP BY ei.env_instance_id
         ORDER BY ei.name`,
        [id]
      );

      res.json({ instances: result.rows });
    } catch (error) {
      console.error('Get instances error:', error);
      res.status(500).json({ error: 'Failed to fetch instances' });
    }
  },

  // Create instance
  createInstance: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, operational_status, availability_window, capacity, primary_location, bookable } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Instance name is required' });
      }

      const result = await db.query(
        `INSERT INTO environment_instances (environment_id, name, operational_status, availability_window, capacity, primary_location, bookable)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [id, name, operational_status || 'Available', availability_window, capacity, primary_location, bookable !== false]
      );

      // Log activity
      await db.query(
        `INSERT INTO activities (user_id, action, entity_type, entity_id, entity_name)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.user_id, 'CREATE', 'EnvironmentInstance', result.rows[0].env_instance_id, name]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Create instance error:', error);
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Instance name already exists in this environment' });
      }
      res.status(500).json({ error: 'Failed to create instance' });
    }
  },

  // Get instance by ID
  getInstance: async (req, res) => {
    try {
      const { instanceId } = req.params;

      const result = await db.query(
        `SELECT ei.*, e.name as environment_name, e.environment_category
         FROM environment_instances ei
         JOIN environments e ON ei.environment_id = e.environment_id
         WHERE ei.env_instance_id = $1`,
        [instanceId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Instance not found' });
      }

      // Get infra components
      const infra = await db.query(
        `SELECT * FROM infra_components WHERE env_instance_id = $1 ORDER BY name`,
        [instanceId]
      );

      // Get deployed applications
      const apps = await db.query(
        `SELECT aei.*, a.name as application_name, a.criticality
         FROM application_environment_instances aei
         JOIN applications a ON aei.application_id = a.application_id
         WHERE aei.env_instance_id = $1`,
        [instanceId]
      );

      // Get active bookings
      const bookings = await db.query(
        `SELECT eb.*, u.display_name as requested_by_name
         FROM environment_bookings eb
         JOIN booking_resources br ON eb.booking_id = br.booking_id
         JOIN users u ON eb.requested_by_user_id = u.user_id
         WHERE br.resource_type = 'EnvironmentInstance' 
           AND br.resource_ref_id = $1
           AND eb.booking_status IN ('Approved', 'Active')
           AND eb.end_datetime > NOW()
         ORDER BY eb.start_datetime`,
        [instanceId]
      );

      res.json({
        ...result.rows[0],
        infra_components: infra.rows,
        applications: apps.rows,
        active_bookings: bookings.rows
      });
    } catch (error) {
      console.error('Get instance error:', error);
      res.status(500).json({ error: 'Failed to fetch instance' });
    }
  },

  // Update instance
  updateInstance: async (req, res) => {
    try {
      const { instanceId } = req.params;
      const { name, operational_status, booking_status, availability_window, capacity, primary_location, bookable } = req.body;

      const result = await db.query(
        `UPDATE environment_instances 
         SET name = COALESCE($1, name),
             operational_status = COALESCE($2, operational_status),
             booking_status = COALESCE($3, booking_status),
             availability_window = COALESCE($4, availability_window),
             capacity = COALESCE($5, capacity),
             primary_location = COALESCE($6, primary_location),
             bookable = COALESCE($7, bookable),
             updated_at = NOW()
         WHERE env_instance_id = $8
         RETURNING *`,
        [name, operational_status, booking_status, availability_window, capacity, primary_location, bookable, instanceId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Instance not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Update instance error:', error);
      res.status(500).json({ error: 'Failed to update instance' });
    }
  },

  // Delete instance
  deleteInstance: async (req, res) => {
    try {
      const { instanceId } = req.params;

      const result = await db.query(
        'DELETE FROM environment_instances WHERE env_instance_id = $1 RETURNING name',
        [instanceId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Instance not found' });
      }

      res.json({ message: 'Instance deleted successfully' });
    } catch (error) {
      console.error('Delete instance error:', error);
      res.status(500).json({ error: 'Failed to delete instance' });
    }
  },

  // Get instance availability
  getInstanceAvailability: async (req, res) => {
    try {
      const { instanceId } = req.params;
      const { start_date, end_date } = req.query;

      const startDate = start_date || new Date().toISOString();
      const endDate = end_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      // Get bookings for this instance in the date range
      const bookings = await db.query(
        `SELECT eb.booking_id, eb.title, eb.start_datetime, eb.end_datetime, 
                eb.booking_status, eb.test_phase, u.display_name as requested_by
         FROM environment_bookings eb
         JOIN booking_resources br ON eb.booking_id = br.booking_id
         JOIN users u ON eb.requested_by_user_id = u.user_id
         WHERE br.resource_type = 'EnvironmentInstance' 
           AND br.resource_ref_id = $1
           AND eb.booking_status NOT IN ('Cancelled', 'Completed')
           AND eb.start_datetime < $3
           AND eb.end_datetime > $2
         ORDER BY eb.start_datetime`,
        [instanceId, startDate, endDate]
      );

      res.json({ bookings: bookings.rows });
    } catch (error) {
      console.error('Get availability error:', error);
      res.status(500).json({ error: 'Failed to fetch availability' });
    }
  },

  // Get all instances (flat list)
  getAllInstances: async (req, res) => {
    try {
      const { operational_status, booking_status, bookable } = req.query;

      let query = `
        SELECT ei.*, e.name as environment_name, e.environment_category,
               COUNT(DISTINCT ic.infra_id) as infra_count
        FROM environment_instances ei
        JOIN environments e ON ei.environment_id = e.environment_id
        LEFT JOIN infra_components ic ON ei.env_instance_id = ic.env_instance_id
        WHERE 1=1
      `;
      const params = [];

      if (operational_status) {
        params.push(operational_status);
        query += ` AND ei.operational_status = $${params.length}`;
      }

      if (booking_status) {
        params.push(booking_status);
        query += ` AND ei.booking_status = $${params.length}`;
      }

      if (bookable !== undefined) {
        params.push(bookable === 'true');
        query += ` AND ei.bookable = $${params.length}`;
      }

      query += ' GROUP BY ei.env_instance_id, e.name, e.environment_category ORDER BY e.name, ei.name';

      const result = await db.query(query, params);
      res.json({ instances: result.rows });
    } catch (error) {
      console.error('Get all instances error:', error);
      res.status(500).json({ error: 'Failed to fetch instances' });
    }
  },

  // Get statistics
  getStatistics: async (req, res) => {
    try {
      const stats = await db.query(`
        SELECT 
          (SELECT COUNT(*) FROM environments) as total_environments,
          (SELECT COUNT(*) FROM environment_instances) as total_instances,
          (SELECT COUNT(*) FROM environment_instances WHERE operational_status = 'Available') as available_instances,
          (SELECT COUNT(*) FROM environment_instances WHERE booking_status = 'FullyBooked') as fully_booked_instances,
          (SELECT COUNT(*) FROM environment_instances WHERE operational_status = 'Maintenance') as maintenance_instances,
          (SELECT COUNT(*) FROM infra_components) as total_infra_components,
          (SELECT COUNT(*) FROM environment_bookings WHERE booking_status = 'Active') as active_bookings
      `);

      res.json(stats.rows[0]);
    } catch (error) {
      console.error('Get statistics error:', error);
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  },

  // Get instance by ID (alias for getInstance)
  getInstanceById: async (req, res) => {
    try {
      const { instanceId } = req.params;

      const result = await db.query(
        `SELECT ei.*, e.name as environment_name, e.environment_category
         FROM environment_instances ei
         JOIN environments e ON ei.environment_id = e.environment_id
         WHERE ei.env_instance_id = $1`,
        [instanceId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Instance not found' });
      }

      // Get infra components
      const infra = await db.query(
        `SELECT * FROM infra_components WHERE env_instance_id = $1 ORDER BY name`,
        [instanceId]
      );

      // Get deployed applications
      const apps = await db.query(
        `SELECT aei.*, a.name as application_name, a.criticality
         FROM application_environment_instances aei
         JOIN applications a ON aei.application_id = a.application_id
         WHERE aei.env_instance_id = $1`,
        [instanceId]
      );

      res.json({
        ...result.rows[0],
        infra_components: infra.rows,
        applications: apps.rows
      });
    } catch (error) {
      console.error('Get instance by ID error:', error);
      res.status(500).json({ error: 'Failed to fetch instance' });
    }
  },

  // Update instance status
  updateInstanceStatus: async (req, res) => {
    try {
      const { instanceId } = req.params;
      const { operational_status, booking_status, status_reason } = req.body;

      const result = await db.query(
        `UPDATE environment_instances 
         SET operational_status = COALESCE($1, operational_status),
             booking_status = COALESCE($2, booking_status),
             updated_at = NOW()
         WHERE env_instance_id = $3
         RETURNING *`,
        [operational_status, booking_status, instanceId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Instance not found' });
      }

      // Log activity
      await db.query(
        `INSERT INTO activities (user_id, action, entity_type, entity_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.user_id, 'UPDATE_STATUS', 'EnvironmentInstance', instanceId, JSON.stringify({ operational_status, booking_status, status_reason })]
      );

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Update instance status error:', error);
      res.status(500).json({ error: 'Failed to update instance status' });
    }
  },

  // Get infra components for an instance
  getInfraComponents: async (req, res) => {
    try {
      const { instanceId } = req.params;

      const result = await db.query(
        `SELECT * FROM infra_components WHERE env_instance_id = $1 ORDER BY name`,
        [instanceId]
      );

      res.json({ infra_components: result.rows });
    } catch (error) {
      console.error('Get infra components error:', error);
      res.status(500).json({ error: 'Failed to fetch infra components' });
    }
  },

  // Create infra component
  createInfraComponent: async (req, res) => {
    try {
      const { instanceId } = req.params;
      const { name, component_type, hostname, ip_address, specifications, os_version, status, owner_team } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Infra component name is required' });
      }

      const result = await db.query(
        `INSERT INTO infra_components (env_instance_id, name, component_type, hostname, ip_address, specifications, os_version, status, owner_team)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [instanceId, name, component_type, hostname, ip_address, specifications, os_version, status || 'Active', owner_team]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Create infra component error:', error);
      res.status(500).json({ error: 'Failed to create infra component' });
    }
  },

  // Update infra component
  updateInfraComponent: async (req, res) => {
    try {
      const { infraId } = req.params;
      const { name, component_type, hostname, ip_address, specifications, os_version, status, owner_team } = req.body;

      const result = await db.query(
        `UPDATE infra_components 
         SET name = COALESCE($1, name),
             component_type = COALESCE($2, component_type),
             hostname = COALESCE($3, hostname),
             ip_address = COALESCE($4, ip_address),
             specifications = COALESCE($5, specifications),
             os_version = COALESCE($6, os_version),
             status = COALESCE($7, status),
             owner_team = COALESCE($8, owner_team),
             updated_at = NOW()
         WHERE infra_id = $9
         RETURNING *`,
        [name, component_type, hostname, ip_address, specifications, os_version, status, owner_team, infraId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Infra component not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Update infra component error:', error);
      res.status(500).json({ error: 'Failed to update infra component' });
    }
  },

  // Delete infra component
  deleteInfraComponent: async (req, res) => {
    try {
      const { infraId } = req.params;

      const result = await db.query(
        'DELETE FROM infra_components WHERE infra_id = $1 RETURNING name',
        [infraId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Infra component not found' });
      }

      res.json({ message: 'Infra component deleted successfully' });
    } catch (error) {
      console.error('Delete infra component error:', error);
      res.status(500).json({ error: 'Failed to delete infra component' });
    }
  },

  // Get instance booking status
  getInstanceBookingStatus: async (req, res) => {
    try {
      const { instanceId } = req.params;

      // Get instance info
      const instance = await db.query(
        'SELECT env_instance_id, name, operational_status, booking_status FROM environment_instances WHERE env_instance_id = $1',
        [instanceId]
      );

      if (instance.rows.length === 0) {
        return res.status(404).json({ error: 'Instance not found' });
      }

      // Get current and upcoming bookings
      const bookings = await db.query(
        `SELECT eb.booking_id, eb.title, eb.start_datetime, eb.end_datetime, 
                eb.booking_status, eb.test_phase, u.display_name as requested_by
         FROM environment_bookings eb
         JOIN booking_resources br ON eb.booking_id = br.booking_id
         JOIN users u ON eb.requested_by_user_id = u.user_id
         WHERE br.resource_type = 'EnvironmentInstance' 
           AND br.resource_ref_id = $1
           AND eb.booking_status IN ('Approved', 'Active', 'Pending')
           AND eb.end_datetime > NOW()
         ORDER BY eb.start_datetime
         LIMIT 10`,
        [instanceId]
      );

      // Check if currently booked
      const currentBooking = bookings.rows.find(b => 
        new Date(b.start_datetime) <= new Date() && 
        new Date(b.end_datetime) > new Date() &&
        b.booking_status === 'Active'
      );

      res.json({
        instance: instance.rows[0],
        is_currently_booked: !!currentBooking,
        current_booking: currentBooking || null,
        upcoming_bookings: bookings.rows
      });
    } catch (error) {
      console.error('Get instance booking status error:', error);
      res.status(500).json({ error: 'Failed to fetch booking status' });
    }
  },

  // Get all applications linked to an environment's instances
  getAppEnvInstances: async (req, res) => {
    try {
      const { id } = req.params;

      const result = await db.query(
        `SELECT aei.*, a.name as application_name, a.business_domain, ei.name as instance_name
         FROM application_environment_instances aei
         JOIN applications a ON aei.application_id = a.application_id
         JOIN environment_instances ei ON aei.env_instance_id = ei.env_instance_id
         WHERE ei.environment_id = $1
         ORDER BY a.name`,
        [id]
      );

      res.json({ appEnvInstances: result.rows });
    } catch (error) {
      console.error('Get app env instances error:', error);
      res.status(500).json({ error: 'Failed to fetch application environment instances' });
    }
  },

  // Link an application to an environment instance
  linkApplicationToInstance: async (req, res) => {
    try {
      const { instanceId } = req.params;
      const { application_id, deployment_model, version, deployment_status } = req.body;

      if (!application_id) {
        return res.status(400).json({ error: 'Application ID is required' });
      }

      // Verify instance exists
      const instance = await db.query(
        'SELECT env_instance_id FROM environment_instances WHERE env_instance_id = $1',
        [instanceId]
      );

      if (instance.rows.length === 0) {
        return res.status(404).json({ error: 'Instance not found' });
      }

      const result = await db.query(
        `INSERT INTO application_environment_instances 
         (application_id, env_instance_id, deployment_model, version, deployment_status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [application_id, instanceId, deployment_model || 'Microservices', version, deployment_status || 'Aligned']
      );

      // Get application name for response
      const app = await db.query('SELECT name FROM applications WHERE application_id = $1', [application_id]);

      res.status(201).json({ 
        ...result.rows[0], 
        application_name: app.rows[0]?.name 
      });
    } catch (error) {
      console.error('Link application to instance error:', error);
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Application is already linked to this instance' });
      }
      res.status(500).json({ error: 'Failed to link application' });
    }
  },

  // Update an application-environment instance link
  updateAppEnvInstance: async (req, res) => {
    try {
      const { appEnvInstanceId } = req.params;
      const { deployment_model, version, deployment_status } = req.body;

      const result = await db.query(
        `UPDATE application_environment_instances 
         SET deployment_model = COALESCE($1, deployment_model),
             version = COALESCE($2, version),
             deployment_status = COALESCE($3, deployment_status),
             updated_at = CURRENT_TIMESTAMP
         WHERE app_env_instance_id = $4
         RETURNING *`,
        [deployment_model, version, deployment_status, appEnvInstanceId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Application-environment link not found' });
      }

      // Get application name for response
      const app = await db.query(
        'SELECT name FROM applications WHERE application_id = $1', 
        [result.rows[0].application_id]
      );

      res.json({ 
        ...result.rows[0], 
        application_name: app.rows[0]?.name 
      });
    } catch (error) {
      console.error('Update app-env instance error:', error);
      res.status(500).json({ error: 'Failed to update application link' });
    }
  },

  // Delete an application-environment instance link
  deleteAppEnvInstance: async (req, res) => {
    try {
      const { appEnvInstanceId } = req.params;

      const result = await db.query(
        'DELETE FROM application_environment_instances WHERE app_env_instance_id = $1 RETURNING *',
        [appEnvInstanceId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Application-environment link not found' });
      }

      res.json({ message: 'Application unlinked successfully' });
    } catch (error) {
      console.error('Delete app-env instance error:', error);
      res.status(500).json({ error: 'Failed to unlink application' });
    }
  }
};

module.exports = environmentController;
