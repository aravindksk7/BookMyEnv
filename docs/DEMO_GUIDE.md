# BookMyEnv - Application Demo Guide

## Overview

**BookMyEnv** is a comprehensive Test Environment Management (TEM) system designed to help teams book, manage, and coordinate test environments across enterprise organizations. This guide walks through the key features and functionality of the application.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Dashboard Overview](#2-dashboard-overview)
3. [Environment Management](#3-environment-management)
4. [Booking Management](#4-booking-management)
5. [Conflict Detection & Resolution](#5-conflict-detection--resolution)
6. [Bulk Data Upload](#6-bulk-data-upload)
7. [Topology View](#7-topology-view)
8. [Additional Features](#8-additional-features)

---

## 1. Getting Started

### Login

1. Navigate to the application URL (default: `http://localhost:3000`)
2. Enter your credentials:
   - **Email**: `admin@bme.local`
   - **Password**: `Admin@123`
3. Click **Sign In**

![Login Page](screenshots/login.png)

### User Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full system access, user management, all CRUD operations |
| **EnvironmentManager** | Manage environments, approve bookings, view all data |
| **ProjectLead** | Create bookings, manage team resources, view reports |
| **TestEngineer** | Create bookings, view environments, limited edit access |
| **Viewer** | Read-only access to all data |

---

## 2. Dashboard Overview

The Dashboard provides a real-time overview of your environment management system.

### Key Metrics Displayed

| Metric | Description |
|--------|-------------|
| **Environments** | Total number of configured environments |
| **Total Instances** | All environment instances across the system |
| **Available Instances** | Instances currently not booked |
| **Active Bookings** | Current ongoing bookings |
| **Applications** | Registered applications in the system |
| **Active Users** | Users who have logged in recently |

### Quick Stats

- **Instance Availability**: Percentage of instances available for booking
- **Active Bookings Count**: Real-time booking activity

### Recent Activity Feed

Shows the latest system activities including:
- User logins
- Booking creations and updates
- Environment changes
- Conflict resolutions
- Bulk uploads

---

## 3. Environment Management

### Navigating to Environments

Click **Environments** in the left sidebar to access the environment management section.

### Environments Tab

Displays all configured environments with:
- **Name**: Environment identifier (e.g., SIT, UAT, PERF)
- **Category**: NonProd, PreProd, DR, Training, or Sandpit
- **Lifecycle Stage**: Active, Deprecated, or Planned
- **Owner Team**: Team responsible for the environment
- **Instances**: Number of instances in the environment

### Creating a New Environment

1. Click **New Environment** button
2. Fill in the required fields:
   - **Name** (required): Unique environment name
   - **Description**: Purpose of the environment
   - **Category**: Select from dropdown
   - **Lifecycle Stage**: Current status
   - **Owner Team**: Responsible team
3. Click **Create**

### Environment Instances

Each environment can have multiple instances. To manage instances:

1. Click **View Details** on any environment
2. Navigate to the **Instances** tab
3. Click **Add Instance** to create new instances

Instance properties include:
- Instance Name
- URL/Connection String
- Operational Status (Available, InUse, Maintenance, Offline)
- Version Information

---

## 4. Booking Management

### Accessing Bookings

Click **Bookings** in the left sidebar.

### View Modes

Toggle between two views using the buttons in the top-right:
- **Table View**: Traditional list format with sortable columns
- **Calendar View**: Month-based calendar showing bookings by date

### Booking List Tabs

| Tab | Shows |
|-----|-------|
| **All** | All bookings in the system |
| **Active** | Currently active and approved bookings |
| **Pending** | Requested and pending approval bookings |
| **Past** | Completed and cancelled bookings |
| **Conflicts** | Bookings with unresolved conflicts ⚠️ |

### Creating a New Booking

1. Click **New Booking** button
2. Fill in the booking details:
   - **Title**: Descriptive name for the booking
   - **Description**: Purpose and details
   - **Test Phase**: SIT, UAT, NFT, Performance, DR Rehearsal, PenTest, or Other
   - **Booking Type**: SingleEnv or MultiEnvE2E
   - **Start Date/Time**: When the booking begins
   - **End Date/Time**: When the booking ends
   - **Project ID**: Optional project reference
   - **Environment Instances**: Select required instances

3. Review any **conflict warnings** displayed
4. Click **Create** (or **Create with Conflicts** if conflicts exist)

### Booking Workflow

```
Requested → PendingApproval → Approved → Active → Completed
                ↓                          ↓
           Cancelled                  Cancelled
```

### Booking Actions

| Action | Description |
|--------|-------------|
| **View Details** | Open detailed booking view with tabs |
| **Edit** | Modify booking details |
| **Approve** | Approve a requested booking |
| **Cancel** | Cancel an active booking |
| **Delete** | Permanently remove booking |
| **Resolve** | Resolve conflicts (if applicable) |

### Booking Detail View

Click **View Details** on any booking to see:
- **Summary**: Time period, requester, owning group
- **Applications Tab**: Applications involved in the booking
- **Interfaces Tab**: Interfaces being tested
- **Instances Tab**: Environment instances allocated
- **Conflicts Tab**: Conflict details and resolution options

---

## 5. Conflict Detection & Resolution

### How Conflicts Are Detected

The system automatically detects conflicts when:
- Multiple bookings request the same resource
- Booking time periods overlap
- Resource availability changes

### Conflict Status Types

| Status | Meaning |
|--------|---------|
| **None** | No conflicts detected |
| **PotentialConflict** | Overlapping booking detected, needs review |
| **ConflictConfirmed** | Conflict verified and pending resolution |
| **Resolved** | Conflict has been addressed |

### Viewing Conflicts

1. Go to **Bookings** page
2. Click the **Conflicts** tab to see all unresolved conflicts
3. Or click **View Details** on a booking with conflict indicator

### Resolving Conflicts

1. Click the **Resolve** button (gavel icon) on a conflicting booking
2. Select a resolution method:

| Resolution Type | Description |
|-----------------|-------------|
| **Accept Overlap** | Both bookings share the resource (with coordination) |
| **Mark as Resolved** | Manually mark as resolved without changes |
| **Remove Resource** | Remove the conflicting resource from this booking |
| **Adjust Timing** | Change booking start/end times |
| **Reject Booking** | Cancel the booking due to conflict |

3. Add resolution notes
4. Click **Apply Resolution**

### Conflict Resolution Dialog

The resolution dialog shows:
- Booking summary and time period
- Number of overlapping bookings
- Resolution options with descriptions
- Notes field for documentation

---

## 6. Bulk Data Upload

### Accessing Bulk Upload

1. Navigate to **Settings** (gear icon in sidebar)
2. Click the **Data Management** tab
3. Click **Go to Bulk Upload**

### Supported Entity Types

| Entity | Required Fields | Optional Fields |
|--------|-----------------|-----------------|
| **Environments** | name | description, environment_category, lifecycle_stage, owner_team |
| **Instances** | environment_name, instance_name | instance_url, status, version |
| **Applications** | name, short_code | description, business_domain, criticality, owner_group |
| **Interfaces** | name, direction | description, source_app, target_app, pattern, frequency |
| **App Components** | application_name, component_name | component_type, version |
| **App Deployments** | application_name, instance_name | deployment_status, version |
| **Infrastructure** | instance_name, infra_name | infra_type, hostname, ip_address, port |

### Upload Process

1. Select the entity type tab (Environments, Instances, etc.)
2. Click **Download Template** to get a sample CSV
3. Fill in your data in CSV format
4. Click **Upload CSV** and select your file
5. Review the results:
   - ✅ Success count
   - ❌ Error details with line numbers

### Recommended Upload Order

For best results, upload data in this sequence:
1. **Environments** - Base environment definitions
2. **Instances** - Environment instances (requires environments)
3. **Applications** - Application definitions
4. **App Components & Interfaces** - Requires applications
5. **App Deployments & Infrastructure** - Links apps to instances

### CSV Format Tips

- Use UTF-8 encoding
- First row must be header with field names
- Use commas as delimiters
- Wrap text containing commas in quotes
- Leave optional fields empty if not needed

---

## 7. Topology View

### Overview

The Topology view provides a visual representation of your environment landscape.

### Accessing Topology

Click **Topology** in the left sidebar.

### Statistics Cards

Quick overview showing:
- Total Environments
- Total Instances
- Total Applications
- Total Interfaces

### View Options

| View | Description |
|------|-------------|
| **Hierarchical View** | Tree structure: Environments → Instances → Applications |
| **Applications View** | Application-centric view with deployments |
| **Interfaces View** | Interface connections between applications |
| **Flat List** | Simple tabular list of all entities |

### Searching

Use the search bar to filter by:
- Environment name
- Instance name
- Application name
- Interface name

### Expanding Nodes

In Hierarchical View:
- Click the expand icon (▶) to show child instances
- Click instance to see deployed applications
- View infrastructure components within instances

---

## 8. Additional Features

### Applications Management

Navigate to **Environments** → **Applications** tab:
- View all registered applications
- See business domain and criticality
- Manage application components
- Track deployments across environments

### Interfaces Management

Navigate to **Environments** → **Interfaces** tab:
- Define application interfaces
- Specify source and target applications
- Set direction (Inbound/Outbound/Bidirectional)
- Configure patterns and frequencies

### Releases Management

Click **Releases** in the sidebar:
- Track release schedules
- Associate releases with applications
- Link releases to environment bookings
- Monitor release status

### Test Data Management

Click **Test Data** in the sidebar:
- Catalog test data sets
- Track data refresh schedules
- Link test data to applications
- Mark data as refreshed

### Groups Management

Click **Groups** in the sidebar:
- Create and manage user groups
- Assign users to teams
- Set group ownership for environments

### Integrations

Click **Integrations** in the sidebar:
- Configure external tool integrations
- Connect to Jira, ServiceNow, etc.
- Sync data with external systems

### User Management (Admin Only)

Navigate to **Settings** → **User Management**:
- Create new users
- Assign roles
- Deactivate users
- Reset passwords

### SSO Configuration (Admin Only)

Navigate to **Settings** → **SSO Configuration**:
- Configure identity providers
- Set up SAML/OIDC integration
- Manage SSO settings

---

## Quick Reference

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `/` | Focus search |
| `Esc` | Close dialogs |
| `Enter` | Submit forms |

### Status Colors

| Color | Meaning |
|-------|---------|
| 🟢 Green | Active, Available, Approved, Success |
| 🟡 Yellow/Orange | Pending, Warning, In Progress |
| 🔴 Red | Error, Cancelled, Conflict |
| 🔵 Blue | Info, Requested |
| ⚫ Gray | Inactive, Completed, Default |

### Common Actions

| Task | Steps |
|------|-------|
| Book an environment | Bookings → New Booking → Fill form → Create |
| Check availability | Bookings → Calendar view → Browse dates |
| Resolve conflict | Bookings → Conflicts tab → Resolve → Apply |
| Bulk upload data | Settings → Data Management → Bulk Upload |
| View topology | Topology → Select view → Explore |

---

## Support

For issues or questions:
- Check the documentation in `/docs` folder
- Review the DATA_SETUP_GUIDE for data configuration
- Contact your system administrator

---

## Version Information

- **Application**: BookMyEnv v2.0.0
- **Release Date**: December 2025
- **New Features**: 
  - Conflict View & Resolution
  - Bulk Data Upload (7 entity types)
  - Enhanced Booking Management
