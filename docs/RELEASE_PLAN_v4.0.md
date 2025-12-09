# BookMyEnv v4.0 Release Plan
## Refresh Lifecycle Management Feature

**Release Version:** 4.0.0  
**Target Release Date:** Q1 2025  
**Feature Branch:** `feature/refresh-lifecycle`  
**Status:** ✅ IMPLEMENTED

---

## Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Database Schema | ✅ Complete | All tables, columns, indexes created |
| Backend Services | ✅ Complete | ConflictDetectionService, RefreshController, BookingController |
| API Endpoints | ✅ Complete | All CRUD + conflict detection endpoints |
| Frontend Calendar | ✅ Complete | Full calendar view with conflict UI |
| Frontend Approvals | ✅ Complete | Approval workflow with statistics |
| Conflict Detection | ✅ Complete | Real-time bidirectional checking |
| Documentation | ✅ Complete | USER_GUIDE.md, LIFECYCLE_GUIDE.md updated |
| Tests | ✅ Passing | 53/53 comprehensive tests passing |

---

## Executive Summary

Version 4.0 introduces comprehensive **Refresh Lifecycle Management** - a critical capability for enterprise test environment management. This feature enables teams to track historical refresh activities, plan future refreshes with approval workflows, receive notifications, and maintain complete audit trails.

### Key Capabilities
- **Last Refresh Tracking** - Historical record of when and how assets were refreshed ✅
- **Refresh Intent Management** - Planning and approval workflow for future refreshes ✅
- **Notification System** - Multi-channel alerts (Email, Teams/Slack, In-App) 🔄 Framework ready
- **Refresh Calendar** - Visual timeline of planned refreshes ✅
- **Booking Conflict Detection** - Automatic detection of refresh/booking conflicts ✅
- **Audit Trail** - Complete history of all refresh activities ✅

---

## Table of Contents

1. [Data Model Changes](#1-data-model-changes)
2. [Backend Implementation](#2-backend-implementation)
3. [Frontend Implementation](#3-frontend-implementation)
4. [Notification System](#4-notification-system)
5. [Workflow & Business Rules](#5-workflow--business-rules)
6. [API Specifications](#6-api-specifications)
7. [Migration Strategy](#7-migration-strategy)
8. [Testing Strategy](#8-testing-strategy)
9. [Implementation Phases](#9-implementation-phases)
10. [Risk Assessment](#10-risk-assessment)

---

## 1. Data Model Changes

### 1.1 New Enumerations

```sql
-- Refresh Types
CREATE TYPE refresh_type AS ENUM (
    'FULL_COPY',           -- Complete database/environment copy
    'PARTIAL_COPY',        -- Selective data copy
    'DATA_ONLY',           -- Data refresh without schema changes
    'CONFIG_ONLY',         -- Configuration refresh only
    'MASKED_COPY',         -- PII/PCI masked data copy
    'SCHEMA_SYNC',         -- Schema synchronization
    'GOLDEN_COPY',         -- Restore from golden baseline
    'POINT_IN_TIME',       -- Point-in-time recovery
    'OTHER'
);

-- Refresh Intent Status
CREATE TYPE refresh_intent_status AS ENUM (
    'DRAFT',               -- Intent created but not submitted
    'REQUESTED',           -- Submitted for approval
    'APPROVED',            -- Approved, awaiting scheduling
    'SCHEDULED',           -- Scheduled for execution
    'IN_PROGRESS',         -- Currently executing
    'COMPLETED',           -- Successfully completed
    'FAILED',              -- Execution failed
    'CANCELLED',           -- Cancelled by user/admin
    'ROLLED_BACK'          -- Rolled back after failure
);

-- Refresh Impact Scope
CREATE TYPE refresh_impact_scope AS ENUM (
    'DATA_OVERWRITE',      -- All data will be overwritten
    'PARTIAL_OVERWRITE',   -- Selective data overwrite
    'DOWNTIME_REQUIRED',   -- Environment unavailable during refresh
    'READ_ONLY_DURING',    -- Read-only access during refresh
    'NO_IMPACT',           -- No user impact
    'CONFIG_CHANGE',       -- Configuration changes only
    'SCHEMA_CHANGE'        -- Schema modifications
);

-- Notification Channel
CREATE TYPE notification_channel AS ENUM (
    'EMAIL',
    'TEAMS',
    'SLACK',
    'IN_APP',
    'WEBHOOK'
);

-- Notification Event Type
CREATE TYPE notification_event_type AS ENUM (
    'REFRESH_INTENT_CREATED',
    'REFRESH_INTENT_UPDATED',
    'REFRESH_APPROVED',
    'REFRESH_REJECTED',
    'REFRESH_SCHEDULED',
    'REFRESH_REMINDER_7DAY',
    'REFRESH_REMINDER_1DAY',
    'REFRESH_REMINDER_1HOUR',
    'REFRESH_STARTING',
    'REFRESH_COMPLETED',
    'REFRESH_FAILED',
    'REFRESH_CANCELLED',
    'BOOKING_CONFLICT_DETECTED'
);
```

### 1.2 New Tables

#### Refresh History Table
```sql
-- Stores all historical refresh records
CREATE TABLE refresh_history (
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
    refresh_type VARCHAR(30) NOT NULL,
    source_environment_id UUID REFERENCES environments(environment_id),
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
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for common queries
    CONSTRAINT idx_refresh_history_entity UNIQUE (entity_type, entity_id, refresh_date)
);

CREATE INDEX idx_refresh_history_entity_lookup ON refresh_history(entity_type, entity_id);
CREATE INDEX idx_refresh_history_date ON refresh_history(refresh_date DESC);
CREATE INDEX idx_refresh_history_requested_by ON refresh_history(requested_by_user_id);
```

#### Refresh Intent Table
```sql
-- Stores planned/upcoming refresh intents
CREATE TABLE refresh_intents (
    refresh_intent_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Polymorphic reference to refreshable entity
    entity_type VARCHAR(30) NOT NULL CHECK (entity_type IN (
        'Environment', 'EnvironmentInstance', 'Application', 
        'AppComponent', 'Interface', 'InfraComponent', 'TestDataSet'
    )),
    entity_id UUID NOT NULL,
    entity_name VARCHAR(255),
    
    -- Intent details
    intent_status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    planned_date TIMESTAMP WITH TIME ZONE NOT NULL,
    planned_end_date TIMESTAMP WITH TIME ZONE,
    refresh_type VARCHAR(30) NOT NULL,
    
    -- Source configuration
    source_environment_id UUID REFERENCES environments(environment_id),
    source_environment_name VARCHAR(255),
    source_snapshot_name VARCHAR(255),
    use_latest_snapshot BOOLEAN DEFAULT false,
    
    -- Impact assessment
    impact_scope VARCHAR(30)[],
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
    notification_groups UUID[],  -- Array of group_ids to notify
    notification_lead_days INTEGER[] DEFAULT ARRAY[7, 1],
    notification_sent_dates TIMESTAMP WITH TIME ZONE[],
    
    -- Execution tracking
    execution_started_at TIMESTAMP WITH TIME ZONE,
    execution_completed_at TIMESTAMP WITH TIME ZONE,
    execution_notes TEXT,
    
    -- Linked to history after completion
    refresh_history_id UUID REFERENCES refresh_history(refresh_history_id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent duplicate active intents for same entity
    CONSTRAINT unique_active_intent UNIQUE (entity_type, entity_id, intent_status) 
        WHERE intent_status NOT IN ('COMPLETED', 'CANCELLED', 'FAILED', 'ROLLED_BACK')
);

CREATE INDEX idx_refresh_intents_entity ON refresh_intents(entity_type, entity_id);
CREATE INDEX idx_refresh_intents_status ON refresh_intents(intent_status);
CREATE INDEX idx_refresh_intents_planned_date ON refresh_intents(planned_date);
CREATE INDEX idx_refresh_intents_requested_by ON refresh_intents(requested_by_user_id);
```

#### Refresh Notification Settings Table
```sql
-- Notification preferences per entity/group
CREATE TABLE refresh_notification_settings (
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
    
    -- Event subscriptions
    subscribed_events VARCHAR(50)[] DEFAULT ARRAY[
        'REFRESH_APPROVED', 'REFRESH_SCHEDULED', 
        'REFRESH_REMINDER_1DAY', 'REFRESH_STARTING', 
        'REFRESH_COMPLETED', 'REFRESH_FAILED'
    ],
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Refresh Notification Log Table
```sql
-- Audit log of all notifications sent
CREATE TABLE refresh_notification_log (
    notification_log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    refresh_intent_id UUID REFERENCES refresh_intents(refresh_intent_id),
    event_type VARCHAR(50) NOT NULL,
    
    -- Delivery details
    channel VARCHAR(20) NOT NULL,
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

CREATE INDEX idx_notification_log_intent ON refresh_notification_log(refresh_intent_id);
CREATE INDEX idx_notification_log_status ON refresh_notification_log(status);
```

#### Refresh Booking Conflicts Table
```sql
-- Tracks conflicts between refresh intents and bookings
CREATE TABLE refresh_booking_conflicts (
    conflict_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    refresh_intent_id UUID NOT NULL REFERENCES refresh_intents(refresh_intent_id),
    booking_id UUID NOT NULL REFERENCES environment_bookings(booking_id),
    
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
```

### 1.3 Modifications to Existing Tables

```sql
-- Add refresh tracking columns to existing entity tables

-- Environments table
ALTER TABLE environments ADD COLUMN IF NOT EXISTS 
    last_refresh_date TIMESTAMP WITH TIME ZONE,
    last_refresh_type VARCHAR(30),
    last_refresh_source VARCHAR(255),
    last_refresh_by UUID REFERENCES users(user_id),
    next_refresh_intent_id UUID REFERENCES refresh_intents(refresh_intent_id);

-- Environment Instances table
ALTER TABLE environment_instances ADD COLUMN IF NOT EXISTS 
    last_refresh_date TIMESTAMP WITH TIME ZONE,
    last_refresh_type VARCHAR(30),
    last_refresh_source VARCHAR(255),
    last_refresh_by UUID REFERENCES users(user_id),
    next_refresh_intent_id UUID REFERENCES refresh_intents(refresh_intent_id);

-- Applications table
ALTER TABLE applications ADD COLUMN IF NOT EXISTS 
    last_refresh_date TIMESTAMP WITH TIME ZONE,
    last_refresh_type VARCHAR(30),
    last_refresh_source VARCHAR(255),
    last_refresh_by UUID REFERENCES users(user_id),
    next_refresh_intent_id UUID REFERENCES refresh_intents(refresh_intent_id);

-- Interfaces table
ALTER TABLE interfaces ADD COLUMN IF NOT EXISTS 
    last_refresh_date TIMESTAMP WITH TIME ZONE,
    last_refresh_type VARCHAR(30),
    last_refresh_source VARCHAR(255),
    last_refresh_by UUID REFERENCES users(user_id),
    next_refresh_intent_id UUID REFERENCES refresh_intents(refresh_intent_id);

-- App Components table
ALTER TABLE app_components ADD COLUMN IF NOT EXISTS 
    last_refresh_date TIMESTAMP WITH TIME ZONE,
    last_refresh_type VARCHAR(30),
    last_refresh_source VARCHAR(255),
    last_refresh_by UUID REFERENCES users(user_id),
    next_refresh_intent_id UUID REFERENCES refresh_intents(refresh_intent_id);

-- Infra Components table
ALTER TABLE infra_components ADD COLUMN IF NOT EXISTS 
    last_refresh_date TIMESTAMP WITH TIME ZONE,
    last_refresh_type VARCHAR(30),
    last_refresh_source VARCHAR(255),
    last_refresh_by UUID REFERENCES users(user_id),
    next_refresh_intent_id UUID REFERENCES refresh_intents(refresh_intent_id);

-- Test Data Sets table
ALTER TABLE test_data_sets ADD COLUMN IF NOT EXISTS 
    last_refresh_type VARCHAR(30),
    last_refresh_source VARCHAR(255),
    last_refresh_by UUID REFERENCES users(user_id),
    next_refresh_intent_id UUID REFERENCES refresh_intents(refresh_intent_id);
```

---

## 2. Backend Implementation

### 2.1 New Files to Create

```
backend/src/
├── controllers/
│   ├── refreshController.js          # Main refresh CRUD operations
│   ├── refreshIntentController.js    # Intent management & workflow
│   ├── refreshNotificationController.js  # Notification management
│   └── refreshCalendarController.js  # Calendar/timeline views
├── routes/
│   ├── refreshRoutes.js
│   ├── refreshIntentRoutes.js
│   └── refreshCalendarRoutes.js
├── services/
│   ├── refreshService.js             # Business logic
│   ├── refreshWorkflowService.js     # Approval workflow
│   ├── refreshNotificationService.js # Notification dispatch
│   ├── refreshConflictService.js     # Conflict detection
│   └── refreshSchedulerService.js    # Scheduled jobs
├── jobs/
│   ├── refreshReminderJob.js         # Send reminder notifications
│   ├── refreshConflictCheckJob.js    # Check for new conflicts
│   └── refreshCleanupJob.js          # Archive old intents
└── templates/
    ├── email/
    │   ├── refresh-intent-created.html
    │   ├── refresh-approved.html
    │   ├── refresh-reminder.html
    │   ├── refresh-starting.html
    │   ├── refresh-completed.html
    │   └── refresh-failed.html
    └── teams/
        └── refresh-notification.json
```

### 2.2 Controller Implementation Overview

#### refreshController.js
```javascript
// Key functions:
// - getRefreshHistory(entityType, entityId) - Get refresh history for an entity
// - getLastRefresh(entityType, entityId) - Get most recent refresh
// - recordRefresh(data) - Record a completed refresh
// - getRefreshStats(filters) - Analytics and statistics
// - exportRefreshHistory(filters) - Export to CSV/Excel
```

#### refreshIntentController.js
```javascript
// Key functions:
// - createIntent(data) - Create new refresh intent
// - updateIntent(intentId, data) - Update intent details
// - submitForApproval(intentId) - Submit DRAFT -> REQUESTED
// - approveIntent(intentId, notes) - REQUESTED -> APPROVED
// - rejectIntent(intentId, reason) - REQUESTED -> CANCELLED
// - scheduleIntent(intentId, scheduledDate) - APPROVED -> SCHEDULED
// - startExecution(intentId) - SCHEDULED -> IN_PROGRESS
// - completeIntent(intentId, executionData) - IN_PROGRESS -> COMPLETED
// - cancelIntent(intentId, reason) - Any -> CANCELLED
// - getIntentsByStatus(status) - List intents by status
// - getIntentsForEntity(entityType, entityId) - Get all intents for entity
// - getPendingApprovals() - Get intents awaiting approval
```

#### refreshConflictService.js
```javascript
// Key functions:
// - checkBookingConflicts(intentId) - Check for conflicts with bookings
// - detectUpcomingConflicts() - Batch check all scheduled intents
// - notifyConflictingParties(conflictId) - Send conflict notifications
// - resolveConflict(conflictId, resolution) - Mark conflict as resolved
```

### 2.3 Scheduled Jobs

```javascript
// Cron job configuration
const refreshJobs = {
  // Check for reminder notifications every hour
  reminderCheck: '0 * * * *',
  
  // Check for conflicts daily at 6 AM
  conflictCheck: '0 6 * * *',
  
  // Archive completed intents older than 90 days - weekly
  archiveCleanup: '0 2 * * 0',
  
  // Send daily digest of upcoming refreshes at 8 AM
  dailyDigest: '0 8 * * *'
};
```

---

## 3. Frontend Implementation

### 3.1 New Components

```
frontend/src/
├── app/(dashboard)/
│   ├── refresh/
│   │   ├── page.tsx                    # Refresh Calendar/Dashboard
│   │   ├── history/page.tsx            # Refresh History List
│   │   └── intents/page.tsx            # Manage Intents
│   └── environments/
│       └── [id]/
│           └── refresh/page.tsx        # Entity-specific refresh view
├── components/
│   ├── refresh/
│   │   ├── RefreshPanel.tsx            # Reusable panel for entity pages
│   │   ├── RefreshHistoryCard.tsx      # Display last refresh info
│   │   ├── RefreshIntentForm.tsx       # Form to create/edit intent
│   │   ├── RefreshIntentCard.tsx       # Display intent details
│   │   ├── RefreshCalendar.tsx         # Calendar view of refreshes
│   │   ├── RefreshTimeline.tsx         # Timeline visualization
│   │   ├── RefreshApprovalQueue.tsx    # Approval workflow UI
│   │   ├── RefreshConflictAlert.tsx    # Conflict warning banner
│   │   ├── RefreshNotificationConfig.tsx # Notification settings
│   │   └── RefreshStatusBadge.tsx      # Status indicator
│   └── notifications/
│       ├── NotificationBell.tsx        # Header notification icon
│       ├── NotificationPanel.tsx       # Notification dropdown
│       └── NotificationPreferences.tsx # User preferences
```

### 3.2 UI/UX Design

#### 3.2.1 Refresh Panel Component

The RefreshPanel will be embedded in Environment, Application, Interface, and Component detail pages:

```
┌─────────────────────────────────────────────────────────────────┐
│ 🔄 REFRESH MANAGEMENT                                    [≡]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ LAST REFRESH                                                    │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ ✓ Last refreshed: 15-Nov-2025 22:30 by John Smith          ││
│ │   Source: PROD-SNAPSHOT-2025-11-15 | Type: MASKED_COPY     ││
│ │   Change: CHG-123456                                        ││
│ │   Notes: Masked PII columns as per policy v4               ││
│ │   [View Full History]                                       ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ NEXT PLANNED REFRESH                                            │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ ⏰ Status: APPROVED                                         ││
│ │   Scheduled: 20-Dec-2025 02:00                              ││
│ │   Type: FULL_COPY from PROD                                 ││
│ │   Reason: Release 2025.1 baseline alignment                 ││
│ │   Requested by: Jane Doe | Approved by: Admin               ││
│ │   ⚠️ Requires Downtime (Est. 4 hours)                       ││
│ │                                                              ││
│ │   Notify: [Securities QA] [Payments QA] [Digital QA]        ││
│ │                                                              ││
│ │   [Edit] [Cancel] [Start Now]                               ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ ─ OR ─                                                          │
│                                                                 │
│ [+ Raise Refresh Request]                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 3.2.2 Refresh Intent Form

```
┌─────────────────────────────────────────────────────────────────┐
│ NEW REFRESH REQUEST                                      [X]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Target Entity: UAT-ENV-01 (Environment Instance)                │
│                                                                 │
│ Planned Date *        [📅 2025-12-20] [🕐 02:00]               │
│ Estimated Duration    [  4  ] hours                             │
│                                                                 │
│ Refresh Type *        [▼ MASKED_COPY                        ]   │
│   ○ FULL_COPY         - Complete database copy                  │
│   ○ PARTIAL_COPY      - Selected tables/schemas                 │
│   ● MASKED_COPY       - With PII/PCI masking                    │
│   ○ DATA_ONLY         - Data only, preserve schema              │
│   ○ CONFIG_ONLY       - Configuration refresh                   │
│   ○ GOLDEN_COPY       - Restore from baseline                   │
│                                                                 │
│ Source Environment *  [▼ PROD                               ]   │
│ Source Snapshot       [▼ Latest Available                   ]   │
│                       [ ] Use most recent snapshot              │
│                                                                 │
│ Reason / Justification *                                        │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ Align environment with Release 2025.1 regression baseline   ││
│ │ for Q1 testing cycle.                                       ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ Change Ticket         [ CHG-123456                          ]   │
│ Release Reference     [▼ Release 2025.1                     ]   │
│                                                                 │
│ IMPACT ASSESSMENT                                               │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ [✓] Data will be overwritten                                ││
│ │ [✓] Downtime required                                       ││
│ │ [ ] Read-only access during refresh                         ││
│ │ [ ] Schema changes included                                 ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ NOTIFICATIONS                                                   │
│ Notify Teams *        [Securities QA    ×] [Payments QA ×]     │
│                       [+ Add Team]                              │
│                                                                 │
│ Reminder Schedule     [✓] 7 days before  [✓] 1 day before      │
│                       [✓] 1 hour before                         │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ [Save as Draft]              [Submit for Approval]              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 3.2.3 Refresh Calendar View

```
┌─────────────────────────────────────────────────────────────────┐
│ REFRESH CALENDAR                        December 2025    [< >] │
├─────────────────────────────────────────────────────────────────┤
│ Filter: [All Environments ▼] [All Types ▼] [All Status ▼]      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Mon     Tue     Wed     Thu     Fri     Sat     Sun           │
│ ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐                    │
│ │  1  │  2  │  3  │  4  │  5  │  6  │  7  │                    │
│ │     │     │     │     │     │     │     │                    │
│ ├─────┼─────┼─────┼─────┼─────┼─────┼─────┤                    │
│ │  8  │  9  │ 10  │ 11  │ 12  │ 13  │ 14  │                    │
│ │     │ 🔄  │     │     │     │     │     │                    │
│ │     │UAT1 │     │     │     │     │     │                    │
│ ├─────┼─────┼─────┼─────┼─────┼─────┼─────┤                    │
│ │ 15  │ 16  │ 17  │ 18  │ 19  │ 20  │ 21  │                    │
│ │ 🔄  │     │     │     │     │ 🔄🔄│     │                    │
│ │SIT2 │     │     │     │     │UAT2 │     │                    │
│ │     │     │     │     │     │E2E1 │     │                    │
│ ├─────┼─────┼─────┼─────┼─────┼─────┼─────┤                    │
│ │ 22  │ 23  │ 24  │ 25  │ 26  │ 27  │ 28  │                    │
│ │     │     │     │     │     │     │     │                    │
│ └─────┴─────┴─────┴─────┴─────┴─────┴─────┘                    │
│                                                                 │
│ Legend: 🔄 Approved  ⏳ Pending  ✅ Completed  ❌ Failed        │
│                                                                 │
│ UPCOMING REFRESHES                                              │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ Dec 9  │ UAT-ENV-01 │ MASKED_COPY │ Approved │ John Smith   ││
│ │ Dec 15 │ SIT-ENV-02 │ FULL_COPY   │ Pending  │ Jane Doe     ││
│ │ Dec 20 │ UAT-ENV-02 │ CONFIG_ONLY │ Approved │ Admin        ││
│ │ Dec 20 │ E2E-ENV-01 │ FULL_COPY   │ Scheduled│ Bob Wilson   ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 3.2.4 Approval Queue

```
┌─────────────────────────────────────────────────────────────────┐
│ REFRESH APPROVAL QUEUE                              [🔔 5 New] │
├─────────────────────────────────────────────────────────────────┤
│ Filter: [Pending My Approval ▼]                     [Export]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ 🔄 UAT-ENV-01 - MASKED_COPY                                 ││
│ │ Requested: Dec 5, 2025 by John Smith                        ││
│ │ Planned: Dec 20, 2025 02:00                                 ││
│ │ Reason: Release 2025.1 baseline alignment                   ││
│ │ Change: CHG-123456                                          ││
│ │ Impact: ⚠️ Downtime Required (4 hrs) | Data Overwrite       ││
│ │                                                              ││
│ │ ⚠️ CONFLICT: 2 active bookings overlap refresh window       ││
│ │   - Booking #1234: Securities Team (Dec 19-21)              ││
│ │   - Booking #1235: Payments Team (Dec 20-22)                ││
│ │                                                              ││
│ │ [View Details] [✓ Approve] [✗ Reject] [📝 Request Changes] ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ 🔄 SIT-ENV-02 - FULL_COPY                                   ││
│ │ Requested: Dec 6, 2025 by Jane Doe                          ││
│ │ Planned: Dec 15, 2025 18:00                                 ││
│ │ Reason: Hotfix HF-2025.0.5 testing                          ││
│ │ Change: CHG-123789                                          ││
│ │ Impact: Data Overwrite | No Downtime                        ││
│ │                                                              ││
│ │ ✅ No conflicts detected                                     ││
│ │                                                              ││
│ │ [View Details] [✓ Approve] [✗ Reject] [📝 Request Changes] ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Integration Points

The RefreshPanel component will be integrated into:

1. **Environments Page** - Tab within environment details
2. **Applications Page** - Tab within application details
3. **Interfaces Page** - Tab within interface details
4. **Configs Page** - For config set refresh tracking
5. **Test Data Page** - For test data refresh tracking
6. **Bookings Page** - Warning banner for refresh conflicts

---

## 4. Notification System

### 4.1 Notification Channels

| Channel | Implementation | Use Case |
|---------|----------------|----------|
| **Email** | SMTP/SendGrid/AWS SES | Formal notifications, audit trail |
| **Microsoft Teams** | Incoming Webhook | Real-time team alerts |
| **Slack** | Incoming Webhook | Real-time team alerts |
| **In-App** | WebSocket + Database | Immediate UI feedback |
| **Custom Webhook** | HTTP POST | Integration with external systems |

### 4.2 Notification Events

| Event | Timing | Recipients |
|-------|--------|------------|
| `REFRESH_INTENT_CREATED` | Immediate | Entity owner, Approvers |
| `REFRESH_APPROVED` | Immediate | Requester, Notification groups |
| `REFRESH_REJECTED` | Immediate | Requester |
| `REFRESH_SCHEDULED` | Immediate | All notification groups |
| `REFRESH_REMINDER_7DAY` | 7 days before | All notification groups |
| `REFRESH_REMINDER_1DAY` | 1 day before | All notification groups |
| `REFRESH_REMINDER_1HOUR` | 1 hour before | All notification groups |
| `REFRESH_STARTING` | At start | All notification groups |
| `REFRESH_COMPLETED` | Immediate | All notification groups |
| `REFRESH_FAILED` | Immediate | All + Admins |
| `BOOKING_CONFLICT_DETECTED` | Immediate | Booking owner, Refresh requester |

### 4.3 Email Templates

Example: Refresh Completed Notification

```html
Subject: ✅ Environment Refresh Completed - {entity_name}

Hi {recipient_name},

The scheduled refresh for {entity_name} has been completed successfully.

📋 REFRESH DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Entity:      {entity_name} ({entity_type})
Type:        {refresh_type}
Source:      {source_environment} / {source_snapshot}
Started:     {start_time}
Completed:   {end_time}
Duration:    {duration}
Executed By: {executed_by}
Change Ref:  {change_ticket}

📝 NOTES
{execution_notes}

You may now proceed with your testing activities.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
View in BookMyEnv: {link_to_entity}

This is an automated notification from BookMyEnv.
```

### 4.4 Teams/Slack Webhook Payload

```json
{
  "@type": "MessageCard",
  "themeColor": "00FF00",
  "summary": "Environment Refresh Completed",
  "sections": [{
    "activityTitle": "✅ Refresh Completed: UAT-ENV-01",
    "facts": [
      { "name": "Type", "value": "MASKED_COPY" },
      { "name": "Source", "value": "PROD-SNAPSHOT-2025-12-09" },
      { "name": "Duration", "value": "3h 45m" },
      { "name": "Executed By", "value": "John Smith" },
      { "name": "Change", "value": "CHG-123456" }
    ],
    "markdown": true
  }],
  "potentialAction": [{
    "@type": "OpenUri",
    "name": "View in BookMyEnv",
    "targets": [{ "os": "default", "uri": "{link}" }]
  }]
}
```

---

## 5. Workflow & Business Rules

### 5.1 State Machine

```
                    ┌──────────────┐
                    │    DRAFT     │
                    └──────┬───────┘
                           │ Submit
                           ▼
                    ┌──────────────┐
           ┌────────│  REQUESTED   │────────┐
           │        └──────┬───────┘        │
           │ Reject        │ Approve        │ Cancel
           ▼               ▼                ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │  CANCELLED   │ │   APPROVED   │ │  CANCELLED   │
    └──────────────┘ └──────┬───────┘ └──────────────┘
                           │ Schedule
                           ▼
                    ┌──────────────┐
                    │  SCHEDULED   │──────────┐
                    └──────┬───────┘          │ Cancel
                           │ Start            ▼
                           ▼           ┌──────────────┐
                    ┌──────────────┐   │  CANCELLED   │
                    │ IN_PROGRESS  │   └──────────────┘
                    └──────┬───────┘
                    ┌──────┴───────┐
                    │              │
           Complete │              │ Fail
                    ▼              ▼
             ┌──────────────┐ ┌──────────────┐
             │  COMPLETED   │ │    FAILED    │
             └──────────────┘ └──────┬───────┘
                                     │ Rollback
                                     ▼
                              ┌──────────────┐
                              │ ROLLED_BACK  │
                              └──────────────┘
```

### 5.2 Business Rules

#### Validation Rules

| Rule ID | Rule | Action |
|---------|------|--------|
| R001 | Intent date cannot be in the past | Block submission |
| R002 | Intent must have reason (min 20 chars) | Block submission |
| R003 | At least one notification group required | Warning |
| R004 | Source environment required for copy types | Block submission |
| R005 | Change ticket recommended for production sources | Warning |

#### Conflict Rules

| Rule ID | Rule | Action |
|---------|------|--------|
| C001 | Overlapping booking exists | Flag conflict, require acknowledgment |
| C002 | Multiple refreshes within 3 days | Warning to approver |
| C003 | Refresh during release deployment window | Block or require override |
| C004 | Entity has active bookings | Notify booking owners |

#### Permission Rules

| Action | Required Role |
|--------|---------------|
| Create Draft Intent | Tester, ProjectLead, EnvironmentManager, Admin |
| Submit for Approval | Tester, ProjectLead, EnvironmentManager, Admin |
| Approve Intent | EnvironmentManager, Admin |
| Reject Intent | EnvironmentManager, Admin |
| Cancel Intent | Requester, EnvironmentManager, Admin |
| Start Execution | EnvironmentManager, Admin |
| Complete/Fail Execution | EnvironmentManager, Admin |
| Override Conflicts | Admin |

### 5.3 Approval Workflow Configuration

```javascript
// Configurable per environment category
const approvalConfig = {
  // Production-sourced refreshes always need approval
  productionSource: {
    requiresApproval: true,
    approverRoles: ['EnvironmentManager', 'Admin'],
    notifyOnRequest: ['env-managers@company.com']
  },
  
  // Non-prod to non-prod can be auto-approved
  nonProdToNonProd: {
    requiresApproval: false,
    autoApprove: true
  },
  
  // Downtime-required refreshes need approval
  downtimeRequired: {
    requiresApproval: true,
    requiresJustification: true,
    minimumLeadTimeDays: 3
  }
};
```

---

## 6. API Specifications

### 6.1 Refresh History Endpoints

```
GET    /api/refresh/history
       Query: entityType, entityId, startDate, endDate, refreshType, limit, offset
       
GET    /api/refresh/history/:historyId
       
GET    /api/refresh/history/entity/:entityType/:entityId
       
POST   /api/refresh/history
       Body: { entityType, entityId, refreshDate, refreshType, sourceEnvironmentId, ... }
       
GET    /api/refresh/history/stats
       Query: entityType, dateRange, groupBy
       
GET    /api/refresh/history/export
       Query: format (csv|xlsx), filters...
```

### 6.2 Refresh Intent Endpoints

```
GET    /api/refresh/intents
       Query: status, entityType, entityId, requestedBy, plannedDateFrom, plannedDateTo
       
GET    /api/refresh/intents/:intentId
       
POST   /api/refresh/intents
       Body: { entityType, entityId, plannedDate, refreshType, reason, ... }
       
PUT    /api/refresh/intents/:intentId
       Body: { plannedDate, refreshType, reason, ... }
       
DELETE /api/refresh/intents/:intentId
       
POST   /api/refresh/intents/:intentId/submit
       Action: Submit for approval (DRAFT -> REQUESTED)
       
POST   /api/refresh/intents/:intentId/approve
       Body: { notes }
       Action: Approve (REQUESTED -> APPROVED)
       
POST   /api/refresh/intents/:intentId/reject
       Body: { reason }
       Action: Reject (REQUESTED -> CANCELLED)
       
POST   /api/refresh/intents/:intentId/schedule
       Body: { scheduledDate }
       Action: Schedule (APPROVED -> SCHEDULED)
       
POST   /api/refresh/intents/:intentId/start
       Action: Start execution (SCHEDULED -> IN_PROGRESS)
       
POST   /api/refresh/intents/:intentId/complete
       Body: { executionNotes, dataVolumeGb, rowsAffected, ... }
       Action: Complete (IN_PROGRESS -> COMPLETED)
       
POST   /api/refresh/intents/:intentId/fail
       Body: { errorMessage, executionNotes }
       Action: Fail (IN_PROGRESS -> FAILED)
       
POST   /api/refresh/intents/:intentId/cancel
       Body: { reason }
       Action: Cancel (any -> CANCELLED)
       
GET    /api/refresh/intents/pending-approvals
       Returns intents awaiting approval for current user
       
GET    /api/refresh/intents/conflicts/:intentId
       Returns booking conflicts for an intent
```

### 6.3 Refresh Calendar Endpoints

```
GET    /api/refresh/calendar
       Query: startDate, endDate, entityType, status
       Returns: Array of intents formatted for calendar display
       
GET    /api/refresh/calendar/timeline
       Query: startDate, endDate, groupBy (entity|team|type)
       Returns: Timeline-formatted data
       
GET    /api/refresh/calendar/upcoming
       Query: days (default 30), limit
       Returns: Upcoming refreshes with countdown
```

### 6.4 Notification Endpoints

```
GET    /api/refresh/notifications/settings
       Query: entityType, entityId, groupId
       
PUT    /api/refresh/notifications/settings
       Body: { scopeType, entityType, entityId, emailEnabled, ... }
       
GET    /api/refresh/notifications/log
       Query: intentId, channel, status, dateRange
       
POST   /api/refresh/notifications/test
       Body: { channel, recipientEmail, webhookUrl }
       Action: Send test notification
```

---

## 7. Migration Strategy

### 7.1 Database Migration

```sql
-- Migration: V4.0.0__refresh_lifecycle_management.sql

-- Step 1: Create new enum types
-- Step 2: Create new tables
-- Step 3: Add columns to existing tables
-- Step 4: Create indexes
-- Step 5: Insert default notification settings
-- Step 6: Migrate any existing refresh data from test_data_sets

-- Rollback script available: V4.0.0__refresh_lifecycle_management_rollback.sql
```

### 7.2 Data Migration

For existing `test_data_sets.last_refreshed_date`:

```sql
-- Migrate existing refresh data to new history table
INSERT INTO refresh_history (
    entity_type, entity_id, entity_name,
    refresh_date, refresh_type, notes
)
SELECT 
    'TestDataSet', test_data_set_id, name,
    last_refreshed_date, 'DATA_ONLY', 'Migrated from legacy system'
FROM test_data_sets
WHERE last_refreshed_date IS NOT NULL;
```

### 7.3 Feature Flags

```javascript
// Feature flags for gradual rollout
const featureFlags = {
  refreshLifecycle: {
    enabled: true,
    historyTracking: true,
    intentManagement: true,
    approvalWorkflow: true,
    notifications: {
      email: true,
      teams: true,
      slack: false,  // Enable after testing
      inApp: true
    },
    conflictDetection: true,
    calendar: true
  }
};
```

---

## 8. Testing Strategy

### 8.1 Unit Tests

```
tests/
├── unit/
│   ├── controllers/
│   │   ├── refreshController.test.js
│   │   ├── refreshIntentController.test.js
│   │   └── refreshNotificationController.test.js
│   ├── services/
│   │   ├── refreshService.test.js
│   │   ├── refreshWorkflowService.test.js
│   │   ├── refreshConflictService.test.js
│   │   └── refreshNotificationService.test.js
│   └── models/
│       ├── refreshHistory.test.js
│       └── refreshIntent.test.js
```

### 8.2 Integration Tests

```
tests/
├── integration/
│   ├── refresh-workflow.test.js      # Full workflow: create -> approve -> complete
│   ├── refresh-conflicts.test.js     # Conflict detection scenarios
│   ├── refresh-notifications.test.js # Notification delivery
│   └── refresh-api.test.js           # API endpoint tests
```

### 8.3 E2E Tests

```
tests/
├── e2e/
│   ├── refresh-panel.spec.ts         # UI component tests
│   ├── refresh-calendar.spec.ts      # Calendar functionality
│   ├── refresh-approval.spec.ts      # Approval workflow UI
│   └── refresh-notifications.spec.ts # Notification preferences
```

### 8.4 Test Scenarios

| Scenario | Description | Expected Result |
|----------|-------------|-----------------|
| TC001 | Create refresh intent as Tester | Intent created in DRAFT status |
| TC002 | Submit intent for approval | Status changes to REQUESTED, approvers notified |
| TC003 | Approve intent | Status changes to APPROVED, requester notified |
| TC004 | Reject intent with reason | Status changes to CANCELLED, requester notified |
| TC005 | Complete refresh execution | History record created, entity updated |
| TC006 | Detect booking conflict | Conflict created, both parties notified |
| TC007 | Send 7-day reminder | Email/Teams notification sent |
| TC008 | Cancel scheduled refresh | Status changes, notifications sent |
| TC009 | Multiple intents for same entity | Prevented by constraint |
| TC010 | Past date validation | Submission blocked |

---

## 9. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Database schema migration
- [ ] Basic CRUD API for refresh history
- [ ] Basic CRUD API for refresh intents
- [ ] RefreshHistoryCard component
- [ ] RefreshIntentForm component

### Phase 2: Workflow (Week 3-4)
- [ ] State machine implementation
- [ ] Approval workflow API
- [ ] RefreshApprovalQueue component
- [ ] RefreshStatusBadge component
- [ ] Permission checks

### Phase 3: Integration (Week 5-6)
- [ ] RefreshPanel integration into entity pages
- [ ] Conflict detection service
- [ ] RefreshConflictAlert component
- [ ] Booking page integration

### Phase 4: Calendar & Visualization (Week 7-8)
- [ ] RefreshCalendar component
- [ ] RefreshTimeline component
- [ ] Calendar API endpoints
- [ ] Dashboard widgets

### Phase 5: Notifications (Week 9-10)
- [ ] Email notification service
- [ ] Teams webhook integration
- [ ] In-app notification system
- [ ] NotificationBell component
- [ ] Notification preferences UI

### Phase 6: Polish & Testing (Week 11-12)
- [ ] Comprehensive testing
- [ ] Performance optimization
- [ ] Documentation
- [ ] User acceptance testing
- [ ] Bug fixes

---

## 10. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Database migration issues | Low | High | Rollback script, staging testing |
| Notification delivery failures | Medium | Medium | Retry logic, fallback channels |
| Performance with large history | Medium | Medium | Indexing, pagination, archival |
| User adoption | Medium | Medium | Training, documentation, UX polish |
| Integration complexity | Medium | High | Phased rollout, feature flags |
| Approval workflow bottlenecks | Low | Medium | Auto-approval rules, delegation |

---

## Appendix A: Sample Data

### Refresh History Example
```json
{
  "refresh_history_id": "550e8400-e29b-41d4-a716-446655440001",
  "entity_type": "EnvironmentInstance",
  "entity_id": "550e8400-e29b-41d4-a716-446655440100",
  "entity_name": "UAT-ENV-01",
  "refresh_date": "2025-11-15T22:30:00Z",
  "refresh_type": "MASKED_COPY",
  "source_environment_name": "PROD",
  "source_snapshot_name": "PROD-SNAPSHOT-2025-11-15",
  "requested_by_user_id": "550e8400-e29b-41d4-a716-446655440200",
  "executed_by_user_id": "550e8400-e29b-41d4-a716-446655440201",
  "change_ticket_ref": "CHG-123456",
  "execution_status": "SUCCESS",
  "duration_minutes": 225,
  "data_volume_gb": 45.5,
  "notes": "Masked PII columns as per data policy v4. All test accounts preserved."
}
```

### Refresh Intent Example
```json
{
  "refresh_intent_id": "550e8400-e29b-41d4-a716-446655440002",
  "entity_type": "EnvironmentInstance",
  "entity_id": "550e8400-e29b-41d4-a716-446655440100",
  "entity_name": "UAT-ENV-01",
  "intent_status": "APPROVED",
  "planned_date": "2025-12-20T02:00:00Z",
  "planned_end_date": "2025-12-20T06:00:00Z",
  "refresh_type": "FULL_COPY",
  "source_environment_name": "PROD",
  "requires_downtime": true,
  "estimated_downtime_minutes": 240,
  "requested_by_user_id": "550e8400-e29b-41d4-a716-446655440200",
  "reason": "Align environment with Release 2025.1 regression baseline for Q1 testing cycle.",
  "change_ticket_ref": "CHG-123789",
  "release_id": "550e8400-e29b-41d4-a716-446655440300",
  "notification_groups": ["550e8400-e29b-41d4-a716-446655440400", "550e8400-e29b-41d4-a716-446655440401"],
  "approved_by_user_id": "550e8400-e29b-41d4-a716-446655440202",
  "approved_at": "2025-12-06T10:30:00Z"
}
```

---

## Appendix B: Configuration Reference

### Environment Variables

```env
# Notification Configuration
SMTP_HOST=smtp.company.com
SMTP_PORT=587
SMTP_USER=bookmyenv@company.com
SMTP_PASSWORD=****
SMTP_FROM=BookMyEnv <bookmyenv@company.com>

TEAMS_DEFAULT_WEBHOOK_URL=https://company.webhook.office.com/...
SLACK_DEFAULT_WEBHOOK_URL=https://hooks.slack.com/services/...

# Refresh Configuration
REFRESH_REMINDER_DAYS=7,1
REFRESH_REMINDER_HOURS=1
REFRESH_MIN_LEAD_TIME_DAYS=1
REFRESH_MAX_INTENTS_PER_ENTITY=3
REFRESH_HISTORY_RETENTION_DAYS=365
REFRESH_AUTO_ARCHIVE_DAYS=90
```

---

*Document Version: 1.0*  
*Created: December 9, 2025*  
*Author: BookMyEnv Development Team*
