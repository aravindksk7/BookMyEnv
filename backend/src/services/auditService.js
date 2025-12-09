/**
 * Audit Service - Comprehensive audit logging for CRUD traceability
 * Version: 4.2
 * 
 * Provides:
 * - logCreate, logUpdate, logDelete for entity operations
 * - logAction for custom actions (login, approve, etc.)
 * - Search and filter capabilities
 * - Report generation support
 */

const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// Entity type constants
const ENTITY_TYPES = {
  ENVIRONMENT: 'Environment',
  ENVIRONMENT_INSTANCE: 'EnvironmentInstance',
  APPLICATION: 'Application',
  INTERFACE: 'Interface',
  COMPONENT: 'Component',
  BOOKING: 'Booking',
  REFRESH_INTENT: 'RefreshIntent',
  REFRESH_EXECUTION: 'RefreshExecution',
  USER: 'User',
  USER_GROUP: 'UserGroup',
  ROLE: 'Role',
  PERMISSION: 'Permission',
  CONFIGURATION: 'Configuration',
  INTEGRATION: 'Integration',
  RELEASE: 'Release',
  CHANGE: 'Change',
  TEST_DATA: 'TestData',
  REPORT: 'Report'
};

// Action type constants
const ACTION_TYPES = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  READ: 'READ',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  PERMISSION_CHANGE: 'PERMISSION_CHANGE',
  ROLE_CHANGE: 'ROLE_CHANGE',
  STATUS_CHANGE: 'STATUS_CHANGE',
  REFRESH_EXECUTE: 'REFRESH_EXECUTE',
  REFRESH_APPROVE: 'REFRESH_APPROVE',
  REFRESH_REJECT: 'REFRESH_REJECT',
  BOOKING_APPROVE: 'BOOKING_APPROVE',
  BOOKING_REJECT: 'BOOKING_REJECT',
  BOOKING_CANCEL: 'BOOKING_CANCEL',
  CONFLICT_RESOLVE: 'CONFLICT_RESOLVE',
  FORCE_APPROVE: 'FORCE_APPROVE',
  EXPORT: 'EXPORT',
  IMPORT: 'IMPORT',
  CONFIG_CHANGE: 'CONFIG_CHANGE',
  INTEGRATION_SYNC: 'INTEGRATION_SYNC',
  REPORT_GENERATE: 'REPORT_GENERATE'
};

// Source channel constants
const SOURCE_CHANNELS = {
  WEB_UI: 'WEB_UI',
  API: 'API',
  BATCH_JOB: 'BATCH_JOB',
  INTEGRATION_SYSTEM: 'INTEGRATION_SYSTEM',
  SCHEDULER: 'SCHEDULER',
  CLI: 'CLI'
};

// Regulatory tag constants
const REGULATORY_TAGS = {
  SOX_CHANGE: 'SOX_CHANGE',
  AU_APRA_CPS_230: 'AU_APRA_CPS_230',
  GDPR: 'GDPR',
  PCI_DSS: 'PCI_DSS',
  HIPAA: 'HIPAA',
  ISO_27001: 'ISO_27001',
  SOC2: 'SOC2',
  CUSTOM: 'CUSTOM'
};

/**
 * Extract context from Express request
 */
function extractContext(req) {
  return {
    actorUserId: req.user?.user_id || null,
    actorUserName: req.user?.display_name || req.user?.username || 'System',
    actorRole: req.user?.role || 'System',
    sourceChannel: req.headers['x-source-channel'] || SOURCE_CHANNELS.WEB_UI,
    ipAddress: req.ip || req.connection?.remoteAddress || null,
    userAgent: req.headers['user-agent'] || null,
    clientApp: req.headers['x-client-app'] || 'BME-UI',
    apiKeyId: req.headers['x-api-key-id'] || null,
    correlationId: req.headers['x-correlation-id'] || uuidv4(),
    sessionId: req.sessionID || null
  };
}

/**
 * Calculate changed fields between two objects
 */
function getChangedFields(beforeState, afterState) {
  if (!beforeState || !afterState) return [];
  
  const changedFields = [];
  const allKeys = new Set([...Object.keys(beforeState), ...Object.keys(afterState)]);
  
  for (const key of allKeys) {
    // Skip internal fields
    if (['updated_at', 'created_at', 'password_hash'].includes(key)) continue;
    
    const before = JSON.stringify(beforeState[key]);
    const after = JSON.stringify(afterState[key]);
    
    if (before !== after) {
      changedFields.push(key);
    }
  }
  
  return changedFields;
}

/**
 * Sanitize sensitive fields from snapshots
 */
function sanitizeSnapshot(snapshot) {
  if (!snapshot) return null;
  
  const sensitiveFields = [
    'password_hash', 'password', 'api_key', 'secret', 
    'client_secret', 'token', 'credentials'
  ];
  
  const sanitized = { ...snapshot };
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

/**
 * Core audit logging function
 */
async function logAuditEvent({
  entityType,
  entityId,
  entityDisplayName,
  actionType,
  beforeSnapshot = null,
  afterSnapshot = null,
  changedFields = null,
  regulatoryTag = null,
  comment = null,
  metadata = {},
  context = {}
}) {
  try {
    const auditId = uuidv4();
    
    // Calculate changed fields if not provided
    const fields = changedFields || getChangedFields(beforeSnapshot, afterSnapshot);
    
    // Sanitize snapshots
    const sanitizedBefore = sanitizeSnapshot(beforeSnapshot);
    const sanitizedAfter = sanitizeSnapshot(afterSnapshot);
    
    const query = `
      INSERT INTO audit_events (
        audit_id, timestamp_utc,
        actor_user_id, actor_username, actor_display_name, actor_role,
        actor_ip_address, actor_user_agent,
        entity_type, entity_id, entity_name,
        action_type, action_description,
        source_system,
        before_snapshot, after_snapshot, changed_fields,
        regulatory_tag, request_id, session_id,
        additional_context
      ) VALUES (
        $1, NOW(),
        $2, $3, $4, $5,
        $6, $7,
        $8, $9, $10,
        $11, $12,
        $13,
        $14, $15, $16,
        $17, $18, $19,
        $20
      )
      RETURNING audit_id, timestamp_utc
    `;
    
    const values = [
      auditId,
      context.actorUserId,
      context.actorUserName || 'System',
      context.actorUserName || 'System',
      context.actorRole || 'System',
      context.ipAddress,
      context.userAgent,
      entityType,
      entityId,
      entityDisplayName,
      actionType,
      comment,
      context.sourceChannel || SOURCE_CHANNELS.WEB_UI,
      sanitizedBefore ? JSON.stringify(sanitizedBefore) : null,
      sanitizedAfter ? JSON.stringify(sanitizedAfter) : null,
      fields.length > 0 ? JSON.stringify(fields) : null,
      regulatoryTag,
      context.correlationId,
      context.sessionId,
      Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    // Log to console but don't throw - audit should not break main operations
    console.error('Audit logging failed:', error.message);
    return null;
  }
}

/**
 * Log a CREATE action
 */
async function logCreate(entityType, entityId, entityDisplayName, afterState, req, options = {}) {
  const context = req ? extractContext(req) : options.context || {};
  
  return logAuditEvent({
    entityType,
    entityId,
    entityDisplayName,
    actionType: ACTION_TYPES.CREATE,
    afterSnapshot: afterState,
    regulatoryTag: options.regulatoryTag,
    comment: options.comment,
    metadata: options.metadata,
    context
  });
}

/**
 * Log an UPDATE action
 */
async function logUpdate(entityType, entityId, entityDisplayName, beforeState, afterState, req, options = {}) {
  const context = req ? extractContext(req) : options.context || {};
  
  return logAuditEvent({
    entityType,
    entityId,
    entityDisplayName,
    actionType: ACTION_TYPES.UPDATE,
    beforeSnapshot: beforeState,
    afterSnapshot: afterState,
    regulatoryTag: options.regulatoryTag,
    comment: options.comment,
    metadata: options.metadata,
    context
  });
}

/**
 * Log a DELETE action
 */
async function logDelete(entityType, entityId, entityDisplayName, beforeState, req, options = {}) {
  const context = req ? extractContext(req) : options.context || {};
  
  return logAuditEvent({
    entityType,
    entityId,
    entityDisplayName,
    actionType: ACTION_TYPES.DELETE,
    beforeSnapshot: beforeState,
    regulatoryTag: options.regulatoryTag,
    comment: options.comment,
    metadata: options.metadata,
    context
  });
}

/**
 * Log a custom action (login, approve, etc.)
 */
async function logAction(actionType, entityType, entityId, entityDisplayName, req, options = {}) {
  const context = req ? extractContext(req) : options.context || {};
  
  return logAuditEvent({
    entityType,
    entityId,
    entityDisplayName,
    actionType,
    beforeSnapshot: options.beforeState,
    afterSnapshot: options.afterState,
    regulatoryTag: options.regulatoryTag,
    comment: options.comment,
    metadata: options.metadata,
    context
  });
}

/**
 * Search audit events with filters
 */
async function searchAuditEvents({
  searchText,
  entityTypes,
  actionTypes,
  actorUserId,
  actorRole,
  sourceChannel,
  regulatoryTag,
  dateFrom,
  dateTo,
  entityId,
  page = 1,
  limit = 50,
  sortBy = 'timestamp_utc',
  sortOrder = 'DESC'
}) {
  try {
    let whereConditions = [];
    let values = [];
    let paramIndex = 1;
    
    // Full-text search
    if (searchText) {
      whereConditions.push(`
        (entity_name ILIKE $${paramIndex} OR 
         actor_username ILIKE $${paramIndex} OR
         action_description ILIKE $${paramIndex})
      `);
      values.push(`%${searchText}%`);
      paramIndex++;
    }
    
    // Entity types filter
    if (entityTypes && entityTypes.length > 0) {
      whereConditions.push(`entity_type = ANY($${paramIndex})`);
      values.push(entityTypes);
      paramIndex++;
    }
    
    // Action types filter
    if (actionTypes && actionTypes.length > 0) {
      whereConditions.push(`action_type = ANY($${paramIndex})`);
      values.push(actionTypes);
      paramIndex++;
    }
    
    // Actor user filter
    if (actorUserId) {
      whereConditions.push(`actor_user_id = $${paramIndex}`);
      values.push(actorUserId);
      paramIndex++;
    }
    
    // Actor role filter
    if (actorRole) {
      whereConditions.push(`actor_role = $${paramIndex}`);
      values.push(actorRole);
      paramIndex++;
    }
    
    // Source system filter
    if (sourceChannel) {
      whereConditions.push(`source_system = $${paramIndex}`);
      values.push(sourceChannel);
      paramIndex++;
    }
    
    // Regulatory tag filter
    if (regulatoryTag) {
      whereConditions.push(`regulatory_tag = $${paramIndex}`);
      values.push(regulatoryTag);
      paramIndex++;
    }
    
    // Date range filter
    if (dateFrom) {
      whereConditions.push(`timestamp_utc >= $${paramIndex}`);
      values.push(dateFrom);
      paramIndex++;
    }
    
    if (dateTo) {
      whereConditions.push(`timestamp_utc <= $${paramIndex}`);
      values.push(dateTo);
      paramIndex++;
    }
    
    // Entity ID filter
    if (entityId) {
      whereConditions.push(`entity_id = $${paramIndex}`);
      values.push(entityId);
      paramIndex++;
    }
    
    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';
    
    // Validate sort column
    const validSortColumns = [
      'timestamp_utc', 'entity_type', 'action_type', 
      'actor_username', 'entity_name'
    ];
    const safeSortBy = validSortColumns.includes(sortBy) ? sortBy : 'timestamp_utc';
    const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';
    
    // Count query
    const countQuery = `SELECT COUNT(*) FROM audit_events ${whereClause}`;
    const countResult = await pool.query(countQuery, values);
    const totalCount = parseInt(countResult.rows[0].count);
    
    // Calculate offset
    const offset = (page - 1) * limit;
    
    // Main query
    const query = `
      SELECT 
        audit_id, timestamp_utc,
        actor_user_id, actor_username, actor_display_name, actor_role,
        entity_type, entity_id, entity_name,
        action_type, action_description,
        source_system, actor_ip_address,
        regulatory_tag, request_id,
        changed_fields, before_snapshot, after_snapshot
      FROM audit_events
      ${whereClause}
      ORDER BY ${safeSortBy} ${safeSortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    values.push(limit, offset);
    
    const result = await pool.query(query, values);
    
    return {
      events: result.rows,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    };
  } catch (error) {
    console.error('Audit search failed:', error.message);
    throw error;
  }
}

/**
 * Get single audit event with full details
 */
async function getAuditEventById(auditId) {
  try {
    const query = `
      SELECT 
        ae.*,
        u.display_name as actor_display_name,
        u.email as actor_email
      FROM audit_events ae
      LEFT JOIN users u ON ae.actor_user_id = u.user_id
      WHERE ae.audit_id = $1
    `;
    
    const result = await pool.query(query, [auditId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Get audit event failed:', error.message);
    throw error;
  }
}

/**
 * Get audit statistics for dashboard
 */
async function getAuditStats(dateFrom, dateTo) {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_events,
        COUNT(*) FILTER (WHERE timestamp_utc >= NOW() - INTERVAL '24 hours') as events_today,
        COUNT(*) FILTER (WHERE timestamp_utc >= NOW() - INTERVAL '7 days') as events_last_7_days,
        COUNT(*) FILTER (WHERE timestamp_utc >= NOW() - INTERVAL '30 days') as events_last_30_days,
        0 as failed_events,
        0 as unauthorized_events
      FROM audit_events
      WHERE ($1::timestamptz IS NULL OR timestamp_utc >= $1)
        AND ($2::timestamptz IS NULL OR timestamp_utc <= $2)
    `;
    
    const statsResult = await pool.query(query, [dateFrom, dateTo]);
    
    // Top entity types
    const entityTypesQuery = `
      SELECT entity_type, COUNT(*) as count
      FROM audit_events
      WHERE ($1::timestamptz IS NULL OR timestamp_utc >= $1)
        AND ($2::timestamptz IS NULL OR timestamp_utc <= $2)
      GROUP BY entity_type
      ORDER BY count DESC
      LIMIT 5
    `;
    const entityTypesResult = await pool.query(entityTypesQuery, [dateFrom, dateTo]);
    
    // Top actors
    const actorsQuery = `
      SELECT actor_username as actor_user_name, COUNT(*) as count
      FROM audit_events
      WHERE actor_username IS NOT NULL
        AND ($1::timestamptz IS NULL OR timestamp_utc >= $1)
        AND ($2::timestamptz IS NULL OR timestamp_utc <= $2)
      GROUP BY actor_username
      ORDER BY count DESC
      LIMIT 5
    `;
    const actorsResult = await pool.query(actorsQuery, [dateFrom, dateTo]);
    
    // Action type distribution
    const actionsQuery = `
      SELECT action_type, COUNT(*) as count
      FROM audit_events
      WHERE ($1::timestamptz IS NULL OR timestamp_utc >= $1)
        AND ($2::timestamptz IS NULL OR timestamp_utc <= $2)
      GROUP BY action_type
      ORDER BY count DESC
    `;
    const actionsResult = await pool.query(actionsQuery, [dateFrom, dateTo]);
    
    return {
      summary: statsResult.rows[0],
      topEntityTypes: entityTypesResult.rows,
      topActors: actorsResult.rows,
      actionDistribution: actionsResult.rows
    };
  } catch (error) {
    console.error('Get audit stats failed:', error.message);
    throw error;
  }
}

/**
 * Get report templates
 */
async function getReportTemplates() {
  try {
    const query = `
      SELECT 
        template_id, name, description, report_type,
        filters, columns, grouping,
        is_system_template,
        created_at, updated_at
      FROM audit_report_templates
      ORDER BY is_system_template DESC, name ASC
    `;
    
    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    console.error('Get report templates failed:', error.message);
    throw error;
  }
}

/**
 * Generate audit report
 */
async function generateReport(templateId, filters, userId) {
  try {
    // Get template
    const templateQuery = `SELECT * FROM audit_report_templates WHERE template_id = $1`;
    const templateResult = await pool.query(templateQuery, [templateId]);
    
    if (templateResult.rows.length === 0) {
      throw new Error('Report template not found');
    }
    
    const template = templateResult.rows[0];
    
    // Merge template filters with provided filters
    const templateFilters = template.filters || {};
    const mergedFilters = {
      entityTypes: filters.entityTypes || templateFilters.entity_type ? [templateFilters.entity_type] : null,
      actionTypes: filters.actionTypes || templateFilters.action_type,
      regulatoryTag: filters.regulatoryTag || templateFilters.regulatory_tag,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      limit: 10000 // Max records for report
    };
    
    // Create execution record in audit_generated_reports
    const reportId = uuidv4();
    const insertQuery = `
      INSERT INTO audit_generated_reports (
        report_id, template_id, report_name, generated_by,
        date_range_start, date_range_end, filters_applied, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PROCESSING')
      RETURNING *
    `;
    
    await pool.query(insertQuery, [
      reportId,
      templateId,
      `${template.name} - ${new Date().toISOString().split('T')[0]}`,
      userId,
      filters.dateFrom,
      filters.dateTo,
      JSON.stringify(mergedFilters)
    ]);
    
    // Execute search
    const searchResult = await searchAuditEvents(mergedFilters);
    
    // Update execution record
    const updateQuery = `
      UPDATE audit_generated_reports
      SET status = 'COMPLETED',
          total_records = $1
      WHERE report_id = $2
    `;
    
    await pool.query(updateQuery, [searchResult.pagination.totalCount, reportId]);
    
    // Log the report generation
    await logAction(
      ACTION_TYPES.REPORT_GENERATE,
      ENTITY_TYPES.REPORT,
      reportId,
      template.name,
      null,
      {
        context: {
          actorUserId: userId,
          sourceChannel: SOURCE_CHANNELS.WEB_UI
        },
        metadata: { templateId, filters: mergedFilters }
      }
    );
    
    return {
      reportId,
      templateName: template.name,
      recordsCount: searchResult.pagination.totalCount,
      events: searchResult.events
    };
  } catch (error) {
    console.error('Generate report failed:', error.message);
    throw error;
  }
}

/**
 * Get saved filters for a user
 */
async function getSavedFilters(userId) {
  try {
    const query = `
      SELECT * FROM audit_saved_filters
      WHERE user_id = $1 OR is_shared = true
      ORDER BY last_used_at DESC NULLS LAST
    `;
    
    const result = await pool.query(query, [userId]);
    return result.rows;
  } catch (error) {
    console.error('Get saved filters failed:', error.message);
    throw error;
  }
}

/**
 * Save a filter
 */
async function saveFilter(userId, name, description, filters, isShared = false) {
  try {
    const filterId = uuidv4();
    const query = `
      INSERT INTO audit_saved_filters (
        filter_id, name, description, user_id, is_shared, filters
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      filterId, name, description, userId, isShared, JSON.stringify(filters)
    ]);
    
    return result.rows[0];
  } catch (error) {
    console.error('Save filter failed:', error.message);
    throw error;
  }
}

module.exports = {
  // Constants
  ENTITY_TYPES,
  ACTION_TYPES,
  SOURCE_CHANNELS,
  REGULATORY_TAGS,
  
  // Logging functions
  logCreate,
  logUpdate,
  logDelete,
  logAction,
  logAuditEvent,
  
  // Helper functions
  extractContext,
  getChangedFields,
  
  // Query functions
  searchAuditEvents,
  getAuditEventById,
  getAuditStats,
  
  // Report functions
  getReportTemplates,
  generateReport,
  
  // Filter functions
  getSavedFilters,
  saveFilter
};
