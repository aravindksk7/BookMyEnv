const db = require('../config/database');

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
        params.push(`%${search}%`);
        query += ` AND (eb.title ILIKE $${params.length} OR eb.description ILIKE $${params.length})`;
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

  // Create booking
  create: async (req, res) => {
    try {
      const { 
        booking_type, project_id, test_phase, title, description,
        start_datetime, end_datetime, owning_group_id, linked_release_id,
        resources, applications
      } = req.body;

      if (!test_phase || !start_datetime || !end_datetime) {
        return res.status(400).json({ error: 'Test phase, start and end datetime are required' });
      }

      // Check for conflicts
      const conflicts = await checkConflicts(resources, start_datetime, end_datetime);
      
      const conflict_status = conflicts.length > 0 ? 'PotentialConflict' : 'None';
      const booking_status = conflict_status === 'PotentialConflict' ? 'PendingApproval' : 'Requested';

      // Create booking
      const result = await db.query(
        `INSERT INTO environment_bookings 
         (booking_type, project_id, test_phase, title, description, start_datetime, end_datetime, 
          booking_status, conflict_status, requested_by_user_id, owning_group_id, linked_release_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [booking_type || 'SingleEnv', project_id, test_phase, title, description, 
         start_datetime, end_datetime, booking_status, conflict_status, 
         req.user.user_id, owning_group_id || req.user.default_group_id, linked_release_id]
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

      // Create notification for approvers if needed
      if (booking_status === 'PendingApproval') {
        await createApprovalNotifications(booking);
      }

      res.status(201).json({ ...booking, conflicts });
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
