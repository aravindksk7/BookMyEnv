# BookMyEnv - Entity Lifecycle Guide

A comprehensive guide to understanding the complete lifecycle of all major entities in BookMyEnv: Environments, Environment Instances, Applications, Interfaces, and Components.

---

## Table of Contents

1. [Overview](#overview)
2. [Environment Lifecycle](#environment-lifecycle)
3. [Environment Instance Lifecycle](#environment-instance-lifecycle)
4. [Application Lifecycle](#application-lifecycle)
5. [Interface Lifecycle](#interface-lifecycle)
6. [Component Lifecycle](#component-lifecycle)
7. [Component Instance Lifecycle](#component-instance-lifecycle)
8. [Interface Endpoint Lifecycle](#interface-endpoint-lifecycle)
9. [Application Deployment Lifecycle](#application-deployment-lifecycle)
10. [Lifecycle Interactions](#lifecycle-interactions)
11. [Best Practices](#best-practices)
12. [Troubleshooting Lifecycle Issues](#troubleshooting-lifecycle-issues)

---

## Overview

Understanding entity lifecycles is crucial for effective test environment management. Each entity progresses through defined stages, and transitions between stages trigger specific behaviors in the system.

### Entity Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           ENTITY LIFECYCLE HIERARCHY                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   ENVIRONMENT ──────────────────────────────────────────────────────────────────│
│   │ Lifecycle: Planned → Active → Retiring → Decommissioned                     │
│   │                                                                              │
│   └── ENVIRONMENT INSTANCE ─────────────────────────────────────────────────────│
│       │ Operational: Provisioning → Available ⇄ Maintenance/Broken              │
│       │ Booking: Available → PartiallyBooked → FullyBooked                      │
│       │                                                                          │
│       ├── APPLICATION DEPLOYMENT ───────────────────────────────────────────────│
│       │   │ Status: Aligned → Mixed → OutOfSync → Broken                        │
│       │   │                                                                      │
│       │   └── COMPONENT INSTANCE ───────────────────────────────────────────────│
│       │       Status: Deployed ⇄ PartiallyDeployed ⇄ RollbackPending → Failed  │
│       │                                                                          │
│       └── INTERFACE ENDPOINT ───────────────────────────────────────────────────│
│           Mode: Live ⇄ Virtualised ⇄ Stubbed ⇄ Disabled                        │
│                                                                                  │
│   APPLICATION ──────────────────────────────────────────────────────────────────│
│   │ No explicit lifecycle stage (always active until deleted)                   │
│   │                                                                              │
│   ├── APP COMPONENT ────────────────────────────────────────────────────────────│
│   │   No explicit lifecycle stage (always active until deleted)                 │
│   │                                                                              │
│   └── INTERFACE ────────────────────────────────────────────────────────────────│
│       No explicit lifecycle stage (enabled/disabled per endpoint)               │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Environment Lifecycle

### Lifecycle Stages

Environments progress through four distinct lifecycle stages:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                         ENVIRONMENT LIFECYCLE FLOW                                │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐      ┌─────────────┐ │
│   │   PLANNED   │ ──── │   ACTIVE    │ ──── │  RETIRING   │ ──── │DECOMMISSIONED│ │
│   │             │      │             │      │             │      │             │ │
│   │ • Planning  │      │ • Fully     │      │ • Phase-out │      │ • Archived  │ │
│   │ • Design    │      │   operational│     │ • Migrate   │      │ • Read-only │ │
│   │ • Approval  │      │ • Bookable  │      │   users     │      │ • Historical│ │
│   │   pending   │      │ • In use    │      │ • Complete  │      │   reference │ │
│   │             │      │             │      │   bookings  │      │             │ │
│   └─────────────┘      └─────────────┘      └─────────────┘      └─────────────┘ │
│         │                    │                    │                    │         │
│         │                    │                    │                    │         │
│         ▼                    ▼                    ▼                    ▼         │
│   Can create         Can create/book      Existing bookings     No bookings     │
│   instances          instances            only, no new          No changes      │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Stage Details

#### 1. Planned Stage
**Purpose**: Initial planning and design phase before the environment is operational.

| Aspect | Description |
|--------|-------------|
| **Trigger** | Environment creation request approved |
| **Duration** | Typically 1-4 weeks |
| **Activities** | Requirements gathering, architecture design, resource allocation |
| **Restrictions** | Cannot be booked, instances cannot be made bookable |
| **Allowed Actions** | Create instances (in Provisioning status), configure settings |
| **Who Can Modify** | Admin, Environment Manager |

**Typical Actions in Planned Stage:**
```
1. Define environment purpose and category
2. Identify owner team and support group
3. Set data sensitivity classification
4. Document usage policies
5. Create instances (in Provisioning state)
6. Link applications that will be deployed
7. Configure infrastructure requirements
```

#### 2. Active Stage
**Purpose**: Environment is fully operational and available for use.

| Aspect | Description |
|--------|-------------|
| **Trigger** | Manual transition after setup complete |
| **Duration** | Months to years |
| **Activities** | Normal operations, bookings, deployments |
| **Restrictions** | None - full functionality |
| **Allowed Actions** | All operations including bookings |
| **Who Can Modify** | Admin, Environment Manager |

**Key Indicators of Active Status:**
- At least one instance is Available and bookable
- Applications are deployed
- Monitoring is configured
- Support procedures documented

#### 3. Retiring Stage
**Purpose**: Environment is being phased out; new bookings restricted.

| Aspect | Description |
|--------|-------------|
| **Trigger** | Decision to decommission, replacement available |
| **Duration** | Typically 2-8 weeks |
| **Activities** | Migration, final testing, user notification |
| **Restrictions** | No new bookings allowed |
| **Allowed Actions** | View, complete existing bookings, migrate data |
| **Who Can Modify** | Admin only |

**Retirement Checklist:**
```
□ Notify all active users and booking owners
□ Complete or cancel all existing bookings
□ Migrate critical data and configurations
□ Document lessons learned
□ Update dependent systems
□ Archive configuration and logs
□ Schedule final decommission date
```

#### 4. Decommissioned Stage
**Purpose**: Environment is no longer in use; retained for historical reference.

| Aspect | Description |
|--------|-------------|
| **Trigger** | All retirement activities complete |
| **Duration** | Permanent (until deleted) |
| **Activities** | Reference only |
| **Restrictions** | Read-only, no modifications |
| **Allowed Actions** | View historical data |
| **Who Can Delete** | Admin only |

**Post-Decommission:**
- Historical bookings retained for reporting
- Configuration snapshots archived
- Can be deleted after retention period

### Environment Category Impact

Different categories have different lifecycle expectations:

| Category | Typical Lifecycle | Replacement Frequency |
|----------|-------------------|----------------------|
| **NonProd** | 1-3 years | Every major platform upgrade |
| **PreProd** | 2-5 years | Aligned with production changes |
| **DR** | 3-5 years | Aligned with production |
| **Training** | 1-2 years | Based on curriculum changes |
| **Sandpit** | 3-12 months | Frequent refresh |

---

## Environment Instance Lifecycle

Environment Instances have two parallel lifecycle dimensions: **Operational Status** and **Booking Status**.

### Operational Status Lifecycle

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                    INSTANCE OPERATIONAL STATUS LIFECYCLE                          │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│                              ┌─────────────────┐                                  │
│                              │  PROVISIONING   │                                  │
│                              │                 │                                  │
│                              │ • Being created │                                  │
│                              │ • Infrastructure│                                  │
│                              │   setup         │                                  │
│                              └────────┬────────┘                                  │
│                                       │                                           │
│                                       │ Setup Complete                            │
│                                       ▼                                           │
│   ┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐    │
│   │   MAINTENANCE   │ ◄────── │    AVAILABLE    │ ──────► │     BROKEN      │    │
│   │                 │         │                 │         │                 │    │
│   │ • Scheduled     │         │ • Ready for use │         │ • Has issues    │    │
│   │   maintenance   │         │ • Bookable      │         │ • Not usable    │    │
│   │ • Upgrades      │         │ • Operational   │         │ • Needs repair  │    │
│   └────────┬────────┘         └────────┬────────┘         └────────┬────────┘    │
│            │                           ▲                           │              │
│            │                           │                           │              │
│            └───────────────────────────┴───────────────────────────┘              │
│                               Return to Available                                 │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Operational Status Details

#### Provisioning
| Aspect | Description |
|--------|-------------|
| **Purpose** | Instance is being set up |
| **Bookable** | No |
| **Typical Duration** | Hours to days |
| **Activities** | Infrastructure deployment, application installation |
| **Exit Criteria** | All applications deployed, health checks pass |

**Provisioning Activities:**
```
1. Infrastructure provisioned (VMs, containers, databases)
2. Networking configured (firewalls, load balancers)
3. Applications deployed
4. Configurations applied
5. Test data loaded
6. Health checks validated
7. Monitoring enabled
```

#### Available
| Aspect | Description |
|--------|-------------|
| **Purpose** | Instance is ready for normal use |
| **Bookable** | Yes (if bookable flag is true) |
| **Typical Duration** | Ongoing |
| **Activities** | Active testing, deployments, bookings |
| **Monitoring** | Continuous health checks |

**Available Health Criteria:**
- All critical components running
- Database connections healthy
- API endpoints responding
- No critical alerts active

#### Maintenance
| Aspect | Description |
|--------|-------------|
| **Purpose** | Planned maintenance or upgrades |
| **Bookable** | No |
| **Typical Duration** | Hours to days |
| **Activities** | Upgrades, patches, configuration changes |
| **Notification** | Users notified in advance |

**Maintenance Triggers:**
- Scheduled patch windows
- Planned upgrades
- Infrastructure changes
- Performance tuning

#### Broken
| Aspect | Description |
|--------|-------------|
| **Purpose** | Instance has critical issues |
| **Bookable** | No |
| **Typical Duration** | Until resolved |
| **Activities** | Troubleshooting, repair |
| **Impact** | Active bookings affected |

**Common Broken Causes:**
- Infrastructure failures
- Database corruption
- Network issues
- Deployment failures
- Resource exhaustion

### Booking Status Lifecycle

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                      INSTANCE BOOKING STATUS LIFECYCLE                            │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│   ┌─────────────────┐     Booking Created     ┌─────────────────┐                │
│   │    AVAILABLE    │ ──────────────────────► │ PARTIALLY BOOKED│                │
│   │                 │                         │                 │                │
│   │ • No active     │                         │ • Has capacity  │                │
│   │   bookings      │                         │ • More bookings │                │
│   │ • Full capacity │                         │   possible      │                │
│   └────────┬────────┘                         └────────┬────────┘                │
│            ▲                                           │                          │
│            │                                           │ At Capacity              │
│            │                                           ▼                          │
│            │                                  ┌─────────────────┐                │
│            │                                  │  FULLY BOOKED   │                │
│            │ All Bookings Complete            │                 │                │
│            │ or Cancelled                     │ • At max usage  │                │
│            │                                  │ • No new        │                │
│            └──────────────────────────────────│   bookings      │                │
│                                               └─────────────────┘                │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Booking Status Details

| Status | active_booking_count | Can Accept New Bookings | Description |
|--------|---------------------|------------------------|-------------|
| **Available** | 0 | Yes | No active bookings, full capacity available |
| **PartiallyBooked** | 1 to capacity-1 | Yes | Has bookings but capacity remains |
| **FullyBooked** | = capacity | No | At maximum concurrent booking capacity |

### Combined Status Matrix

| Operational Status | Booking Status | Can Book? | Visible to Users? |
|-------------------|----------------|-----------|-------------------|
| Provisioning | Available | No | Yes (coming soon) |
| Available | Available | Yes | Yes |
| Available | PartiallyBooked | Yes | Yes |
| Available | FullyBooked | No | Yes (full) |
| Maintenance | Any | No | Yes (maintenance) |
| Broken | Any | No | Yes (unavailable) |

---

## Application Lifecycle

Applications in BookMyEnv don't have explicit lifecycle stages but follow an implicit lifecycle through their usage patterns.

### Implicit Application Lifecycle

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                         APPLICATION IMPLICIT LIFECYCLE                            │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐    │
│   │   CREATED   │ ──► │  DEPLOYED   │ ──► │   ACTIVE    │ ──► │  RETIRED    │    │
│   │             │     │             │     │             │     │             │    │
│   │ • Defined   │     │ • Deployed  │     │ • In use    │     │ • No active │    │
│   │ • Components│     │   to        │     │ • Bookings  │     │   bookings  │    │
│   │   added     │     │   instances │     │   include   │     │ • Can be    │    │
│   │ • Interfaces│     │ • Tested    │     │   app       │     │   deleted   │    │
│   │   defined   │     │             │     │             │     │             │    │
│   └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘    │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Application Creation Phase

When creating an application, define:

| Step | Action | Details |
|------|--------|---------|
| 1 | Basic Info | Name, description, business domain |
| 2 | Classification | Criticality level, data sensitivity |
| 3 | Ownership | Owner team, test owner |
| 4 | Components | Define microservices, APIs, UIs |
| 5 | Interfaces | Define integrations with other apps |

### Application Deployment Phase

Deploy application to environment instances:

| Step | Action | Outcome |
|------|--------|---------|
| 1 | Select Instance | Choose target environment instance |
| 2 | Set Version | Specify version being deployed |
| 3 | Choose Model | Monolith, Microservices, SaaS, COTS |
| 4 | Deploy Components | Deploy individual component instances |
| 5 | Configure Interfaces | Set up interface endpoints |
| 6 | Verify | Run health checks and smoke tests |

### Application Active Usage

During active usage:

- **Bookings**: Application linked to environment bookings
- **Releases**: Application included in release planning
- **Version Tracking**: Component versions tracked per instance
- **Configuration**: Config sets managed per deployment

### Application Retirement

Before deleting an application:

```
□ No active bookings reference the application
□ No active releases include the application
□ All deployments removed from instances
□ Historical data archived if needed
□ Dependent interfaces updated or removed
□ Documentation archived
```

---

## Interface Lifecycle

Interfaces define communication contracts between applications or with external systems.

### Interface Lifecycle Flow

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                            INTERFACE LIFECYCLE                                    │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│   ┌───────────────┐                                                              │
│   │    DESIGN     │ Define interface contract, source/target, pattern            │
│   └───────┬───────┘                                                              │
│           │                                                                       │
│           ▼                                                                       │
│   ┌───────────────┐                                                              │
│   │   IMPLEMENT   │ Create endpoints for each environment instance               │
│   └───────┬───────┘                                                              │
│           │                                                                       │
│           ▼                                                                       │
│   ┌───────────────┐                                                              │
│   │     TEST      │ Validate in lower environments (stubbed/virtualised)         │
│   └───────┬───────┘                                                              │
│           │                                                                       │
│           ▼                                                                       │
│   ┌───────────────┐                                                              │
│   │   ACTIVATE    │ Enable Live mode in higher environments                      │
│   └───────┬───────┘                                                              │
│           │                                                                       │
│           ▼                                                                       │
│   ┌───────────────┐                                                              │
│   │    OPERATE    │ Monitor, maintain, version updates                           │
│   └───────┬───────┘                                                              │
│           │                                                                       │
│           ▼                                                                       │
│   ┌───────────────┐                                                              │
│   │   DEPRECATE   │ Disable endpoints, migrate consumers                         │
│   └───────┬───────┘                                                              │
│           │                                                                       │
│           ▼                                                                       │
│   ┌───────────────┐                                                              │
│   │    RETIRE     │ Remove interface and all endpoints                           │
│   └───────────────┘                                                              │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Interface Definition

When creating an interface:

| Field | Purpose | Best Practice |
|-------|---------|---------------|
| **Name** | Unique identifier | Use pattern: {Source}-to-{Target}-{Purpose} |
| **Direction** | Data flow direction | Clear inbound/outbound/bidirectional |
| **Pattern** | Integration type | REST, SOAP, MQ, Kafka, etc. |
| **Frequency** | Call pattern | RealTime, NearRealTime, Batch |
| **Source Application** | Where data originates | Link to application |
| **Target Application** | Where data goes | Link or leave null for external |
| **External Party** | External system | For external integrations |
| **SLA** | Service expectations | Response time, availability |
| **Contract ID** | API contract reference | OpenAPI spec, WSDL reference |

### Interface Endpoint Configuration

Each interface has endpoints per environment instance:

| Test Mode | Purpose | Typical Environment |
|-----------|---------|---------------------|
| **Live** | Real connectivity | PreProd, UAT, Performance |
| **Virtualised** | Service virtualization | SIT, Integration testing |
| **Stubbed** | Simple mocks | Development, Unit testing |
| **Disabled** | Interface off | Isolated component testing |

### Interface Lifecycle Best Practices

```
Design Phase:
├── Document API contract (OpenAPI/Swagger)
├── Define error handling
├── Specify authentication requirements
├── Set performance expectations (SLA)
└── Identify test strategy per environment

Implementation Phase:
├── Create stubbed endpoints for development
├── Set up service virtualization for SIT
├── Configure live endpoints for UAT/PreProd
└── Document endpoint URLs and credentials

Testing Phase:
├── Unit test with stubs
├── Integration test with virtualised services
├── E2E test with live connections
└── Performance test under load

Operations Phase:
├── Monitor endpoint health
├── Track latency and error rates
├── Version management
└── Documentation updates
```

---

## Component Lifecycle

Application Components (microservices, APIs, UIs) follow a development and deployment lifecycle.

### Component Definition Lifecycle

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           COMPONENT DEFINITION LIFECYCLE                          │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│   ┌─────────────────────────────────────────────────────────────────────────┐    │
│   │  1. DEFINE                                                               │    │
│   │  ├── Name the component                                                  │    │
│   │  ├── Select type (API, UI, Batch, etc.)                                  │    │
│   │  ├── Link to source repository                                           │    │
│   │  ├── Specify runtime platform                                            │    │
│   │  └── Assign owner team                                                   │    │
│   └─────────────────────────────────────────────────────────────────────────┘    │
│                                        │                                          │
│                                        ▼                                          │
│   ┌─────────────────────────────────────────────────────────────────────────┐    │
│   │  2. DEVELOP                                                              │    │
│   │  ├── Code development in repository                                      │    │
│   │  ├── Build pipeline configured                                           │    │
│   │  ├── Unit tests implemented                                              │    │
│   │  └── Container/artifact created                                          │    │
│   └─────────────────────────────────────────────────────────────────────────┘    │
│                                        │                                          │
│                                        ▼                                          │
│   ┌─────────────────────────────────────────────────────────────────────────┐    │
│   │  3. DEPLOY                                                               │    │
│   │  ├── Create component instances per environment                          │    │
│   │  ├── Set version per instance                                            │    │
│   │  ├── Track deployment status                                             │    │
│   │  └── Configure per-environment settings                                  │    │
│   └─────────────────────────────────────────────────────────────────────────┘    │
│                                        │                                          │
│                                        ▼                                          │
│   ┌─────────────────────────────────────────────────────────────────────────┐    │
│   │  4. OPERATE                                                              │    │
│   │  ├── Monitor health and performance                                      │    │
│   │  ├── Track version across environments                                   │    │
│   │  ├── Manage configuration                                                │    │
│   │  └── Handle incidents and deployments                                    │    │
│   └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Component Types and Their Characteristics

| Type | Description | Typical Deployment | Key Considerations |
|------|-------------|-------------------|-------------------|
| **API** | REST/GraphQL services | Kubernetes pods | Versioning, rate limiting |
| **UI** | Frontend applications | Static hosting, containers | CDN, caching |
| **Batch** | Batch processing jobs | Scheduled containers | Timing, dependencies |
| **RuleEngine** | Business rules | Embedded or standalone | Version consistency |
| **DBSchema** | Database schemas | Database instance | Migration scripts |
| **MessageProcessor** | Queue consumers | Always-on containers | Scaling, backpressure |
| **Job** | Scheduled tasks | Cron jobs, scheduled containers | Timing, idempotency |
| **Lambda** | Serverless functions | Cloud functions | Cold start, limits |

---

## Component Instance Lifecycle

Component Instances track the deployment of components to specific environment instances.

### Component Instance Status Flow

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                      COMPONENT INSTANCE STATUS LIFECYCLE                          │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│                              ┌─────────────────┐                                  │
│                              │   NOT DEPLOYED  │                                  │
│                              │                 │                                  │
│                              │ Component not   │                                  │
│                              │ yet in instance │                                  │
│                              └────────┬────────┘                                  │
│                                       │                                           │
│                                       │ Initial Deploy                            │
│                                       ▼                                           │
│   ┌─────────────────┐         ┌─────────────────┐                                │
│   │ROLLBACK PENDING │ ◄────── │    DEPLOYED     │                                │
│   │                 │ Rollback│                 │                                │
│   │ • Reverting     │ Started │ • Running       │                                │
│   │ • Previous      │         │ • Healthy       │                                │
│   │   version       │         │ • Version set   │                                │
│   └────────┬────────┘         └────────┬────────┘                                │
│            │                           │                                          │
│            │                           │ Deployment Issue                         │
│            │                           ▼                                          │
│            │                  ┌─────────────────┐         ┌─────────────────┐    │
│            │                  │   PARTIALLY     │ ──────► │     FAILED      │    │
│            │                  │   DEPLOYED      │ Deploy  │                 │    │
│            │                  │                 │ Failed  │ • Not running   │    │
│            │                  │ • Some replicas │         │ • Needs         │    │
│            │                  │ • Partial       │         │   attention     │    │
│            │                  │   availability  │         │                 │    │
│            │                  └────────┬────────┘         └────────┬────────┘    │
│            │                           │                           │              │
│            │                           │                           │              │
│            └───────────────────────────┴───────────────────────────┘              │
│                                 Retry / Fix                                       │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Component Instance Status Details

| Status | Description | Actions Available | Alert Level |
|--------|-------------|-------------------|-------------|
| **Deployed** | Successfully running | Update version, rollback | None |
| **PartiallyDeployed** | Some replicas running | Retry, investigate | Warning |
| **RollbackPending** | Rolling back to previous | Monitor | Info |
| **Failed** | Deployment failed | Investigate, retry, rollback | Critical |

### Version Tracking

Component instances track versions across environments:

```
Example: payment-api versions across instances

┌─────────────────────────────────────────────────────────────┐
│ Environment Instance    │ Version     │ Status              │
├─────────────────────────┼─────────────┼─────────────────────┤
│ DEV-1                   │ 2.3.0-SNAP  │ Deployed            │
│ SIT-1                   │ 2.2.0       │ Deployed            │
│ SIT-2                   │ 2.2.0       │ Deployed            │
│ UAT-1                   │ 2.1.0       │ Deployed            │
│ PreProd-1               │ 2.0.0       │ Deployed            │
│ Perf-1                  │ 2.1.0       │ PartiallyDeployed   │
└─────────────────────────────────────────────────────────────┘
```

---

## Interface Endpoint Lifecycle

Interface Endpoints configure how interfaces behave in specific environment instances.

### Interface Endpoint Mode Transitions

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                    INTERFACE ENDPOINT MODE LIFECYCLE                              │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│   ┌─────────────┐                                                                │
│   │  DISABLED   │◄─────────────────────────────────────────────────────┐        │
│   │             │                                                       │        │
│   │ Interface   │                                                       │        │
│   │ turned off  │                                                       │        │
│   └──────┬──────┘                                                       │        │
│          │                                                              │        │
│          │ Enable with stub                                             │        │
│          ▼                                                              │        │
│   ┌─────────────┐     Promote      ┌─────────────┐     Promote         │        │
│   │   STUBBED   │ ───────────────► │ VIRTUALISED │ ───────────────┐    │        │
│   │             │                  │             │                │    │        │
│   │ Simple mock │                  │ Service     │                │    │        │
│   │ responses   │                  │ virtualiz.  │                │    │        │
│   └──────┬──────┘                  └──────┬──────┘                │    │        │
│          │                                │                       │    │        │
│          │                                │                       ▼    │        │
│          │                                │               ┌─────────────┐        │
│          └────────────────────────────────┴─────────────► │    LIVE     │        │
│                          Direct to Live                   │             │        │
│                                                           │ Real        │        │
│                                                           │ connection  │────────┘
│                                                           └─────────────┘ Disable │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Test Mode Selection Guide

| Environment Type | Recommended Mode | Rationale |
|-----------------|------------------|-----------|
| Development | Stubbed | Fast, no external dependencies |
| SIT | Virtualised | Controlled, repeatable responses |
| Integration | Live (internal), Virtualised (external) | Real internal, controlled external |
| UAT | Live (most), Virtualised (external) | Near-production behavior |
| Performance | Live | Real performance characteristics |
| PreProd | Live | Production-like |

### Endpoint Promotion Strategy

```
Development → SIT → UAT → PreProd

1. DEV: Stubbed
   └── Simple mocks, developer controls responses
   
2. SIT: Virtualised  
   └── Parasoft/WireMock service virtualization
   └── Consistent, controlled test scenarios
   
3. UAT: Live (internal), Virtualised (external)
   └── Real internal systems for business validation
   └── External vendors via virtual services
   
4. PreProd: Live
   └── Production-like connectivity
   └── Final validation before production
```

---

## Application Deployment Lifecycle

Application Deployments track the overall relationship between applications and environment instances.

### Deployment Status Flow

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                    APPLICATION DEPLOYMENT STATUS LIFECYCLE                        │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│   ┌─────────────────┐                                                            │
│   │     ALIGNED     │◄──────────────────────────────────────────────────┐       │
│   │                 │                                                    │       │
│   │ All components  │                                                    │       │
│   │ at expected     │                                                    │       │
│   │ versions        │                                                    │       │
│   └────────┬────────┘                                                    │       │
│            │                                                             │       │
│            │ Component version mismatch                                  │       │
│            ▼                                                             │       │
│   ┌─────────────────┐                                                    │       │
│   │      MIXED      │                                                    │       │
│   │                 │                                                    │       │
│   │ Some components │                    All components                  │       │
│   │ at different    │────────────────────aligned────────────────────────►│       │
│   │ versions        │                                                    │       │
│   └────────┬────────┘                                                            │
│            │                                                                      │
│            │ Configuration drift                                                  │
│            ▼                                                                      │
│   ┌─────────────────┐                                                            │
│   │    OUT OF SYNC  │                                                            │
│   │                 │                                                            │
│   │ Deployment      │────────────────────Resync────────────────────────►│       │
│   │ differs from    │                                                    │       │
│   │ expected        │                                                    │       │
│   └────────┬────────┘                                                    │       │
│            │                                                             │       │
│            │ Critical failure                                            │       │
│            ▼                                                             │       │
│   ┌─────────────────┐                                                    │       │
│   │     BROKEN      │                                                    │       │
│   │                 │                    Repair                          │       │
│   │ Deployment has  │────────────────────complete───────────────────────►│       │
│   │ failures        │                                                            │
│   └─────────────────┘                                                            │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Deployment Status Details

| Status | Description | Typical Cause | Action Required |
|--------|-------------|---------------|-----------------|
| **Aligned** | All components at correct versions | Successful deployment | None |
| **Mixed** | Version inconsistencies | Partial deployment, testing | Review, may be intentional |
| **OutOfSync** | Configuration drift | Manual changes, failed updates | Investigate, resync |
| **Broken** | Critical failures | Deployment failure, dependency issue | Immediate remediation |

### Deployment Model Impact

| Model | Deployment Complexity | Version Tracking | Typical Status Pattern |
|-------|----------------------|------------------|------------------------|
| **Monolith** | Low - single artifact | Single version | Usually Aligned |
| **Microservices** | High - many components | Per-component | Often Mixed during releases |
| **SaaS** | Low - vendor managed | Vendor version | Aligned (vendor controls) |
| **COTS** | Medium - vendor + custom | Mixed versioning | May be OutOfSync |

---

## Lifecycle Interactions

Understanding how lifecycles interact is crucial for effective management.

### Environment and Instance Lifecycle Interaction

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│              ENVIRONMENT ↔ INSTANCE LIFECYCLE INTERACTION                         │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│   Environment Stage    │  Instance Operations Allowed                            │
│  ─────────────────────┼──────────────────────────────────────────────────────── │
│                        │                                                          │
│   PLANNED              │  ✓ Create instances (Provisioning only)                 │
│                        │  ✗ Cannot set instances to Available                    │
│                        │  ✗ Cannot create bookings                               │
│                        │                                                          │
│   ACTIVE               │  ✓ All instance operations allowed                      │
│                        │  ✓ Instances can be Available/Maintenance/Broken        │
│                        │  ✓ Bookings can be created                              │
│                        │                                                          │
│   RETIRING             │  ✗ Cannot create new instances                          │
│                        │  ✓ Existing instances can complete bookings             │
│                        │  ✗ No new bookings allowed                              │
│                        │                                                          │
│   DECOMMISSIONED       │  ✗ No instance changes allowed                          │
│                        │  ✓ View historical data only                            │
│                        │                                                          │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Application and Component Instance Interaction

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│           APPLICATION ↔ COMPONENT INSTANCE LIFECYCLE INTERACTION                  │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│   When Application is deployed to an Instance:                                   │
│                                                                                   │
│   1. Create Application Deployment (app_env_instance)                            │
│      ├── Set deployment model (Monolith/Microservices/SaaS/COTS)                │
│      └── Initial status: Mixed (until all components deployed)                   │
│                                                                                   │
│   2. For each App Component:                                                     │
│      └── Create Component Instance                                               │
│          ├── Set version                                                         │
│          ├── Set deployment_status: Deployed/PartiallyDeployed/Failed           │
│          └── Record last_deployed_date                                           │
│                                                                                   │
│   3. Update Application Deployment status based on component statuses:           │
│      ├── All Deployed with same version → Aligned                               │
│      ├── All Deployed with different versions → Mixed                            │
│      ├── Configuration issues → OutOfSync                                        │
│      └── Any Failed → Broken                                                     │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Interface and Endpoint Interaction

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│              INTERFACE ↔ ENDPOINT LIFECYCLE INTERACTION                           │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│   Interface Definition Level:                                                    │
│   ├── Defines contract (pattern, direction, frequency)                          │
│   ├── Links source and target applications                                       │
│   └── Sets SLA expectations                                                      │
│                                                                                   │
│   Interface Endpoint Level (per Environment Instance):                           │
│   ├── Implements the interface in that specific instance                         │
│   ├── Sets test_mode (Live/Virtualised/Stubbed/Disabled)                        │
│   ├── Provides actual endpoint URL/connection string                             │
│   └── Links to specific component instances (source/target)                      │
│                                                                                   │
│   Promotion Pattern:                                                             │
│   DEV Instance: Stubbed → SIT Instance: Virtualised → UAT: Live                 │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Booking Impact on Lifecycles

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                     BOOKING IMPACT ON ENTITY LIFECYCLES                           │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│   When Booking is Created:                                                       │
│   ├── Environment Instance                                                       │
│   │   ├── active_booking_count incremented                                       │
│   │   └── booking_status updated (Available → PartiallyBooked → FullyBooked)    │
│   │                                                                              │
│   ├── Booked Applications (optional)                                             │
│   │   └── Associated with booking for tracking                                   │
│   │                                                                              │
│   └── Booked Resources                                                           │
│       ├── EnvironmentInstance marked as booked                                   │
│       ├── ComponentInstance optionally reserved                                  │
│       └── InfraComponent booking_status updated                                  │
│                                                                                   │
│   When Booking is Completed/Cancelled:                                           │
│   ├── active_booking_count decremented                                           │
│   ├── booking_status recalculated                                                │
│   └── Resources released                                                         │
│                                                                                   │
│   Constraints:                                                                   │
│   ├── Cannot delete instance with active bookings                                │
│   ├── Cannot decommission environment with active bookings                       │
│   └── Cannot change instance to Broken without notifying booking owners          │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## Best Practices

### Environment Lifecycle Best Practices

| Stage | Best Practice | Rationale |
|-------|--------------|-----------|
| **Planned** | Complete all design documentation | Avoid changes after activation |
| **Planned** | Get stakeholder sign-off | Ensure requirements met |
| **Active** | Regular health monitoring | Early issue detection |
| **Active** | Scheduled maintenance windows | Minimize disruption |
| **Retiring** | 4-week minimum notice | Allow migration time |
| **Retiring** | Active user communication | No surprises |

### Instance Management Best Practices

| Practice | Description |
|----------|-------------|
| **Capacity Planning** | Set appropriate booking capacity per instance |
| **Status Monitoring** | Automated health checks with status updates |
| **Maintenance Windows** | Scheduled, communicated maintenance periods |
| **Incident Response** | Clear process for Broken status handling |
| **Documentation** | Keep instance configuration documented |

### Application Deployment Best Practices

| Practice | Description |
|----------|-------------|
| **Version Consistency** | Aim for Aligned status in production-like environments |
| **Mixed State Awareness** | Document intentional Mixed states during testing |
| **Automated Tracking** | Integrate with CI/CD for automatic version updates |
| **Rollback Planning** | Maintain previous version availability |

### Interface Endpoint Best Practices

| Environment Type | Recommended Approach |
|-----------------|---------------------|
| **Development** | Use Stubbed mode with developer-controlled mocks |
| **SIT** | Use Virtualised with standardized test scenarios |
| **UAT** | Live for internal, Virtualised for external |
| **Performance** | Live mode for accurate performance data |

---

## Troubleshooting Lifecycle Issues

### Common Environment Lifecycle Issues

| Issue | Symptoms | Resolution |
|-------|----------|------------|
| Stuck in Planned | Cannot make instances bookable | Verify setup complete, transition to Active |
| Cannot Retire | Retirement blocked | Complete or cancel all active bookings |
| Unexpected Decommission | Users lost access | Review audit logs, restore if error |

### Common Instance Lifecycle Issues

| Issue | Symptoms | Resolution |
|-------|----------|------------|
| Stuck in Provisioning | Never becomes Available | Check provisioning logs, verify infrastructure |
| Unexpected Broken | Suddenly unavailable | Check monitoring alerts, investigate root cause |
| Booking Count Mismatch | Wrong availability shown | Recalculate from booking_resources table |

### Common Application Deployment Issues

| Issue | Symptoms | Resolution |
|-------|----------|------------|
| Persistent Mixed Status | Never reaches Aligned | Review component versions, identify drift |
| Unexpected OutOfSync | Configuration drift | Compare current vs expected, reconcile |
| Chronic Broken | Repeated deployment failures | Review CI/CD pipeline, check dependencies |

### Common Interface Endpoint Issues

| Issue | Symptoms | Resolution |
|-------|----------|------------|
| Mode Mismatch | Wrong test behavior | Verify test_mode per environment |
| Disabled When Needed | Interface not working | Check enabled flag, endpoint URL |
| Wrong Environment Connected | Cross-environment data | Verify endpoint URLs match instance |

---

## Quick Reference

### Environment Lifecycle Stages

| Stage | Bookable | Create Instances | Modify |
|-------|----------|------------------|--------|
| Planned | ❌ | ✅ (Provisioning) | ✅ |
| Active | ✅ | ✅ | ✅ |
| Retiring | ❌ (existing only) | ❌ | Limited |
| Decommissioned | ❌ | ❌ | ❌ |

### Instance Status Quick Reference

| Operational | Booking | Can Book? |
|-------------|---------|-----------|
| Provisioning | Any | ❌ |
| Available | Available | ✅ |
| Available | PartiallyBooked | ✅ |
| Available | FullyBooked | ❌ |
| Maintenance | Any | ❌ |
| Broken | Any | ❌ |

### Component Instance Status Quick Reference

| Status | Healthy | Action Required |
|--------|---------|-----------------|
| Deployed | ✅ | None |
| PartiallyDeployed | ⚠️ | Monitor |
| RollbackPending | ⚠️ | Wait |
| Failed | ❌ | Investigate |

### Interface Endpoint Mode Quick Reference

| Mode | Connectivity | Use Case |
|------|--------------|----------|
| Live | Real system | Production-like testing |
| Virtualised | Virtual service | Controlled testing |
| Stubbed | Simple mock | Development |
| Disabled | None | Isolated testing |
