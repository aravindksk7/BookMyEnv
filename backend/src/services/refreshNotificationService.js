/**
 * Refresh Notification Service
 * Handles sending notifications for refresh lifecycle events
 */

const db = require('../config/database');

// Notification event types
const NOTIFICATION_EVENTS = {
  REFRESH_REQUESTED: 'REFRESH_REQUESTED',
  REFRESH_APPROVED: 'REFRESH_APPROVED',
  REFRESH_REJECTED: 'REFRESH_REJECTED',
  REFRESH_SCHEDULED: 'REFRESH_SCHEDULED',
  REFRESH_REMINDER_7DAY: 'REFRESH_REMINDER_7DAY',
  REFRESH_REMINDER_1DAY: 'REFRESH_REMINDER_1DAY',
  REFRESH_REMINDER_1HR: 'REFRESH_REMINDER_1HR',
  REFRESH_STARTING: 'REFRESH_STARTING',
  REFRESH_COMPLETED: 'REFRESH_COMPLETED',
  REFRESH_FAILED: 'REFRESH_FAILED',
  CONFLICT_DETECTED: 'CONFLICT_DETECTED',
  CONFLICT_RESOLVED: 'CONFLICT_RESOLVED'
};

// Notification channels
const CHANNELS = {
  EMAIL: 'EMAIL',
  TEAMS: 'TEAMS',
  SLACK: 'SLACK',
  IN_APP: 'IN_APP',
  WEBHOOK: 'WEBHOOK'
};

const refreshNotificationService = {
  /**
   * Send notifications for a refresh event
   * @param {string} intentId - The refresh intent ID
   * @param {string} eventType - Type of event from NOTIFICATION_EVENTS
   * @param {object} additionalData - Extra data for the notification
   */
  sendNotifications: async (intentId, eventType, additionalData = {}) => {
    try {
      // Get intent details
      const intentResult = await db.query(
        `SELECT ri.*, u.username as requested_by_username, u.email as requested_by_email
         FROM refresh_intents ri
         LEFT JOIN users u ON ri.requested_by_user_id = u.user_id
         WHERE ri.refresh_intent_id = $1`,
        [intentId]
      );

      if (intentResult.rows.length === 0) {
        console.error(`Notification: Intent not found - ${intentId}`);
        return;
      }

      const intent = intentResult.rows[0];

      // Get notification settings for this entity and groups
      const settings = await refreshNotificationService.getNotificationSettings(
        intent.entity_type, 
        intent.entity_id, 
        intent.notification_groups
      );

      // Build notification content
      const content = refreshNotificationService.buildNotificationContent(intent, eventType, additionalData);

      // Send via each enabled channel
      for (const setting of settings) {
        if (setting.email_enabled && setting.subscribed_events?.includes(eventType)) {
          await refreshNotificationService.sendEmail(intent, eventType, content, setting);
        }
        if (setting.teams_webhook_url && setting.subscribed_events?.includes(eventType)) {
          await refreshNotificationService.sendTeams(intent, eventType, content, setting);
        }
        if (setting.slack_webhook_url && setting.subscribed_events?.includes(eventType)) {
          await refreshNotificationService.sendSlack(intent, eventType, content, setting);
        }
        if (setting.in_app_enabled && setting.subscribed_events?.includes(eventType)) {
          await refreshNotificationService.sendInApp(intent, eventType, content, setting);
        }
        if (setting.custom_webhook_url && setting.subscribed_events?.includes(eventType)) {
          await refreshNotificationService.sendWebhook(intent, eventType, content, setting);
        }
      }

      // Always notify the requester for important events
      const requesterEvents = ['REFRESH_APPROVED', 'REFRESH_REJECTED', 'REFRESH_COMPLETED', 'REFRESH_FAILED'];
      if (requesterEvents.includes(eventType) && intent.requested_by_email) {
        await refreshNotificationService.notifyRequester(intent, eventType, content);
      }

    } catch (error) {
      console.error('Send notifications error:', error);
    }
  },

  /**
   * Get notification settings for an entity and groups
   */
  getNotificationSettings: async (entityType, entityId, notificationGroups) => {
    try {
      const settings = [];

      // Get entity-specific settings
      const entitySettings = await db.query(
        `SELECT * FROM refresh_notification_settings 
         WHERE scope_type = 'Entity' 
         AND entity_type = $1 
         AND entity_id = $2`,
        [entityType, entityId]
      );
      settings.push(...entitySettings.rows);

      // Get group settings
      if (notificationGroups && notificationGroups.length > 0) {
        const groupSettings = await db.query(
          `SELECT rns.*, ug.name as group_name
           FROM refresh_notification_settings rns
           LEFT JOIN user_groups ug ON rns.group_id = ug.group_id
           WHERE rns.scope_type = 'Group' 
           AND rns.group_id = ANY($1::uuid[])`,
          [notificationGroups]
        );
        settings.push(...groupSettings.rows);
      }

      // Get global settings as fallback
      const globalSettings = await db.query(
        `SELECT * FROM refresh_notification_settings 
         WHERE scope_type = 'Global'`
      );
      settings.push(...globalSettings.rows);

      return settings.length > 0 ? settings : [{ 
        in_app_enabled: true, 
        subscribed_events: Object.values(NOTIFICATION_EVENTS) 
      }];
    } catch (error) {
      console.error('Get notification settings error:', error);
      return [];
    }
  },

  /**
   * Build notification content
   */
  buildNotificationContent: (intent, eventType, additionalData) => {
    const entityLabel = `${intent.entity_type}: ${intent.entity_name || intent.entity_id}`;
    const plannedDate = new Date(intent.planned_date).toLocaleString();
    
    const templates = {
      REFRESH_REQUESTED: {
        subject: `[Refresh Request] ${entityLabel} - Approval Required`,
        body: `A refresh has been requested for ${entityLabel}.\n\n` +
              `Type: ${intent.refresh_type}\n` +
              `Planned Date: ${plannedDate}\n` +
              `Source: ${intent.source_environment_name || 'N/A'}\n` +
              `Reason: ${intent.reason}\n\n` +
              `Requested by: ${intent.requested_by_username || 'Unknown'}`
      },
      REFRESH_APPROVED: {
        subject: `[Refresh Approved] ${entityLabel}`,
        body: `The refresh request for ${entityLabel} has been approved.\n\n` +
              `Type: ${intent.refresh_type}\n` +
              `Planned Date: ${plannedDate}\n` +
              `Approval Notes: ${additionalData.approvalNotes || 'None'}`
      },
      REFRESH_REJECTED: {
        subject: `[Refresh Rejected] ${entityLabel}`,
        body: `The refresh request for ${entityLabel} has been rejected.\n\n` +
              `Reason: ${additionalData.rejectionReason || 'Not specified'}`
      },
      REFRESH_SCHEDULED: {
        subject: `[Refresh Scheduled] ${entityLabel}`,
        body: `A refresh has been scheduled for ${entityLabel}.\n\n` +
              `Type: ${intent.refresh_type}\n` +
              `Scheduled Date: ${plannedDate}\n` +
              `Source: ${intent.source_environment_name || 'N/A'}\n` +
              `Downtime Expected: ${intent.requires_downtime ? `Yes (${intent.estimated_downtime_minutes} min)` : 'No'}`
      },
      REFRESH_REMINDER_7DAY: {
        subject: `[Reminder] Refresh in 7 days - ${entityLabel}`,
        body: `Reminder: A refresh is scheduled in 7 days for ${entityLabel}.\n\n` +
              `Scheduled Date: ${plannedDate}\n` +
              `Type: ${intent.refresh_type}`
      },
      REFRESH_REMINDER_1DAY: {
        subject: `[Reminder] Refresh Tomorrow - ${entityLabel}`,
        body: `Reminder: A refresh is scheduled for tomorrow for ${entityLabel}.\n\n` +
              `Scheduled Date: ${plannedDate}\n` +
              `Type: ${intent.refresh_type}\n` +
              `Downtime Expected: ${intent.requires_downtime ? `Yes (${intent.estimated_downtime_minutes} min)` : 'No'}`
      },
      REFRESH_REMINDER_1HR: {
        subject: `[URGENT] Refresh in 1 hour - ${entityLabel}`,
        body: `URGENT: A refresh will begin in approximately 1 hour for ${entityLabel}.\n\n` +
              `Scheduled Date: ${plannedDate}\n` +
              `Type: ${intent.refresh_type}`
      },
      REFRESH_STARTING: {
        subject: `[Starting] Refresh Beginning - ${entityLabel}`,
        body: `The refresh for ${entityLabel} is now starting.\n\n` +
              `Type: ${intent.refresh_type}\n` +
              `Source: ${intent.source_environment_name || 'N/A'}`
      },
      REFRESH_COMPLETED: {
        subject: `[Completed] Refresh Successful - ${entityLabel}`,
        body: `The refresh for ${entityLabel} has completed successfully.\n\n` +
              `Duration: ${additionalData.durationMinutes || 'N/A'} minutes\n` +
              `Data Volume: ${additionalData.dataVolumeGb || 'N/A'} GB`
      },
      REFRESH_FAILED: {
        subject: `[FAILED] Refresh Failed - ${entityLabel}`,
        body: `The refresh for ${entityLabel} has FAILED.\n\n` +
              `Error: ${additionalData.errorMessage || 'Unknown error'}\n\n` +
              `Please investigate and take appropriate action.`
      },
      CONFLICT_DETECTED: {
        subject: `[Conflict] Booking Conflict Detected - ${entityLabel}`,
        body: `A conflict has been detected between a refresh and an existing booking.\n\n` +
              `Refresh: ${entityLabel}\n` +
              `Planned Date: ${plannedDate}\n` +
              `Booking Owner: ${additionalData.bookingOwner || 'Unknown'}\n\n` +
              `Please resolve this conflict before the refresh can proceed.`
      },
      CONFLICT_RESOLVED: {
        subject: `[Resolved] Conflict Resolved - ${entityLabel}`,
        body: `The booking conflict for the refresh of ${entityLabel} has been resolved.\n\n` +
              `Resolution: ${additionalData.resolution || 'Unknown'}`
      }
    };

    return templates[eventType] || {
      subject: `[Refresh] ${eventType} - ${entityLabel}`,
      body: `Event: ${eventType}\nEntity: ${entityLabel}\nPlanned Date: ${plannedDate}`
    };
  },

  /**
   * Send email notification
   */
  sendEmail: async (intent, eventType, content, setting) => {
    try {
      // Get users in the group to email
      let recipients = [];
      
      if (setting.group_id) {
        const usersResult = await db.query(
          `SELECT u.user_id, u.email, u.username 
           FROM users u
           JOIN user_group_members ugm ON u.user_id = ugm.user_id
           WHERE ugm.group_id = $1 AND u.is_active = true`,
          [setting.group_id]
        );
        recipients = usersResult.rows;
      }

      for (const recipient of recipients) {
        // Log the notification (actual email sending would integrate with email service)
        await db.query(
          `INSERT INTO refresh_notification_log 
           (refresh_intent_id, event_type, channel, recipient_type, recipient_id, recipient_email, status, subject, message_body, sent_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
          [intent.refresh_intent_id, eventType, CHANNELS.EMAIL, 'User', recipient.user_id, 
           recipient.email, 'SENT', content.subject, content.body]
        );
        
        console.log(`[Email] Sent to ${recipient.email}: ${content.subject}`);
      }

      // TODO: Integrate with actual email service (SendGrid, AWS SES, etc.)
      // Example: await emailService.send({ to: recipient.email, subject: content.subject, body: content.body });
      
    } catch (error) {
      console.error('Send email error:', error);
    }
  },

  /**
   * Send Microsoft Teams notification via webhook
   */
  sendTeams: async (intent, eventType, content, setting) => {
    try {
      const teamsPayload = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": eventType.includes('FAILED') ? "FF0000" : 
                      eventType.includes('COMPLETED') ? "00FF00" : "0076D7",
        "summary": content.subject,
        "sections": [{
          "activityTitle": content.subject,
          "facts": [
            { "name": "Entity", "value": `${intent.entity_type}: ${intent.entity_name}` },
            { "name": "Type", "value": intent.refresh_type },
            { "name": "Status", "value": intent.intent_status },
            { "name": "Planned Date", "value": new Date(intent.planned_date).toLocaleString() }
          ],
          "markdown": true
        }]
      };

      // Log the notification
      await db.query(
        `INSERT INTO refresh_notification_log 
         (refresh_intent_id, event_type, channel, recipient_type, recipient_webhook_url, status, subject, message_body, sent_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [intent.refresh_intent_id, eventType, CHANNELS.TEAMS, 'Webhook', 
         setting.teams_webhook_url, 'SENT', content.subject, JSON.stringify(teamsPayload)]
      );

      // TODO: Uncomment to send actual webhook
      // const response = await fetch(setting.teams_webhook_url, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(teamsPayload)
      // });

      console.log(`[Teams] Webhook sent: ${content.subject}`);
    } catch (error) {
      console.error('Send Teams error:', error);
    }
  },

  /**
   * Send Slack notification via webhook
   */
  sendSlack: async (intent, eventType, content, setting) => {
    try {
      const slackPayload = {
        "text": content.subject,
        "blocks": [
          {
            "type": "header",
            "text": { "type": "plain_text", "text": content.subject }
          },
          {
            "type": "section",
            "fields": [
              { "type": "mrkdwn", "text": `*Entity:*\n${intent.entity_type}: ${intent.entity_name}` },
              { "type": "mrkdwn", "text": `*Type:*\n${intent.refresh_type}` },
              { "type": "mrkdwn", "text": `*Status:*\n${intent.intent_status}` },
              { "type": "mrkdwn", "text": `*Planned:*\n${new Date(intent.planned_date).toLocaleString()}` }
            ]
          },
          {
            "type": "section",
            "text": { "type": "mrkdwn", "text": content.body.split('\n\n')[0] }
          }
        ]
      };

      // Log the notification
      await db.query(
        `INSERT INTO refresh_notification_log 
         (refresh_intent_id, event_type, channel, recipient_type, recipient_webhook_url, status, subject, message_body, sent_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [intent.refresh_intent_id, eventType, CHANNELS.SLACK, 'Webhook', 
         setting.slack_webhook_url, 'SENT', content.subject, JSON.stringify(slackPayload)]
      );

      // TODO: Uncomment to send actual webhook
      // const response = await fetch(setting.slack_webhook_url, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(slackPayload)
      // });

      console.log(`[Slack] Webhook sent: ${content.subject}`);
    } catch (error) {
      console.error('Send Slack error:', error);
    }
  },

  /**
   * Send in-app notification (using existing notifications table)
   */
  sendInApp: async (intent, eventType, content, setting) => {
    try {
      // Get users in the group
      let userIds = [];
      
      if (setting.group_id) {
        const usersResult = await db.query(
          `SELECT user_id FROM user_group_members WHERE group_id = $1`,
          [setting.group_id]
        );
        userIds = usersResult.rows.map(r => r.user_id);
      }

      // Create in-app notification for each user
      for (const userId of userIds) {
        await db.query(
          `INSERT INTO notifications 
           (user_id, type, title, message, related_entity_type, related_entity_id, action_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [userId, 'REFRESH', content.subject, content.body, 
           intent.entity_type, intent.entity_id, `/refresh/intents/${intent.refresh_intent_id}`]
        );
      }

      // Log the notification
      await db.query(
        `INSERT INTO refresh_notification_log 
         (refresh_intent_id, event_type, channel, recipient_type, status, subject, message_body, sent_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [intent.refresh_intent_id, eventType, CHANNELS.IN_APP, 'Group', 
         'DELIVERED', content.subject, content.body]
      );

      console.log(`[In-App] Notifications sent to ${userIds.length} users: ${content.subject}`);
    } catch (error) {
      console.error('Send in-app notification error:', error);
    }
  },

  /**
   * Send custom webhook notification
   */
  sendWebhook: async (intent, eventType, content, setting) => {
    try {
      const payload = {
        event: eventType,
        timestamp: new Date().toISOString(),
        intent: {
          id: intent.refresh_intent_id,
          entityType: intent.entity_type,
          entityId: intent.entity_id,
          entityName: intent.entity_name,
          refreshType: intent.refresh_type,
          status: intent.intent_status,
          plannedDate: intent.planned_date,
          source: intent.source_environment_name
        },
        notification: {
          subject: content.subject,
          body: content.body
        }
      };

      // Log the notification
      await db.query(
        `INSERT INTO refresh_notification_log 
         (refresh_intent_id, event_type, channel, recipient_type, recipient_webhook_url, status, subject, message_body, sent_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [intent.refresh_intent_id, eventType, CHANNELS.WEBHOOK, 'Webhook', 
         setting.custom_webhook_url, 'SENT', content.subject, JSON.stringify(payload)]
      );

      // TODO: Uncomment to send actual webhook
      // const response = await fetch(setting.custom_webhook_url, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(payload)
      // });

      console.log(`[Webhook] Sent to ${setting.custom_webhook_url}: ${content.subject}`);
    } catch (error) {
      console.error('Send webhook error:', error);
    }
  },

  /**
   * Notify the requester directly
   */
  notifyRequester: async (intent, eventType, content) => {
    try {
      // Create in-app notification for requester
      await db.query(
        `INSERT INTO notifications 
         (user_id, type, title, message, related_entity_type, related_entity_id, action_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [intent.requested_by_user_id, 'REFRESH', content.subject, content.body,
         intent.entity_type, intent.entity_id, `/refresh/intents/${intent.refresh_intent_id}`]
      );

      console.log(`[Requester] Notified ${intent.requested_by_username}: ${content.subject}`);
    } catch (error) {
      console.error('Notify requester error:', error);
    }
  },

  /**
   * Process scheduled reminders (to be called by cron job)
   */
  processScheduledReminders: async () => {
    try {
      const now = new Date();
      
      // Find intents needing 7-day reminder
      const sevenDayIntents = await db.query(
        `SELECT * FROM refresh_intents 
         WHERE intent_status IN ('APPROVED', 'SCHEDULED')
         AND planned_date BETWEEN NOW() + INTERVAL '6 days 23 hours' AND NOW() + INTERVAL '7 days 1 hour'
         AND NOT ($1 = ANY(notification_sent_dates))`,
        [`7day-${now.toISOString().split('T')[0]}`]
      );

      for (const intent of sevenDayIntents.rows) {
        await refreshNotificationService.sendNotifications(
          intent.refresh_intent_id, 
          NOTIFICATION_EVENTS.REFRESH_REMINDER_7DAY
        );
        // Mark as sent
        await db.query(
          `UPDATE refresh_intents SET notification_sent_dates = array_append(notification_sent_dates, $1)
           WHERE refresh_intent_id = $2`,
          [`7day-${now.toISOString().split('T')[0]}`, intent.refresh_intent_id]
        );
      }

      // Find intents needing 1-day reminder
      const oneDayIntents = await db.query(
        `SELECT * FROM refresh_intents 
         WHERE intent_status IN ('APPROVED', 'SCHEDULED')
         AND planned_date BETWEEN NOW() + INTERVAL '23 hours' AND NOW() + INTERVAL '25 hours'
         AND NOT ($1 = ANY(notification_sent_dates))`,
        [`1day-${now.toISOString().split('T')[0]}`]
      );

      for (const intent of oneDayIntents.rows) {
        await refreshNotificationService.sendNotifications(
          intent.refresh_intent_id, 
          NOTIFICATION_EVENTS.REFRESH_REMINDER_1DAY
        );
        await db.query(
          `UPDATE refresh_intents SET notification_sent_dates = array_append(notification_sent_dates, $1)
           WHERE refresh_intent_id = $2`,
          [`1day-${now.toISOString().split('T')[0]}`, intent.refresh_intent_id]
        );
      }

      // Find intents needing 1-hour reminder
      const oneHourIntents = await db.query(
        `SELECT * FROM refresh_intents 
         WHERE intent_status IN ('APPROVED', 'SCHEDULED')
         AND planned_date BETWEEN NOW() + INTERVAL '55 minutes' AND NOW() + INTERVAL '65 minutes'
         AND NOT ($1 = ANY(notification_sent_dates))`,
        [`1hr-${now.toISOString()}`]
      );

      for (const intent of oneHourIntents.rows) {
        await refreshNotificationService.sendNotifications(
          intent.refresh_intent_id, 
          NOTIFICATION_EVENTS.REFRESH_REMINDER_1HR
        );
        await db.query(
          `UPDATE refresh_intents SET notification_sent_dates = array_append(notification_sent_dates, $1)
           WHERE refresh_intent_id = $2`,
          [`1hr-${now.toISOString()}`, intent.refresh_intent_id]
        );
      }

      console.log(`[Reminders] Processed: ${sevenDayIntents.rows.length} 7-day, ${oneDayIntents.rows.length} 1-day, ${oneHourIntents.rows.length} 1-hour`);
    } catch (error) {
      console.error('Process scheduled reminders error:', error);
    }
  }
};

module.exports = {
  refreshNotificationService,
  NOTIFICATION_EVENTS,
  CHANNELS
};
