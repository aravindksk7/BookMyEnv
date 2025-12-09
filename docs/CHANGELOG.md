# BookMyEnv - Changelog

All notable changes to BookMyEnv are documented here.

---

## [4.2.0] - 2025-12-09

### ⭐ New Features

#### Audit & Compliance System
- **Comprehensive Audit Logging** - Full CRUD traceability for all entity operations
  - Tracks CREATE, UPDATE, DELETE operations across all major entities
  - Captures actor information (user, role, IP address, user agent)
  - Stores before/after snapshots for change tracking
  - Records changed fields for easy diff viewing
  
- **Audit Events Dashboard** (Admin, EnvironmentManager, ProjectLead roles)
  - Real-time statistics cards (events today, 7 days, 30 days)
  - Top entity types breakdown
  - Top actors activity summary
  - Action type distribution

- **Advanced Search & Filtering**
  - Date range picker with presets (Today, Last 7 Days, Last 30 Days, Custom)
  - Filter by entity type (Environment, Booking, Application, Release, User, etc.)
  - Filter by action type (CREATE, UPDATE, DELETE, LOGIN, APPROVE, etc.)
  - Filter by actor (user who performed the action)
  - Filter by regulatory tag (SOX, GDPR, PCI-DSS, etc.)
  - Full-text search across entity names and descriptions

- **Event Detail View**
  - Side drawer with complete event details
  - Before/After snapshot comparison
  - Changed fields highlighting
  - Actor and context information

- **Compliance Reports**
  - Pre-built report templates:
    - All Activity Report
    - User Activity Report
    - Environment Changes
    - Booking Audit Trail
    - Security Events
    - Compliance Report
  - Export functionality (CSV, JSON)
  - Custom date range selection

#### Database Schema Updates
- New `audit_events` table with 25+ fields for comprehensive tracking
- New `audit_report_templates` table for report configuration
- New `audit_generated_reports` table for report history
- Performance indexes on timestamp, entity_type, actor, action_type

### 🔧 Improvements

- **Notification System**
  - Fixed notification badge not clearing after viewing
  - Notifications now properly mark as read when popover is closed
  - Improved unread count calculation

- **Backend Services**
  - Added `auditService.js` with AuditLogger utility class
  - Integrated audit logging into:
    - Authentication (login events)
    - Environment operations (create, update, delete)
    - Booking operations (create, update, status change, delete)
    - Application operations (create, update, delete)
    - Release operations (create, update)

### 🐛 Bug Fixes

- Fixed hydration errors in notification bell (nested `<p>` tags)
- Fixed MUI ListItemText component warnings
- Fixed `date-fns` missing dependency for DatePicker components

---

## [4.0.0] - 2025-12-08

### ⭐ Major Features

#### Refresh Lifecycle Management
- **Refresh Intent Creation** - Plan data refreshes with date/time and impact analysis
- **Conflict Detection** - Automatic detection of booking-refresh conflicts
- **Approval Workflow** - Multi-stage approval process for refresh operations
- **Refresh Calendar** - Visual calendar view with drag-and-drop rescheduling
- **Notification System** - Real-time alerts for conflicts and status changes

#### Booking-Refresh Dependency
- Bookings automatically check for refresh conflicts during creation
- Warning system for overlapping scheduled refreshes
- Acknowledgement flow for proceeding with risky bookings

#### Enhanced UI Components
- Refresh Calendar with Schedule-X integration
- Conflict resolution modals
- Impact analysis displays
- Timeline visualizations

### Database Updates
- `refresh_intents` table for refresh planning
- `refresh_history` table for execution tracking
- `refresh_booking_conflicts` table for conflict management
- `refresh_notification_log` table for notification history
- `refresh_notification_settings` table for user preferences

---

## [3.0.0] - 2025-11-15

### Features
- Environment Instance Lifecycle (Available → Reserved → InUse → Maintenance)
- Booking conflict detection and resolution
- Release management with deployment tracking
- Application component management
- Integration framework for JIRA, GitLab, ServiceNow

---

## [2.0.0] - 2025-10-01

### Features
- User authentication with JWT
- Role-based access control (Admin, EnvironmentManager, ProjectLead, Tester, Viewer)
- Environment and instance management
- Basic booking system
- Dashboard with statistics

---

## [1.0.0] - 2025-09-01

### Initial Release
- Core environment booking functionality
- User management
- PostgreSQL database
- Docker containerization
- Next.js frontend with Material-UI
