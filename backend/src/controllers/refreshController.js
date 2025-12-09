const db = require('../config/database');

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Validate UUID format
const isValidUUID = (id) => {
  return id && UUID_REGEX.test(id);
};

// Valid entity types for refresh operations
const VALID_ENTITY_TYPES = [
  'Environment', 'EnvironmentInstance', 'Application', 
  'AppComponent', 'Interface', 'InfraComponent', 'TestDataSet'
];

// Valid refresh types
const VALID_REFRESH_TYPES = [
  'FULL_COPY', 'PARTIAL_COPY', 'DATA_ONLY', 'CONFIG_ONLY',
  'MASKED_COPY', 'SCHEMA_SYNC', 'GOLDEN_COPY', 'POINT_IN_TIME', 'OTHER'
];

// Valid intent statuses
const VALID_INTENT_STATUSES = [
  'DRAFT', 'REQUESTED', 'APPROVED', 'SCHEDULED', 
  'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED', 'ROLLED_BACK'
];

const refreshController = {
  // =====================================================
  // REFRESH HISTORY ENDPOINTS
  // =====================================================

  // Get refresh history for an entity
  getHistory: async (req, res) => {
    try {
      const { entityType, entityId } = req.params;
      const { limit = 20, offset = 0 } = req.query;

      // Validate entity type
      if (!VALID_ENTITY_TYPES.includes(entityType)) {
        return res.status(400).json({ error: 'Invalid entity type' });
      }

      // Validate entity ID
      if (!isValidUUID(entityId)) {
        return res.status(400).json({ error: 'Invalid entity ID format' });
      }

      const result = await db.query(
        `SELECT rh.*, 
                u1.username as requested_by_username,
                u1.email as requested_by_email,
                u2.username as executed_by_username,
                u2.email as executed_by_email,
                r.name as release_name
         FROM refresh_history rh
         LEFT JOIN users u1 ON rh.requested_by_user_id = u1.user_id
         LEFT JOIN users u2 ON rh.executed_by_user_id = u2.user_id
         LEFT JOIN releases r ON rh.release_id = r.release_id
         WHERE rh.entity_type = $1 AND rh.entity_id = $2
         ORDER BY rh.refresh_date DESC
         LIMIT $3 OFFSET $4`,
        [entityType, entityId, parseInt(limit), parseInt(offset)]
      );

      // Get total count for pagination
      const countResult = await db.query(
        `SELECT COUNT(*) as total 
         FROM refresh_history 
         WHERE entity_type = $1 AND entity_id = $2`,
        [entityType, entityId]
      );

      res.json({
        history: result.rows,
        pagination: {
          total: parseInt(countResult.rows[0].total),
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      });
    } catch (error) {
      console.error('Get refresh history error:', error);
      res.status(500).json({ error: 'Failed to fetch refresh history' });
    }
  },

  // Get all refresh history (with filters)
  getAllHistory: async (req, res) => {
    try {
      const { 
        entityType, 
        refreshType, 
        startDate, 
        endDate, 
        executionStatus,
        limit = 50, 
        offset = 0 
      } = req.query;

      let query = `
        SELECT rh.*, 
               u1.username as requested_by_username,
               u2.username as executed_by_username,
               r.name as release_name
        FROM refresh_history rh
        LEFT JOIN users u1 ON rh.requested_by_user_id = u1.user_id
        LEFT JOIN users u2 ON rh.executed_by_user_id = u2.user_id
        LEFT JOIN releases r ON rh.release_id = r.release_id
        WHERE 1=1
      `;
      const params = [];

      if (entityType && VALID_ENTITY_TYPES.includes(entityType)) {
        params.push(entityType);
        query += ` AND rh.entity_type = $${params.length}`;
      }

      if (refreshType && VALID_REFRESH_TYPES.includes(refreshType)) {
        params.push(refreshType);
        query += ` AND rh.refresh_type = $${params.length}`;
      }

      if (startDate) {
        params.push(startDate);
        query += ` AND rh.refresh_date >= $${params.length}`;
      }

      if (endDate) {
        params.push(endDate);
        query += ` AND rh.refresh_date <= $${params.length}`;
      }

      if (executionStatus) {
        const validStatuses = ['SUCCESS', 'PARTIAL_SUCCESS', 'FAILED', 'ROLLED_BACK'];
        if (validStatuses.includes(executionStatus)) {
          params.push(executionStatus);
          query += ` AND rh.execution_status = $${params.length}`;
        }
      }

      query += ` ORDER BY rh.refresh_date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(parseInt(limit), parseInt(offset));

      const result = await db.query(query, params);

      res.json({
        history: result.rows,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      });
    } catch (error) {
      console.error('Get all refresh history error:', error);
      res.status(500).json({ error: 'Failed to fetch refresh history' });
    }
  },

  // Create refresh history record
  createHistory: async (req, res) => {
    try {
      const {
        entityType,
        entityId,
        entityName,
        refreshDate,
        refreshType,
        sourceEnvironmentId,
        sourceEnvironmentName,
        sourceSnapshotName,
        sourceSnapshotDate,
        changeTicketRef,
        releaseId,
        jiraRef,
        servicenowRef,
        executionStatus,
        durationMinutes,
        dataVolumeGb,
        rowsAffected,
        notes,
        errorMessage,
        executionLogUrl,
        refreshIntentId
      } = req.body;

      // Validation
      if (!entityType || !VALID_ENTITY_TYPES.includes(entityType)) {
        return res.status(400).json({ error: 'Invalid or missing entity type' });
      }
      if (!isValidUUID(entityId)) {
        return res.status(400).json({ error: 'Invalid entity ID format' });
      }
      if (!refreshType || !VALID_REFRESH_TYPES.includes(refreshType)) {
        return res.status(400).json({ error: 'Invalid or missing refresh type' });
      }
      if (!refreshDate) {
        return res.status(400).json({ error: 'Refresh date is required' });
      }

      const result = await db.query(
        `INSERT INTO refresh_history (
           entity_type, entity_id, entity_name, refresh_date, refresh_type,
           source_environment_id, source_environment_name, source_snapshot_name, source_snapshot_date,
           requested_by_user_id, executed_by_user_id, executed_at,
           change_ticket_ref, release_id, jira_ref, servicenow_ref,
           execution_status, duration_minutes, data_volume_gb, rows_affected,
           notes, error_message, execution_log_url, refresh_intent_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
         RETURNING *`,
        [
          entityType, entityId, entityName, refreshDate, refreshType,
          sourceEnvironmentId, sourceEnvironmentName, sourceSnapshotName, sourceSnapshotDate,
          req.user.user_id, req.user.user_id,
          changeTicketRef, releaseId, jiraRef, servicenowRef,
          executionStatus || 'SUCCESS', durationMinutes, dataVolumeGb, rowsAffected,
          notes, errorMessage, executionLogUrl, refreshIntentId
        ]
      );

      // Update the entity's last refresh info based on entity type
      await refreshController.updateEntityLastRefresh(
        entityType, entityId, refreshDate, refreshType, 
        sourceEnvironmentName || sourceSnapshotName, req.user.user_id
      );

      res.status(201).json({ 
        message: 'Refresh history created successfully',
        history: result.rows[0] 
      });
    } catch (error) {
      console.error('Create refresh history error:', error);
      res.status(500).json({ error: 'Failed to create refresh history' });
    }
  },

  // Helper: Update entity's last refresh columns
  updateEntityLastRefresh: async (entityType, entityId, refreshDate, refreshType, source, userId) => {
    const tableMap = {
      'Environment': { table: 'environments', idColumn: 'environment_id' },
      'EnvironmentInstance': { table: 'environment_instances', idColumn: 'env_instance_id' },
      'Application': { table: 'applications', idColumn: 'application_id' },
      'Interface': { table: 'interfaces', idColumn: 'interface_id' },
      'AppComponent': { table: 'app_components', idColumn: 'component_id' },
      'InfraComponent': { table: 'infra_components', idColumn: 'infra_id' },
      'TestDataSet': { table: 'test_data_sets', idColumn: 'test_data_id' }
    };

    const mapping = tableMap[entityType];
    if (!mapping) return;

    try {
      await db.query(
        `UPDATE ${mapping.table} 
         SET last_refresh_date = $1, last_refresh_type = $2, 
             last_refresh_source = $3, last_refresh_by = $4
         WHERE ${mapping.idColumn} = $5`,
        [refreshDate, refreshType, source, userId, entityId]
      );
    } catch (error) {
      console.error(`Failed to update last refresh for ${entityType}:`, error);
    }
  },

  // =====================================================
  // REFRESH INTENTS ENDPOINTS
  // =====================================================

  // Get all refresh intents (with filters)
  getIntents: async (req, res) => {
    try {
      const { 
        status, 
        entityType, 
        startDate, 
        endDate, 
        requestedBy,
        pendingApproval,
        limit = 50, 
        offset = 0 
      } = req.query;

      let query = `
        SELECT ri.*, 
               u1.username as requested_by_username,
               u1.email as requested_by_email,
               u2.username as approved_by_username,
               r.name as release_name,
               (SELECT COUNT(*) FROM refresh_booking_conflicts rbc 
                WHERE rbc.refresh_intent_id = ri.refresh_intent_id 
                AND rbc.resolution_status = 'UNRESOLVED') as unresolved_conflicts
        FROM refresh_intents ri
        LEFT JOIN users u1 ON ri.requested_by_user_id = u1.user_id
        LEFT JOIN users u2 ON ri.approved_by_user_id = u2.user_id
        LEFT JOIN releases r ON ri.release_id = r.release_id
        WHERE 1=1
      `;
      const params = [];

      if (status && VALID_INTENT_STATUSES.includes(status)) {
        params.push(status);
        query += ` AND ri.intent_status = $${params.length}`;
      }

      if (entityType && VALID_ENTITY_TYPES.includes(entityType)) {
        params.push(entityType);
        query += ` AND ri.entity_type = $${params.length}`;
      }

      if (startDate) {
        params.push(startDate);
        query += ` AND ri.planned_date >= $${params.length}`;
      }

      if (endDate) {
        params.push(endDate);
        query += ` AND ri.planned_date <= $${params.length}`;
      }

      if (requestedBy && isValidUUID(requestedBy)) {
        params.push(requestedBy);
        query += ` AND ri.requested_by_user_id = $${params.length}`;
      }

      if (pendingApproval === 'true') {
        query += ` AND ri.intent_status = 'REQUESTED'`;
      }

      query += ` ORDER BY ri.planned_date ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(parseInt(limit), parseInt(offset));

      const result = await db.query(query, params);

      res.json({
        intents: result.rows,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      });
    } catch (error) {
      console.error('Get refresh intents error:', error);
      res.status(500).json({ error: 'Failed to fetch refresh intents' });
    }
  },

  // Get intents for specific entity
  getEntityIntents: async (req, res) => {
    try {
      const { entityType, entityId } = req.params;
      const { includeCompleted = 'false' } = req.query;

      if (!VALID_ENTITY_TYPES.includes(entityType)) {
        return res.status(400).json({ error: 'Invalid entity type' });
      }
      if (!isValidUUID(entityId)) {
        return res.status(400).json({ error: 'Invalid entity ID format' });
      }

      let query = `
        SELECT ri.*, 
               u1.username as requested_by_username,
               u2.username as approved_by_username
        FROM refresh_intents ri
        LEFT JOIN users u1 ON ri.requested_by_user_id = u1.user_id
        LEFT JOIN users u2 ON ri.approved_by_user_id = u2.user_id
        WHERE ri.entity_type = $1 AND ri.entity_id = $2
      `;
      
      if (includeCompleted !== 'true') {
        query += ` AND ri.intent_status NOT IN ('COMPLETED', 'FAILED', 'CANCELLED', 'ROLLED_BACK')`;
      }
      
      query += ` ORDER BY ri.planned_date ASC`;

      const result = await db.query(query, [entityType, entityId]);

      res.json({ intents: result.rows });
    } catch (error) {
      console.error('Get entity intents error:', error);
      res.status(500).json({ error: 'Failed to fetch entity intents' });
    }
  },

  // Get single intent by ID
  getIntentById: async (req, res) => {
    try {
      const { id } = req.params;

      if (!isValidUUID(id)) {
        return res.status(400).json({ error: 'Invalid intent ID format' });
      }

      const result = await db.query(
        `SELECT ri.*, 
                u1.username as requested_by_username,
                u1.email as requested_by_email,
                u2.username as approved_by_username,
                u3.username as rejected_by_username,
                r.name as release_name
         FROM refresh_intents ri
         LEFT JOIN users u1 ON ri.requested_by_user_id = u1.user_id
         LEFT JOIN users u2 ON ri.approved_by_user_id = u2.user_id
         LEFT JOIN users u3 ON ri.rejected_by_user_id = u3.user_id
         LEFT JOIN releases r ON ri.release_id = r.release_id
         WHERE ri.refresh_intent_id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Refresh intent not found' });
      }

      // Get conflicts for this intent
      const conflicts = await db.query(
        `SELECT rbc.*, eb.start_datetime as booking_start, eb.end_datetime as booking_end,
                u.username as booking_owner
         FROM refresh_booking_conflicts rbc
         JOIN environment_bookings eb ON rbc.booking_id = eb.booking_id
         LEFT JOIN users u ON eb.requested_by_user_id = u.user_id
         WHERE rbc.refresh_intent_id = $1`,
        [id]
      );

      res.json({
        intent: result.rows[0],
        conflicts: conflicts.rows
      });
    } catch (error) {
      console.error('Get intent by ID error:', error);
      res.status(500).json({ error: 'Failed to fetch refresh intent' });
    }
  },

  // Create new refresh intent
  createIntent: async (req, res) => {
    try {
      const {
        entityType,
        entityId,
        entityName,
        plannedDate,
        plannedEndDate,
        refreshType,
        sourceEnvironmentId,
        sourceEnvironmentName,
        sourceSnapshotName,
        useLatestSnapshot,
        impactScope,
        requiresDowntime,
        estimatedDowntimeMinutes,
        affectedApplications,
        reason,
        businessJustification,
        requiresApproval = true,
        changeTicketRef,
        releaseId,
        jiraRef,
        servicenowRef,
        notificationGroups,
        notificationLeadDays
      } = req.body;

      // Validation
      if (!entityType || !VALID_ENTITY_TYPES.includes(entityType)) {
        return res.status(400).json({ error: 'Invalid or missing entity type' });
      }
      if (!isValidUUID(entityId)) {
        return res.status(400).json({ error: 'Invalid entity ID format' });
      }
      if (!refreshType || !VALID_REFRESH_TYPES.includes(refreshType)) {
        return res.status(400).json({ error: 'Invalid or missing refresh type' });
      }
      if (!plannedDate) {
        return res.status(400).json({ error: 'Planned date is required' });
      }
      if (!reason) {
        return res.status(400).json({ error: 'Reason is required' });
      }

      // Determine initial status
      const initialStatus = requiresApproval ? 'REQUESTED' : 'SCHEDULED';

      const result = await db.query(
        `INSERT INTO refresh_intents (
           entity_type, entity_id, entity_name, intent_status,
           planned_date, planned_end_date, refresh_type,
           source_environment_id, source_environment_name, source_snapshot_name, use_latest_snapshot,
           impact_scope, requires_downtime, estimated_downtime_minutes, affected_applications,
           requested_by_user_id, reason, business_justification,
           requires_approval, change_ticket_ref, release_id, jira_ref, servicenow_ref,
           notification_groups, notification_lead_days
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
         RETURNING *`,
        [
          entityType, entityId, entityName, initialStatus,
          plannedDate, plannedEndDate, refreshType,
          sourceEnvironmentId, sourceEnvironmentName, sourceSnapshotName, useLatestSnapshot || false,
          impactScope, requiresDowntime || false, estimatedDowntimeMinutes, affectedApplications,
          req.user.user_id, reason, businessJustification,
          requiresApproval, changeTicketRef, releaseId, jiraRef, servicenowRef,
          notificationGroups, notificationLeadDays || [7, 1]
        ]
      );

      const newIntent = result.rows[0];

      // Check for booking conflicts
      await refreshController.checkAndCreateConflicts(newIntent);

      res.status(201).json({ 
        message: 'Refresh intent created successfully',
        intent: newIntent 
      });
    } catch (error) {
      console.error('Create refresh intent error:', error);
      res.status(500).json({ error: 'Failed to create refresh intent' });
    }
  },

  // Update refresh intent
  updateIntent: async (req, res) => {
    try {
      const { id } = req.params;
      const {
        plannedDate,
        plannedEndDate,
        refreshType,
        sourceEnvironmentId,
        sourceEnvironmentName,
        sourceSnapshotName,
        useLatestSnapshot,
        impactScope,
        requiresDowntime,
        estimatedDowntimeMinutes,
        affectedApplications,
        reason,
        businessJustification,
        changeTicketRef,
        releaseId,
        jiraRef,
        servicenowRef,
        notificationGroups,
        notificationLeadDays
      } = req.body;

      if (!isValidUUID(id)) {
        return res.status(400).json({ error: 'Invalid intent ID format' });
      }

      // Check if intent exists and is editable
      const existing = await db.query(
        'SELECT * FROM refresh_intents WHERE refresh_intent_id = $1',
        [id]
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Refresh intent not found' });
      }

      const currentStatus = existing.rows[0].intent_status;
      if (!['DRAFT', 'REQUESTED'].includes(currentStatus)) {
        return res.status(400).json({ 
          error: 'Cannot modify intent in current status. Only DRAFT and REQUESTED intents can be edited.' 
        });
      }

      const result = await db.query(
        `UPDATE refresh_intents SET
           planned_date = COALESCE($1, planned_date),
           planned_end_date = COALESCE($2, planned_end_date),
           refresh_type = COALESCE($3, refresh_type),
           source_environment_id = COALESCE($4, source_environment_id),
           source_environment_name = COALESCE($5, source_environment_name),
           source_snapshot_name = COALESCE($6, source_snapshot_name),
           use_latest_snapshot = COALESCE($7, use_latest_snapshot),
           impact_scope = COALESCE($8, impact_scope),
           requires_downtime = COALESCE($9, requires_downtime),
           estimated_downtime_minutes = COALESCE($10, estimated_downtime_minutes),
           affected_applications = COALESCE($11, affected_applications),
           reason = COALESCE($12, reason),
           business_justification = COALESCE($13, business_justification),
           change_ticket_ref = COALESCE($14, change_ticket_ref),
           release_id = COALESCE($15, release_id),
           jira_ref = COALESCE($16, jira_ref),
           servicenow_ref = COALESCE($17, servicenow_ref),
           notification_groups = COALESCE($18, notification_groups),
           notification_lead_days = COALESCE($19, notification_lead_days),
           updated_at = NOW()
         WHERE refresh_intent_id = $20
         RETURNING *`,
        [
          plannedDate, plannedEndDate, refreshType,
          sourceEnvironmentId, sourceEnvironmentName, sourceSnapshotName, useLatestSnapshot,
          impactScope, requiresDowntime, estimatedDowntimeMinutes, affectedApplications,
          reason, businessJustification, changeTicketRef, releaseId, jiraRef, servicenowRef,
          notificationGroups, notificationLeadDays, id
        ]
      );

      // Re-check conflicts if dates changed
      if (plannedDate || plannedEndDate) {
        await refreshController.recheckConflicts(result.rows[0]);
      }

      res.json({ 
        message: 'Refresh intent updated successfully',
        intent: result.rows[0] 
      });
    } catch (error) {
      console.error('Update refresh intent error:', error);
      res.status(500).json({ error: 'Failed to update refresh intent' });
    }
  },

  // Approve refresh intent
  approveIntent: async (req, res) => {
    try {
      const { id } = req.params;
      const { approvalNotes } = req.body;

      if (!isValidUUID(id)) {
        return res.status(400).json({ error: 'Invalid intent ID format' });
      }

      // Check current status
      const existing = await db.query(
        'SELECT * FROM refresh_intents WHERE refresh_intent_id = $1',
        [id]
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Refresh intent not found' });
      }

      if (existing.rows[0].intent_status !== 'REQUESTED') {
        return res.status(400).json({ error: 'Only REQUESTED intents can be approved' });
      }

      const result = await db.query(
        `UPDATE refresh_intents SET
           intent_status = 'APPROVED',
           approved_by_user_id = $1,
           approved_at = NOW(),
           approval_notes = $2,
           updated_at = NOW()
         WHERE refresh_intent_id = $3
         RETURNING *`,
        [req.user.user_id, approvalNotes, id]
      );

      res.json({ 
        message: 'Refresh intent approved successfully',
        intent: result.rows[0] 
      });
    } catch (error) {
      console.error('Approve refresh intent error:', error);
      res.status(500).json({ error: 'Failed to approve refresh intent' });
    }
  },

  // Reject refresh intent
  rejectIntent: async (req, res) => {
    try {
      const { id } = req.params;
      const { rejectionReason } = req.body;

      if (!isValidUUID(id)) {
        return res.status(400).json({ error: 'Invalid intent ID format' });
      }

      if (!rejectionReason) {
        return res.status(400).json({ error: 'Rejection reason is required' });
      }

      // Check current status
      const existing = await db.query(
        'SELECT * FROM refresh_intents WHERE refresh_intent_id = $1',
        [id]
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Refresh intent not found' });
      }

      if (existing.rows[0].intent_status !== 'REQUESTED') {
        return res.status(400).json({ error: 'Only REQUESTED intents can be rejected' });
      }

      const result = await db.query(
        `UPDATE refresh_intents SET
           intent_status = 'CANCELLED',
           rejected_by_user_id = $1,
           rejected_at = NOW(),
           rejection_reason = $2,
           updated_at = NOW()
         WHERE refresh_intent_id = $3
         RETURNING *`,
        [req.user.user_id, rejectionReason, id]
      );

      res.json({ 
        message: 'Refresh intent rejected',
        intent: result.rows[0] 
      });
    } catch (error) {
      console.error('Reject refresh intent error:', error);
      res.status(500).json({ error: 'Failed to reject refresh intent' });
    }
  },

  // Start execution of approved intent
  startExecution: async (req, res) => {
    try {
      const { id } = req.params;

      if (!isValidUUID(id)) {
        return res.status(400).json({ error: 'Invalid intent ID format' });
      }

      const existing = await db.query(
        'SELECT * FROM refresh_intents WHERE refresh_intent_id = $1',
        [id]
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Refresh intent not found' });
      }

      const validStartStatuses = ['APPROVED', 'SCHEDULED'];
      if (!validStartStatuses.includes(existing.rows[0].intent_status)) {
        return res.status(400).json({ 
          error: 'Intent must be APPROVED or SCHEDULED to start execution' 
        });
      }

      const result = await db.query(
        `UPDATE refresh_intents SET
           intent_status = 'IN_PROGRESS',
           execution_started_at = NOW(),
           updated_at = NOW()
         WHERE refresh_intent_id = $1
         RETURNING *`,
        [id]
      );

      res.json({ 
        message: 'Refresh execution started',
        intent: result.rows[0] 
      });
    } catch (error) {
      console.error('Start execution error:', error);
      res.status(500).json({ error: 'Failed to start execution' });
    }
  },

  // Complete execution of intent
  completeExecution: async (req, res) => {
    try {
      const { id } = req.params;
      const { 
        executionNotes, 
        durationMinutes, 
        dataVolumeGb, 
        rowsAffected,
        executionStatus = 'SUCCESS',
        errorMessage
      } = req.body;

      if (!isValidUUID(id)) {
        return res.status(400).json({ error: 'Invalid intent ID format' });
      }

      const existing = await db.query(
        'SELECT * FROM refresh_intents WHERE refresh_intent_id = $1',
        [id]
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Refresh intent not found' });
      }

      if (existing.rows[0].intent_status !== 'IN_PROGRESS') {
        return res.status(400).json({ error: 'Intent must be IN_PROGRESS to complete' });
      }

      const intent = existing.rows[0];
      const finalStatus = executionStatus === 'SUCCESS' ? 'COMPLETED' : 
                         executionStatus === 'FAILED' ? 'FAILED' : 'COMPLETED';

      // Create history record
      const historyResult = await db.query(
        `INSERT INTO refresh_history (
           entity_type, entity_id, entity_name, refresh_date, refresh_type,
           source_environment_id, source_environment_name, source_snapshot_name,
           requested_by_user_id, requested_at, executed_by_user_id, executed_at,
           change_ticket_ref, release_id, jira_ref, servicenow_ref,
           execution_status, duration_minutes, data_volume_gb, rows_affected,
           notes, error_message, refresh_intent_id
         ) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9, $10, NOW(), $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
         RETURNING refresh_history_id`,
        [
          intent.entity_type, intent.entity_id, intent.entity_name, intent.refresh_type,
          intent.source_environment_id, intent.source_environment_name, intent.source_snapshot_name,
          intent.requested_by_user_id, intent.requested_at, req.user.user_id,
          intent.change_ticket_ref, intent.release_id, intent.jira_ref, intent.servicenow_ref,
          executionStatus, durationMinutes, dataVolumeGb, rowsAffected,
          executionNotes, errorMessage, id
        ]
      );

      // Update intent
      const result = await db.query(
        `UPDATE refresh_intents SET
           intent_status = $1,
           execution_completed_at = NOW(),
           execution_notes = $2,
           refresh_history_id = $3,
           updated_at = NOW()
         WHERE refresh_intent_id = $4
         RETURNING *`,
        [finalStatus, executionNotes, historyResult.rows[0].refresh_history_id, id]
      );

      // Update entity's last refresh info
      if (executionStatus === 'SUCCESS') {
        await refreshController.updateEntityLastRefresh(
          intent.entity_type, intent.entity_id, new Date(),
          intent.refresh_type, intent.source_environment_name || intent.source_snapshot_name,
          req.user.user_id
        );
      }

      res.json({ 
        message: `Refresh execution ${finalStatus.toLowerCase()}`,
        intent: result.rows[0],
        historyId: historyResult.rows[0].refresh_history_id
      });
    } catch (error) {
      console.error('Complete execution error:', error);
      res.status(500).json({ error: 'Failed to complete execution' });
    }
  },

  // Cancel refresh intent
  cancelIntent: async (req, res) => {
    try {
      const { id } = req.params;
      const { cancellationReason } = req.body;

      if (!isValidUUID(id)) {
        return res.status(400).json({ error: 'Invalid intent ID format' });
      }

      const existing = await db.query(
        'SELECT * FROM refresh_intents WHERE refresh_intent_id = $1',
        [id]
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Refresh intent not found' });
      }

      const nonCancellableStatuses = ['COMPLETED', 'FAILED', 'CANCELLED', 'ROLLED_BACK', 'IN_PROGRESS'];
      if (nonCancellableStatuses.includes(existing.rows[0].intent_status)) {
        return res.status(400).json({ 
          error: 'Cannot cancel intent in current status' 
        });
      }

      const result = await db.query(
        `UPDATE refresh_intents SET
           intent_status = 'CANCELLED',
           execution_notes = $1,
           updated_at = NOW()
         WHERE refresh_intent_id = $2
         RETURNING *`,
        [cancellationReason || 'Cancelled by user', id]
      );

      res.json({ 
        message: 'Refresh intent cancelled',
        intent: result.rows[0] 
      });
    } catch (error) {
      console.error('Cancel intent error:', error);
      res.status(500).json({ error: 'Failed to cancel intent' });
    }
  },

  // =====================================================
  // CONFLICT MANAGEMENT
  // =====================================================

  // Check and create conflicts for an intent
  checkAndCreateConflicts: async (intent) => {
    try {
      const plannedEnd = intent.planned_end_date || 
        new Date(new Date(intent.planned_date).getTime() + 4 * 60 * 60 * 1000); // Default 4 hours

      // Find overlapping bookings for the same entity
      let bookingQuery = '';
      let bookingParams = [];

      if (intent.entity_type === 'EnvironmentInstance') {
        bookingQuery = `
          SELECT eb.* FROM environment_bookings eb
          JOIN booking_resources br ON eb.booking_id = br.booking_id
          WHERE br.resource_type = 'EnvironmentInstance'
          AND br.resource_ref_id = $1
          AND eb.booking_status IN ('Active', 'Confirmed', 'Approved')
          AND (
            (eb.start_datetime <= $2 AND eb.end_datetime >= $2) OR
            (eb.start_datetime <= $3 AND eb.end_datetime >= $3) OR
            (eb.start_datetime >= $2 AND eb.end_datetime <= $3)
          )
        `;
        bookingParams = [intent.entity_id, intent.planned_date, plannedEnd];
      } else if (intent.entity_type === 'Environment') {
        bookingQuery = `
          SELECT eb.* FROM environment_bookings eb
          JOIN booking_resources br ON eb.booking_id = br.booking_id
          JOIN environment_instances ei ON br.resource_ref_id = ei.env_instance_id
          WHERE br.resource_type = 'EnvironmentInstance'
          AND ei.environment_id = $1
          AND eb.booking_status IN ('Active', 'Confirmed', 'Approved')
          AND (
            (eb.start_datetime <= $2 AND eb.end_datetime >= $2) OR
            (eb.start_datetime <= $3 AND eb.end_datetime >= $3) OR
            (eb.start_datetime >= $2 AND eb.end_datetime <= $3)
          )
        `;
        bookingParams = [intent.entity_id, intent.planned_date, plannedEnd];
      }

      if (bookingQuery) {
        const conflicts = await db.query(bookingQuery, bookingParams);

        for (const booking of conflicts.rows) {
          await db.query(
            `INSERT INTO refresh_booking_conflicts (
               refresh_intent_id, booking_id, conflict_type, severity
             ) VALUES ($1, $2, $3, $4)
             ON CONFLICT (refresh_intent_id, booking_id) DO NOTHING`,
            [intent.refresh_intent_id, booking.booking_id, 'OVERLAP', 
             intent.requires_downtime ? 'HIGH' : 'MEDIUM']
          );
        }
      }
    } catch (error) {
      console.error('Check conflicts error:', error);
    }
  },

  // Recheck conflicts after intent update
  recheckConflicts: async (intent) => {
    try {
      // Clear existing unresolved conflicts
      await db.query(
        `DELETE FROM refresh_booking_conflicts 
         WHERE refresh_intent_id = $1 AND resolution_status = 'UNRESOLVED'`,
        [intent.refresh_intent_id]
      );

      // Check for new conflicts
      await refreshController.checkAndCreateConflicts(intent);
    } catch (error) {
      console.error('Recheck conflicts error:', error);
    }
  },

  // Get conflicts for an intent
  getConflicts: async (req, res) => {
    try {
      const { id } = req.params;

      if (!isValidUUID(id)) {
        return res.status(400).json({ error: 'Invalid intent ID format' });
      }

      const result = await db.query(
        `SELECT rbc.*, 
                eb.start_datetime as booking_start, eb.end_datetime as booking_end,
                eb.title as booking_purpose,
                u.username as booking_owner,
                u.email as booking_owner_email
         FROM refresh_booking_conflicts rbc
         JOIN environment_bookings eb ON rbc.booking_id = eb.booking_id
         LEFT JOIN users u ON eb.requested_by_user_id = u.user_id
         WHERE rbc.refresh_intent_id = $1
         ORDER BY rbc.severity DESC, rbc.created_at`,
        [id]
      );

      res.json({ conflicts: result.rows });
    } catch (error) {
      console.error('Get conflicts error:', error);
      res.status(500).json({ error: 'Failed to fetch conflicts' });
    }
  },

  // Resolve a conflict
  resolveConflict: async (req, res) => {
    try {
      const { conflictId } = req.params;
      const { resolutionStatus, resolutionNotes } = req.body;

      if (!isValidUUID(conflictId)) {
        return res.status(400).json({ error: 'Invalid conflict ID format' });
      }

      const validResolutions = [
        'ACKNOWLEDGED', 'BOOKING_MOVED', 'REFRESH_MOVED', 
        'OVERRIDE_APPROVED', 'DISMISSED'
      ];
      if (!validResolutions.includes(resolutionStatus)) {
        return res.status(400).json({ error: 'Invalid resolution status' });
      }

      const result = await db.query(
        `UPDATE refresh_booking_conflicts SET
           resolution_status = $1,
           resolved_by_user_id = $2,
           resolved_at = NOW(),
           resolution_notes = $3,
           updated_at = NOW()
         WHERE conflict_id = $4
         RETURNING *`,
        [resolutionStatus, req.user.user_id, resolutionNotes, conflictId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Conflict not found' });
      }

      res.json({ 
        message: 'Conflict resolved',
        conflict: result.rows[0] 
      });
    } catch (error) {
      console.error('Resolve conflict error:', error);
      res.status(500).json({ error: 'Failed to resolve conflict' });
    }
  },

  // =====================================================
  // CALENDAR / TIMELINE VIEW
  // =====================================================

  // Get calendar data for date range
  getCalendar: async (req, res) => {
    try {
      const { startDate, endDate, entityType } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Start and end dates are required' });
      }

      let query = `
        SELECT ri.refresh_intent_id, ri.entity_type, ri.entity_id, ri.entity_name,
               ri.intent_status, ri.planned_date, ri.planned_end_date,
               ri.refresh_type, ri.requires_downtime,
               u.username as requested_by_username,
               (SELECT COUNT(*) FROM refresh_booking_conflicts rbc 
                WHERE rbc.refresh_intent_id = ri.refresh_intent_id 
                AND rbc.resolution_status = 'UNRESOLVED') as unresolved_conflicts
        FROM refresh_intents ri
        LEFT JOIN users u ON ri.requested_by_user_id = u.user_id
        WHERE ri.intent_status NOT IN ('CANCELLED', 'COMPLETED', 'FAILED', 'ROLLED_BACK')
        AND (
          (ri.planned_date >= $1 AND ri.planned_date <= $2) OR
          (ri.planned_end_date >= $1 AND ri.planned_end_date <= $2) OR
          (ri.planned_date <= $1 AND COALESCE(ri.planned_end_date, ri.planned_date) >= $2)
        )
      `;
      const params = [startDate, endDate];

      if (entityType && VALID_ENTITY_TYPES.includes(entityType)) {
        params.push(entityType);
        query += ` AND ri.entity_type = $${params.length}`;
      }

      query += ` ORDER BY ri.planned_date`;

      const result = await db.query(query, params);

      // Also get recent history for context
      const historyResult = await db.query(
        `SELECT rh.refresh_history_id, rh.entity_type, rh.entity_id, rh.entity_name,
                rh.refresh_date, rh.refresh_type, rh.execution_status
         FROM refresh_history rh
         WHERE rh.refresh_date >= $1 AND rh.refresh_date <= $2
         ORDER BY rh.refresh_date`,
        [startDate, endDate]
      );

      res.json({
        intents: result.rows,
        history: historyResult.rows
      });
    } catch (error) {
      console.error('Get calendar error:', error);
      res.status(500).json({ error: 'Failed to fetch calendar data' });
    }
  },

  // =====================================================
  // STATISTICS / DASHBOARD
  // =====================================================

  // Get refresh statistics
  getStatistics: async (req, res) => {
    try {
      const { period = '30' } = req.query;
      const periodDays = parseInt(period);

      // Pending approvals count
      const pendingApprovals = await db.query(
        `SELECT COUNT(*) as count FROM refresh_intents 
         WHERE intent_status = 'REQUESTED'`
      );

      // Upcoming refreshes (next 7 days)
      const upcomingRefreshes = await db.query(
        `SELECT COUNT(*) as count FROM refresh_intents 
         WHERE intent_status IN ('APPROVED', 'SCHEDULED')
         AND planned_date <= NOW() + INTERVAL '7 days'`
      );

      // Unresolved conflicts
      const unresolvedConflicts = await db.query(
        `SELECT COUNT(*) as count FROM refresh_booking_conflicts 
         WHERE resolution_status = 'UNRESOLVED'`
      );

      // Recent history stats
      const historyStats = await db.query(
        `SELECT 
           COUNT(*) FILTER (WHERE execution_status = 'SUCCESS') as success_count,
           COUNT(*) FILTER (WHERE execution_status = 'FAILED') as failed_count,
           COUNT(*) as total_count,
           AVG(duration_minutes) as avg_duration
         FROM refresh_history 
         WHERE refresh_date >= NOW() - INTERVAL '${periodDays} days'`
      );

      // Refreshes by entity type
      const byEntityType = await db.query(
        `SELECT entity_type, COUNT(*) as count 
         FROM refresh_history 
         WHERE refresh_date >= NOW() - INTERVAL '${periodDays} days'
         GROUP BY entity_type 
         ORDER BY count DESC`
      );

      // Refreshes by type
      const byRefreshType = await db.query(
        `SELECT refresh_type, COUNT(*) as count 
         FROM refresh_history 
         WHERE refresh_date >= NOW() - INTERVAL '${periodDays} days'
         GROUP BY refresh_type 
         ORDER BY count DESC`
      );

      res.json({
        summary: {
          pendingApprovals: parseInt(pendingApprovals.rows[0].count),
          upcomingRefreshes: parseInt(upcomingRefreshes.rows[0].count),
          unresolvedConflicts: parseInt(unresolvedConflicts.rows[0].count)
        },
        historyStats: {
          successCount: parseInt(historyStats.rows[0].success_count || 0),
          failedCount: parseInt(historyStats.rows[0].failed_count || 0),
          totalCount: parseInt(historyStats.rows[0].total_count || 0),
          avgDurationMinutes: Math.round(historyStats.rows[0].avg_duration || 0)
        },
        byEntityType: byEntityType.rows,
        byRefreshType: byRefreshType.rows,
        period: periodDays
      });
    } catch (error) {
      console.error('Get statistics error:', error);
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  }
};

module.exports = refreshController;
