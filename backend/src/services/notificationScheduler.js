/**
 * Notification Scheduler Service
 * Schedules and sends automated email notifications
 */

const cron = require('node-cron');
const db = require('../config/database');
const emailService = require('./emailService');
const { emailConfig } = require('../config/email');

/**
 * Send booking reminders (24 hours before start)
 */
async function sendBookingReminders() {
  if (!emailConfig.enabled) return;
  
  try {
    // Find bookings starting in 24 hours that haven't been reminded
    const query = `
      SELECT 
        eb.booking_id, eb.title, eb.start_datetime, eb.end_datetime,
        e.name as environment_name,
        u.user_id, u.email, u.display_name,
        COALESCE(u.preferences->>'notifications', '{}')::json as notification_prefs
      FROM environment_bookings eb
      JOIN users u ON eb.requested_by_user_id = u.user_id
      LEFT JOIN booking_resources br ON eb.booking_id = br.booking_id AND br.resource_type = 'Environment'
      LEFT JOIN environments e ON br.resource_ref_id = e.environment_id
      WHERE eb.booking_status IN ('Approved', 'Active')
        AND eb.start_datetime BETWEEN NOW() + INTERVAL '23 hours' AND NOW() + INTERVAL '25 hours'
        AND eb.reminder_sent IS NOT TRUE
      GROUP BY eb.booking_id, e.name, u.user_id
    `;
    
    const result = await db.query(query);
    
    for (const booking of result.rows) {
      // Check user's notification preferences
      const prefs = booking.notification_prefs || {};
      if (prefs.bookingReminder === false) continue;
      
      try {
        await emailService.sendBookingReminderEmail(
          {
            title: booking.title,
            environment_name: booking.environment_name,
            start_datetime: booking.start_datetime,
            end_datetime: booking.end_datetime
          },
          {
            email: booking.email,
            display_name: booking.display_name
          }
        );
        
        // Mark as reminded
        await db.query(
          `UPDATE environment_bookings SET reminder_sent = TRUE WHERE booking_id = $1`,
          [booking.booking_id]
        );
        
        console.log(`[Scheduler] Sent reminder for booking ${booking.booking_id}`);
      } catch (err) {
        console.error(`[Scheduler] Failed to send reminder for booking ${booking.booking_id}:`, err.message);
      }
    }
    
    console.log(`[Scheduler] Processed ${result.rows.length} booking reminders`);
  } catch (error) {
    console.error('[Scheduler] Error sending booking reminders:', error);
  }
}

/**
 * Send expiring soon notifications (4 hours before end)
 */
async function sendExpiringNotifications() {
  if (!emailConfig.enabled) return;
  
  try {
    const query = `
      SELECT 
        eb.booking_id, eb.title, eb.end_datetime,
        e.name as environment_name,
        u.email, u.display_name,
        COALESCE(u.preferences->>'notifications', '{}')::json as notification_prefs
      FROM environment_bookings eb
      JOIN users u ON eb.requested_by_user_id = u.user_id
      LEFT JOIN booking_resources br ON eb.booking_id = br.booking_id AND br.resource_type = 'Environment'
      LEFT JOIN environments e ON br.resource_ref_id = e.environment_id
      WHERE eb.booking_status = 'Active'
        AND eb.end_datetime BETWEEN NOW() + INTERVAL '3 hours' AND NOW() + INTERVAL '5 hours'
        AND eb.expiring_notification_sent IS NOT TRUE
      GROUP BY eb.booking_id, e.name, u.user_id, u.email, u.display_name
    `;
    
    const result = await db.query(query);
    
    for (const booking of result.rows) {
      const prefs = booking.notification_prefs || {};
      if (prefs.bookingExpiring === false) continue;
      
      try {
        await emailService.sendBookingExpiringEmail(
          {
            title: booking.title,
            environment_name: booking.environment_name,
            end_datetime: booking.end_datetime
          },
          {
            email: booking.email,
            display_name: booking.display_name
          },
          4 // hours remaining
        );
        
        await db.query(
          `UPDATE environment_bookings SET expiring_notification_sent = TRUE WHERE booking_id = $1`,
          [booking.booking_id]
        );
        
        console.log(`[Scheduler] Sent expiring notification for booking ${booking.booking_id}`);
      } catch (err) {
        console.error(`[Scheduler] Failed to send expiring notification:`, err.message);
      }
    }
    
    console.log(`[Scheduler] Processed ${result.rows.length} expiring notifications`);
  } catch (error) {
    console.error('[Scheduler] Error sending expiring notifications:', error);
  }
}

/**
 * Start the notification scheduler
 */
function startScheduler() {
  if (!emailConfig.enabled) {
    console.log('[Scheduler] Email notifications disabled - scheduler not started');
    return;
  }
  
  // Run booking reminders every hour
  cron.schedule('0 * * * *', () => {
    console.log('[Scheduler] Running booking reminders check...');
    sendBookingReminders();
  });
  
  // Run expiring notifications every hour
  cron.schedule('30 * * * *', () => {
    console.log('[Scheduler] Running expiring notifications check...');
    sendExpiringNotifications();
  });
  
  console.log('[Scheduler] Notification scheduler started');
  
  // Run initial check after 1 minute
  setTimeout(() => {
    sendBookingReminders();
    sendExpiringNotifications();
  }, 60000);
}

module.exports = {
  startScheduler,
  sendBookingReminders,
  sendExpiringNotifications
};
