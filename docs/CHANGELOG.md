# BookMyEnv - Changelog

All notable changes to BookMyEnv are documented here.

---

## [6.0.0] - 2025-12-24

### ⭐ Performance & Scalability Improvements

#### Database Search Indexes
- **pg_trgm Extension** - Enabled PostgreSQL trigram extension for efficient text search
- **GIN Indexes** - Added 11 trigram indexes for ILIKE search optimization:
  - `environments` - name, description columns
  - `applications` - name, description columns
  - `environment_bookings` - title, description columns
  - `interfaces` - name column
  - `releases` - name, description columns
  - `users` - display_name, username columns
- **B-tree Indexes** - Added filtering indexes:
  - `idx_environments_category`, `idx_environments_lifecycle`
  - `idx_applications_criticality`, `idx_applications_domain`

#### API Pagination
- **All List Endpoints** - Now support `?page=N&limit=N` query parameters
- **Pagination Metadata** - Responses include pagination object with:
  - `page`, `limit`, `totalItems`, `totalPages`
  - `hasNextPage`, `hasPrevPage` for navigation
- **Default Behavior** - 20 items per page, max 100 items per request
- **Affected Endpoints**:
  - `GET /api/environments`
  - `GET /api/applications`
  - `GET /api/bookings`
  - `GET /api/instances`

#### N+1 Query Optimization
- **Environment getById** - Single query with LATERAL JOINs fetches environment + instances + counts
- **Application getById** - Single query with subqueries fetches application + components + deployments
- **Performance Impact** - Reduced database queries from 3-5 to 1 per detail view

### 🔧 Technical Changes

#### New Files
- `backend/src/utils/pagination.js` - Pagination utility functions
- `backend/database/migrations/V5.1.0__search_indexes_and_performance.sql` - Migration script
- `test-pagination.ps1` - Pagination and search test script
- `docs/UPGRADE_GUIDE_v6.0.0.md` - Upgrade documentation

#### Updated Controllers
- `environmentController.js` - getAll, getAllInstances with pagination; getById optimized
- `applicationController.js` - getAll with pagination; getById optimized  
- `bookingController.js` - getAll with pagination

#### Database Schema
- Updated `init.sql` to version 1.3
- Added `pg_trgm` extension
- Added 15 new indexes for search and filtering

### 📚 Documentation Updates
- Updated README.md with v6.0.0 features and API pagination documentation
- Updated USER_GUIDE.md with pagination usage
- Updated ARCHITECTURE.md with performance features
- Updated QUICK_REFERENCE.md with API pagination examples
- Added UPGRADE_GUIDE_v6.0.0.md

---

## [5.0.0] - 2025-12-15

### ⭐ New Features

#### Email Notifications
- **SMTP/SendGrid/AWS SES Support** - Configurable email providers
- **Notification Types** - Booking confirmations, conflict alerts, release updates
- **Admin Configuration** - UI for managing email settings

#### Dark Mode
- **System-wide Theme** - Dark mode support across all pages
- **User Preference** - Persisted theme selection per user
- **Auto-detect** - Follows system preference by default

#### UI Enhancements
- Improved dashboard layouts
- Better mobile responsiveness
- Enhanced form validation feedback

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
