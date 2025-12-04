const db = require('../config/database');
const { parse } = require('csv-parse/sync');

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Validate and sanitize string
const sanitizeString = (str, maxLen = 255) => {
  if (!str) return null;
  return String(str).trim().substring(0, maxLen);
};

// Parse CSV content
const parseCSV = (content, options = {}) => {
  try {
    return parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      ...options
    });
  } catch (error) {
    throw new Error(`CSV parsing error: ${error.message}`);
  }
};

const bulkUploadController = {
  // Get CSV templates
  getTemplate: async (req, res) => {
    try {
      const { type } = req.params;
      
      const templates = {
        environments: 'name,description,environment_category,lifecycle_stage,owner_team,support_group,data_sensitivity,usage_policies\nDEV-Environment-1,Development environment for Team A,NonProd,Active,DevOps Team,Support Team,NonProdDummy,Development use only',
        
        instances: 'environment_name,name,operational_status,availability_window,capacity,primary_location,bookable\nDEV-Environment-1,Instance-1,Available,24x7,10,DataCenter-1,true',
        
        applications: 'name,business_domain,description,criticality,data_sensitivity,owner_team,test_owner\nApp-1,Finance,Financial application,High,PCI,Finance Team,QA Team',
        
        interfaces: 'name,direction,pattern,frequency,protocol,source_application_name,target_application_name,description\nInterface-1,Outbound,REST,RealTime,HTTPS,App-1,App-2,API interface between apps',
        
        components: 'application_name,name,component_type,technology_stack,description\nApp-1,Component-1,Service,Node.js,Backend service component',
        
        app_instances: 'application_name,instance_name,deployment_model,version,deployment_status\nApp-1,Instance-1,Microservices,1.0.0,Aligned',
        
        infra_components: 'instance_name,name,component_type,hostname,ip_address,os_version,status,owner_team\nInstance-1,Server-1,VM,server1.local,192.168.1.10,Ubuntu 22.04,Active,Infrastructure Team',
        
        interface_endpoints: 'interface_name,instance_name,endpoint,test_mode,enabled,source_component_name,target_component_name\nInterface-1,Instance-1,https://api.example.com/v1,Live,true,Component-1,Component-2',
        
        component_instances: 'application_name,component_name,instance_name,version,deployment_status\nApp-1,Component-1,Instance-1,1.0.0,Deployed'
      };

      if (!templates[type]) {
        return res.status(400).json({ 
          error: 'Invalid template type',
          available: Object.keys(templates)
        });
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${type}_template.csv`);
      res.send(templates[type]);
    } catch (error) {
      console.error('Get template error:', error);
      res.status(500).json({ error: 'Failed to get template' });
    }
  },

  // Bulk upload environments
  uploadEnvironments: async (req, res) => {
    const client = await db.getClient();
    try {
      const { csvContent } = req.body;
      
      if (!csvContent) {
        return res.status(400).json({ error: 'CSV content is required' });
      }

      const records = parseCSV(csvContent);
      
      if (records.length === 0) {
        return res.status(400).json({ error: 'No valid records found in CSV' });
      }

      const results = { success: [], errors: [] };
      
      await client.query('BEGIN');

      for (let i = 0; i < records.length; i++) {
        const row = records[i];
        const rowNum = i + 2; // Account for header row
        
        try {
          const name = sanitizeString(row.name);
          if (!name) {
            results.errors.push({ row: rowNum, error: 'Name is required' });
            continue;
          }

          // Validate category
          const validCategories = ['NonProd', 'PreProd', 'DR', 'Training', 'Sandpit'];
          const category = row.environment_category;
          if (category && !validCategories.includes(category)) {
            results.errors.push({ row: rowNum, error: `Invalid category: ${row.environment_category}. Must be one of: ${validCategories.join(', ')}` });
            continue;
          }

          // Validate lifecycle stage
          const validStages = ['Active', 'Provisioning', 'Decommissioning', 'Archived'];
          const stage = row.lifecycle_stage || 'Active';
          if (!validStages.includes(stage)) {
            results.errors.push({ row: rowNum, error: `Invalid lifecycle stage: ${row.lifecycle_stage}` });
            continue;
          }

          const result = await client.query(
            `INSERT INTO environments (name, description, environment_category, lifecycle_stage, owner_team, support_group, data_sensitivity, usage_policies)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (name) DO UPDATE SET
               description = EXCLUDED.description,
               environment_category = EXCLUDED.environment_category,
               lifecycle_stage = EXCLUDED.lifecycle_stage,
               owner_team = EXCLUDED.owner_team,
               support_group = EXCLUDED.support_group,
               data_sensitivity = EXCLUDED.data_sensitivity,
               usage_policies = EXCLUDED.usage_policies,
               updated_at = NOW()
             RETURNING environment_id, name`,
            [
              name,
              sanitizeString(row.description, 1000),
              category || 'NonProd',
              stage,
              sanitizeString(row.owner_team, 100),
              sanitizeString(row.support_group, 100),
              sanitizeString(row.data_sensitivity, 20),
              sanitizeString(row.usage_policies, 500)
            ]
          );

          results.success.push({ row: rowNum, id: result.rows[0].environment_id, name: result.rows[0].name });
        } catch (err) {
          results.errors.push({ row: rowNum, error: err.message });
        }
      }

      await client.query('COMMIT');

      // Log activity - use a system UUID for bulk operations
      const systemEntityId = '00000000-0000-0000-0000-000000000000';
      await db.query(
        `INSERT INTO activities (user_id, action, entity_type, entity_id, entity_name, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.user.user_id, 'BULK_UPLOAD', 'Environment', systemEntityId, 'Bulk Upload', 
         JSON.stringify({ success: results.success.length, errors: results.errors.length })]
      );

      res.json({
        message: `Processed ${records.length} records`,
        results
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Bulk upload environments error:', error);
      res.status(500).json({ error: error.message || 'Failed to process bulk upload' });
    } finally {
      client.release();
    }
  },

  // Bulk upload instances
  uploadInstances: async (req, res) => {
    const client = await db.getClient();
    try {
      const { csvContent } = req.body;
      
      if (!csvContent) {
        return res.status(400).json({ error: 'CSV content is required' });
      }

      const records = parseCSV(csvContent);
      
      if (records.length === 0) {
        return res.status(400).json({ error: 'No valid records found in CSV' });
      }

      const results = { success: [], errors: [] };
      
      await client.query('BEGIN');

      for (let i = 0; i < records.length; i++) {
        const row = records[i];
        const rowNum = i + 2;
        
        try {
          const name = sanitizeString(row.name);
          const envName = sanitizeString(row.environment_name);
          
          if (!name || !envName) {
            results.errors.push({ row: rowNum, error: 'Name and environment_name are required' });
            continue;
          }

          // Look up environment by name
          const envResult = await client.query(
            'SELECT environment_id FROM environments WHERE name = $1',
            [envName]
          );

          if (envResult.rows.length === 0) {
            results.errors.push({ row: rowNum, error: `Environment not found: ${envName}` });
            continue;
          }

          const environmentId = envResult.rows[0].environment_id;

          // Validate operational status
          const validStatuses = ['Available', 'InUse', 'Maintenance', 'Offline'];
          const status = row.operational_status || 'Available';
          if (!validStatuses.includes(status)) {
            results.errors.push({ row: rowNum, error: `Invalid operational status: ${row.operational_status}` });
            continue;
          }

          const result = await client.query(
            `INSERT INTO environment_instances (environment_id, name, operational_status, availability_window, capacity, primary_location, bookable)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (environment_id, name) DO UPDATE SET
               operational_status = EXCLUDED.operational_status,
               availability_window = EXCLUDED.availability_window,
               capacity = EXCLUDED.capacity,
               primary_location = EXCLUDED.primary_location,
               bookable = EXCLUDED.bookable,
               updated_at = NOW()
             RETURNING env_instance_id, name`,
            [
              environmentId,
              name,
              status,
              sanitizeString(row.availability_window, 50),
              row.capacity ? parseInt(row.capacity) : null,
              sanitizeString(row.primary_location, 100),
              row.bookable !== 'false' && row.bookable !== '0'
            ]
          );

          results.success.push({ row: rowNum, id: result.rows[0].env_instance_id, name: result.rows[0].name });
        } catch (err) {
          results.errors.push({ row: rowNum, error: err.message });
        }
      }

      await client.query('COMMIT');

      // Log activity - use a system UUID for bulk operations
      const systemEntityId = '00000000-0000-0000-0000-000000000000';
      await db.query(
        `INSERT INTO activities (user_id, action, entity_type, entity_id, entity_name, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.user.user_id, 'BULK_UPLOAD', 'EnvironmentInstance', systemEntityId, 'Bulk Upload', 
         JSON.stringify({ success: results.success.length, errors: results.errors.length })]
      );

      res.json({
        message: `Processed ${records.length} records`,
        results
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Bulk upload instances error:', error);
      res.status(500).json({ error: error.message || 'Failed to process bulk upload' });
    } finally {
      client.release();
    }
  },

  // Bulk upload applications
  uploadApplications: async (req, res) => {
    const client = await db.getClient();
    try {
      const { csvContent } = req.body;
      
      if (!csvContent) {
        return res.status(400).json({ error: 'CSV content is required' });
      }

      const records = parseCSV(csvContent);
      
      if (records.length === 0) {
        return res.status(400).json({ error: 'No valid records found in CSV' });
      }

      const results = { success: [], errors: [] };
      
      await client.query('BEGIN');

      for (let i = 0; i < records.length; i++) {
        const row = records[i];
        const rowNum = i + 2;
        
        try {
          const name = sanitizeString(row.name);
          if (!name) {
            results.errors.push({ row: rowNum, error: 'Name is required' });
            continue;
          }

          // Validate criticality
          const validCriticality = ['High', 'Medium', 'Low'];
          const criticality = row.criticality || 'Medium';
          if (!validCriticality.includes(criticality)) {
            results.errors.push({ row: rowNum, error: `Invalid criticality: ${row.criticality}` });
            continue;
          }

          // Validate data sensitivity
          const validSensitivity = ['PII', 'PCI', 'Confidential', 'NonProdDummy'];
          const sensitivity = row.data_sensitivity;
          if (sensitivity && !validSensitivity.includes(sensitivity)) {
            results.errors.push({ row: rowNum, error: `Invalid data_sensitivity: ${row.data_sensitivity}` });
            continue;
          }

          const result = await client.query(
            `INSERT INTO applications (name, business_domain, description, criticality, data_sensitivity, owner_team, test_owner)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (name) DO UPDATE SET
               business_domain = EXCLUDED.business_domain,
               description = EXCLUDED.description,
               criticality = EXCLUDED.criticality,
               data_sensitivity = EXCLUDED.data_sensitivity,
               owner_team = EXCLUDED.owner_team,
               test_owner = EXCLUDED.test_owner,
               updated_at = NOW()
             RETURNING application_id, name`,
            [
              name,
              sanitizeString(row.business_domain, 100),
              sanitizeString(row.description, 1000),
              criticality,
              sensitivity,
              sanitizeString(row.owner_team, 100),
              sanitizeString(row.test_owner, 100)
            ]
          );

          results.success.push({ row: rowNum, id: result.rows[0].application_id, name: result.rows[0].name });
        } catch (err) {
          results.errors.push({ row: rowNum, error: err.message });
        }
      }

      await client.query('COMMIT');

      // Log activity - use a system UUID for bulk operations
      const systemEntityId = '00000000-0000-0000-0000-000000000000';
      await db.query(
        `INSERT INTO activities (user_id, action, entity_type, entity_id, entity_name, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.user.user_id, 'BULK_UPLOAD', 'Application', systemEntityId, 'Bulk Upload', 
         JSON.stringify({ success: results.success.length, errors: results.errors.length })]
      );

      res.json({
        message: `Processed ${records.length} records`,
        results
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Bulk upload applications error:', error);
      res.status(500).json({ error: error.message || 'Failed to process bulk upload' });
    } finally {
      client.release();
    }
  },

  // Bulk upload interfaces
  uploadInterfaces: async (req, res) => {
    const client = await db.getClient();
    try {
      const { csvContent } = req.body;
      
      if (!csvContent) {
        return res.status(400).json({ error: 'CSV content is required' });
      }

      const records = parseCSV(csvContent);
      
      if (records.length === 0) {
        return res.status(400).json({ error: 'No valid records found in CSV' });
      }

      const results = { success: [], errors: [] };
      
      await client.query('BEGIN');

      for (let i = 0; i < records.length; i++) {
        const row = records[i];
        const rowNum = i + 2;
        
        try {
          const name = sanitizeString(row.name);
          if (!name) {
            results.errors.push({ row: rowNum, error: 'Name is required' });
            continue;
          }

          // Validate direction
          const validDirections = ['Inbound', 'Outbound', 'Bidirectional'];
          const direction = row.direction || 'Outbound';
          if (!validDirections.includes(direction)) {
            results.errors.push({ row: rowNum, error: `Invalid direction: ${row.direction}` });
            continue;
          }

          // Validate pattern
          const validPatterns = ['REST', 'SOAP', 'GraphQL', 'gRPC', 'Messaging', 'File', 'Database', 'EventStream'];
          const pattern = row.pattern || 'REST';
          if (!validPatterns.includes(pattern)) {
            results.errors.push({ row: rowNum, error: `Invalid pattern: ${row.pattern}` });
            continue;
          }

          // Look up source application by name
          let sourceAppId = null;
          if (row.source_application_name) {
            const srcResult = await client.query(
              'SELECT application_id FROM applications WHERE name = $1',
              [sanitizeString(row.source_application_name)]
            );
            if (srcResult.rows.length > 0) {
              sourceAppId = srcResult.rows[0].application_id;
            }
          }

          // Look up target application by name
          let targetAppId = null;
          if (row.target_application_name) {
            const tgtResult = await client.query(
              'SELECT application_id FROM applications WHERE name = $1',
              [sanitizeString(row.target_application_name)]
            );
            if (tgtResult.rows.length > 0) {
              targetAppId = tgtResult.rows[0].application_id;
            }
          }

          const result = await client.query(
            `INSERT INTO interfaces (name, direction, pattern, frequency, protocol, source_application_id, target_application_id, description)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (name) DO UPDATE SET
               direction = EXCLUDED.direction,
               pattern = EXCLUDED.pattern,
               frequency = EXCLUDED.frequency,
               protocol = EXCLUDED.protocol,
               source_application_id = EXCLUDED.source_application_id,
               target_application_id = EXCLUDED.target_application_id,
               description = EXCLUDED.description,
               updated_at = NOW()
             RETURNING interface_id, name`,
            [
              name,
              direction,
              pattern,
              sanitizeString(row.frequency, 50),
              sanitizeString(row.protocol, 50),
              sourceAppId,
              targetAppId,
              sanitizeString(row.description, 1000)
            ]
          );

          results.success.push({ row: rowNum, id: result.rows[0].interface_id, name: result.rows[0].name });
        } catch (err) {
          results.errors.push({ row: rowNum, error: err.message });
        }
      }

      await client.query('COMMIT');

      // Log activity - use a system UUID for bulk operations
      const systemEntityId = '00000000-0000-0000-0000-000000000000';
      await db.query(
        `INSERT INTO activities (user_id, action, entity_type, entity_id, entity_name, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.user.user_id, 'BULK_UPLOAD', 'Interface', systemEntityId, 'Bulk Upload', 
         JSON.stringify({ success: results.success.length, errors: results.errors.length })]
      );

      res.json({
        message: `Processed ${records.length} records`,
        results
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Bulk upload interfaces error:', error);
      res.status(500).json({ error: error.message || 'Failed to process bulk upload' });
    } finally {
      client.release();
    }
  },

  // Bulk upload app components
  uploadComponents: async (req, res) => {
    const client = await db.getClient();
    try {
      const { csvContent } = req.body;
      
      if (!csvContent) {
        return res.status(400).json({ error: 'CSV content is required' });
      }

      const records = parseCSV(csvContent);
      
      if (records.length === 0) {
        return res.status(400).json({ error: 'No valid records found in CSV' });
      }

      const results = { success: [], errors: [] };
      
      await client.query('BEGIN');

      for (let i = 0; i < records.length; i++) {
        const row = records[i];
        const rowNum = i + 2;
        
        try {
          const name = sanitizeString(row.name);
          const appName = sanitizeString(row.application_name);
          
          if (!name || !appName) {
            results.errors.push({ row: rowNum, error: 'Name and application_name are required' });
            continue;
          }

          // Look up application by name
          const appResult = await client.query(
            'SELECT application_id FROM applications WHERE name = $1',
            [appName]
          );

          if (appResult.rows.length === 0) {
            results.errors.push({ row: rowNum, error: `Application not found: ${appName}` });
            continue;
          }

          const applicationId = appResult.rows[0].application_id;

          const result = await client.query(
            `INSERT INTO app_components (application_id, name, component_type, technology_stack, description)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (application_id, name) DO UPDATE SET
               component_type = EXCLUDED.component_type,
               technology_stack = EXCLUDED.technology_stack,
               description = EXCLUDED.description,
               updated_at = NOW()
             RETURNING component_id, name`,
            [
              applicationId,
              name,
              sanitizeString(row.component_type, 50),
              sanitizeString(row.technology_stack, 100),
              sanitizeString(row.description, 500)
            ]
          );

          results.success.push({ row: rowNum, id: result.rows[0].component_id, name: result.rows[0].name });
        } catch (err) {
          results.errors.push({ row: rowNum, error: err.message });
        }
      }

      await client.query('COMMIT');

      // Log activity - use a system UUID for bulk operations
      const systemEntityId = '00000000-0000-0000-0000-000000000000';
      await db.query(
        `INSERT INTO activities (user_id, action, entity_type, entity_id, entity_name, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.user.user_id, 'BULK_UPLOAD', 'AppComponent', systemEntityId, 'Bulk Upload', 
         JSON.stringify({ success: results.success.length, errors: results.errors.length })]
      );

      res.json({
        message: `Processed ${records.length} records`,
        results
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Bulk upload components error:', error);
      res.status(500).json({ error: error.message || 'Failed to process bulk upload' });
    } finally {
      client.release();
    }
  },

  // Bulk upload application-instance mappings
  uploadAppInstances: async (req, res) => {
    const client = await db.getClient();
    try {
      const { csvContent } = req.body;
      
      if (!csvContent) {
        return res.status(400).json({ error: 'CSV content is required' });
      }

      const records = parseCSV(csvContent);
      
      if (records.length === 0) {
        return res.status(400).json({ error: 'No valid records found in CSV' });
      }

      const results = { success: [], errors: [] };
      
      await client.query('BEGIN');

      for (let i = 0; i < records.length; i++) {
        const row = records[i];
        const rowNum = i + 2;
        
        try {
          const appName = sanitizeString(row.application_name);
          const instanceName = sanitizeString(row.instance_name);
          
          if (!appName || !instanceName) {
            results.errors.push({ row: rowNum, error: 'application_name and instance_name are required' });
            continue;
          }

          // Look up application by name
          const appResult = await client.query(
            'SELECT application_id FROM applications WHERE name = $1',
            [appName]
          );

          if (appResult.rows.length === 0) {
            results.errors.push({ row: rowNum, error: `Application not found: ${appName}` });
            continue;
          }

          // Look up instance by name
          const instanceResult = await client.query(
            'SELECT env_instance_id FROM environment_instances WHERE name = $1',
            [instanceName]
          );

          if (instanceResult.rows.length === 0) {
            results.errors.push({ row: rowNum, error: `Instance not found: ${instanceName}` });
            continue;
          }

          const applicationId = appResult.rows[0].application_id;
          const envInstanceId = instanceResult.rows[0].env_instance_id;

          const result = await client.query(
            `INSERT INTO application_environment_instances (application_id, env_instance_id, deployment_model, version, deployment_status)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (application_id, env_instance_id) DO UPDATE SET
               deployment_model = EXCLUDED.deployment_model,
               version = EXCLUDED.version,
               deployment_status = EXCLUDED.deployment_status,
               updated_at = NOW()
             RETURNING app_env_instance_id`,
            [
              applicationId,
              envInstanceId,
              sanitizeString(row.deployment_model, 50) || 'Microservices',
              sanitizeString(row.version, 50),
              sanitizeString(row.deployment_status, 50) || 'Aligned'
            ]
          );

          results.success.push({ row: rowNum, id: result.rows[0].app_env_instance_id, name: `${appName} -> ${instanceName}` });
        } catch (err) {
          results.errors.push({ row: rowNum, error: err.message });
        }
      }

      await client.query('COMMIT');

      // Log activity - use a system UUID for bulk operations
      const systemEntityId = '00000000-0000-0000-0000-000000000000';
      await db.query(
        `INSERT INTO activities (user_id, action, entity_type, entity_id, entity_name, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.user.user_id, 'BULK_UPLOAD', 'AppEnvInstance', systemEntityId, 'Bulk Upload', 
         JSON.stringify({ success: results.success.length, errors: results.errors.length })]
      );

      res.json({
        message: `Processed ${records.length} records`,
        results
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Bulk upload app instances error:', error);
      res.status(500).json({ error: error.message || 'Failed to process bulk upload' });
    } finally {
      client.release();
    }
  },

  // Bulk upload infra components
  uploadInfraComponents: async (req, res) => {
    const client = await db.getClient();
    try {
      const { csvContent } = req.body;
      
      if (!csvContent) {
        return res.status(400).json({ error: 'CSV content is required' });
      }

      const records = parseCSV(csvContent);
      
      if (records.length === 0) {
        return res.status(400).json({ error: 'No valid records found in CSV' });
      }

      const results = { success: [], errors: [] };
      
      await client.query('BEGIN');

      for (let i = 0; i < records.length; i++) {
        const row = records[i];
        const rowNum = i + 2;
        
        try {
          const name = sanitizeString(row.name);
          const instanceName = sanitizeString(row.instance_name);
          
          if (!name || !instanceName) {
            results.errors.push({ row: rowNum, error: 'name and instance_name are required' });
            continue;
          }

          // Look up instance by name
          const instanceResult = await client.query(
            'SELECT env_instance_id FROM environment_instances WHERE name = $1',
            [instanceName]
          );

          if (instanceResult.rows.length === 0) {
            results.errors.push({ row: rowNum, error: `Instance not found: ${instanceName}` });
            continue;
          }

          const envInstanceId = instanceResult.rows[0].env_instance_id;

          const result = await client.query(
            `INSERT INTO infra_components (env_instance_id, name, component_type, hostname, ip_address, os_version, status, owner_team)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (env_instance_id, name) DO UPDATE SET
               component_type = EXCLUDED.component_type,
               hostname = EXCLUDED.hostname,
               ip_address = EXCLUDED.ip_address,
               os_version = EXCLUDED.os_version,
               status = EXCLUDED.status,
               owner_team = EXCLUDED.owner_team,
               updated_at = NOW()
             RETURNING infra_id, name`,
            [
              envInstanceId,
              name,
              sanitizeString(row.component_type, 50),
              sanitizeString(row.hostname, 255),
              sanitizeString(row.ip_address, 45),
              sanitizeString(row.os_version, 100),
              sanitizeString(row.status, 20) || 'Active',
              sanitizeString(row.owner_team, 100)
            ]
          );

          results.success.push({ row: rowNum, id: result.rows[0].infra_id, name: result.rows[0].name });
        } catch (err) {
          results.errors.push({ row: rowNum, error: err.message });
        }
      }

      await client.query('COMMIT');

      // Log activity - use a system UUID for bulk operations
      const systemEntityId = '00000000-0000-0000-0000-000000000000';
      await db.query(
        `INSERT INTO activities (user_id, action, entity_type, entity_id, entity_name, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.user.user_id, 'BULK_UPLOAD', 'InfraComponent', systemEntityId, 'Bulk Upload', 
         JSON.stringify({ success: results.success.length, errors: results.errors.length })]
      );

      res.json({
        message: `Processed ${records.length} records`,
        results
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Bulk upload infra components error:', error);
      res.status(500).json({ error: error.message || 'Failed to process bulk upload' });
    } finally {
      client.release();
    }
  },

  // Bulk upload interface endpoints
  uploadInterfaceEndpoints: async (req, res) => {
    const client = await db.getClient();
    try {
      const { csvContent } = req.body;
      
      if (!csvContent) {
        return res.status(400).json({ error: 'CSV content is required' });
      }

      const records = parseCSV(csvContent);
      
      if (records.length === 0) {
        return res.status(400).json({ error: 'No valid records found in CSV' });
      }

      const results = { success: [], errors: [] };
      
      await client.query('BEGIN');

      for (let i = 0; i < records.length; i++) {
        const row = records[i];
        const rowNum = i + 2;
        
        try {
          const interfaceName = sanitizeString(row.interface_name);
          const instanceName = sanitizeString(row.instance_name);
          
          if (!interfaceName || !instanceName) {
            results.errors.push({ row: rowNum, error: 'interface_name and instance_name are required' });
            continue;
          }

          // Look up interface by name
          const interfaceResult = await client.query(
            'SELECT interface_id FROM interfaces WHERE name = $1',
            [interfaceName]
          );

          if (interfaceResult.rows.length === 0) {
            results.errors.push({ row: rowNum, error: `Interface not found: ${interfaceName}` });
            continue;
          }

          // Look up instance by name
          const instanceResult = await client.query(
            'SELECT env_instance_id FROM environment_instances WHERE name = $1',
            [instanceName]
          );

          if (instanceResult.rows.length === 0) {
            results.errors.push({ row: rowNum, error: `Instance not found: ${instanceName}` });
            continue;
          }

          const interfaceId = interfaceResult.rows[0].interface_id;
          const envInstanceId = instanceResult.rows[0].env_instance_id;

          // Look up source component instance if provided
          let sourceComponentInstanceId = null;
          if (row.source_component_name) {
            const srcResult = await client.query(
              `SELECT ci.component_instance_id 
               FROM component_instances ci
               JOIN app_components ac ON ci.component_id = ac.component_id
               WHERE ac.name = $1 AND ci.env_instance_id = $2`,
              [sanitizeString(row.source_component_name), envInstanceId]
            );
            if (srcResult.rows.length > 0) {
              sourceComponentInstanceId = srcResult.rows[0].component_instance_id;
            }
          }

          // Look up target component instance if provided
          let targetComponentInstanceId = null;
          if (row.target_component_name) {
            const tgtResult = await client.query(
              `SELECT ci.component_instance_id 
               FROM component_instances ci
               JOIN app_components ac ON ci.component_id = ac.component_id
               WHERE ac.name = $1 AND ci.env_instance_id = $2`,
              [sanitizeString(row.target_component_name), envInstanceId]
            );
            if (tgtResult.rows.length > 0) {
              targetComponentInstanceId = tgtResult.rows[0].component_instance_id;
            }
          }

          // Validate test_mode
          const validTestModes = ['Live', 'Virtualised', 'Stubbed', 'Disabled'];
          const testMode = row.test_mode || 'Live';
          if (!validTestModes.includes(testMode)) {
            results.errors.push({ row: rowNum, error: `Invalid test_mode: ${row.test_mode}. Must be one of: ${validTestModes.join(', ')}` });
            continue;
          }

          const result = await client.query(
            `INSERT INTO interface_endpoints (interface_id, env_instance_id, endpoint, test_mode, enabled, source_component_instance_id, target_component_instance_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING interface_endpoint_id`,
            [
              interfaceId,
              envInstanceId,
              sanitizeString(row.endpoint, 500),
              testMode,
              row.enabled !== 'false' && row.enabled !== '0',
              sourceComponentInstanceId,
              targetComponentInstanceId
            ]
          );

          results.success.push({ row: rowNum, id: result.rows[0].interface_endpoint_id, name: `${interfaceName} -> ${instanceName}` });
        } catch (err) {
          results.errors.push({ row: rowNum, error: err.message });
        }
      }

      await client.query('COMMIT');

      // Log activity
      const systemEntityId = '00000000-0000-0000-0000-000000000000';
      await db.query(
        `INSERT INTO activities (user_id, action, entity_type, entity_id, entity_name, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.user.user_id, 'BULK_UPLOAD', 'InterfaceEndpoint', systemEntityId, 'Bulk Upload', 
         JSON.stringify({ success: results.success.length, errors: results.errors.length })]
      );

      res.json({
        message: `Processed ${records.length} records`,
        results
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Bulk upload interface endpoints error:', error);
      res.status(500).json({ error: error.message || 'Failed to process bulk upload' });
    } finally {
      client.release();
    }
  },

  // Bulk upload component instances
  uploadComponentInstances: async (req, res) => {
    const client = await db.getClient();
    try {
      const { csvContent } = req.body;
      
      if (!csvContent) {
        return res.status(400).json({ error: 'CSV content is required' });
      }

      const records = parseCSV(csvContent);
      
      if (records.length === 0) {
        return res.status(400).json({ error: 'No valid records found in CSV' });
      }

      const results = { success: [], errors: [] };
      
      await client.query('BEGIN');

      for (let i = 0; i < records.length; i++) {
        const row = records[i];
        const rowNum = i + 2;
        
        try {
          const appName = sanitizeString(row.application_name);
          const componentName = sanitizeString(row.component_name);
          const instanceName = sanitizeString(row.instance_name);
          
          if (!appName || !componentName || !instanceName) {
            results.errors.push({ row: rowNum, error: 'application_name, component_name, and instance_name are required' });
            continue;
          }

          // Look up component by name and application
          const componentResult = await client.query(
            `SELECT ac.component_id 
             FROM app_components ac
             JOIN applications a ON ac.application_id = a.application_id
             WHERE ac.name = $1 AND a.name = $2`,
            [componentName, appName]
          );

          if (componentResult.rows.length === 0) {
            results.errors.push({ row: rowNum, error: `Component not found: ${componentName} in application ${appName}` });
            continue;
          }

          // Look up instance by name
          const instanceResult = await client.query(
            'SELECT env_instance_id FROM environment_instances WHERE name = $1',
            [instanceName]
          );

          if (instanceResult.rows.length === 0) {
            results.errors.push({ row: rowNum, error: `Instance not found: ${instanceName}` });
            continue;
          }

          const componentId = componentResult.rows[0].component_id;
          const envInstanceId = instanceResult.rows[0].env_instance_id;

          // Validate deployment_status
          const validStatuses = ['Deployed', 'PartiallyDeployed', 'RollbackPending', 'Failed'];
          const deploymentStatus = row.deployment_status || 'Deployed';
          if (!validStatuses.includes(deploymentStatus)) {
            results.errors.push({ row: rowNum, error: `Invalid deployment_status: ${row.deployment_status}. Must be one of: ${validStatuses.join(', ')}` });
            continue;
          }

          const result = await client.query(
            `INSERT INTO component_instances (component_id, env_instance_id, version, deployment_status, last_deployed_date)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (component_id, env_instance_id) DO UPDATE SET
               version = EXCLUDED.version,
               deployment_status = EXCLUDED.deployment_status,
               last_deployed_date = NOW(),
               updated_at = NOW()
             RETURNING component_instance_id`,
            [
              componentId,
              envInstanceId,
              sanitizeString(row.version, 50),
              deploymentStatus
            ]
          );

          results.success.push({ row: rowNum, id: result.rows[0].component_instance_id, name: `${componentName} -> ${instanceName}` });
        } catch (err) {
          results.errors.push({ row: rowNum, error: err.message });
        }
      }

      await client.query('COMMIT');

      // Log activity
      const systemEntityId = '00000000-0000-0000-0000-000000000000';
      await db.query(
        `INSERT INTO activities (user_id, action, entity_type, entity_id, entity_name, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.user.user_id, 'BULK_UPLOAD', 'ComponentInstance', systemEntityId, 'Bulk Upload', 
         JSON.stringify({ success: results.success.length, errors: results.errors.length })]
      );

      res.json({
        message: `Processed ${records.length} records`,
        results
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Bulk upload component instances error:', error);
      res.status(500).json({ error: error.message || 'Failed to process bulk upload' });
    } finally {
      client.release();
    }
  }
};

module.exports = bulkUploadController;
