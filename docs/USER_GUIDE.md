# BookMyEnv (BME) - User Guide

A comprehensive guide to using the BookMyEnv environment booking and management system.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [Environments Management](#environments-management)
4. [Bookings Management](#bookings-management)
5. [Releases Management](#releases-management)
6. [Applications Management](#applications-management)
7. [Groups Management](#groups-management)
8. [Monitoring](#monitoring)
9. [Integrations](#integrations)
10. [Settings & Administration](#settings--administration)
11. [User Roles & Permissions](#user-roles--permissions)
12. [Best Practices](#best-practices)
13. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Accessing the Application

1. Open your web browser and navigate to: **https://localhost** (or your deployed URL)
2. Accept the self-signed certificate warning (development only)
3. You will be redirected to the login page

> **Note**: For production, use proper SSL certificates from Let's Encrypt or a commercial CA.

### Login

1. Enter your **Email** (e.g., `admin@bme.local`)
2. Enter your **Password** (e.g., `Admin@123`)
3. Click **Sign In**

> **Security**: After 5 failed login attempts, you'll be temporarily blocked for 15 minutes.

#### Demo Accounts

| Role | Email | Password | Access Level |
|------|-------|----------|--------------|
| Admin | admin@bme.local | Admin@123 | Full system access |
| Environment Manager | envmgr@bme.local | Admin@123 | Manage environments & approve bookings |
| Project Lead | lead@bme.local | Admin@123 | Create bookings & manage releases |
| Tester | tester@bme.local | Admin@123 | Create bookings & view resources |
| Viewer | viewer@bme.local | Admin@123 | Read-only access |

> **Production Note**: Change all demo passwords immediately in production environments!

### Navigation

After logging in, you'll see the main navigation sidebar on the left with:

- **Dashboard** - Overview and statistics
- **Monitoring** - Real-time environment health
- **Environments** - Manage environments and instances
- **Bookings** - Book and manage environment reservations
- **Releases** - Plan and track releases
- **Applications** - Manage applications and components
- **Groups** - User groups management
- **Integrations** - External tool connections
- **Settings** - User profile and system settings

---

## Dashboard Overview

The Dashboard provides a quick summary of system status:

### Statistics Cards

- **Environments** - Total number of environments in the system
- **Total Instances** - Count of all environment instances
- **Available Instances** - Instances currently available for booking
- **Active Bookings** - Currently active environment reservations
- **In-Progress Releases** - Releases currently being deployed
- **Applications** - Total applications managed

### Instance Availability

Visual indicator showing the percentage of available vs. total instances.

### Recent Activity

Live feed of recent actions in the system:
- Environment creations/updates
- Booking requests and approvals
- Release status changes
- User actions

---

## Environments Management

### Viewing Environments

1. Click **Environments** in the sidebar
2. View the list of all environments with:
   - Name
   - Category (NonProd, PreProd, DR)
   - Lifecycle Stage
   - Owner Team
   - Instance Count

### Creating an Environment

1. Click the **+ Add Environment** button
2. Fill in the required fields:
   - **Name** - Unique environment name (e.g., "SIT Environment 1")
   - **Category** - Select: NonProd, PreProd, or DR
   - **Description** - Brief description of the environment
   - **Lifecycle Stage** - Active, Provisioning, Decommissioned
   - **Owner Team** - Team responsible for the environment
   - **Support Group** - Support contact group
   - **Data Sensitivity** - NonProdDummy, MaskedProd, ProdClone, LiveProd
3. Click **Create**

### Managing Environment Instances

Each environment can have multiple instances (actual deployments):

#### Creating an Instance

1. Click on an environment row to view details
2. Go to the **Instances** tab
3. Click **+ Add Instance**
4. Fill in:
   - **Name** - Instance name (e.g., "SIT-Instance-A")
   - **Operational Status** - Available, InUse, Maintenance, Offline
   - **Availability Window** - 24x7, BusinessHours, Weekdays
   - **Capacity** - Max concurrent users/tests
   - **Primary Location** - Data center/region
   - **Bookable** - Whether it can be reserved
5. Click **Create**

#### Instance Actions

- **Edit** - Modify instance properties
- **Delete** - Remove instance (if not in use)
- **View Details** - See full configuration

### Linking Applications to Instances

1. In the environment detail view, go to **Applications** tab
2. Click **+ Link Application**
3. Select the application to link
4. Configure:
   - **Deployment Model** - Standalone, Shared, Dedicated
   - **Version** - Application version deployed
   - **Deployment Status** - Deployed, Pending, Failed
5. Click **Link**

---

## Bookings Management

### Viewing Bookings

1. Click **Bookings** in the sidebar
2. Choose view mode:
   - **Table View** - List format with filtering
   - **Calendar View** - Monthly calendar visualization

### Filtering Bookings

Use the filter options:
- **Search** - Search by title or description
- **Test Phase** - SIT, UAT, NFT, Performance, etc.
- **Status** - Requested, Approved, Active, Completed, Cancelled
- **Environment** - Filter by specific environment

### Creating a Booking

1. Click **+ New Booking**
2. Fill in the booking details:

   **Basic Information:**
   - **Booking Type** - SingleEnv (one environment) or MultiEnvE2E (multiple)
   - **Test Phase** - Select the testing phase
   - **Title** - Descriptive booking title
   - **Description** - Detailed purpose of the booking

   **Schedule:**
   - **Start Date/Time** - When the booking begins
   - **End Date/Time** - When the booking ends

   **Resources:**
   - Select environment instances to book
   - Assign logical roles (SystemUnderTest, UpstreamDependency, etc.)

3. Click **Create**

### Booking Statuses

| Status | Description |
|--------|-------------|
| Requested | Initial state, awaiting review |
| PendingApproval | Conflicts detected, needs approval |
| Approved | Approved and confirmed |
| Active | Currently in use |
| Completed | Booking period ended |
| Cancelled | Booking was cancelled |

### Conflict Detection

The system automatically detects scheduling conflicts:

- **Overlapping bookings** on the same instance
- **Potential conflicts** are flagged for review
- Bookings with conflicts go to "PendingApproval" status

### Approving/Rejecting Bookings

(Environment Manager or Admin only)

1. Find the booking in "PendingApproval" status
2. Click to view details
3. Review conflict information
4. Click **Approve** or **Reject**

### Calendar View

The calendar provides a visual timeline:
- Navigate months with **< >** arrows
- Click on a day to see bookings
- Color-coded by status:
  - 🟢 Green - Active
  - 🟡 Yellow - Pending
  - 🔵 Blue - Approved
  - ⚪ Gray - Completed

---

## Releases Management

### Viewing Releases

1. Click **Releases** in the sidebar
2. View releases with status indicators

### Creating a Release

1. Click **+ New Release**
2. Fill in:
   - **Name** - Release identifier (e.g., "v2.5.0")
   - **Description** - Release notes/description
   - **Version** - Semantic version number
   - **Release Type** - Major, Minor, Patch, Hotfix
   - **Planned Start/End** - Deployment window
   - **Target Environments** - Select target environments
   - **Applications** - Applications included in release
3. Click **Create**

### Release Statuses

| Status | Description |
|--------|-------------|
| Planned | Scheduled but not started |
| InProgress | Currently being deployed |
| Completed | Successfully deployed |
| RolledBack | Deployment was reversed |
| Cancelled | Release was cancelled |

### Release Workflow

1. **Planned** → Create release with schedule
2. **InProgress** → Begin deployment
3. **Completed** → Mark successful deployment
4. (Optional) **RolledBack** → If issues occur

---

## Applications Management

### Viewing Applications

1. Click **Applications** in the sidebar
2. View applications list with:
   - Name
   - Business Domain
   - Criticality
   - Owner Team
   - Component Count

### Creating an Application

1. Click **+ Add Application**
2. Fill in:
   - **Name** - Application name
   - **Description** - What the application does
   - **Business Domain** - Domain category
   - **Criticality** - Critical, High, Medium, Low
   - **Data Sensitivity** - Data classification
   - **Owner Team** - Responsible team
   - **Test Owner** - QA/Test lead
3. Click **Create**

### Managing Components

Applications have components (services, modules):

#### Adding a Component

1. Select an application
2. Go to **Components** tab
3. Click **+ Add Component**
4. Fill in:
   - **Name** - Component name
   - **Component Type** - Microservice, API, UI, Database, MessageQueue, etc.
   - **Source Repo** - Git repository URL
   - **Build Pipeline ID** - CI/CD pipeline reference
   - **Runtime Platform** - Container, VM, Serverless, etc.
   - **Owner Team** - Component owner
5. Click **Create**

---

## Groups Management

### Viewing Groups

1. Click **Groups** in the sidebar
2. View teams/groups in the system

### Creating a Group

1. Click **+ Add Group**
2. Fill in:
   - **Name** - Group name (e.g., "QA Team")
   - **Description** - Group purpose
   - **Group Type** - Team, Project, Department
3. Click **Create**

### Managing Members

1. Select a group
2. Go to **Members** tab
3. Click **+ Add Member**
4. Select users to add
5. Click **Add**

---

## Monitoring

The Monitoring page provides real-time system health:

### Environment Statistics

- Total environments and instances
- Breakdown by category (NonProd, PreProd, DR)
- Instance availability status

### Health Indicators

- **Available** - Ready for use
- **In Use** - Currently booked
- **Maintenance** - Under maintenance
- **Offline** - Not operational

### Infrastructure Components

View infrastructure components deployed across environments.

---

## Integrations

### Supported Integrations

- **Jira** - Issue tracking and project management
- **GitLab** - Source control and CI/CD
- **ServiceNow** - Change management and CMDB

### Configuring an Integration

(Admin only)

1. Click **Integrations** in the sidebar
2. Click **+ Add Integration**
3. Select the tool type
4. Fill in connection details:
   - **Name** - Integration identifier
   - **Base URL** - Tool API endpoint
   - **API Token** - Authentication token
5. Click **Test Connection** to verify
6. Click **Save**

---

## Settings & Administration

### Accessing Settings

Click **Settings** in the sidebar or click your avatar → **Settings**

### Profile Tab

- View and update your profile information
- Change display name
- Update time zone

### Notifications Tab

- Configure notification preferences
- Enable/disable email notifications
- Set notification frequency

### User Management (Admin only)

- View all users
- Create new users
- Edit user roles
- Activate/deactivate accounts
- Reset passwords

### SSO Configuration (Admin only)

- Configure identity providers (Azure AD, Okta, etc.)
- Set up SAML/OIDC authentication
- Map SSO groups to BME roles

---

## User Roles & Permissions

### Role Hierarchy

| Role | Environments | Bookings | Releases | Users | Settings |
|------|--------------|----------|----------|-------|----------|
| Admin | Full | Full | Full | Full | Full |
| EnvironmentManager | Full | Approve | View | View | Limited |
| ProjectLead | View | Create | Full | View | Limited |
| Tester | View | Create | View | - | Profile |
| Viewer | View | View | View | - | Profile |

### Detailed Permissions

**Admin**
- All permissions
- User management
- System configuration
- SSO setup

**Environment Manager**
- Create/edit/delete environments
- Approve/reject bookings
- Manage instances
- View all resources

**Project Lead**
- Create bookings
- Manage releases
- View all environments
- Manage applications

**Tester**
- Create bookings
- View environments
- View releases
- View applications

**Viewer**
- Read-only access to all resources

---

## Best Practices

### Booking Best Practices

1. **Book in Advance** - Reserve environments early for critical testing
2. **Accurate Timeframes** - Set realistic start/end times
3. **Descriptive Titles** - Use clear, descriptive booking names
4. **Check Conflicts** - Review conflicts before submitting
5. **Release on Time** - Complete bookings promptly to free resources

### Environment Management

1. **Keep Status Updated** - Mark instances accurately (Available, Maintenance, etc.)
2. **Document Changes** - Add descriptions when updating environments
3. **Regular Cleanup** - Remove obsolete instances and environments
4. **Capacity Planning** - Monitor instance utilization

### Release Management

1. **Plan Ahead** - Create releases with adequate lead time
2. **Link Applications** - Associate all affected applications
3. **Target Environments** - Specify all deployment targets
4. **Update Status** - Keep release status current

---

## Troubleshooting

### Common Issues

#### Login Failed
- Verify email and password
- Check if account is active
- Clear browser cache and cookies

#### Booking Conflicts
- Check the calendar view for overlapping bookings
- Contact the conflicting booking owner
- Request approval if conflict is acceptable

#### Environment Not Available
- Check operational status
- Verify booking end time hasn't expired
- Contact environment owner

#### Page Not Loading
- Check network connection
- Clear browser cache
- Try refreshing the page

### Getting Help

1. Check this documentation
2. Contact your system administrator
3. Review recent activity logs
4. Submit a support ticket

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + K` | Quick search |
| `Esc` | Close dialogs |
| `Enter` | Confirm actions |

---

## API Access

For programmatic access, see the API documentation:
- Base URL: `http://localhost:5000/api`
- Authentication: JWT Bearer token
- Full API docs: `/api/docs`

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Nov 2025 | Initial release |

---

**© 2025 BookMyEnv. All rights reserved.**
