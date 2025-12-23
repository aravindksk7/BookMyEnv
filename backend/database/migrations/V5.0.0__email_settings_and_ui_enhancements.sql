-- =====================================================
-- EMAIL SETTINGS & UI ENHANCEMENTS - DATABASE MIGRATION
-- Version: 5.0.0
-- Description: Adds system settings for email configuration,
--              UI preferences, and supporting features
-- Date: 2025-12-23
-- 
-- IMPORTANT: This migration is safe to run on existing data
-- All statements use IF NOT EXISTS or ON CONFLICT to prevent
-- errors on re-runs or existing schemas
-- =====================================================

BEGIN;

-- =====================================================
-- PRE-MIGRATION: CHECK CURRENT STATE
-- =====================================================

-- Create a migration log if it doesn't exist
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(50) PRIMARY KEY,
    description TEXT,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    execution_time_ms INTEGER,
    checksum VARCHAR(64)
);

-- Record migration start
DO $$
BEGIN
    INSERT INTO schema_migrations (version, description, executed_at)
    VALUES ('5.0.0', 'Email settings and UI enhancements', NOW())
    ON CONFLICT (version) DO UPDATE SET executed_at = NOW();
END $$;

-- =====================================================
-- SYSTEM SETTINGS TABLE
-- Stores application-wide configuration
-- =====================================================

-- Create system_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS system_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value JSONB NOT NULL,
    description TEXT,
    is_sensitive BOOLEAN DEFAULT FALSE,
    updated_by UUID REFERENCES users(user_id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comment for documentation
COMMENT ON TABLE system_settings IS 'Stores application-wide configuration settings including email, UI preferences, and integration configs';
COMMENT ON COLUMN system_settings.setting_key IS 'Unique identifier for the setting (e.g., email_config, ui_defaults)';
COMMENT ON COLUMN system_settings.setting_value IS 'JSONB value containing the setting configuration';
COMMENT ON COLUMN system_settings.is_sensitive IS 'If true, value may contain secrets and should be masked in logs/UI';

-- =====================================================
-- DEFAULT SETTINGS
-- =====================================================

-- Insert default email configuration (only if not exists)
INSERT INTO system_settings (setting_key, setting_value, description, is_sensitive) VALUES
('email_config', '{
    "enabled": false,
    "provider": "smtp",
    "smtp": {
        "host": "",
        "port": 587,
        "secure": false,
        "user": "",
        "pass": ""
    },
    "sendgrid": {
        "apiKey": ""
    },
    "ses": {
        "region": "us-east-1",
        "accessKeyId": "",
        "secretAccessKey": ""
    },
    "from": {
        "name": "BookMyEnv",
        "email": "noreply@example.com"
    },
    "appUrl": "http://localhost:3000"
}'::jsonb, 'Email notification configuration - supports SMTP, SendGrid, and AWS SES', true)
ON CONFLICT (setting_key) DO NOTHING;

-- Insert default UI preferences
INSERT INTO system_settings (setting_key, setting_value, description, is_sensitive) VALUES
('ui_defaults', '{
    "defaultTheme": "light",
    "defaultCalendarView": "month",
    "defaultTimeZone": "UTC",
    "dateFormat": "YYYY-MM-DD",
    "timeFormat": "HH:mm",
    "enableAnimations": true,
    "compactMode": false
}'::jsonb, 'Default UI preferences for new users', false)
ON CONFLICT (setting_key) DO NOTHING;

-- Insert notification defaults
INSERT INTO system_settings (setting_key, setting_value, description, is_sensitive) VALUES
('notification_defaults', '{
    "emailNotifications": true,
    "inAppNotifications": true,
    "reminderDays": [7, 3, 1],
    "digestFrequency": "daily",
    "quietHoursEnabled": false,
    "quietHoursStart": "22:00",
    "quietHoursEnd": "07:00"
}'::jsonb, 'Default notification preferences', false)
ON CONFLICT (setting_key) DO NOTHING;

-- Insert application metadata
INSERT INTO system_settings (setting_key, setting_value, description, is_sensitive) VALUES
('app_metadata', '{
    "version": "5.0.0",
    "installedAt": null,
    "lastUpgrade": null,
    "instanceId": null,
    "features": {
        "refreshLifecycle": true,
        "emailNotifications": true,
        "darkMode": true,
        "scheduleXCalendar": true
    }
}'::jsonb, 'Application metadata and feature flags', false)
ON CONFLICT (setting_key) DO UPDATE 
SET setting_value = jsonb_set(
    system_settings.setting_value, 
    '{version}', 
    '"5.0.0"'::jsonb
),
updated_at = NOW();

-- =====================================================
-- USER PREFERENCES TABLE
-- Stores per-user UI and notification preferences
-- =====================================================

CREATE TABLE IF NOT EXISTS user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    theme VARCHAR(10) DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
    default_calendar_view VARCHAR(20) DEFAULT 'month' CHECK (default_calendar_view IN ('month', 'week', 'day')),
    time_zone VARCHAR(50) DEFAULT 'UTC',
    date_format VARCHAR(20) DEFAULT 'YYYY-MM-DD',
    time_format VARCHAR(10) DEFAULT 'HH:mm',
    compact_mode BOOLEAN DEFAULT FALSE,
    email_notifications BOOLEAN DEFAULT TRUE,
    in_app_notifications BOOLEAN DEFAULT TRUE,
    reminder_days INTEGER[] DEFAULT ARRAY[7, 3, 1],
    digest_frequency VARCHAR(10) DEFAULT 'daily' CHECK (digest_frequency IN ('realtime', 'hourly', 'daily', 'weekly', 'none')),
    quiet_hours_enabled BOOLEAN DEFAULT FALSE,
    quiet_hours_start TIME DEFAULT '22:00',
    quiet_hours_end TIME DEFAULT '07:00',
    sidebar_collapsed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE user_preferences IS 'Stores individual user UI and notification preferences';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id);

-- =====================================================
-- EMAIL TEMPLATES TABLE
-- Stores customizable email templates
-- =====================================================

CREATE TABLE IF NOT EXISTS email_templates (
    template_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_key VARCHAR(50) NOT NULL UNIQUE,
    template_name VARCHAR(100) NOT NULL,
    subject_template TEXT NOT NULL,
    body_template TEXT NOT NULL,
    body_html_template TEXT,
    description TEXT,
    variables JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    is_system BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE email_templates IS 'Customizable email templates for notifications';
COMMENT ON COLUMN email_templates.template_key IS 'Unique key for template lookup (e.g., booking_confirmed)';
COMMENT ON COLUMN email_templates.variables IS 'JSON array of available template variables';
COMMENT ON COLUMN email_templates.is_system IS 'If true, template cannot be deleted (but can be customized)';

-- Insert default email templates
INSERT INTO email_templates (template_key, template_name, subject_template, body_template, body_html_template, description, variables, is_system) VALUES
('booking_confirmed', 'Booking Confirmed', 
 'Booking Confirmed: {{title}}',
 'Your booking "{{title}}" has been confirmed.\n\nEnvironment: {{environmentName}}\nStart: {{startDateTime}}\nEnd: {{endDateTime}}\nTest Phase: {{testPhase}}\n\nView booking: {{bookingUrl}}',
 '<h2>Booking Confirmed</h2><p>Your booking <strong>{{title}}</strong> has been confirmed.</p><table><tr><td>Environment:</td><td>{{environmentName}}</td></tr><tr><td>Start:</td><td>{{startDateTime}}</td></tr><tr><td>End:</td><td>{{endDateTime}}</td></tr><tr><td>Test Phase:</td><td>{{testPhase}}</td></tr></table><p><a href="{{bookingUrl}}">View Booking</a></p>',
 'Sent when a booking is confirmed',
 '["title", "environmentName", "startDateTime", "endDateTime", "testPhase", "bookingUrl"]'::jsonb, true),
 
('booking_reminder', 'Booking Reminder',
 'Reminder: Upcoming Booking - {{title}}',
 'This is a reminder for your upcoming booking.\n\nTitle: {{title}}\nEnvironment: {{environmentName}}\nStarts in: {{daysUntil}} day(s)\nStart: {{startDateTime}}\n\nView booking: {{bookingUrl}}',
 '<h2>Booking Reminder</h2><p>This is a reminder for your upcoming booking.</p><table><tr><td>Title:</td><td>{{title}}</td></tr><tr><td>Environment:</td><td>{{environmentName}}</td></tr><tr><td>Starts in:</td><td>{{daysUntil}} day(s)</td></tr><tr><td>Start:</td><td>{{startDateTime}}</td></tr></table><p><a href="{{bookingUrl}}">View Booking</a></p>',
 'Sent as a reminder before booking starts',
 '["title", "environmentName", "daysUntil", "startDateTime", "bookingUrl"]'::jsonb, true),

('refresh_scheduled', 'Refresh Scheduled',
 'Refresh Scheduled: {{entityName}} - {{refreshType}}',
 'A refresh has been scheduled for {{entityName}}.\n\nType: {{refreshType}}\nPlanned Date: {{plannedDate}}\nEstimated Duration: {{estimatedDuration}}\nRequires Downtime: {{requiresDowntime}}\n\nReason: {{reason}}\n\nView details: {{intentUrl}}',
 '<h2>Refresh Scheduled</h2><p>A refresh has been scheduled for <strong>{{entityName}}</strong>.</p><table><tr><td>Type:</td><td>{{refreshType}}</td></tr><tr><td>Planned Date:</td><td>{{plannedDate}}</td></tr><tr><td>Duration:</td><td>{{estimatedDuration}}</td></tr><tr><td>Downtime:</td><td>{{requiresDowntime}}</td></tr></table><p><strong>Reason:</strong> {{reason}}</p><p><a href="{{intentUrl}}">View Details</a></p>',
 'Sent when a refresh is scheduled',
 '["entityName", "refreshType", "plannedDate", "estimatedDuration", "requiresDowntime", "reason", "intentUrl"]'::jsonb, true),

('refresh_completed', 'Refresh Completed',
 'Refresh Completed: {{entityName}} - {{status}}',
 'The refresh for {{entityName}} has completed.\n\nStatus: {{status}}\nDuration: {{duration}}\nCompleted At: {{completedAt}}\n\n{{#if errorMessage}}Error: {{errorMessage}}{{/if}}\n\nView details: {{historyUrl}}',
 '<h2>Refresh Completed</h2><p>The refresh for <strong>{{entityName}}</strong> has completed.</p><table><tr><td>Status:</td><td><span style="color:{{statusColor}}">{{status}}</span></td></tr><tr><td>Duration:</td><td>{{duration}}</td></tr><tr><td>Completed:</td><td>{{completedAt}}</td></tr></table>{{#if errorMessage}}<p style="color:red"><strong>Error:</strong> {{errorMessage}}</p>{{/if}}<p><a href="{{historyUrl}}">View Details</a></p>',
 'Sent when a refresh completes (success or failure)',
 '["entityName", "status", "statusColor", "duration", "completedAt", "errorMessage", "historyUrl"]'::jsonb, true),

('conflict_detected', 'Booking Conflict Detected',
 'Conflict Alert: Refresh may impact your booking',
 'A scheduled refresh may conflict with your booking.\n\nYour Booking: {{bookingTitle}}\nBooking Period: {{bookingStart}} - {{bookingEnd}}\n\nScheduled Refresh:\n- Entity: {{entityName}}\n- Type: {{refreshType}}\n- Planned: {{refreshDate}}\n- Requires Downtime: {{requiresDowntime}}\n\nPlease coordinate with the refresh requestor or consider rescheduling.\n\nContact: {{requestorEmail}}',
 '<h2>Conflict Alert</h2><p>A scheduled refresh may conflict with your booking.</p><h3>Your Booking</h3><table><tr><td>Title:</td><td>{{bookingTitle}}</td></tr><tr><td>Period:</td><td>{{bookingStart}} - {{bookingEnd}}</td></tr></table><h3>Scheduled Refresh</h3><table><tr><td>Entity:</td><td>{{entityName}}</td></tr><tr><td>Type:</td><td>{{refreshType}}</td></tr><tr><td>Planned:</td><td>{{refreshDate}}</td></tr><tr><td>Downtime:</td><td>{{requiresDowntime}}</td></tr></table><p>Please coordinate with the refresh requestor or consider rescheduling.</p><p>Contact: <a href="mailto:{{requestorEmail}}">{{requestorEmail}}</a></p>',
 'Sent when a refresh conflicts with an existing booking',
 '["bookingTitle", "bookingStart", "bookingEnd", "entityName", "refreshType", "refreshDate", "requiresDowntime", "requestorEmail"]'::jsonb, true)

ON CONFLICT (template_key) DO NOTHING;

-- =====================================================
-- AUDIT LOG ENHANCEMENT
-- Add email notification tracking
-- =====================================================

-- Add email_sent column to audit log if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'audit_log' AND column_name = 'notification_sent'
    ) THEN
        ALTER TABLE audit_log ADD COLUMN notification_sent BOOLEAN DEFAULT FALSE;
        ALTER TABLE audit_log ADD COLUMN notification_sent_at TIMESTAMP WITH TIME ZONE;
        ALTER TABLE audit_log ADD COLUMN notification_error TEXT;
    END IF;
END $$;

-- =====================================================
-- EMAIL NOTIFICATION LOG
-- Track all sent emails for debugging and audit
-- =====================================================

CREATE TABLE IF NOT EXISTS email_notification_log (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_key VARCHAR(50) REFERENCES email_templates(template_key),
    recipient_email VARCHAR(255) NOT NULL,
    recipient_user_id UUID REFERENCES users(user_id),
    subject VARCHAR(500) NOT NULL,
    body_preview TEXT,
    booking_id UUID,
    refresh_intent_id UUID,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
    provider VARCHAR(20),
    provider_message_id VARCHAR(255),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivered_at TIMESTAMP WITH TIME ZONE
);

COMMENT ON TABLE email_notification_log IS 'Tracks all email notifications for audit and debugging';

-- Create indexes for email log
CREATE INDEX IF NOT EXISTS idx_email_log_recipient ON email_notification_log(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_log_booking ON email_notification_log(booking_id);
CREATE INDEX IF NOT EXISTS idx_email_log_intent ON email_notification_log(refresh_intent_id);
CREATE INDEX IF NOT EXISTS idx_email_log_sent ON email_notification_log(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_log_status ON email_notification_log(status);

-- =====================================================
-- FEATURE FLAGS TABLE
-- Dynamic feature toggle management
-- =====================================================

CREATE TABLE IF NOT EXISTS feature_flags (
    flag_key VARCHAR(50) PRIMARY KEY,
    flag_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_enabled BOOLEAN DEFAULT FALSE,
    enabled_for_groups UUID[] DEFAULT '{}',
    enabled_for_users UUID[] DEFAULT '{}',
    rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE feature_flags IS 'Feature flags for gradual rollout and A/B testing';

-- Insert default feature flags
INSERT INTO feature_flags (flag_key, flag_name, description, is_enabled, rollout_percentage) VALUES
('dark_mode', 'Dark Mode Theme', 'Enable dark mode theme option in UI', true, 100),
('schedule_x_calendar', 'Schedule-X Calendar', 'Use Schedule-X calendar component instead of custom calendar', true, 100),
('email_notifications', 'Email Notifications', 'Enable email notification system', true, 100),
('refresh_conflict_detection', 'Refresh Conflict Detection', 'Automatically detect booking conflicts for refresh intents', true, 100),
('bulk_operations', 'Bulk Operations', 'Enable bulk create/update operations', true, 100)
ON CONFLICT (flag_key) DO NOTHING;

-- =====================================================
-- SCHEMA MIGRATION COMPLETE
-- =====================================================

-- Update app metadata with upgrade timestamp
UPDATE system_settings 
SET setting_value = jsonb_set(
    jsonb_set(setting_value, '{lastUpgrade}', to_jsonb(NOW()::text)),
    '{version}', '"5.0.0"'::jsonb
)
WHERE setting_key = 'app_metadata';

-- Record successful migration
UPDATE schema_migrations 
SET execution_time_ms = EXTRACT(EPOCH FROM (NOW() - executed_at)) * 1000,
    checksum = md5('V5.0.0__email_settings_and_ui_enhancements.sql')
WHERE version = '5.0.0';

COMMIT;

-- =====================================================
-- POST-MIGRATION VERIFICATION
-- Run these queries to verify the migration
-- =====================================================

-- SELECT version, description, executed_at FROM schema_migrations ORDER BY executed_at DESC;
-- SELECT setting_key, description FROM system_settings;
-- SELECT flag_key, flag_name, is_enabled FROM feature_flags;
-- SELECT template_key, template_name FROM email_templates;
