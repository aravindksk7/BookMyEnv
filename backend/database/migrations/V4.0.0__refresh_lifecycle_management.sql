-- =====================================================
-- REFRESH LIFECYCLE MANAGEMENT - DATABASE MIGRATION
-- Version: 4.0.0
-- Description: Adds refresh history, intents, notifications, and conflict tracking
-- =====================================================

BEGIN;

-- =====================================================
-- REFRESH HISTORY TABLE
-- Stores all historical refresh records
-- =====================================================
CREATE TABLE IF NOT EXISTS refresh_history (
    refresh_history_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Polymorphic reference to refreshable entity
    entity_type VARCHAR(30) NOT NULL CHECK (entity_type IN (
        'Environment', 'EnvironmentInstance', 'Application', 
        'AppComponent', 'Interface', 'InfraComponent', 'TestDataSet'
    )),
    entity_id UUID NOT NULL,
    entity_name VARCHAR(255),
    
    -- Refresh details
    refresh_date TIMESTAMP WITH TIME ZONE NOT NULL,
    refresh_type VARCHAR(30) NOT NULL CHECK (refresh_type IN (
        'FULL_COPY', 'PARTIAL_COPY', 'DATA_ONLY', 'CONFIG_ONLY',
        'MASKED_COPY', 'SCHEMA_SYNC', 'GOLDEN_COPY', 'POINT_IN_TIME', 'OTHER'
    )),
    source_environment_id UUID,
    source_environment_name VARCHAR(255),
    source_snapshot_name VARCHAR(255),
    source_snapshot_date TIMESTAMP WITH TIME ZONE,
    
    -- Request tracking
    requested_by_user_id UUID REFERENCES users(user_id),
    requested_at TIMESTAMP WITH TIME ZONE,
    executed_by_user_id UUID REFERENCES users(user_id),
    executed_at TIMESTAMP WITH TIME ZONE,
    
    -- External references
    change_ticket_ref VARCHAR(100),
    release_id UUID REFERENCES releases(release_id),
    jira_ref VARCHAR(100),
    servicenow_ref VARCHAR(100),
    
    -- Execution details
    execution_status VARCHAR(20) CHECK (execution_status IN (
        'SUCCESS', 'PARTIAL_SUCCESS', 'FAILED', 'ROLLED_BACK'
    )),
    duration_minutes INTEGER,
    data_volume_gb DECIMAL(10,2),
    rows_affected BIGINT,
    
    -- Metadata
    notes TEXT,
    error_message TEXT,
    execution_log_url VARCHAR(500),
    
    -- Linked intent (if created from intent)
    refresh_intent_id UUID,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for refresh_history
CREATE INDEX idx_refresh_history_entity_lookup ON refresh_history(entity_type, entity_id);
CREATE INDEX idx_refresh_history_date ON refresh_history(refresh_date DESC);
CREATE INDEX idx_refresh_history_requested_by ON refresh_history(requested_by_user_id);
CREATE INDEX idx_refresh_history_recent ON refresh_history(entity_type, entity_id, refresh_date DESC);

-- =====================================================
-- REFRESH INTENTS TABLE
-- Stores planned/upcoming refresh intents
-- =====================================================
CREATE TABLE IF NOT EXISTS refresh_intents (
    refresh_intent_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Polymorphic reference to refreshable entity
    entity_type VARCHAR(30) NOT NULL CHECK (entity_type IN (
        'Environment', 'EnvironmentInstance', 'Application', 
        'AppComponent', 'Interface', 'InfraComponent', 'TestDataSet'
    )),
    entity_id UUID NOT NULL,
    entity_name VARCHAR(255),
    
    -- Intent details
    intent_status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (intent_status IN (
        'DRAFT', 'REQUESTED', 'APPROVED', 'SCHEDULED', 
        'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED', 'ROLLED_BACK'
    )),
    planned_date TIMESTAMP WITH TIME ZONE NOT NULL,
    planned_end_date TIMESTAMP WITH TIME ZONE,
    refresh_type VARCHAR(30) NOT NULL CHECK (refresh_type IN (
        'FULL_COPY', 'PARTIAL_COPY', 'DATA_ONLY', 'CONFIG_ONLY',
        'MASKED_COPY', 'SCHEMA_SYNC', 'GOLDEN_COPY', 'POINT_IN_TIME', 'OTHER'
    )),
    
    -- Source configuration
    source_environment_id UUID,
    source_environment_name VARCHAR(255),
    source_snapshot_name VARCHAR(255),
    use_latest_snapshot BOOLEAN DEFAULT false,
    
    -- Impact assessment
    impact_scope TEXT[], -- Array of impact types
    requires_downtime BOOLEAN DEFAULT false,
    estimated_downtime_minutes INTEGER,
    affected_applications UUID[],
    
    -- Request tracking
    requested_by_user_id UUID NOT NULL REFERENCES users(user_id),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reason TEXT NOT NULL,
    business_justification TEXT,
    
    -- Approval workflow
    requires_approval BOOLEAN DEFAULT true,
    approved_by_user_id UUID REFERENCES users(user_id),
    approved_at TIMESTAMP WITH TIME ZONE,
    approval_notes TEXT,
    rejected_by_user_id UUID REFERENCES users(user_id),
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    
    -- External references
    change_ticket_ref VARCHAR(100),
    release_id UUID REFERENCES releases(release_id),
    jira_ref VARCHAR(100),
    servicenow_ref VARCHAR(100),
    
    -- Notification configuration
    notification_groups UUID[], -- Array of group_ids to notify
    notification_lead_days INTEGER[] DEFAULT ARRAY[7, 1],
    notification_sent_dates TIMESTAMP WITH TIME ZONE[],
    
    -- Execution tracking
    execution_started_at TIMESTAMP WITH TIME ZONE,
    execution_completed_at TIMESTAMP WITH TIME ZONE,
    execution_notes TEXT,
    
    -- Linked to history after completion
    refresh_history_id UUID,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for refresh_intents
CREATE INDEX idx_refresh_intents_entity ON refresh_intents(entity_type, entity_id);
CREATE INDEX idx_refresh_intents_status ON refresh_intents(intent_status);
CREATE INDEX idx_refresh_intents_planned_date ON refresh_intents(planned_date);
CREATE INDEX idx_refresh_intents_requested_by ON refresh_intents(requested_by_user_id);
CREATE INDEX idx_refresh_intents_calendar ON refresh_intents(planned_date, intent_status) 
    WHERE intent_status NOT IN ('CANCELLED', 'COMPLETED', 'FAILED', 'ROLLED_BACK');
CREATE INDEX idx_refresh_intents_pending_approval ON refresh_intents(intent_status, requested_at) 
    WHERE intent_status = 'REQUESTED';

-- =====================================================
-- REFRESH NOTIFICATION SETTINGS TABLE
-- Notification preferences per entity/group
-- =====================================================
CREATE TABLE IF NOT EXISTS refresh_notification_settings (
    notification_setting_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Scope (entity-level or group-level)
    scope_type VARCHAR(20) NOT NULL CHECK (scope_type IN ('Entity', 'Group', 'Global')),
    entity_type VARCHAR(30),
    entity_id UUID,
    group_id UUID REFERENCES user_groups(group_id),
    
    -- Channel configurations
    email_enabled BOOLEAN DEFAULT true,
    teams_webhook_url VARCHAR(500),
    slack_webhook_url VARCHAR(500),
    in_app_enabled BOOLEAN DEFAULT true,
    custom_webhook_url VARCHAR(500),
    
    -- Timing preferences
    reminder_days INTEGER[] DEFAULT ARRAY[7, 1],
    reminder_hours INTEGER[] DEFAULT ARRAY[1],
    
    -- Event subscriptions (stored as text array for flexibility)
    subscribed_events TEXT[] DEFAULT ARRAY[
        'REFRESH_APPROVED', 'REFRESH_SCHEDULED', 
        'REFRESH_REMINDER_1DAY', 'REFRESH_STARTING', 
        'REFRESH_COMPLETED', 'REFRESH_FAILED'
    ],
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for notification settings
CREATE INDEX idx_notification_settings_scope ON refresh_notification_settings(scope_type, entity_type, entity_id);
CREATE INDEX idx_notification_settings_group ON refresh_notification_settings(group_id);

-- =====================================================
-- REFRESH NOTIFICATION LOG TABLE
-- Audit log of all notifications sent
-- =====================================================
CREATE TABLE IF NOT EXISTS refresh_notification_log (
    notification_log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    refresh_intent_id UUID REFERENCES refresh_intents(refresh_intent_id),
    event_type VARCHAR(50) NOT NULL,
    
    -- Delivery details
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('EMAIL', 'TEAMS', 'SLACK', 'IN_APP', 'WEBHOOK')),
    recipient_type VARCHAR(20) CHECK (recipient_type IN ('User', 'Group', 'Webhook')),
    recipient_id UUID,
    recipient_email VARCHAR(255),
    recipient_webhook_url VARCHAR(500),
    
    -- Status
    status VARCHAR(20) CHECK (status IN ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED')),
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    
    -- Content (for audit)
    subject VARCHAR(500),
    message_body TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for notification log
CREATE INDEX idx_notification_log_intent ON refresh_notification_log(refresh_intent_id);
CREATE INDEX idx_notification_log_status ON refresh_notification_log(status);
CREATE INDEX idx_notification_log_created ON refresh_notification_log(created_at DESC);

-- =====================================================
-- REFRESH BOOKING CONFLICTS TABLE
-- Tracks conflicts between refresh intents and bookings
-- =====================================================
CREATE TABLE IF NOT EXISTS refresh_booking_conflicts (
    conflict_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    refresh_intent_id UUID NOT NULL REFERENCES refresh_intents(refresh_intent_id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES environment_bookings(booking_id) ON DELETE CASCADE,
    
    -- Conflict details
    conflict_type VARCHAR(30) CHECK (conflict_type IN (
        'OVERLAP',              -- Refresh window overlaps booking
        'DEPENDENCY',           -- Booked app depends on refreshed env
        'DATA_LOSS_RISK',       -- Refresh may affect booked test data
        'DOWNTIME_CONFLICT'     -- Downtime during active booking
    )),
    severity VARCHAR(10) CHECK (severity IN ('HIGH', 'MEDIUM', 'LOW')),
    
    -- Resolution
    resolution_status VARCHAR(20) DEFAULT 'UNRESOLVED' CHECK (resolution_status IN (
        'UNRESOLVED', 'ACKNOWLEDGED', 'BOOKING_MOVED', 'REFRESH_MOVED', 
        'OVERRIDE_APPROVED', 'DISMISSED'
    )),
    resolved_by_user_id UUID REFERENCES users(user_id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    
    -- Notification tracking
    booking_owner_notified BOOLEAN DEFAULT false,
    notification_sent_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(refresh_intent_id, booking_id)
);

-- Indexes for conflicts
CREATE INDEX idx_conflicts_intent ON refresh_booking_conflicts(refresh_intent_id);
CREATE INDEX idx_conflicts_booking ON refresh_booking_conflicts(booking_id);
CREATE INDEX idx_conflicts_unresolved ON refresh_booking_conflicts(resolution_status) 
    WHERE resolution_status = 'UNRESOLVED';

-- =====================================================
-- ALTER EXISTING TABLES
-- Add refresh tracking columns
-- =====================================================

-- Environments table
ALTER TABLE environments 
ADD COLUMN IF NOT EXISTS last_refresh_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_refresh_type VARCHAR(30),
ADD COLUMN IF NOT EXISTS last_refresh_source VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_refresh_by UUID REFERENCES users(user_id);

-- Environment Instances table
ALTER TABLE environment_instances 
ADD COLUMN IF NOT EXISTS last_refresh_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_refresh_type VARCHAR(30),
ADD COLUMN IF NOT EXISTS last_refresh_source VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_refresh_by UUID REFERENCES users(user_id);

-- Applications table
ALTER TABLE applications 
ADD COLUMN IF NOT EXISTS last_refresh_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_refresh_type VARCHAR(30),
ADD COLUMN IF NOT EXISTS last_refresh_source VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_refresh_by UUID REFERENCES users(user_id);

-- Interfaces table
ALTER TABLE interfaces 
ADD COLUMN IF NOT EXISTS last_refresh_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_refresh_type VARCHAR(30),
ADD COLUMN IF NOT EXISTS last_refresh_source VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_refresh_by UUID REFERENCES users(user_id);

-- App Components table
ALTER TABLE app_components 
ADD COLUMN IF NOT EXISTS last_refresh_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_refresh_type VARCHAR(30),
ADD COLUMN IF NOT EXISTS last_refresh_source VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_refresh_by UUID REFERENCES users(user_id);

-- Infra Components table
ALTER TABLE infra_components 
ADD COLUMN IF NOT EXISTS last_refresh_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_refresh_type VARCHAR(30),
ADD COLUMN IF NOT EXISTS last_refresh_source VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_refresh_by UUID REFERENCES users(user_id);

-- Test Data Sets table - already has last_refreshed_date, add other columns
ALTER TABLE test_data_sets 
ADD COLUMN IF NOT EXISTS last_refresh_type VARCHAR(30),
ADD COLUMN IF NOT EXISTS last_refresh_source VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_refresh_by UUID REFERENCES users(user_id);

-- =====================================================
-- INSERT SAMPLE DATA
-- =====================================================

-- Sample Refresh History
INSERT INTO refresh_history (
    refresh_history_id, entity_type, entity_id, entity_name,
    refresh_date, refresh_type, source_environment_name, source_snapshot_name,
    requested_by_user_id, executed_by_user_id, executed_at,
    change_ticket_ref, execution_status, duration_minutes, notes
) VALUES
(
    'rh111111-1111-1111-1111-111111111111',
    'EnvironmentInstance', 'a1111111-1111-1111-1111-111111111111', 'SIT1',
    NOW() - INTERVAL '15 days', 'MASKED_COPY', 'PROD', 'PROD-SNAPSHOT-2025-11-24',
    'cccccccc-cccc-cccc-cccc-cccccccccccc', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', NOW() - INTERVAL '15 days',
    'CHG-123456', 'SUCCESS', 225, 'Masked PII columns as per data policy v4. All test accounts preserved.'
),
(
    'rh222222-2222-2222-2222-222222222222',
    'EnvironmentInstance', 'a2222222-2222-2222-2222-222222222222', 'SIT2',
    NOW() - INTERVAL '10 days', 'FULL_COPY', 'PROD', 'PROD-SNAPSHOT-2025-11-29',
    'dddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', NOW() - INTERVAL '10 days',
    'CHG-123789', 'SUCCESS', 180, 'Full environment refresh for release testing.'
),
(
    'rh333333-3333-3333-3333-333333333333',
    'Application', 'c0a11111-1111-1111-1111-111111111111', 'PaymentGateway',
    NOW() - INTERVAL '5 days', 'CONFIG_ONLY', NULL, NULL,
    'cccccccc-cccc-cccc-cccc-cccccccccccc', 'cccccccc-cccc-cccc-cccc-cccccccccccc', NOW() - INTERVAL '5 days',
    'CHG-124000', 'SUCCESS', 15, 'Configuration update for new payment channels.'
);

-- Sample Refresh Intents
INSERT INTO refresh_intents (
    refresh_intent_id, entity_type, entity_id, entity_name,
    intent_status, planned_date, planned_end_date, refresh_type,
    source_environment_name, requires_downtime, estimated_downtime_minutes,
    requested_by_user_id, requested_at, reason,
    change_ticket_ref, notification_groups, notification_lead_days
) VALUES
(
    'ri111111-1111-1111-1111-111111111111',
    'EnvironmentInstance', 'a1111111-1111-1111-1111-111111111111', 'SIT1',
    'APPROVED', NOW() + INTERVAL '7 days', NOW() + INTERVAL '7 days' + INTERVAL '4 hours', 'MASKED_COPY',
    'PROD', true, 240,
    'cccccccc-cccc-cccc-cccc-cccccccccccc', NOW() - INTERVAL '2 days', 
    'Align environment with Release 2025.1 regression baseline for Q1 testing cycle.',
    'CHG-125000', ARRAY['22222222-2222-2222-2222-222222222222'::UUID], ARRAY[7, 1]
),
(
    'ri222222-2222-2222-2222-222222222222',
    'EnvironmentInstance', 'a3333333-3333-3333-3333-333333333333', 'UAT1',
    'REQUESTED', NOW() + INTERVAL '14 days', NOW() + INTERVAL '14 days' + INTERVAL '6 hours', 'FULL_COPY',
    'PROD', true, 360,
    'dddddddd-dddd-dddd-dddd-dddddddddddd', NOW() - INTERVAL '1 day',
    'Full refresh for UAT regression testing before production deployment.',
    'CHG-125100', ARRAY['22222222-2222-2222-2222-222222222222'::UUID, '33333333-3333-3333-3333-333333333333'::UUID], ARRAY[7, 1]
),
(
    'ri333333-3333-3333-3333-333333333333',
    'Application', 'c0a22222-2222-2222-2222-222222222222', 'FraudDetection',
    'DRAFT', NOW() + INTERVAL '21 days', NOW() + INTERVAL '21 days' + INTERVAL '2 hours', 'DATA_ONLY',
    'PROD', false, NULL,
    'dddddddd-dddd-dddd-dddd-dddddddddddd', NOW(),
    'Update fraud detection rules and test data.',
    NULL, ARRAY['33333333-3333-3333-3333-333333333333'::UUID], ARRAY[7, 1]
);

-- Update approved intent with approval details
UPDATE refresh_intents 
SET approved_by_user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    approved_at = NOW() - INTERVAL '1 day',
    approval_notes = 'Approved for weekend refresh window.'
WHERE refresh_intent_id = 'ri111111-1111-1111-1111-111111111111';

-- Sample Notification Settings
INSERT INTO refresh_notification_settings (
    scope_type, group_id, email_enabled, in_app_enabled,
    reminder_days, subscribed_events
) VALUES
(
    'Group', '22222222-2222-2222-2222-222222222222', true, true,
    ARRAY[7, 3, 1], ARRAY['REFRESH_APPROVED', 'REFRESH_SCHEDULED', 'REFRESH_REMINDER_1DAY', 
                          'REFRESH_STARTING', 'REFRESH_COMPLETED', 'REFRESH_FAILED']
),
(
    'Group', '33333333-3333-3333-3333-333333333333', true, true,
    ARRAY[7, 1], ARRAY['REFRESH_SCHEDULED', 'REFRESH_STARTING', 'REFRESH_COMPLETED']
);

-- Sample Conflict (for pending intent)
INSERT INTO refresh_booking_conflicts (
    conflict_id, refresh_intent_id, booking_id,
    conflict_type, severity, resolution_status
) VALUES
(
    'rc111111-1111-1111-1111-111111111111',
    'ri222222-2222-2222-2222-222222222222', 'f0222222-2222-2222-2222-222222222222',
    'OVERLAP', 'HIGH', 'UNRESOLVED'
);

-- Update environment instances with last refresh info
UPDATE environment_instances 
SET last_refresh_date = NOW() - INTERVAL '15 days',
    last_refresh_type = 'MASKED_COPY',
    last_refresh_source = 'PROD-SNAPSHOT-2025-11-24',
    last_refresh_by = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
WHERE env_instance_id = 'a1111111-1111-1111-1111-111111111111';

UPDATE environment_instances 
SET last_refresh_date = NOW() - INTERVAL '10 days',
    last_refresh_type = 'FULL_COPY',
    last_refresh_source = 'PROD-SNAPSHOT-2025-11-29',
    last_refresh_by = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
WHERE env_instance_id = 'a2222222-2222-2222-2222-222222222222';

COMMIT;
