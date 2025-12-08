# BookMyEnv (BME) - User Guide

A comprehensive guide to using the BookMyEnv environment booking and management system.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [Environments Management](#environments-management)
4. [Environment Instance Lifecycle](#environment-instance-lifecycle)
5. [Bookings Management](#bookings-management)
6. [Conflict Detection & Resolution](#conflict-detection--resolution)
7. [Releases Management](#releases-management)
8. [Applications Management](#applications-management)
9. [Application Deployments](#application-deployments)
10. [Interfaces & Endpoints](#interfaces--endpoints)
11. [Components & Instances](#components--instances)
12. [Groups Management](#groups-management)
13. [Bulk Data Upload](#bulk-data-upload)
14. [Monitoring](#monitoring)
15. [Integrations](#integrations)
16. [Settings & Administration](#settings--administration)
17. [User Roles & Permissions](#user-roles--permissions)
18. [Best Practices](#best-practices)
19. [Troubleshooting](#troubleshooting)

> **📘 Related Documentation**: For detailed lifecycle diagrams and state transitions, see the [Lifecycle Guide](LIFECYCLE_GUIDE.md).

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

### Understanding Environment Lifecycle

Environments progress through four lifecycle stages:

| Stage | Description | Bookings Allowed |
|-------|-------------|------------------|
| **Planned** | Environment is being designed and set up | ❌ No |
| **Active** | Fully operational and available | ✅ Yes |
| **Retiring** | Being phased out, existing bookings only | ⚠️ Existing only |
| **Decommissioned** | No longer in use, archived | ❌ No |

> **📘 See Also**: [Environment Lifecycle Details](LIFECYCLE_GUIDE.md#environment-lifecycle) for complete state transition diagrams.

### Viewing Environments

1. Click **Environments** in the sidebar
2. View the list of all environments with:
   - Name
   - Category (NonProd, PreProd, DR, Training, Sandpit)
   - Lifecycle Stage (with visual indicator)
   - Owner Team
   - Instance Count

### Environment Categories

| Category | Purpose | Typical Use |
|----------|---------|-------------|
| **NonProd** | Development and testing | DEV, SIT, Integration |
| **PreProd** | Final pre-production testing | UAT, Staging |
| **DR** | Disaster recovery | DR Failover, Business Continuity |
| **Training** | User training | Training, Demos |
| **Sandpit** | Experimentation | POCs, Innovation |

### Creating an Environment

1. Click the **+ Add Environment** button
2. Fill in the required fields:
   - **Name** - Unique environment name (e.g., "SIT Environment 1")
   - **Category** - Select: NonProd, PreProd, DR, Training, or Sandpit
   - **Description** - Brief description of the environment
   - **Lifecycle Stage** - Planned (initial), Active (ready for use)
   - **Owner Team** - Team responsible for the environment
   - **Support Group** - Support contact group
   - **Data Sensitivity** - NonProdDummy, PII, PCI, Confidential
   - **Usage Policies** - Guidelines for environment usage
3. Click **Create**

### Transitioning Environment Lifecycle

**To Activate an Environment (Planned → Active):**
1. Ensure at least one instance is in Available status
2. Verify all required applications are deployed
3. Change Lifecycle Stage to "Active"

**To Retire an Environment (Active → Retiring):**
1. Notify all active users with minimum 2-week notice
2. Ensure no critical bookings are affected
3. Change Lifecycle Stage to "Retiring"
4. Complete or cancel remaining bookings

**To Decommission (Retiring → Decommissioned):**
1. Ensure all bookings are completed or cancelled
2. Archive any required data
3. Change Lifecycle Stage to "Decommissioned"

---

## Environment Instance Lifecycle

### Understanding Instance Status

Instances have two status dimensions:

**Operational Status** (physical state):
| Status | Meaning | Can Book? |
|--------|---------|-----------|
| **Provisioning** | Being set up | ❌ No |
| **Available** | Ready for use | ✅ Yes |
| **Maintenance** | Scheduled maintenance | ❌ No |
| **Broken** | Has critical issues | ❌ No |

**Booking Status** (reservation state):
| Status | Meaning | Can Book? |
|--------|---------|-----------|
| **Available** | No active bookings | ✅ Yes |
| **PartiallyBooked** | Has bookings but capacity remains | ✅ Yes |
| **FullyBooked** | At maximum capacity | ❌ No |

> **📘 See Also**: [Instance Lifecycle Details](LIFECYCLE_GUIDE.md#environment-instance-lifecycle) for complete state transitions.

### Managing Environment Instances

Each environment can have multiple instances (actual deployments):

#### Creating an Instance

1. Click on an environment row to view details
2. Go to the **Instances** tab
3. Click **+ Add Instance**
4. Fill in:
   - **Name** - Instance name (e.g., "SIT-Instance-A")
   - **Operational Status** - Provisioning (initial), Available (ready)
   - **Availability Window** - 24x7, BusinessHours, Weekdays
   - **Capacity** - Max concurrent bookings allowed
   - **Primary Location** - Data center/region
   - **Bookable** - Whether it can be reserved
5. Click **Create**

#### Instance Status Transitions

```
Provisioning → Available → Maintenance → Available
                    ↓           ↓
                 Broken  ←───────┘
                    ↓
                Available (after repair)
```

#### Instance Actions

- **Edit** - Modify instance properties
- **Change Status** - Update operational status
- **Delete** - Remove instance (if no active bookings)
- **View Details** - See full configuration including deployed applications

### Linking Applications to Instances

1. In the environment detail view, go to **Applications** tab
2. Click **+ Link Application**
3. Select the application to link
4. Configure:
   - **Deployment Model** - Monolith, Microservices, SaaS, COTS
   - **Version** - Application version deployed
   - **Deployment Status** - Aligned, Mixed, OutOfSync, Broken
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

## Conflict Detection & Resolution

### How Conflicts Are Detected

The system automatically detects conflicts when:
- Multiple bookings request the same environment instance
- Booking time periods overlap
- Resource availability changes during a booking period

### Conflict Status Types

| Status | Meaning |
|--------|--------|
| **None** | No conflicts detected |
| **PotentialConflict** | Overlapping booking detected, needs review |
| **ConflictConfirmed** | Conflict verified and pending resolution |
| **Resolved** | Conflict has been addressed |

### Viewing Conflicts

1. Go to **Bookings** page
2. Click the **Conflicts** tab to see all bookings with unresolved conflicts
3. Or click **View Details** on any booking with a conflict indicator (⚠️)

### Resolving Conflicts

1. Find a booking with conflicts and click the **Resolve** button (gavel icon)
2. Review the conflict details:
   - Current booking summary
   - Overlapping bookings count
   - Affected resources
3. Select a resolution method:

| Resolution Type | Description |
|-----------------|-------------|
| **Accept Overlap** | Both bookings share the resource (coordinate usage) |
| **Mark as Resolved** | Manually mark resolved without changes |
| **Remove Resource** | Remove the conflicting resource from this booking |
| **Adjust Timing** | Modify booking start/end times to avoid overlap |
| **Reject Booking** | Cancel this booking due to the conflict |

4. Add resolution notes explaining your decision
5. Click **Apply Resolution**

### Conflict Prevention

- Use the **Calendar View** to check availability before booking
- Review conflict warnings when creating a new booking
- Consider booking during off-peak times
- Communicate with other teams about shared resources

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

## Application Deployments

### Overview

Application Deployments track the relationship between applications and environment instances. This helps teams understand:
- Where each application is deployed
- What version is running in each environment
- The deployment model and status

### Viewing Deployments (Application View)

1. Click **Applications** in the sidebar
2. Select an application and click **View Details**
3. Go to the **Deployments** tab
4. View all environment instances where the application is deployed

### Deploying an Application

1. Open the application's detail view
2. Go to **Deployments** tab
3. Click **Deploy to Environment**
4. Fill in the deployment form:
   - **Environment Instance** (required): Select the target instance
   - **Version**: Enter the version being deployed (e.g., "2.5.0")
   - **Deployment Model**: Select the architecture type
   - **Deployment Status**: Select the current status
5. Click **Deploy**

### Deployment Models

| Model | Description | Use Case |
|-------|-------------|----------|
| **Monolith** | Single deployable unit | Traditional applications |
| **Microservices** | Distributed services | Cloud-native apps |
| **SaaS** | Software as a Service | Third-party hosted |
| **COTS** | Commercial Off-The-Shelf | Vendor products |

### Deployment Statuses

| Status | Description | Action Needed |
|--------|-------------|---------------|
| **Aligned** | All components match expected versions | None |
| **Mixed** | Some components at different versions | Review |
| **OutOfSync** | Deployment differs from plan | Investigate |
| **Broken** | Deployment has issues | Immediate action |

### Editing a Deployment

1. In the Deployments tab, find the deployment row
2. Click the **Edit** icon
3. Update version, model, or status as needed
4. Click **Update**

### Undeploying an Application

1. In the Deployments tab, find the deployment row
2. Click the **Undeploy** icon
3. Confirm the action in the dialog
4. The deployment record is removed

### Managing Deployments from Environments

You can also manage deployments from the Environment side:

1. Go to **Environments** page
2. Click **View Details** on an environment
3. Go to the **Applications** tab
4. View all applications deployed to this environment
5. Click **Link Application** to add a new deployment
6. Edit or unlink existing deployments

### Deployment Best Practices

1. **Keep versions updated** - Update the version field when deploying new releases
2. **Monitor status** - Check for OutOfSync or Broken deployments regularly
3. **Document models** - Use consistent deployment models across environments
4. **Review before booking** - Check deployments when planning test bookings

---

## Interfaces & Endpoints

### Understanding Interfaces

Interfaces define communication contracts between applications or with external systems. Each interface can have multiple endpoints configured per environment instance.

> **📘 See Also**: [Interface Lifecycle Details](LIFECYCLE_GUIDE.md#interface-lifecycle) for complete lifecycle documentation.

### Interface Properties

| Property | Description |
|----------|-------------|
| **Name** | Unique identifier for the interface |
| **Direction** | Inbound, Outbound, or Bidirectional |
| **Pattern** | REST, SOAP, MQ, Kafka, FileDrop, etc. |
| **Frequency** | RealTime, NearRealTime, or Batch |
| **Source Application** | Where data originates |
| **Target Application** | Where data goes (or External Party) |
| **SLA** | Service level agreement |

### Viewing Interfaces

1. Click **Environments** → select an environment → **Interfaces** tab
2. Or view from Application details → **Interfaces** tab
3. See all interfaces with their configurations

### Interface Endpoint Configuration

Each interface has endpoints configured per environment instance with different test modes:

| Test Mode | Description | When to Use |
|-----------|-------------|-------------|
| **Live** | Real connection to target system | Production-like testing, E2E |
| **Virtualised** | Service virtualization (Parasoft, WireMock) | Controlled testing in SIT |
| **Stubbed** | Simple mock responses | Development, unit testing |
| **Disabled** | Interface turned off | Isolated component testing |

### Configuring Interface Endpoints

1. Navigate to Environment Instance details
2. Go to **Interfaces** tab
3. For each interface, configure:
   - **Endpoint URL** - Connection string/URL
   - **Test Mode** - Live, Virtualised, Stubbed, or Disabled
   - **Enabled** - Whether endpoint is active

### Interface Endpoint Promotion Strategy

As you move through environments, promote interface modes:

```
Development (Stubbed) → SIT (Virtualised) → UAT (Live/Virtualised) → PreProd (Live)
```

---

## Components & Instances

### Understanding Component Instances

Component Instances track the deployment of individual application components (microservices, APIs, UIs) to specific environment instances.

> **📘 See Also**: [Component Instance Lifecycle](LIFECYCLE_GUIDE.md#component-instance-lifecycle) for detailed status transitions.

### Component Instance Status

| Status | Description | Alert Level |
|--------|-------------|-------------|
| **Deployed** | Successfully running | ✅ None |
| **PartiallyDeployed** | Some replicas running | ⚠️ Warning |
| **RollbackPending** | Rolling back to previous version | ⚠️ Info |
| **Failed** | Deployment failed | ❌ Critical |

### Managing Component Instances

1. Navigate to Application → **Components** tab
2. Select a component
3. View instances across environments
4. For each instance, see:
   - Environment Instance name
   - Deployed version
   - Deployment status
   - Last deployed date

### Deploying Component Instances

1. From Application → Components → select component
2. Click **Deploy to Instance**
3. Select target Environment Instance
4. Enter version number
5. Click **Deploy**

### Version Tracking Across Environments

Component instances allow you to track versions across your environment landscape:

```
Example: payment-api versions

┌─────────────────────────────────────────────┐
│ Instance      │ Version  │ Status          │
├───────────────┼──────────┼─────────────────┤
│ DEV-1         │ 2.3.0    │ Deployed        │
│ SIT-1         │ 2.2.0    │ Deployed        │
│ UAT-1         │ 2.1.0    │ Deployed        │
│ PreProd-1     │ 2.0.0    │ Deployed        │
└─────────────────────────────────────────────┘
```

### Component Instance Best Practices

1. **Version Consistency** - Keep track of version differences across environments
2. **Status Monitoring** - Address PartiallyDeployed or Failed statuses promptly
3. **Deployment Records** - Update last_deployed_date when deploying
4. **Rollback Planning** - Know which version to rollback to if needed

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

## Bulk Data Upload

### Accessing Bulk Upload

1. Navigate to **Settings** (gear icon in sidebar)
2. Click the **Data Management** tab
3. Click **Go to Bulk Upload**

### Supported Entity Types

| Entity | Tab Name | Required Fields | Key Optional Fields |
|--------|----------|-----------------|---------------------|
| **Environments** | Environments | name | environment_category, lifecycle_stage, owner_team |
| **Instances** | Instances | environment_name, name | operational_status, availability_window, capacity, bookable |
| **Applications** | Applications | name | business_domain, criticality, owner_team, test_owner |
| **Interfaces** | Interfaces | name | direction, pattern, frequency, source/target_application_name |
| **Components** | Components | application_name, name | component_type, source_repo, runtime_platform |
| **App Deployments** | App Instances | application_name, instance_name | deployment_model, version, deployment_status |
| **Infrastructure** | Infrastructure | instance_name, name | component_type, hostname, ip_address |
| **Interface Endpoints** | Interface Endpoints | interface_name, instance_name | endpoint, test_mode, enabled |
| **Component Instances** | Component Instances | application_name, component_name, instance_name | version, deployment_status |

### New: Interface Endpoints Upload

Configure how interfaces behave in different environment instances:

| Field | Description | Valid Values |
|-------|-------------|--------------|
| `interface_name` | Name of existing interface | Must match exactly |
| `instance_name` | Target environment instance | Must match exactly |
| `endpoint` | URL or connection string | Any valid URL |
| `test_mode` | How interface operates | `Live`, `Virtualised`, `Stubbed`, `Disabled` |
| `enabled` | Is endpoint active | `true`, `false` |

**Example Use Case:** In SIT, connect to real internal APIs (`Live`), but use WireMock stubs (`Stubbed`) for external vendor APIs.

### New: Component Instances Upload

Track individual component deployments per instance:

| Field | Description | Valid Values |
|-------|-------------|--------------|
| `application_name` | Parent application name | Must match exactly |
| `component_name` | Component name | Must exist under application |
| `instance_name` | Environment instance | Must match exactly |
| `version` | Deployed version | e.g., "2.1.0", "2.1.0-SNAPSHOT" |
| `deployment_status` | Current state | `Deployed`, `PartiallyDeployed`, `RollbackPending`, `Failed` |

**Example Use Case:** Track that `payment-api v2.1.0` is in SIT while `payment-api v2.0.0` is in UAT.

### Upload Process

1. Select the entity type tab (Environments, Instances, Applications, etc.)
2. Click **Download Template** to get a sample CSV file
3. Fill in your data following the template format
4. Click **Upload CSV** and select your file
5. Review the results:
   - ✅ Success count
   - ❌ Error details with line numbers

### Recommended Upload Order

For best results, upload data in this sequence:

1. **Environments** - Base environment definitions
2. **Applications** - Application definitions
3. **Instances** - Environment instances (requires environments)
4. **Interfaces** - Interface definitions (can reference applications)
5. **Components** - Application components (requires applications)
6. **App Deployments** - Links apps to instances (requires both)
7. **Infrastructure** - Infrastructure components (requires instances)
8. **Interface Endpoints** - Interface per-instance config (requires interfaces + instances)
9. **Component Instances** - Component per-instance deployment (requires components + instances)

### CSV Format Guidelines

- Use **UTF-8 encoding**
- First row must contain **header names**
- Use **commas** as delimiters
- Wrap text containing commas in **double quotes**
- Leave optional fields **empty** if not needed
- Date format: **YYYY-MM-DD** or **ISO 8601**
- Boolean values: **true** or **false** (lowercase)

### Error Handling

If upload fails:
- Check the error message for the specific row number
- Verify field names match exactly (case-sensitive)
- Ensure referenced entities exist (e.g., environment before instance)
- Check enum values match exactly (e.g., `Live` not `live`)
- Check for duplicate names where unique is required

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
- Base URL: `http://localhost:5000/api` (local) or `https://your-domain.com/api` (AWS)
- Authentication: JWT Bearer token
- Full API docs: `/api/docs`

---

## Cloud Deployment

BookMyEnv can be deployed to AWS using the provided Terraform configuration. See [terraform/README.md](../terraform/README.md) for:

- Infrastructure as Code setup
- ECS Fargate container deployment
- RDS PostgreSQL managed database
- CloudFront CDN with SSL
- CI/CD pipeline with GitHub Actions

---

## Version History

| Version | Date | Changes |
|---------|------|--------|
| 3.1.0 | Dec 2025 | AWS Terraform deployment, GitHub Actions CI/CD |
| 3.0.0 | Dec 2025 | Interface Endpoints and Component Instances bulk upload, enhanced documentation |
| 2.1.0 | Dec 2025 | Application Deployments management, bidirectional deploy/undeploy |
| 2.0.0 | Dec 2025 | Conflict detection & resolution, Bulk data upload |
| 1.0.0 | Nov 2025 | Initial release |

---

**© 2025 BookMyEnv. All rights reserved.**
