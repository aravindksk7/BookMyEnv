const db = require('../config/database');
const conflictDetectionService = require('../services/conflictDetectionService');
const auditService = require('../services/auditService');

// UUID validation regex - allow any hex characters in version field
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Sanitize search input
const sanitizeSearch = (input) => {
  if (!input) return null;
  return String(input).substring(0, 100).replace(/[;'"\\]/g, '');
};

// Validate UUID format
const isValidUUID = (id) => {
  return id && UUID_REGEX.test(id);
};

const bookingController = {
  // Get all bookings
  getAll: async (req, res) => {
    try {
      const { booking_status, test_phase, start_date, end_date, search } = req.query;
      
      let query = `
        SELECT eb.*, 
               u.display_name as requested_by_name,
               u2.display_name as approved_by_name,
               ug.name as owning_group_name,
               COUNT(DISTINCT br.booking_resource_id) as resource_count
        FROM environment_bookings eb
        JOIN users u ON eb.requested_by_user_id = u.user_id
        LEFT JOIN users u2 ON eb.approved_by_user_id = u2.user_id
        LEFT JOIN user_groups ug ON eb.owning_group_id = ug.group_id
        LEFT JOIN booking_resources br ON eb.booking_id = br.booking_id
        WHERE 1=1
      `;
      const params = [];

      if (booking_status) {
        params.push(booking_status);
        query += ` AND eb.booking_status = $${params.length}`;
      }

      if (test_phase) {
        params.push(test_phase);
        query += ` AND eb.test_phase = $${params.length}`;
      }

      if (start_date) {
        params.push(start_date);
        query += ` AND eb.end_datetime >= $${params.length}`;
      }

      if (end_date) {
        params.push(end_date);
        query += ` AND eb.start_datetime <= $${params.length}`;
      }

      if (search) {
        const sanitizedSearch = sanitizeSearch(search);
        if (sanitizedSearch) {
          params.push(`%${sanitizedSearch}%`);
          query += ` AND (eb.title ILIKE $${params.length} OR eb.description ILIKE $${params.length})`;
        }
      }

      query += ' GROUP BY eb.booking_id, u.display_name, u2.display_name, ug.name ORDER BY eb.start_datetime DESC';

      const result = await db.query(query, params);
      res.json({ bookings: result.rows });
    } catch (error) {
      console.error('Get bookings error:', error);
      res.status(500).json({ error: 'Failed to fetch bookings' });
    }
  },

  // Get booking by ID
  getById: async (req, res) => {
    try {
      const { id } = req.params;

      // Validate UUID format
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: 'Invalid booking ID format' });
      }

      const result = await db.query(
        `SELECT eb.*, 
                u.display_name as requested_by_name,
                u2.display_name as approved_by_name,
                ug.name as owning_group_name,
                r.name as release_name
         FROM environment_bookings eb
         JOIN users u ON eb.requested_by_user_id = u.user_id
         LEFT JOIN users u2 ON eb.approved_by_user_id = u2.user_id
         LEFT JOIN user_groups ug ON eb.owning_group_id = ug.group_id
         LEFT JOIN releases r ON eb.linked_release_id = r.release_id
         WHERE eb.booking_id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      // Get resources
      const resources = await db.query(
        `SELECT br.*,
                CASE 
                  WHEN br.resource_type = 'EnvironmentInstance' THEN ei.name
                  WHEN br.resource_type = 'InfraComponent' THEN ic.name
                  WHEN br.resource_type = 'ComponentInstance' THEN ac.name
                END as resource_name,
                sei.name as source_instance_name
         FROM booking_resources br
         LEFT JOIN environment_instances ei ON br.resource_type = 'EnvironmentInstance' AND br.resource_ref_id = ei.env_instance_id
         LEFT JOIN infra_components ic ON br.resource_type = 'InfraComponent' AND br.resource_ref_id = ic.infra_id
         LEFT JOIN component_instances ci ON br.resource_type = 'ComponentInstance' AND br.resource_ref_id = ci.component_instance_id
         LEFT JOIN app_components ac ON ci.component_id = ac.component_id
         LEFT JOIN environment_instances sei ON br.source_env_instance_id = sei.env_instance_id
         WHERE br.booking_id = $1`,
        [id]
      );

      // Get linked applications
      const applications = await db.query(
        `SELECT a.*
         FROM applications a
         JOIN booking_applications ba ON a.application_id = ba.application_id
         WHERE ba.booking_id = $1`,
        [id]
      );

      res.json({
        ...result.rows[0],
        resources: resources.rows,
        applications: applications.rows
      });
    } catch (error) {
      console.error('Get booking error:', error);
      res.status(500).json({ error: 'Failed to fetch booking' });
    }
  },

  // Create booking (with refresh awareness)
  create: async (req, res) => {
    try {
      const { 
        booking_type, project_id, test_phase, title, description,
        start_datetime, end_datetime, owning_group_id, linked_release_id,
        resources, applications,
        is_critical_booking = false,
        booking_priority = 'Normal',
        acknowledgeRefreshConflicts = false // User acknowledges refresh conflicts
      } = req.body;

      if (!test_phase || !start_datetime || !end_datetime) {
        return res.status(400).json({ error: 'Test phase, start and end datetime are required' });
      }

      // Check for booking conflicts (existing bookings)
      const conflicts = await checkConflicts(resources, start_datetime, end_datetime);
      
      // NEW: Check for scheduled/approved refresh conflicts
      let refreshConflicts = { hasConflicts: false, refreshConflicts: [] };
      if (resources && resources.length > 0) {
        // Get environment instance IDs from resources
        const envInstanceIds = resources
          .filter(r => r.resource_type === 'EnvironmentInstance' || r.source_env_instance_id)
          .map(r => r.resource_type === 'EnvironmentInstance' ? r.resource_ref_id : r.source_env_instance_id)
          .filter(id => id);

        if (envInstanceIds.length > 0) {
          refreshConflicts = await conflictDetectionService.checkRefreshesForBooking({
            startDatetime: start_datetime,
            endDatetime: end_datetime,
            environmentInstanceIds: envInstanceIds
          });
        }
      }

      // Warn user about refresh conflicts if not acknowledged
      if (refreshConflicts.hasDestructiveRefresh && !acknowledgeRefreshConflicts) {
        return res.status(409).json({
          error: 'Booking overlaps with scheduled refresh',
          message: 'There are scheduled refreshes that may affect your booking. Please review and acknowledge.',
          refreshConflicts: refreshConflicts.refreshConflicts,
          warningLevel: refreshConflicts.warningLevel,
          suggestedAction: refreshConflicts.suggestedAction,
          requiresAcknowledgement: true
        });
      }
      
      const conflict_status = conflicts.length > 0 ? 'PotentialConflict' : 'None';
      const booking_status = conflict_status === 'PotentialConflict' ? 'PendingApproval' : 'Requested';

      // Create booking
      const result = await db.query(
        `INSERT INTO environment_bookings 
         (booking_type, project_id, test_phase, title, description, start_datetime, end_datetime, 
          booking_status, conflict_status, requested_by_user_id, owning_group_id, linked_release_id,
          is_critical_booking, booking_priority)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING *`,
        [booking_type || 'SingleEnv', project_id, test_phase, title, description, 
         start_datetime, end_datetime, booking_status, conflict_status, 
         req.user.user_id, owning_group_id || req.user.default_group_id, linked_release_id,
         is_critical_booking, booking_priority]
      );

      const booking = result.rows[0];

      // Add resources
      if (resources && resources.length > 0) {
        for (const resource of resources) {
          const resourceConflict = conflicts.find(c => 
            c.resource_type === resource.resource_type && 
            c.resource_ref_id === resource.resource_ref_id
          );

          await db.query(
            `INSERT INTO booking_resources 
             (booking_id, resource_type, resource_ref_id, source_env_instance_id, logical_role, 
              resource_conflict_status, conflicting_booking_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [booking.booking_id, resource.resource_type, resource.resource_ref_id, 
             resource.source_env_instance_id, resource.logical_role,
             resourceConflict ? 'PotentialConflict' : 'None',
             resourceConflict ? resourceConflict.conflicting_booking_id : null]
          );
        }
      }

      // Add applications
      if (applications && applications.length > 0) {
        for (const appId of applications) {
          await db.query(
            `INSERT INTO booking_applications (booking_id, application_id) VALUES ($1, $2)`,
            [booking.booking_id, appId]
          );
        }
      }

      // Log activity
      await db.query(
        `INSERT INTO activities (user_id, action, entity_type, entity_id, entity_name)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.user_id, 'CREATE', 'EnvironmentBooking', booking.booking_id, title]
      );

      // Audit log
      await auditService.logCreate(
        auditService.ENTITY_TYPES.BOOKING,
        booking.booking_id,
        title,
        booking,
        req
      );

      // Create notification for approvers if needed
      if (booking_status === 'PendingApproval') {
        await createApprovalNotifications(booking);
      }

      res.status(201).json({ 
        ...booking, 
        conflicts,
        refreshConflicts: refreshConflicts.refreshConflicts,
        hasRefreshConflicts: refreshConflicts.hasConflicts,
        refreshWarningLevel: refreshConflicts.warningLevel
      });
    } catch (error) {
      console.error('Create booking error:', error);
      res.status(500).json({ error: 'Failed to create booking' });
    }
  },

  // Update booking
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { title, description, start_datetime, end_datetime, test_phase } = req.body;

      // Check if booking can be modified
      const existing = await db.query(
        'SELECT * FROM environment_bookings WHERE booking_id = $1',
        [id]
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      if (['Completed', 'Cancelled'].includes(existing.rows[0].booking_status)) {
        return res.status(400).json({ error: 'Cannot modify completed or cancelled booking' });
      }

      const result = await db.query(
        `UPDATE environment_bookings 
         SET title = COALESCE($1, title),
             description = COALESCE($2, description),
             start_datetime = COALESCE($3, start_datetime),
             end_datetime = COALESCE($4, end_datetime),
             test_phase = COALESCE($5, test_phase),
             updated_at = NOW()
         WHERE booking_id = $6
         RETURNING *`,
        [title, description, start_datetime, end_datetime, test_phase, id]
      );

      // Audit log
      await auditService.logUpdate(
        auditService.ENTITY_TYPES.BOOKING,
        id,
        result.rows[0].title,
        existing.rows[0],
        result.rows[0],
        req
      );

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Update booking error:', error);
      res.status(500).json({ error: 'Failed to update booking' });
    }
  },

  // Update booking status
  updateStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { booking_status, conflict_notes } = req.body;

      const validStatuses = ['Requested', 'PendingApproval', 'Approved', 'Active', 'Completed', 'Cancelled'];
      if (!validStatuses.includes(booking_status)) {
        return res.status(400).json({ error: 'Invalid booking status' });
      }

      const updateFields = ['booking_status = $1', 'updated_at = NOW()'];
      const params = [booking_status];

      if (booking_status === 'Approved') {
        updateFields.push(`approved_by_user_id = $${params.length + 1}`);
        params.push(req.user.user_id);
      }

      if (conflict_notes) {
        updateFields.push(`conflict_notes = $${params.length + 1}`);
        params.push(conflict_notes);
      }

      params.push(id);

      const result = await db.query(
        `UPDATE environment_bookings 
         SET ${updateFields.join(', ')}
         WHERE booking_id = $${params.length}
         RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      const booking = result.rows[0];

      // Update resource statuses based on booking status
      if (booking_status === 'Approved') {
        await db.query(
          `UPDATE booking_resources SET resource_booking_status = 'Reserved' WHERE booking_id = $1`,
          [id]
        );
        await updateResourceBookingStatuses(id, 'Reserved');
      } else if (booking_status === 'Active') {
        await db.query(
          `UPDATE booking_resources SET resource_booking_status = 'Active' WHERE booking_id = $1`,
          [id]
        );
        await updateResourceBookingStatuses(id, 'InUse');
      } else if (['Completed', 'Cancelled'].includes(booking_status)) {
        await db.query(
          `UPDATE booking_resources SET resource_booking_status = 'Released' WHERE booking_id = $1`,
          [id]
        );
        await updateResourceBookingStatuses(id, 'Available');
      }

      // Create notification
      await db.query(
        `INSERT INTO notifications (user_id, title, message, type, related_entity_type, related_entity_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [booking.requested_by_user_id, `Booking ${booking_status}`, 
         `Your booking "${booking.title}" has been ${booking_status.toLowerCase()}`,
         booking_status === 'Approved' ? 'Success' : 'Info',
         'EnvironmentBooking', id]
      );

      // Log activity
      await db.query(
        `INSERT INTO activities (user_id, action, entity_type, entity_id, entity_name, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.user.user_id, 'STATUS_CHANGE', 'EnvironmentBooking', id, booking.title, 
         JSON.stringify({ new_status: booking_status })]
      );

      // Audit log for status change
      await auditService.logAction(
        booking_status === 'Approved' ? 'APPROVE' : 'UPDATE',
        auditService.ENTITY_TYPES.BOOKING,
        id,
        booking.title,
        req,
        { comment: `Status changed to ${booking_status}` }
      );

      res.json(booking);
    } catch (error) {
      console.error('Update booking status error:', error);
      res.status(500).json({ error: 'Failed to update booking status' });
    }
  },

  // Delete booking
  delete: async (req, res) => {
    try {
      const { id } = req.params;

      // Check if booking can be deleted
      const existing = await db.query(
        'SELECT * FROM environment_bookings WHERE booking_id = $1',
        [id]
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      if (existing.rows[0].booking_status === 'Active') {
        return res.status(400).json({ error: 'Cannot delete active booking. Cancel it first.' });
      }

      await db.query('DELETE FROM environment_bookings WHERE booking_id = $1', [id]);

      // Audit log
      await auditService.logDelete(
        auditService.ENTITY_TYPES.BOOKING,
        id,
        existing.rows[0].title,
        existing.rows[0],
        req
      );

      res.json({ message: 'Booking deleted successfully' });
    } catch (error) {
      console.error('Delete booking error:', error);
      res.status(500).json({ error: 'Failed to delete booking' });
    }
  },

  // Get my bookings
  getMyBookings: async (req, res) => {
    try {
      const result = await db.query(
        `SELECT eb.*, 
                COUNT(DISTINCT br.booking_resource_id) as resource_count
         FROM environment_bookings eb
         LEFT JOIN booking_resources br ON eb.booking_id = br.booking_id
         WHERE eb.requested_by_user_id = $1
         GROUP BY eb.booking_id
         ORDER BY eb.start_datetime DESC`,
        [req.user.user_id]
      );

      res.json({ bookings: result.rows });
    } catch (error) {
      console.error('Get my bookings error:', error);
      res.status(500).json({ error: 'Failed to fetch bookings' });
    }
  },

  // Get pending approvals
  getPendingApprovals: async (req, res) => {
    try {
      const result = await db.query(
        `SELECT eb.*, u.display_name as requested_by_name
         FROM environment_bookings eb
         JOIN users u ON eb.requested_by_user_id = u.user_id
         WHERE eb.booking_status = 'PendingApproval'
         ORDER BY eb.created_at ASC`
      );

      res.json({ bookings: result.rows });
    } catch (error) {
      console.error('Get pending approvals error:', error);
      res.status(500).json({ error: 'Failed to fetch pending approvals' });
    }
  },

  // Get calendar data
  getCalendar: async (req, res) => {
    try {
      const { start_date, end_date, env_instance_id } = req.query;

      const startDate = start_date || new Date().toISOString();
      const endDate = end_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      let query = `
        SELECT eb.booking_id, eb.title, eb.start_datetime, eb.end_datetime, 
               eb.booking_status, eb.test_phase, eb.booking_type,
               u.display_name as requested_by_name,
               json_agg(DISTINCT jsonb_build_object(
                 'resource_type', br.resource_type,
                 'resource_ref_id', br.resource_ref_id,
                 'source_env_instance_id', br.source_env_instance_id
               )) as resources
        FROM environment_bookings eb
        JOIN users u ON eb.requested_by_user_id = u.user_id
        LEFT JOIN booking_resources br ON eb.booking_id = br.booking_id
        WHERE eb.booking_status NOT IN ('Cancelled', 'Completed')
          AND eb.start_datetime < $2
          AND eb.end_datetime > $1
      `;
      const params = [startDate, endDate];

      if (env_instance_id) {
        params.push(env_instance_id);
        query += ` AND (br.source_env_instance_id = $${params.length} OR (br.resource_type = 'EnvironmentInstance' AND br.resource_ref_id = $${params.length}))`;
      }

      query += ' GROUP BY eb.booking_id, u.display_name ORDER BY eb.start_datetime';

      const result = await db.query(query, params);
      res.json({ events: result.rows });
    } catch (error) {
      console.error('Get calendar error:', error);
      res.status(500).json({ error: 'Failed to fetch calendar data' });
    }
  },

  // Check conflicts
  checkConflicts: async (req, res) => {
    try {
      const { resources, start_datetime, end_datetime, exclude_booking_id } = req.body;

      const conflicts = await checkConflicts(resources, start_datetime, end_datetime, exclude_booking_id);
      res.json({ conflicts, has_conflicts: conflicts.length > 0 });
    } catch (error) {
      console.error('Check conflicts error:', error);
      res.status(500).json({ error: 'Failed to check conflicts' });
    }
  },

  // Add resource to booking
  addResource: async (req, res) => {
    try {
      const { id } = req.params;
      const { resource_type, resource_ref_id, source_env_instance_id, logical_role } = req.body;

      const result = await db.query(
        `INSERT INTO booking_resources (booking_id, resource_type, resource_ref_id, source_env_instance_id, logical_role)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [id, resource_type, resource_ref_id, source_env_instance_id, logical_role]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Add resource error:', error);
      res.status(500).json({ error: 'Failed to add resource' });
    }
  },

  // Remove resource from booking
  removeResource: async (req, res) => {
    try {
      const { id, resourceId } = req.params;

      await db.query(
        'DELETE FROM booking_resources WHERE booking_id = $1 AND booking_resource_id = $2',
        [id, resourceId]
      );

      res.json({ message: 'Resource removed successfully' });
    } catch (error) {
      console.error('Remove resource error:', error);
      res.status(500).json({ error: 'Failed to remove resource' });
    }
  },

  // Get statistics
  getStatistics: async (req, res) => {
    try {
      const stats = await db.query(`
        SELECT 
          (SELECT COUNT(*) FROM environment_bookings WHERE booking_status = 'Active') as active_bookings,
          (SELECT COUNT(*) FROM environment_bookings WHERE booking_status = 'PendingApproval') as pending_approvals,
          (SELECT COUNT(*) FROM environment_bookings WHERE booking_status = 'Approved' AND start_datetime > NOW()) as upcoming_bookings,
          (SELECT COUNT(*) FROM environment_bookings WHERE conflict_status != 'None') as bookings_with_conflicts,
          (SELECT COUNT(*) FROM environment_bookings WHERE created_at > NOW() - INTERVAL '7 days') as bookings_last_week
      `);

      res.json(stats.rows[0]);
    } catch (error) {
      console.error('Get statistics error:', error);
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  },

  // Get related applications for a booking
  getRelatedApplications: async (req, res) => {
    try {
      const { id } = req.params;

      // Get directly linked applications via booking_applications
      const directApps = await db.query(
        `SELECT DISTINCT a.*
         FROM applications a
         JOIN booking_applications ba ON a.application_id = ba.application_id
         WHERE ba.booking_id = $1`,
        [id]
      );

      // Also get applications linked via environment instances in booking resources
      const instanceApps = await db.query(
        `SELECT DISTINCT a.*
         FROM applications a
         JOIN application_environment_instances aei ON a.application_id = aei.application_id
         JOIN booking_resources br ON aei.env_instance_id = br.resource_ref_id OR aei.env_instance_id = br.source_env_instance_id
         WHERE br.booking_id = $1 AND br.resource_type = 'EnvironmentInstance'`,
        [id]
      );

      // Combine and deduplicate
      const allApps = [...directApps.rows];
      instanceApps.rows.forEach(app => {
        if (!allApps.find(a => a.application_id === app.application_id)) {
          allApps.push(app);
        }
      });

      res.json({ applications: allApps });
    } catch (error) {
      console.error('Get related applications error:', error);
      res.status(500).json({ error: 'Failed to fetch related applications' });
    }
  },

  // Get related interfaces for a booking
  getRelatedInterfaces: async (req, res) => {
    try {
      const { id } = req.params;

      // Get interfaces linked to applications in this booking (via source or target app)
      // or via interface endpoints on environment instances in the booking
      const result = await db.query(
        `SELECT DISTINCT i.*, 
                sa.name as source_application_name, 
                ta.name as target_application_name
         FROM interfaces i
         LEFT JOIN applications sa ON i.source_application_id = sa.application_id
         LEFT JOIN applications ta ON i.target_application_id = ta.application_id
         WHERE 
           -- Linked via source or target application in booking
           i.source_application_id IN (
             SELECT a.application_id FROM applications a
             JOIN booking_applications ba ON a.application_id = ba.application_id
             WHERE ba.booking_id = $1
           )
           OR i.target_application_id IN (
             SELECT a.application_id FROM applications a
             JOIN booking_applications ba ON a.application_id = ba.application_id
             WHERE ba.booking_id = $1
           )
           -- Or via interface endpoints on environment instances in this booking
           OR i.interface_id IN (
             SELECT ie.interface_id FROM interface_endpoints ie
             JOIN booking_resources br ON ie.env_instance_id = br.resource_ref_id 
                                       OR ie.env_instance_id = br.source_env_instance_id
             WHERE br.booking_id = $1 AND br.resource_type = 'EnvironmentInstance'
           )
         ORDER BY i.name`,
        [id]
      );

      res.json({ interfaces: result.rows });
    } catch (error) {
      console.error('Get related interfaces error:', error);
      res.status(500).json({ error: 'Failed to fetch related interfaces' });
    }
  },

  // Get related instances for a booking
  getRelatedInstances: async (req, res) => {
    try {
      const { id } = req.params;

      const result = await db.query(
        `SELECT DISTINCT ei.*, e.name as environment_name, e.environment_category,
                br.logical_role, br.resource_booking_status
         FROM environment_instances ei
         JOIN environments e ON ei.environment_id = e.environment_id
         JOIN booking_resources br ON (ei.env_instance_id = br.resource_ref_id OR ei.env_instance_id = br.source_env_instance_id)
         WHERE br.booking_id = $1 AND br.resource_type = 'EnvironmentInstance'
         ORDER BY e.name, ei.name`,
        [id]
      );

      res.json({ instances: result.rows });
    } catch (error) {
      console.error('Get related instances error:', error);
      res.status(500).json({ error: 'Failed to fetch related instances' });
    }
  },

  // Link an application to a booking
  addApplication: async (req, res) => {
    try {
      const { id } = req.params;
      const { application_id } = req.body;

      await db.query(
        `INSERT INTO booking_applications (booking_id, application_id) VALUES ($1, $2)
         ON CONFLICT (booking_id, application_id) DO NOTHING`,
        [id, application_id]
      );

      res.status(201).json({ message: 'Application linked to booking' });
    } catch (error) {
      console.error('Add application error:', error);
      res.status(500).json({ error: 'Failed to add application' });
    }
  },

  // Remove application from booking
  removeApplication: async (req, res) => {
    try {
      const { id, applicationId } = req.params;

      await db.query(
        'DELETE FROM booking_applications WHERE booking_id = $1 AND application_id = $2',
        [id, applicationId]
      );

      res.json({ message: 'Application removed from booking' });
    } catch (error) {
      console.error('Remove application error:', error);
      res.status(500).json({ error: 'Failed to remove application' });
    }
  },

  // Get conflicts for a booking
  getConflicts: async (req, res) => {
    try {
      const { id } = req.params;

      // Validate UUID format
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: 'Invalid booking ID format' });
      }

      // Get booking details
      const bookingResult = await db.query(
        `SELECT eb.*, u.display_name as requested_by_name
         FROM environment_bookings eb
         JOIN users u ON eb.requested_by_user_id = u.user_id
         WHERE eb.booking_id = $1`,
        [id]
      );

      if (bookingResult.rows.length === 0) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      const booking = bookingResult.rows[0];

      // Get all resource conflicts for this booking
      const conflictsResult = await db.query(
        `SELECT br.booking_resource_id, br.resource_type, br.resource_ref_id, 
                br.logical_role, br.resource_conflict_status, br.conflicting_booking_id,
                CASE 
                  WHEN br.resource_type = 'EnvironmentInstance' THEN ei.name
                  WHEN br.resource_type = 'InfraComponent' THEN ic.name
                END as resource_name,
                e.name as environment_name,
                cb.title as conflicting_booking_title,
                cb.start_datetime as conflicting_start,
                cb.end_datetime as conflicting_end,
                cb.booking_status as conflicting_booking_status,
                cu.display_name as conflicting_requested_by
         FROM booking_resources br
         LEFT JOIN environment_instances ei ON br.resource_type = 'EnvironmentInstance' AND br.resource_ref_id = ei.env_instance_id
         LEFT JOIN environments e ON ei.environment_id = e.environment_id
         LEFT JOIN infra_components ic ON br.resource_type = 'InfraComponent' AND br.resource_ref_id = ic.infra_id
         LEFT JOIN environment_bookings cb ON br.conflicting_booking_id = cb.booking_id
         LEFT JOIN users cu ON cb.requested_by_user_id = cu.user_id
         WHERE br.booking_id = $1 AND br.resource_conflict_status != 'None'
         ORDER BY br.resource_type, resource_name`,
        [id]
      );

      // Also find all overlapping bookings for resources in this booking
      const overlappingResult = await db.query(
        `SELECT DISTINCT ob.booking_id, ob.title, ob.start_datetime, ob.end_datetime, 
                ob.booking_status, ob.test_phase, ob.conflict_status,
                ou.display_name as requested_by_name,
                br2.resource_type, br2.resource_ref_id,
                CASE 
                  WHEN br2.resource_type = 'EnvironmentInstance' THEN ei.name
                  WHEN br2.resource_type = 'InfraComponent' THEN ic.name
                END as resource_name
         FROM environment_bookings ob
         JOIN booking_resources br2 ON ob.booking_id = br2.booking_id
         JOIN booking_resources br ON br.resource_ref_id = br2.resource_ref_id AND br.resource_type = br2.resource_type
         LEFT JOIN environment_instances ei ON br2.resource_type = 'EnvironmentInstance' AND br2.resource_ref_id = ei.env_instance_id
         LEFT JOIN infra_components ic ON br2.resource_type = 'InfraComponent' AND br2.resource_ref_id = ic.infra_id
         JOIN users ou ON ob.requested_by_user_id = ou.user_id
         WHERE br.booking_id = $1 
           AND ob.booking_id != $1
           AND ob.booking_status NOT IN ('Cancelled', 'Completed')
           AND ob.start_datetime < $2
           AND ob.end_datetime > $3
         ORDER BY ob.start_datetime`,
        [id, booking.end_datetime, booking.start_datetime]
      );

      res.json({
        booking: {
          booking_id: booking.booking_id,
          title: booking.title,
          start_datetime: booking.start_datetime,
          end_datetime: booking.end_datetime,
          conflict_status: booking.conflict_status,
          conflict_notes: booking.conflict_notes,
          requested_by_name: booking.requested_by_name
        },
        resource_conflicts: conflictsResult.rows,
        overlapping_bookings: overlappingResult.rows
      });
    } catch (error) {
      console.error('Get conflicts error:', error);
      res.status(500).json({ error: 'Failed to fetch conflicts' });
    }
  },

  // Resolve conflict for a booking
  resolveConflict: async (req, res) => {
    try {
      const { id } = req.params;
      const { resolution_type, conflict_notes, resource_changes } = req.body;

      // Validate UUID format
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: 'Invalid booking ID format' });
      }

      // Valid resolution types
      const validResolutions = ['AcceptOverlap', 'RemoveResource', 'AdjustTiming', 'RejectBooking', 'MarkResolved'];
      if (!validResolutions.includes(resolution_type)) {
        return res.status(400).json({ error: 'Invalid resolution type. Must be one of: ' + validResolutions.join(', ') });
      }

      // Get booking
      const bookingResult = await db.query(
        'SELECT * FROM environment_bookings WHERE booking_id = $1',
        [id]
      );

      if (bookingResult.rows.length === 0) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      const booking = bookingResult.rows[0];

      // Handle different resolution types
      switch (resolution_type) {
        case 'AcceptOverlap':
          // Mark conflict as resolved but keep the booking as-is
          await db.query(
            `UPDATE environment_bookings 
             SET conflict_status = 'Resolved', 
                 conflict_notes = $1,
                 updated_at = NOW()
             WHERE booking_id = $2`,
            [conflict_notes || 'Overlap accepted by manager', id]
          );
          await db.query(
            `UPDATE booking_resources 
             SET resource_conflict_status = 'Resolved'
             WHERE booking_id = $1 AND resource_conflict_status = 'PotentialConflict'`,
            [id]
          );
          break;

        case 'RemoveResource':
          // Remove specific conflicting resources
          if (resource_changes && resource_changes.remove) {
            for (const resourceId of resource_changes.remove) {
              await db.query(
                'DELETE FROM booking_resources WHERE booking_id = $1 AND booking_resource_id = $2',
                [id, resourceId]
              );
            }
          }
          // Recheck if conflicts remain
          const remainingConflicts = await db.query(
            `SELECT COUNT(*) FROM booking_resources 
             WHERE booking_id = $1 AND resource_conflict_status != 'None'`,
            [id]
          );
          if (parseInt(remainingConflicts.rows[0].count) === 0) {
            await db.query(
              `UPDATE environment_bookings 
               SET conflict_status = 'None', 
                   conflict_notes = $1,
                   updated_at = NOW()
               WHERE booking_id = $2`,
              [conflict_notes || 'Conflicting resources removed', id]
            );
          }
          break;

        case 'AdjustTiming':
          // Update booking times (provided in resource_changes.new_times)
          if (resource_changes && resource_changes.new_times) {
            await db.query(
              `UPDATE environment_bookings 
               SET start_datetime = $1, 
                   end_datetime = $2,
                   conflict_notes = $3,
                   updated_at = NOW()
               WHERE booking_id = $4`,
              [resource_changes.new_times.start, resource_changes.new_times.end, 
               conflict_notes || 'Timing adjusted to resolve conflict', id]
            );
            // Recheck conflicts with new timing
            const resources = await db.query(
              'SELECT resource_type, resource_ref_id FROM booking_resources WHERE booking_id = $1',
              [id]
            );
            const newConflicts = await checkConflicts(
              resources.rows, 
              resource_changes.new_times.start, 
              resource_changes.new_times.end, 
              id
            );
            if (newConflicts.length === 0) {
              await db.query(
                `UPDATE environment_bookings SET conflict_status = 'None' WHERE booking_id = $1`,
                [id]
              );
              await db.query(
                `UPDATE booking_resources SET resource_conflict_status = 'None', conflicting_booking_id = NULL WHERE booking_id = $1`,
                [id]
              );
            }
          }
          break;

        case 'RejectBooking':
          // Cancel the booking due to unresolvable conflict
          await db.query(
            `UPDATE environment_bookings 
             SET booking_status = 'Cancelled', 
                 conflict_status = 'ConflictConfirmed',
                 conflict_notes = $1,
                 updated_at = NOW()
             WHERE booking_id = $2`,
            [conflict_notes || 'Booking cancelled due to unresolvable conflict', id]
          );
          // Notify the requester
          await db.query(
            `INSERT INTO notifications (user_id, title, message, type, related_entity_type, related_entity_id)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [booking.requested_by_user_id, 'Booking Rejected', 
             `Your booking "${booking.title}" was rejected due to conflicts. ${conflict_notes || ''}`,
             'Warning', 'EnvironmentBooking', id]
          );
          break;

        case 'MarkResolved':
          // Simply mark the conflict as resolved without changes
          await db.query(
            `UPDATE environment_bookings 
             SET conflict_status = 'Resolved', 
                 conflict_notes = $1,
                 booking_status = CASE WHEN booking_status = 'PendingApproval' THEN 'Requested' ELSE booking_status END,
                 updated_at = NOW()
             WHERE booking_id = $2`,
            [conflict_notes || 'Conflict marked as resolved', id]
          );
          await db.query(
            `UPDATE booking_resources 
             SET resource_conflict_status = 'Resolved'
             WHERE booking_id = $1`,
            [id]
          );
          break;
      }

      // Log activity
      await db.query(
        `INSERT INTO activities (user_id, action, entity_type, entity_id, entity_name, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.user.user_id, 'CONFLICT_RESOLVED', 'EnvironmentBooking', id, booking.title,
         JSON.stringify({ resolution_type, conflict_notes })]
      );

      // Get updated booking
      const updatedBooking = await db.query(
        'SELECT * FROM environment_bookings WHERE booking_id = $1',
        [id]
      );

      res.json({
        message: 'Conflict resolution applied',
        resolution_type,
        booking: updatedBooking.rows[0]
      });
    } catch (error) {
      console.error('Resolve conflict error:', error);
      res.status(500).json({ error: 'Failed to resolve conflict' });
    }
  },

  // Get all bookings with conflicts
  getConflictingBookings: async (req, res) => {
    try {
      const result = await db.query(
        `SELECT eb.*, 
                u.display_name as requested_by_name,
                ug.name as owning_group_name,
                COUNT(DISTINCT br.booking_resource_id) as resource_count,
                COUNT(DISTINCT CASE WHEN br.resource_conflict_status != 'None' THEN br.booking_resource_id END) as conflicting_resources_count
         FROM environment_bookings eb
         JOIN users u ON eb.requested_by_user_id = u.user_id
         LEFT JOIN user_groups ug ON eb.owning_group_id = ug.group_id
         LEFT JOIN booking_resources br ON eb.booking_id = br.booking_id
         WHERE eb.conflict_status IN ('PotentialConflict', 'ConflictConfirmed')
           AND eb.booking_status NOT IN ('Cancelled', 'Completed')
         GROUP BY eb.booking_id, u.display_name, ug.name
         ORDER BY eb.start_datetime`,
      );

      res.json({ bookings: result.rows });
    } catch (error) {
      console.error('Get conflicting bookings error:', error);
      res.status(500).json({ error: 'Failed to fetch conflicting bookings' });
    }
  },

  // =====================================================
  // REFRESH AWARENESS ENDPOINTS (v4.1)
  // =====================================================

  /**
   * Check for scheduled refreshes that overlap with a proposed booking window
   * This allows the UI to warn users before they create a booking
   */
  checkRefreshConflicts: async (req, res) => {
    try {
      const { startDatetime, endDatetime, environmentInstanceIds } = req.body;

      if (!startDatetime || !endDatetime) {
        return res.status(400).json({ error: 'Start and end datetime are required' });
      }

      if (!environmentInstanceIds || !Array.isArray(environmentInstanceIds) || environmentInstanceIds.length === 0) {
        return res.status(400).json({ error: 'At least one environment instance ID is required' });
      }

      const result = await conflictDetectionService.checkRefreshesForBooking({
        startDatetime,
        endDatetime,
        environmentInstanceIds
      });

      res.json({
        ...result,
        message: result.hasConflicts 
          ? `Found ${result.refreshConflicts.length} scheduled refresh(es) that may affect your booking`
          : 'No refresh conflicts detected'
      });
    } catch (error) {
      console.error('Check refresh conflicts for booking error:', error);
      res.status(500).json({ error: 'Failed to check refresh conflicts' });
    }
  },

  /**
   * Get upcoming refreshes that may affect a specific booking
   */
  getRefreshesForBooking: async (req, res) => {
    try {
      const { id } = req.params;

      if (!isValidUUID(id)) {
        return res.status(400).json({ error: 'Invalid booking ID format' });
      }

      // Get the booking details
      const bookingResult = await db.query(
        'SELECT * FROM environment_bookings WHERE booking_id = $1',
        [id]
      );

      if (bookingResult.rows.length === 0) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      const booking = bookingResult.rows[0];

      // Get environment instances for this booking
      const resourcesResult = await db.query(
        `SELECT DISTINCT COALESCE(br.source_env_instance_id, br.resource_ref_id) as env_instance_id
         FROM booking_resources br
         WHERE br.booking_id = $1 
         AND (br.resource_type = 'EnvironmentInstance' OR br.source_env_instance_id IS NOT NULL)`,
        [id]
      );

      const envInstanceIds = resourcesResult.rows
        .map(r => r.env_instance_id)
        .filter(id => id);

      if (envInstanceIds.length === 0) {
        return res.json({ 
          refreshes: [],
          hasConflicts: false,
          message: 'No environment instances found for this booking'
        });
      }

      // Check for refresh conflicts
      const result = await conflictDetectionService.checkRefreshesForBooking({
        startDatetime: booking.start_datetime,
        endDatetime: booking.end_datetime,
        environmentInstanceIds: envInstanceIds
      });

      res.json({
        bookingId: id,
        bookingStart: booking.start_datetime,
        bookingEnd: booking.end_datetime,
        ...result
      });
    } catch (error) {
      console.error('Get refreshes for booking error:', error);
      res.status(500).json({ error: 'Failed to fetch refreshes for booking' });
    }
  }
};

// Helper function to check conflicts
async function checkConflicts(resources, start_datetime, end_datetime, exclude_booking_id = null) {
  if (!resources || resources.length === 0) return [];

  const conflicts = [];

  for (const resource of resources) {
    let query = `
      SELECT eb.booking_id, eb.title, eb.start_datetime, eb.end_datetime, eb.booking_status
      FROM environment_bookings eb
      JOIN booking_resources br ON eb.booking_id = br.booking_id
      WHERE br.resource_type = $1 
        AND br.resource_ref_id = $2
        AND eb.booking_status NOT IN ('Cancelled', 'Completed')
        AND eb.start_datetime < $4
        AND eb.end_datetime > $3
    `;
    const params = [resource.resource_type, resource.resource_ref_id, start_datetime, end_datetime];

    if (exclude_booking_id) {
      params.push(exclude_booking_id);
      query += ` AND eb.booking_id != $${params.length}`;
    }

    const result = await db.query(query, params);

    for (const row of result.rows) {
      conflicts.push({
        resource_type: resource.resource_type,
        resource_ref_id: resource.resource_ref_id,
        conflicting_booking_id: row.booking_id,
        conflicting_booking_title: row.title,
        conflicting_start: row.start_datetime,
        conflicting_end: row.end_datetime
      });
    }
  }

  return conflicts;
}

// Helper function to update resource booking statuses
async function updateResourceBookingStatuses(bookingId, status) {
  const resources = await db.query(
    'SELECT resource_type, resource_ref_id FROM booking_resources WHERE booking_id = $1',
    [bookingId]
  );

  for (const resource of resources.rows) {
    if (resource.resource_type === 'InfraComponent') {
      await db.query(
        `UPDATE infra_components 
         SET booking_status = $1, 
             current_booking_id = $2,
             updated_at = NOW()
         WHERE infra_id = $3`,
        [status, status === 'Available' ? null : bookingId, resource.resource_ref_id]
      );
    }
  }

  // Update environment instance booking status
  await db.query(`
    UPDATE environment_instances ei
    SET booking_status = CASE 
      WHEN (SELECT COUNT(*) FROM infra_components ic WHERE ic.env_instance_id = ei.env_instance_id AND ic.booking_status = 'InUse') = 
           (SELECT COUNT(*) FROM infra_components ic WHERE ic.env_instance_id = ei.env_instance_id) 
      THEN 'FullyBooked'
      WHEN EXISTS (SELECT 1 FROM infra_components ic WHERE ic.env_instance_id = ei.env_instance_id AND ic.booking_status IN ('InUse', 'Reserved'))
      THEN 'PartiallyBooked'
      ELSE 'Available'
    END,
    updated_at = NOW()
  `);
}

// Helper function to create approval notifications
async function createApprovalNotifications(booking) {
  // Get environment managers
  const managers = await db.query(
    `SELECT user_id FROM users WHERE role IN ('Admin', 'EnvironmentManager') AND is_active = true`
  );

  for (const manager of managers.rows) {
    await db.query(
      `INSERT INTO notifications (user_id, title, message, type, related_entity_type, related_entity_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [manager.user_id, 'Booking Approval Required', 
       `A new booking "${booking.title}" requires your approval`,
       'ApprovalRequired', 'EnvironmentBooking', booking.booking_id]
    );
  }
}

module.exports = bookingController;
