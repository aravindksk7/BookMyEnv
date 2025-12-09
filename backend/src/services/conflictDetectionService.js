/**
 * Conflict Detection Service
 * 
 * Implements the TOON specification for refresh-booking dependency checking:
 * - Detects overlapping bookings when creating/updating refresh intents
 * - Detects scheduled refreshes when creating/updating bookings
 * - Calculates conflict severity based on booking criticality
 * - Manages conflict resolution workflow
 * 
 * Version: 4.1
 */

const db = require('../config/database');

/**
 * Conflict Severity Rules:
 * - MAJOR: Overlaps with CONFIRMED + CRITICAL bookings, or any active booking with DATA_OVERWRITE/DOWNTIME impact
 * - MINOR: Overlaps with non-critical or TENTATIVE bookings, or READ_ONLY impact
 * - NONE: No overlap
 */
const SEVERITY_RULES = {
  // Impact types that require stricter conflict rules
  DESTRUCTIVE_IMPACTS: ['DATA_OVERWRITE', 'DOWNTIME_REQUIRED', 'SCHEMA_CHANGE'],
  // Impact types that allow more flexibility
  NON_DESTRUCTIVE_IMPACTS: ['READ_ONLY', 'CONFIG_CHANGE'],
  // Booking statuses that count as confirmed
  CONFIRMED_STATUSES: ['Approved', 'Active'],
  // Booking statuses that count as tentative
  TENTATIVE_STATUSES: ['Requested', 'PendingApproval'],
};

const conflictDetectionService = {
  /**
   * Check for booking conflicts when creating/updating a refresh intent
   * 
   * @param {Object} params - Refresh intent parameters
   * @param {string} params.entityType - Type of entity being refreshed
   * @param {string} params.entityId - ID of entity being refreshed
   * @param {Date} params.plannedDate - Refresh start datetime
   * @param {Date} params.plannedEndDate - Refresh end datetime (optional)
   * @param {string} params.impactType - Type of impact (DATA_OVERWRITE, DOWNTIME_REQUIRED, etc.)
   * @param {number} params.estimatedDowntimeMinutes - Estimated duration if not specified
   * @param {string} params.refreshIntentId - Existing intent ID (for updates, to exclude from conflict check)
   * @returns {Object} Conflict detection result
   */
  checkConflictsForRefresh: async ({
    entityType,
    entityId,
    plannedDate,
    plannedEndDate,
    impactType = 'DATA_OVERWRITE',
    estimatedDowntimeMinutes = 60,
    refreshIntentId = null
  }) => {
    try {
      // Calculate refresh window
      const refreshStart = new Date(plannedDate);
      const refreshEnd = plannedEndDate 
        ? new Date(plannedEndDate) 
        : new Date(refreshStart.getTime() + (estimatedDowntimeMinutes * 60 * 1000));

      // Build query to find overlapping bookings
      // Time overlap: refresh_start < booking_end AND refresh_end > booking_start
      const bookingsQuery = `
        SELECT 
          eb.booking_id,
          eb.title,
          eb.description,
          eb.start_datetime,
          eb.end_datetime,
          eb.booking_status,
          eb.booking_type,
          eb.test_phase,
          eb.is_critical_booking,
          eb.booking_priority,
          eb.project_id,
          eb.conflict_status,
          u.display_name as booked_by_name,
          u.email as booked_by_email,
          u.user_id as booked_by_user_id,
          ug.name as owning_group_name,
          ug.group_id as owning_group_id,
          -- Calculate overlap window
          GREATEST(eb.start_datetime, $1::timestamp) as overlap_start,
          LEAST(eb.end_datetime, $2::timestamp) as overlap_end,
          EXTRACT(EPOCH FROM (LEAST(eb.end_datetime, $2::timestamp) - GREATEST(eb.start_datetime, $1::timestamp))) / 60 as overlap_minutes
        FROM environment_bookings eb
        JOIN users u ON eb.requested_by_user_id = u.user_id
        LEFT JOIN user_groups ug ON eb.owning_group_id = ug.group_id
        LEFT JOIN booking_resources br ON eb.booking_id = br.booking_id
        WHERE eb.booking_status NOT IN ('Cancelled', 'Completed')
        AND eb.start_datetime < $2::timestamp
        AND eb.end_datetime > $1::timestamp
        AND (
          -- Check if booking resources include the entity being refreshed
          (br.resource_type = $3 AND br.resource_ref_id = $4)
          OR (br.source_env_instance_id = $4)
          -- Also check if entity is an environment and booking has resources in that env
          OR ($3 = 'Environment' AND br.source_env_instance_id IN (
            SELECT env_instance_id FROM environment_instances WHERE environment_id = $4
          ))
          OR ($3 = 'EnvironmentInstance' AND br.source_env_instance_id = $4)
        )
        ORDER BY eb.start_datetime
      `;

      const bookingsResult = await db.query(bookingsQuery, [
        refreshStart.toISOString(),
        refreshEnd.toISOString(),
        entityType,
        entityId
      ]);

      // If no direct resource matches, also check for environment-level overlaps
      let overlappingBookings = bookingsResult.rows;

      // If entity is environment-related, also check direct environment bookings
      if (['Environment', 'EnvironmentInstance'].includes(entityType) && overlappingBookings.length === 0) {
        const envBookingsQuery = `
          SELECT DISTINCT
            eb.booking_id,
            eb.title,
            eb.description,
            eb.start_datetime,
            eb.end_datetime,
            eb.booking_status,
            eb.booking_type,
            eb.test_phase,
            eb.is_critical_booking,
            eb.booking_priority,
            eb.project_id,
            eb.conflict_status,
            u.display_name as booked_by_name,
            u.email as booked_by_email,
            u.user_id as booked_by_user_id,
            ug.name as owning_group_name,
            ug.group_id as owning_group_id,
            GREATEST(eb.start_datetime, $1::timestamp) as overlap_start,
            LEAST(eb.end_datetime, $2::timestamp) as overlap_end,
            EXTRACT(EPOCH FROM (LEAST(eb.end_datetime, $2::timestamp) - GREATEST(eb.start_datetime, $1::timestamp))) / 60 as overlap_minutes
          FROM environment_bookings eb
          JOIN users u ON eb.requested_by_user_id = u.user_id
          LEFT JOIN user_groups ug ON eb.owning_group_id = ug.group_id
          JOIN booking_resources br ON eb.booking_id = br.booking_id
          JOIN environment_instances ei ON br.source_env_instance_id = ei.env_instance_id
          WHERE eb.booking_status NOT IN ('Cancelled', 'Completed')
          AND eb.start_datetime < $2::timestamp
          AND eb.end_datetime > $1::timestamp
          AND (
            ($3 = 'Environment' AND ei.environment_id = $4)
            OR ($3 = 'EnvironmentInstance' AND ei.env_instance_id = $4)
          )
          ORDER BY eb.start_datetime
        `;

        const envBookingsResult = await db.query(envBookingsQuery, [
          refreshStart.toISOString(),
          refreshEnd.toISOString(),
          entityType,
          entityId
        ]);
        overlappingBookings = envBookingsResult.rows;
      }

      // Calculate conflict severity for each booking
      const conflicts = overlappingBookings.map(booking => {
        const severity = conflictDetectionService.calculateSeverity(booking, impactType);
        return {
          bookingId: booking.booking_id,
          title: booking.title,
          description: booking.description,
          startDatetime: booking.start_datetime,
          endDatetime: booking.end_datetime,
          bookingStatus: booking.booking_status,
          testPhase: booking.test_phase,
          isCritical: booking.is_critical_booking,
          priority: booking.booking_priority,
          projectId: booking.project_id,
          bookedByName: booking.booked_by_name,
          bookedByEmail: booking.booked_by_email,
          bookedByUserId: booking.booked_by_user_id,
          owningGroupName: booking.owning_group_name,
          owningGroupId: booking.owning_group_id,
          overlapStart: booking.overlap_start,
          overlapEnd: booking.overlap_end,
          overlapMinutes: Math.round(booking.overlap_minutes),
          severity,
          conflictType: 'OVERLAP'
        };
      });

      // Calculate overall conflict flag
      const majorConflicts = conflicts.filter(c => c.severity === 'HIGH');
      const minorConflicts = conflicts.filter(c => c.severity === 'MEDIUM' || c.severity === 'LOW');

      let conflictFlag = 'NONE';
      if (majorConflicts.length > 0) {
        conflictFlag = 'MAJOR';
      } else if (minorConflicts.length > 0) {
        conflictFlag = 'MINOR';
      }

      // Get impacted teams
      const impactedTeams = [...new Set(conflicts
        .filter(c => c.owningGroupId)
        .map(c => c.owningGroupId))];

      // Build conflict summary
      const conflictSummary = {
        totalConflicts: conflicts.length,
        majorConflicts: majorConflicts.length,
        minorConflicts: minorConflicts.length,
        affectedBookings: conflicts.map(c => c.bookingId),
        impactedTeams,
        refreshWindow: {
          start: refreshStart.toISOString(),
          end: refreshEnd.toISOString()
        },
        impactType,
        checkedAt: new Date().toISOString()
      };

      return {
        hasConflicts: conflicts.length > 0,
        conflictFlag,
        conflictSummary,
        conflicts,
        impactedTeams,
        canProceedWithoutOverride: conflictFlag !== 'MAJOR',
        requiresForceApproval: conflictFlag === 'MAJOR'
      };
    } catch (error) {
      console.error('Conflict detection error:', error);
      throw new Error(`Failed to check conflicts: ${error.message}`);
    }
  },

  /**
   * Check for refresh conflicts when creating/updating a booking
   * 
   * @param {Object} params - Booking parameters
   * @param {Date} params.startDatetime - Booking start
   * @param {Date} params.endDatetime - Booking end
   * @param {Array} params.resourceIds - Array of resource IDs being booked
   * @param {string} params.bookingId - Existing booking ID (for updates)
   * @returns {Object} Refresh conflict detection result
   */
  checkRefreshesForBooking: async ({
    startDatetime,
    endDatetime,
    resourceIds = [],
    environmentInstanceIds = [],
    bookingId = null
  }) => {
    try {
      const bookingStart = new Date(startDatetime);
      const bookingEnd = new Date(endDatetime);

      // Find all approved/scheduled refreshes that overlap with booking window
      let query = `
        SELECT 
          ri.refresh_intent_id,
          ri.entity_type,
          ri.entity_id,
          ri.entity_name,
          ri.intent_status,
          ri.planned_date,
          ri.planned_end_date,
          ri.refresh_type,
          ri.impact_type,
          ri.requires_downtime,
          ri.estimated_downtime_minutes,
          ri.reason,
          ri.source_environment_name,
          u.display_name as requested_by_name,
          u.email as requested_by_email,
          GREATEST(ri.planned_date, $1::timestamp) as overlap_start,
          LEAST(COALESCE(ri.planned_end_date, ri.planned_date + COALESCE(ri.estimated_downtime_minutes, 60) * INTERVAL '1 minute'), $2::timestamp) as overlap_end
        FROM refresh_intents ri
        JOIN users u ON ri.requested_by_user_id = u.user_id
        WHERE ri.intent_status IN ('APPROVED', 'SCHEDULED', 'IN_PROGRESS')
        AND ri.planned_date < $2::timestamp
        AND COALESCE(ri.planned_end_date, ri.planned_date + COALESCE(ri.estimated_downtime_minutes, 60) * INTERVAL '1 minute') > $1::timestamp
      `;

      const params = [bookingStart.toISOString(), bookingEnd.toISOString()];

      // Add entity filter if we have specific resources
      if (environmentInstanceIds.length > 0) {
        params.push(environmentInstanceIds);
        query += `
          AND (
            (ri.entity_type = 'EnvironmentInstance' AND ri.entity_id = ANY($${params.length}::uuid[]))
            OR (ri.entity_type = 'Environment' AND ri.entity_id IN (
              SELECT environment_id FROM environment_instances WHERE env_instance_id = ANY($${params.length}::uuid[])
            ))
          )
        `;
      }

      query += ' ORDER BY ri.planned_date';

      const result = await db.query(query, params);

      const refreshConflicts = result.rows.map(refresh => {
        // Determine impact on booking
        let impactDescription = '';
        let severity = 'MEDIUM';

        if (SEVERITY_RULES.DESTRUCTIVE_IMPACTS.includes(refresh.impact_type)) {
          impactDescription = `This refresh will ${refresh.impact_type === 'DATA_OVERWRITE' ? 'overwrite data' : 
            refresh.impact_type === 'DOWNTIME_REQUIRED' ? 'cause downtime' : 'modify schema'}. Your test data may be affected.`;
          severity = 'HIGH';
        } else {
          impactDescription = `This refresh is ${refresh.impact_type === 'READ_ONLY' ? 'read-only' : 'config-only'}. Impact should be minimal.`;
          severity = 'LOW';
        }

        return {
          refreshIntentId: refresh.refresh_intent_id,
          entityType: refresh.entity_type,
          entityId: refresh.entity_id,
          entityName: refresh.entity_name,
          intentStatus: refresh.intent_status,
          plannedDate: refresh.planned_date,
          plannedEndDate: refresh.planned_end_date,
          refreshType: refresh.refresh_type,
          impactType: refresh.impact_type,
          requiresDowntime: refresh.requires_downtime,
          estimatedDowntimeMinutes: refresh.estimated_downtime_minutes,
          reason: refresh.reason,
          sourceEnvironmentName: refresh.source_environment_name,
          requestedByName: refresh.requested_by_name,
          requestedByEmail: refresh.requested_by_email,
          overlapStart: refresh.overlap_start,
          overlapEnd: refresh.overlap_end,
          severity,
          impactDescription
        };
      });

      const hasConflicts = refreshConflicts.length > 0;
      const hasDestructiveRefresh = refreshConflicts.some(r => 
        SEVERITY_RULES.DESTRUCTIVE_IMPACTS.includes(r.impactType)
      );

      return {
        hasConflicts,
        hasDestructiveRefresh,
        refreshConflicts,
        warningLevel: hasDestructiveRefresh ? 'HIGH' : (hasConflicts ? 'MEDIUM' : 'NONE'),
        suggestedAction: hasDestructiveRefresh 
          ? 'Consider adjusting your booking time or selecting a different environment'
          : (hasConflicts ? 'Proceed with caution - a refresh is scheduled during your booking' : null)
      };
    } catch (error) {
      console.error('Refresh check for booking error:', error);
      throw new Error(`Failed to check refreshes: ${error.message}`);
    }
  },

  /**
   * Calculate conflict severity based on booking attributes and impact type
   */
  calculateSeverity: (booking, impactType) => {
    const isDestructive = SEVERITY_RULES.DESTRUCTIVE_IMPACTS.includes(impactType);
    const isConfirmed = SEVERITY_RULES.CONFIRMED_STATUSES.includes(booking.booking_status);
    const isCritical = booking.is_critical_booking || booking.booking_priority === 'Critical';
    const isHighPriority = booking.booking_priority === 'High';

    // MAJOR (HIGH severity): Destructive impact on confirmed critical bookings
    if (isDestructive && isConfirmed && (isCritical || isHighPriority)) {
      return 'HIGH';
    }

    // MAJOR (HIGH severity): Any destructive impact on active booking
    if (isDestructive && booking.booking_status === 'Active') {
      return 'HIGH';
    }

    // MEDIUM severity: Destructive impact on non-critical confirmed bookings
    if (isDestructive && isConfirmed) {
      return 'MEDIUM';
    }

    // MEDIUM severity: Non-destructive impact on critical bookings
    if (!isDestructive && isConfirmed && isCritical) {
      return 'MEDIUM';
    }

    // LOW severity: Tentative bookings or non-destructive impacts
    return 'LOW';
  },

  /**
   * Store detected conflicts in the database
   */
  storeConflicts: async (refreshIntentId, conflicts) => {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Remove existing conflicts for this intent (to handle updates)
      await client.query(
        'DELETE FROM refresh_booking_conflicts WHERE refresh_intent_id = $1',
        [refreshIntentId]
      );

      // Insert new conflicts
      for (const conflict of conflicts) {
        await client.query(`
          INSERT INTO refresh_booking_conflicts (
            refresh_intent_id, booking_id, conflict_type, severity,
            resolution_status, overlap_start, overlap_end, overlap_minutes,
            booking_is_critical, booking_priority, auto_detected
          ) VALUES ($1, $2, $3, $4, 'UNRESOLVED', $5, $6, $7, $8, $9, true)
        `, [
          refreshIntentId,
          conflict.bookingId,
          conflict.conflictType,
          conflict.severity,
          conflict.overlapStart,
          conflict.overlapEnd,
          conflict.overlapMinutes,
          conflict.isCritical,
          conflict.priority
        ]);
      }

      await client.query('COMMIT');
      return { stored: conflicts.length };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Store conflicts error:', error);
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Re-validate conflicts before approval (checks for new bookings)
   */
  revalidateConflicts: async (refreshIntentId) => {
    try {
      // Get the refresh intent details
      const intentResult = await db.query(
        `SELECT * FROM refresh_intents WHERE refresh_intent_id = $1`,
        [refreshIntentId]
      );

      if (intentResult.rows.length === 0) {
        throw new Error('Refresh intent not found');
      }

      const intent = intentResult.rows[0];

      // Run conflict detection again
      const conflictResult = await conflictDetectionService.checkConflictsForRefresh({
        entityType: intent.entity_type,
        entityId: intent.entity_id,
        plannedDate: intent.planned_date,
        plannedEndDate: intent.planned_end_date,
        impactType: intent.impact_type,
        estimatedDowntimeMinutes: intent.estimated_downtime_minutes,
        refreshIntentId
      });

      // Store updated conflicts
      await conflictDetectionService.storeConflicts(refreshIntentId, conflictResult.conflicts);

      // Update intent with new conflict info
      await db.query(`
        UPDATE refresh_intents 
        SET conflict_flag = $1, 
            conflict_summary = $2,
            impacted_teams = $3,
            updated_at = NOW()
        WHERE refresh_intent_id = $4
      `, [
        conflictResult.conflictFlag,
        JSON.stringify(conflictResult.conflictSummary),
        conflictResult.impactedTeams,
        refreshIntentId
      ]);

      return conflictResult;
    } catch (error) {
      console.error('Revalidate conflicts error:', error);
      throw error;
    }
  },

  /**
   * Get conflict details with full booking information
   */
  getConflictDetails: async (refreshIntentId) => {
    try {
      const result = await db.query(`
        SELECT 
          rbc.*,
          eb.title as booking_title,
          eb.description as booking_description,
          eb.start_datetime as booking_start,
          eb.end_datetime as booking_end,
          eb.booking_status,
          eb.test_phase,
          eb.project_id,
          u.display_name as booking_owner_name,
          u.email as booking_owner_email,
          ug.name as booking_group_name,
          ru.display_name as resolved_by_name
        FROM refresh_booking_conflicts rbc
        JOIN environment_bookings eb ON rbc.booking_id = eb.booking_id
        JOIN users u ON eb.requested_by_user_id = u.user_id
        LEFT JOIN user_groups ug ON eb.owning_group_id = ug.group_id
        LEFT JOIN users ru ON rbc.resolved_by_user_id = ru.user_id
        WHERE rbc.refresh_intent_id = $1
        ORDER BY eb.start_datetime
      `, [refreshIntentId]);

      return result.rows;
    } catch (error) {
      console.error('Get conflict details error:', error);
      throw error;
    }
  },

  /**
   * Resolve a conflict
   */
  resolveConflict: async (conflictId, resolution, userId, notes) => {
    try {
      const validResolutions = [
        'ACKNOWLEDGED', 'BOOKING_MOVED', 'REFRESH_MOVED', 
        'OVERRIDE_APPROVED', 'DISMISSED'
      ];

      if (!validResolutions.includes(resolution)) {
        throw new Error(`Invalid resolution: ${resolution}`);
      }

      await db.query(`
        UPDATE refresh_booking_conflicts 
        SET resolution_status = $1,
            resolved_by_user_id = $2,
            resolved_at = NOW(),
            resolution_notes = $3,
            updated_at = NOW()
        WHERE conflict_id = $4
      `, [resolution, userId, notes, conflictId]);

      return { success: true };
    } catch (error) {
      console.error('Resolve conflict error:', error);
      throw error;
    }
  },

  /**
   * Get all unresolved conflicts (for dashboard)
   */
  getUnresolvedConflicts: async (filters = {}) => {
    try {
      let query = `
        SELECT 
          rbc.*,
          ri.entity_type,
          ri.entity_name,
          ri.planned_date,
          ri.planned_end_date,
          ri.intent_status,
          ri.impact_type,
          eb.title as booking_title,
          eb.start_datetime as booking_start,
          eb.end_datetime as booking_end,
          eb.booking_status,
          eb.test_phase,
          u_req.display_name as refresh_requested_by,
          u_book.display_name as booking_owner,
          u_book.email as booking_owner_email,
          ug.name as booking_group_name
        FROM refresh_booking_conflicts rbc
        JOIN refresh_intents ri ON rbc.refresh_intent_id = ri.refresh_intent_id
        JOIN environment_bookings eb ON rbc.booking_id = eb.booking_id
        JOIN users u_req ON ri.requested_by_user_id = u_req.user_id
        JOIN users u_book ON eb.requested_by_user_id = u_book.user_id
        LEFT JOIN user_groups ug ON eb.owning_group_id = ug.group_id
        WHERE rbc.resolution_status = 'UNRESOLVED'
      `;

      const params = [];

      if (filters.entityType) {
        params.push(filters.entityType);
        query += ` AND ri.entity_type = $${params.length}`;
      }

      if (filters.severity) {
        params.push(filters.severity);
        query += ` AND rbc.severity = $${params.length}`;
      }

      if (filters.groupId) {
        params.push(filters.groupId);
        query += ` AND eb.owning_group_id = $${params.length}`;
      }

      query += ' ORDER BY ri.planned_date, rbc.severity DESC';

      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Get unresolved conflicts error:', error);
      throw error;
    }
  },

  /**
   * Suggest alternative time slots for a refresh
   */
  suggestAlternativeSlots: async ({
    entityType,
    entityId,
    durationMinutes = 60,
    preferredDateRange = 7, // days to look ahead
    impactType = 'DATA_OVERWRITE'
  }) => {
    try {
      const now = new Date();
      const endDate = new Date(now.getTime() + (preferredDateRange * 24 * 60 * 60 * 1000));

      // Get all bookings in the range
      const bookingsResult = await db.query(`
        SELECT eb.start_datetime, eb.end_datetime
        FROM environment_bookings eb
        JOIN booking_resources br ON eb.booking_id = br.booking_id
        WHERE eb.booking_status NOT IN ('Cancelled', 'Completed')
        AND eb.start_datetime <= $2
        AND eb.end_datetime >= $1
        AND (
          (br.resource_type = $3 AND br.resource_ref_id = $4)
          OR br.source_env_instance_id = $4
        )
        ORDER BY eb.start_datetime
      `, [now.toISOString(), endDate.toISOString(), entityType, entityId]);

      // Find gaps between bookings
      const slots = [];
      let searchStart = now;

      for (const booking of bookingsResult.rows) {
        const bookingStart = new Date(booking.start_datetime);
        const bookingEnd = new Date(booking.end_datetime);

        // Check if there's a gap before this booking
        const gapMinutes = (bookingStart - searchStart) / (1000 * 60);
        if (gapMinutes >= durationMinutes) {
          slots.push({
            start: searchStart.toISOString(),
            end: new Date(searchStart.getTime() + (durationMinutes * 60 * 1000)).toISOString(),
            availableMinutes: Math.round(gapMinutes)
          });
        }

        searchStart = bookingEnd > searchStart ? bookingEnd : searchStart;
      }

      // Check gap after last booking
      const finalGap = (endDate - searchStart) / (1000 * 60);
      if (finalGap >= durationMinutes) {
        slots.push({
          start: searchStart.toISOString(),
          end: new Date(searchStart.getTime() + (durationMinutes * 60 * 1000)).toISOString(),
          availableMinutes: Math.round(finalGap)
        });
      }

      return {
        suggestedSlots: slots.slice(0, 5), // Return top 5 suggestions
        searchRange: {
          start: now.toISOString(),
          end: endDate.toISOString()
        }
      };
    } catch (error) {
      console.error('Suggest alternative slots error:', error);
      throw error;
    }
  },

  /**
   * Notify impacted booking owners about an approved refresh
   */
  notifyImpactedBookingOwners: async (refreshIntentId) => {
    try {
      // Get all unresolved/acknowledged conflicts for this refresh
      const conflicts = await db.query(`
        SELECT 
          rbc.conflict_id,
          rbc.booking_id,
          eb.title as booking_title,
          eb.requested_by_user_id,
          u.display_name,
          u.email,
          ri.entity_name,
          ri.planned_date,
          ri.planned_end_date,
          ri.impact_type,
          ri.reason
        FROM refresh_booking_conflicts rbc
        JOIN environment_bookings eb ON rbc.booking_id = eb.booking_id
        JOIN users u ON eb.requested_by_user_id = u.user_id
        JOIN refresh_intents ri ON rbc.refresh_intent_id = ri.refresh_intent_id
        WHERE rbc.refresh_intent_id = $1
        AND rbc.resolution_status IN ('UNRESOLVED', 'ACKNOWLEDGED', 'OVERRIDE_APPROVED')
        AND rbc.booking_owner_notified = false
      `, [refreshIntentId]);

      // Mark as notified (actual notification would be sent via notification service)
      for (const conflict of conflicts.rows) {
        await db.query(`
          UPDATE refresh_booking_conflicts 
          SET booking_owner_notified = true,
              notification_sent_at = NOW()
          WHERE conflict_id = $1
        `, [conflict.conflict_id]);
      }

      return {
        notified: conflicts.rows.length,
        recipients: conflicts.rows.map(c => ({
          email: c.email,
          name: c.display_name,
          bookingTitle: c.booking_title
        }))
      };
    } catch (error) {
      console.error('Notify impacted booking owners error:', error);
      throw error;
    }
  }
};

module.exports = conflictDetectionService;
