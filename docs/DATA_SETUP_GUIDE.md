# BookMyEnv - Data Setup Guide

A comprehensive guide to setting up your test environment management system. This guide explains the data model, entity relationships, and how to create environments, applications, instances, interfaces, components, and their deployments.

---

## Related Documentation

| Document | Description |
|----------|-------------|
| [User Guide](USER_GUIDE.md) | End-user instructions for day-to-day usage |
| [**Lifecycle Guide**](LIFECYCLE_GUIDE.md) | **Detailed lifecycle states, transitions, and best practices** |
| [Architecture Guide](ARCHITECTURE.md) | Technical architecture and system design |
| [Quick Reference](QUICK_REFERENCE.md) | Cheat sheet for common operations |

---

## Table of Contents

1. [Understanding the Data Model](#understanding-the-data-model)
2. [Core Entity Overview](#core-entity-overview)
3. [Environments](#environments)
4. [Environment Instances](#environment-instances)
5. [Applications](#applications)
6. [Application Components](#application-components)
7. [Interfaces](#interfaces)
8. [Interface Endpoints](#interface-endpoints)
9. [Component Instances](#component-instances)
10. [Application Deployments](#application-deployments)
11. [Entity Relationships](#entity-relationships)
12. [Entity Lifecycle Summary](#entity-lifecycle-summary)
13. [Bulk Upload Guide](#bulk-upload-guide)
14. [Sample Data Files](#sample-data-files)
15. [Quick Reference](#quick-reference)

---

## Understanding the Data Model

BookMyEnv organizes your IT landscape into a hierarchical structure that allows granular control and tracking of test environments and their applications.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              ENVIRONMENT HIERARCHY                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   ENVIRONMENT (Category: NonProd, PreProd, DR, Training, Sandpit)               │
│   └── ENVIRONMENT INSTANCE (Bookable unit - what teams actually reserve)        │
│       ├── APPLICATION DEPLOYMENTS (Apps deployed to this instance)              │
│       │   └── Tracks: version, deployment_model, deployment_status              │
│       ├── COMPONENT INSTANCES (Individual app components in this instance)      │
│       │   └── Tracks: version, deployment_status, last_deployed_date            │
│       ├── INTERFACE ENDPOINTS (How interfaces work in this instance)            │
│       │   └── Tracks: endpoint URL, test_mode (Live/Virtualised/Stubbed)        │
│       └── INFRASTRUCTURE COMPONENTS (VMs, containers, databases)                │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                             APPLICATION HIERARCHY                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   APPLICATION (Business system: Payment Gateway, Customer Portal)               │
│   ├── APP COMPONENTS (Microservices, APIs, UIs, Databases within the app)       │
│   │   └── COMPONENT INSTANCES (Component deployed to a specific instance)       │
│   └── INTERFACES (How this app communicates with other apps)                    │
│       └── INTERFACE ENDPOINTS (Interface configuration per instance)            │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Why This Structure?

| Layer | Purpose | Example |
|-------|---------|---------|
| **Environment** | Categorize environments by purpose | "Non-Production", "Pre-Production" |
| **Instance** | Provide bookable units | "SIT-1", "UAT-Instance-A" |
| **Application Deployment** | Track what apps are in each instance | "Payment Gateway v2.1 in SIT-1" |
| **Component Instance** | Track individual service versions | "payment-api v2.1.0 in SIT-1" |
| **Interface Endpoint** | Configure interface behavior per instance | "Payment API using stub in SIT" |

---

## Core Entity Overview

### Entity Summary Table

| Entity | Description | Parent | Key Fields |
|--------|-------------|--------|------------|
| **Environment** | Top-level category | None | name, category, lifecycle_stage |
| **Environment Instance** | Bookable environment copy | Environment | name, operational_status, bookable |
| **Application** | Business system | None | name, business_domain, criticality |
| **App Component** | Part of an application | Application | name, component_type, runtime_platform |
| **Interface** | Communication channel | Application (source/target) | name, direction, pattern, frequency |
| **App Deployment** | App → Instance link | Application + Instance | version, deployment_model, status |
| **Component Instance** | Component → Instance link | App Component + Instance | version, deployment_status |
| **Interface Endpoint** | Interface → Instance link | Interface + Instance | endpoint, test_mode, enabled |

---

## Environments

**Environments** are the top-level containers that categorize your testing landscape. They represent a type or category of environment rather than a specific deployable unit.

### Environment Fields

| Field | Type | Required | Description | Valid Values |
|-------|------|----------|-------------|--------------|
| `name` | String(50) | ✓ | Unique environment name | Any unique name |
| `description` | Text | | Detailed description | Free text |
| `environment_category` | Enum | | Type of environment | `NonProd`, `PreProd`, `DR`, `Training`, `Sandpit` |
| `lifecycle_stage` | Enum | | Current stage | `Planned`, `Active`, `Retiring`, `Decommissioned` |
| `owner_team` | String(100) | | Responsible team | e.g., "Platform Team" |
| `support_group` | String(100) | | Support contact | e.g., "IT Support" |
| `data_sensitivity` | Enum | | Data classification | `PII`, `PCI`, `Confidential`, `NonProdDummy` |
| `usage_policies` | Text | | Usage guidelines | Free text |

### Environment Categories Explained

| Category | Purpose | Typical Use |
|----------|---------|-------------|
| **NonProd** | Development and general testing | DEV, SIT, Integration Testing |
| **PreProd** | Final testing before production | UAT, Staging, Pre-Production |
| **DR** | Disaster recovery testing | DR Failover, Business Continuity |
| **Training** | User training and demos | Training environments, Demo systems |
| **Sandpit** | Experimentation | POCs, Innovation, Experimentation |

### Lifecycle Stages

| Stage | Description | Actions Allowed |
|-------|-------------|-----------------|
| **Planned** | Environment is being planned | Create instances, configure |
| **Active** | Fully operational | All operations, bookings |
| **Retiring** | Being phased out | View only, complete existing bookings |
| **Decommissioned** | No longer in use | Archive, read-only |

### Creating an Environment

**Via UI:**
1. Navigate to **Environments** in the sidebar
2. Click **+ Add Environment**
3. Fill in the required and optional fields
4. Click **Save**

**Via Bulk Upload CSV:**
```csv
name,description,environment_category,lifecycle_stage,owner_team,support_group,data_sensitivity,usage_policies
SIT-Environment,System Integration Testing,NonProd,Active,QA Team,IT Support,NonProdDummy,Integration testing only
UAT-Environment,User Acceptance Testing,PreProd,Active,UAT Team,IT Support,Confidential,UAT with masked prod data
```

---

## Environment Instances

**Environment Instances** are the actual deployable units that teams book and use. Each Environment can have multiple Instances, allowing parallel usage.

### Instance Fields

| Field | Type | Required | Description | Valid Values |
|-------|------|----------|-------------|--------------|
| `name` | String(100) | ✓ | Unique name within environment | Any unique name |
| `operational_status` | Enum | | Current operational state | `Available`, `Broken`, `Maintenance`, `Provisioning` |
| `booking_status` | Enum | | Booking availability | `Available`, `PartiallyBooked`, `FullyBooked` |
| `active_booking_count` | Integer | | Number of active bookings | Auto-calculated |
| `availability_window` | String(100) | | When available | e.g., "24x7", "Business Hours" |
| `capacity` | Integer | | Concurrent usage capacity | Number of teams/users |
| `primary_location` | String(100) | | Physical/cloud location | e.g., "Sydney DC", "AWS ap-southeast-2" |
| `bookable` | Boolean | | Can be booked | `true` / `false` |

### Operational vs Booking Status

**Operational Status** - Physical/technical state:
| Status | Meaning | Bookable? |
|--------|---------|-----------|
| `Available` | Fully functional, ready for use | Yes |
| `Broken` | Has issues, not usable | No |
| `Maintenance` | Scheduled maintenance | No |
| `Provisioning` | Being set up | No |

**Booking Status** - Reservation state:
| Status | Meaning |
|--------|---------|
| `Available` | No active bookings, can be reserved |
| `PartiallyBooked` | Has some bookings but has capacity |
| `FullyBooked` | At capacity, cannot accept more bookings |

### Why Multiple Instances?

Consider a "SIT Environment" that needs to support 3 teams testing simultaneously:

```
SIT Environment (Category: NonProd)
├── SIT-Instance-1 → Team Alpha testing Payment module
├── SIT-Instance-2 → Team Beta testing User module  
└── SIT-Instance-3 → Automated regression testing
```

Each instance can have different applications deployed at different versions.

### Creating an Instance

**Via UI:**
1. Navigate to **Environments**
2. Click on an environment to expand
3. Click **+ Add Instance**
4. Fill in the fields
5. Click **Save**

**Via Bulk Upload CSV:**
```csv
environment_name,name,operational_status,availability_window,capacity,primary_location,bookable
SIT-Environment,SIT-1,Available,24x7,5,Sydney DC,true
SIT-Environment,SIT-2,Available,24x7,5,Melbourne DC,true
SIT-Environment,SIT-3,Maintenance,24x7,5,Sydney DC,false
```

---

## Applications

**Applications** represent business systems that are deployed to environments. They are the software products your organization develops, purchases, or integrates.

### Application Fields

| Field | Type | Required | Description | Valid Values |
|-------|------|----------|-------------|--------------|
| `name` | String(255) | ✓ | Unique application name | Any unique name |
| `business_domain` | String(100) | | Business area | e.g., "Retail Banking", "Payments" |
| `description` | Text | | What the app does | Free text |
| `criticality` | Enum | | Business importance | `High`, `Medium`, `Low` |
| `data_sensitivity` | Enum | | Data it handles | `PII`, `PCI`, `Confidential`, `NonProdDummy` |
| `owner_team` | String(100) | | Development owner | e.g., "Digital Banking Team" |
| `test_owner` | String(100) | | QA/Test owner | e.g., "QA Team" |

### Criticality Levels

| Level | Meaning | Typical Applications |
|-------|---------|---------------------|
| **High** | Business critical, affects revenue/customers | Payment systems, Core banking |
| **Medium** | Important but not critical | Reporting, Analytics |
| **Low** | Nice to have | Internal tools, Utilities |

### Data Sensitivity

| Classification | Description | Example Data |
|----------------|-------------|--------------|
| **PCI** | Payment Card Industry data | Credit card numbers, CVV |
| **PII** | Personally Identifiable Information | Names, addresses, SSN |
| **Confidential** | Business sensitive | Financial reports, strategies |
| **NonProdDummy** | Test/dummy data only | Synthetic test data |

### Creating an Application

**Via UI:**
1. Navigate to **Applications**
2. Click **+ Add Application**
3. Fill in the fields
4. Click **Save**

**Via Bulk Upload CSV:**
```csv
name,business_domain,description,criticality,data_sensitivity,owner_team,test_owner
Payment Gateway,Payments,Core payment processing system,High,PCI,Payments Team,QA Team
Customer Portal,Retail Banking,Customer-facing web application,High,PII,Digital Team,QA Team
Notification Service,Communications,Email and SMS notifications,Medium,PII,Platform Team,QA Team
```

---

## Application Components

**App Components** are the individual services, modules, or deployable units that make up an Application. Modern applications often consist of multiple microservices.

### Component Fields

| Field | Type | Required | Description | Valid Values |
|-------|------|----------|-------------|--------------|
| `name` | String(255) | ✓ | Component name | Any unique name within app |
| `application_id` | UUID | ✓ | Parent application | FK to applications |
| `component_type` | Enum | | Type of component | See below |
| `source_repo` | String(500) | | Git repository URL | e.g., "github.com/org/repo" |
| `build_pipeline_id` | String(255) | | CI/CD pipeline ID | e.g., "pipeline-123" |
| `runtime_platform` | String(100) | | Where it runs | e.g., "Kubernetes", "AWS Lambda" |
| `owner_team` | String(100) | | Component owner | e.g., "Backend Team" |

### Component Types

| Type | Description | Examples |
|------|-------------|----------|
| **API** | REST/GraphQL/gRPC API service | payment-api, user-service |
| **UI** | Frontend/User Interface | web-portal, admin-dashboard |
| **Batch** | Batch processing jobs | daily-report, data-sync |
| **RuleEngine** | Business rules processing | fraud-rules, pricing-engine |
| **DBSchema** | Database schema/migrations | payment-db, user-db |
| **MessageProcessor** | Message queue consumer | order-processor, notification-handler |
| **Job** | Scheduled/background jobs | cleanup-job, reconciliation |
| **Lambda** | Serverless functions | image-resize, email-sender |
| **Other** | Other component types | Custom components |

### Example: Payment Gateway Components

```
Payment Gateway (Application)
├── payment-api (API) - REST API for payment operations
├── payment-processor (MessageProcessor) - Processes payment queue
├── payment-validator (API) - Validates payment requests
├── payment-db (DBSchema) - PostgreSQL database schema
├── payment-batch (Batch) - End-of-day settlement
└── payment-ui (UI) - Admin dashboard
```

### Creating a Component

**Via UI:**
1. Navigate to **Applications**
2. Select an application
3. Go to **Components** tab
4. Click **+ Add Component**
5. Fill in the fields
6. Click **Save**

**Via Bulk Upload CSV:**
```csv
application_name,name,component_type,source_repo,runtime_platform,owner_team
Payment Gateway,payment-api,API,github.com/org/payment-api,Kubernetes,Backend Team
Payment Gateway,payment-processor,MessageProcessor,github.com/org/payment-proc,Kubernetes,Backend Team
Payment Gateway,payment-db,DBSchema,github.com/org/payment-db,PostgreSQL,DBA Team
Customer Portal,portal-ui,UI,github.com/org/portal-ui,Kubernetes,Frontend Team
Customer Portal,portal-bff,API,github.com/org/portal-bff,Kubernetes,Backend Team
```

---

## Interfaces

**Interfaces** define how applications communicate with each other. They represent the contracts and channels for data exchange.

### Interface Fields

| Field | Type | Required | Description | Valid Values |
|-------|------|----------|-------------|--------------|
| `name` | String(255) | ✓ | Interface name | Any unique name |
| `direction` | Enum | | Data flow direction | `Inbound`, `Outbound`, `Bidirectional` |
| `pattern` | Enum | | Integration pattern | See below |
| `frequency` | Enum | | Call frequency | `RealTime`, `NearRealTime`, `Batch` |
| `source_application_id` | UUID | | Where data originates | FK to applications |
| `target_application_id` | UUID | | Where data goes | FK to applications |
| `external_party` | String(255) | | External system name | e.g., "Visa", "SWIFT" |
| `sla` | String(100) | | Service level agreement | e.g., "99.9%, <100ms" |
| `contract_id` | String(100) | | API contract reference | e.g., "SWAGGER-001" |

### Interface Patterns

| Pattern | Description | Use Case |
|---------|-------------|----------|
| **REST** | RESTful HTTP APIs | Web services, mobile backends |
| **SOAP** | XML-based web services | Legacy enterprise systems |
| **MQ** | IBM MQ messaging | Enterprise message queues |
| **Kafka** | Event streaming | Real-time event processing |
| **FileDrop** | File-based exchange | Batch data transfers |
| **FTP** | File Transfer Protocol | Legacy file transfers |
| **SFTP** | Secure FTP | Secure file transfers |
| **FIX** | Financial Information eXchange | Trading systems |
| **Other** | Other patterns | Custom integrations |

### Direction Types

| Direction | Description | Example |
|-----------|-------------|---------|
| **Inbound** | App receives data | Payment Gateway receives orders |
| **Outbound** | App sends data | Portal sends payment requests |
| **Bidirectional** | Two-way communication | Real-time sync |

### Frequency Types

| Frequency | Description | Typical Latency |
|-----------|-------------|-----------------|
| **RealTime** | Immediate, synchronous | < 1 second |
| **NearRealTime** | Slight delay, async | 1-60 seconds |
| **Batch** | Scheduled batches | Hours/Daily |

### Example: Portal-to-Payment Interface

```
Interface: Portal-Payment-API
├── Source: Customer Portal
├── Target: Payment Gateway
├── Direction: Outbound
├── Pattern: REST
├── Frequency: RealTime
└── SLA: 99.9%, response < 200ms
```

### Creating an Interface

**Via Bulk Upload CSV:**
```csv
name,direction,pattern,frequency,source_application_name,target_application_name,sla,external_party
Portal-to-Payment-API,Outbound,REST,RealTime,Customer Portal,Payment Gateway,99.9% <200ms,
Payment-to-Fraud-Check,Outbound,REST,RealTime,Payment Gateway,Fraud Detection,99.99% <100ms,
Payment-to-VISA,Outbound,REST,RealTime,Payment Gateway,,99.9%,VISA
Daily-Statement-Export,Outbound,FileDrop,Batch,Transaction History,,Daily 6AM,
```

---

## Interface Endpoints

**Interface Endpoints** define how an interface behaves in a specific environment instance. The same interface may have different configurations (URLs, test modes) across instances.

### Interface Endpoint Fields

| Field | Type | Required | Description | Valid Values |
|-------|------|----------|-------------|--------------|
| `interface_id` | UUID | ✓ | Parent interface | FK to interfaces |
| `env_instance_id` | UUID | ✓ | Environment instance | FK to environment_instances |
| `endpoint` | String(500) | | URL or connection string | e.g., "https://api.sit.local/v1" |
| `test_mode` | Enum | | How interface behaves | `Live`, `Virtualised`, `Stubbed`, `Disabled` |
| `enabled` | Boolean | | Is endpoint active | `true` / `false` |
| `source_component_instance_id` | UUID | | Source component | FK to component_instances |
| `target_component_instance_id` | UUID | | Target component | FK to component_instances |
| `external_stub_id` | String(255) | | Virtual service ID | e.g., "WireMock-stub-001" |

### Test Modes Explained

| Mode | Description | When to Use |
|------|-------------|-------------|
| **Live** | Connects to real target system | Production-like testing, E2E tests |
| **Virtualised** | Uses service virtualization | Isolated testing, parallel testing |
| **Stubbed** | Uses simple mock responses | Unit testing, development |
| **Disabled** | Interface is turned off | Focused component testing |

### Why Different Test Modes?

In a **SIT Instance**, you might want:
- Internal APIs → **Live** (real connections within SIT)
- External vendor APIs → **Virtualised** (use Parasoft/WireMock stubs)
- Third-party services → **Stubbed** (simple mocks)

### Example: Same Interface, Different Instances

```
Interface: Payment-to-VISA
├── SIT-1 Instance
│   ├── Endpoint: https://stub.internal/visa-mock
│   ├── Test Mode: Stubbed
│   └── Enabled: true
├── UAT-1 Instance
│   ├── Endpoint: https://virtualservice.internal/visa
│   ├── Test Mode: Virtualised
│   └── Enabled: true
└── PreProd-1 Instance
    ├── Endpoint: https://sandbox.visa.com/api
    ├── Test Mode: Live
    └── Enabled: true
```

### Creating Interface Endpoints via Bulk Upload

```csv
interface_name,instance_name,endpoint,test_mode,enabled,source_component_name,target_component_name
Portal-to-Payment-API,SIT-1,https://payment-api.sit.local/v1,Live,true,portal-bff,payment-api
Portal-to-Payment-API,UAT-1,https://payment-api.uat.local/v1,Live,true,portal-bff,payment-api
Payment-to-VISA,SIT-1,https://stub.internal/visa-mock,Stubbed,true,payment-processor,
Payment-to-VISA,UAT-1,https://sandbox.visa.com/api,Virtualised,true,payment-processor,
```

---

## Component Instances

**Component Instances** track the deployment of individual application components to environment instances. This allows version tracking at the component level.

### Component Instance Fields

| Field | Type | Required | Description | Valid Values |
|-------|------|----------|-------------|--------------|
| `component_id` | UUID | ✓ | Parent component | FK to app_components |
| `env_instance_id` | UUID | ✓ | Environment instance | FK to environment_instances |
| `version` | String(50) | | Deployed version | e.g., "2.1.0", "2.1.0-SNAPSHOT" |
| `deployment_status` | Enum | | Current state | `Deployed`, `PartiallyDeployed`, `RollbackPending`, `Failed` |
| `last_deployed_date` | Timestamp | | Last deployment time | Auto-updated |

### Deployment Statuses

| Status | Description | Action Needed |
|--------|-------------|---------------|
| **Deployed** | Successfully deployed and running | None |
| **PartiallyDeployed** | Some replicas deployed | Monitor, may need retry |
| **RollbackPending** | Rollback in progress | Wait for completion |
| **Failed** | Deployment failed | Investigate and retry |

### Example: Tracking Component Versions

```
SIT-1 Instance:
├── payment-api v2.1.0 (Deployed)
├── payment-processor v2.1.0 (Deployed)
├── payment-db v2.1.0 (Deployed)
├── portal-ui v3.0.0-beta (Deployed)
└── portal-bff v2.9.0 (Deployed)

UAT-1 Instance:
├── payment-api v2.0.0 (Deployed)
├── payment-processor v2.0.0 (Deployed)
├── portal-ui v2.9.0 (Deployed)
└── portal-bff v2.9.0 (Deployed)
```

This shows SIT has newer payment versions while UAT has stable releases.

### Creating Component Instances via Bulk Upload

```csv
application_name,component_name,instance_name,version,deployment_status
Payment Gateway,payment-api,SIT-1,2.1.0,Deployed
Payment Gateway,payment-api,UAT-1,2.0.0,Deployed
Payment Gateway,payment-processor,SIT-1,2.1.0,Deployed
Customer Portal,portal-ui,SIT-1,3.0.0-beta,Deployed
Customer Portal,portal-ui,UAT-1,2.9.0,Deployed
```

---

## Application Deployments

**Application Deployments** (stored in `application_environment_instances`) track the high-level relationship between Applications and Environment Instances.

### Deployment Fields

| Field | Type | Required | Description | Valid Values |
|-------|------|----------|-------------|--------------|
| `application_id` | UUID | ✓ | Application | FK to applications |
| `env_instance_id` | UUID | ✓ | Environment instance | FK to environment_instances |
| `deployment_model` | Enum | | Architecture type | `Monolith`, `Microservices`, `SaaS`, `COTS` |
| `version` | String(50) | | Overall app version | e.g., "2.1.0" |
| `deployment_status` | Enum | | Overall health | `Aligned`, `Mixed`, `OutOfSync`, `Broken` |

### Deployment Models

| Model | Description | Use Case |
|-------|-------------|----------|
| **Monolith** | Single deployable unit | Traditional applications |
| **Microservices** | Multiple independent services | Cloud-native apps |
| **SaaS** | Third-party hosted | Salesforce, ServiceNow |
| **COTS** | Commercial off-the-shelf | Oracle, SAP |

### Deployment Status

| Status | Meaning | Action |
|--------|---------|--------|
| **Aligned** | All components at expected versions | None |
| **Mixed** | Some components at different versions | Review |
| **OutOfSync** | Deployment differs from planned state | Investigate |
| **Broken** | Deployment has failures | Immediate action |

---

## Entity Relationships

### Complete Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         COMPLETE ENTITY RELATIONSHIP                             │
└─────────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐                                    ┌──────────────┐
│  ENVIRONMENT │                                    │ APPLICATION  │
│              │                                    │              │
│ • name       │                                    │ • name       │
│ • category   │                                    │ • domain     │
│ • stage      │                                    │ • criticality│
└──────┬───────┘                                    └──────┬───────┘
       │ 1:N                                               │ 1:N
       ▼                                                   ▼
┌──────────────────┐                              ┌─────────────────┐
│ ENV INSTANCE     │                              │ APP COMPONENT   │
│                  │                              │                 │
│ • name           │                              │ • name          │
│ • op_status      │                              │ • type          │
│ • bookable       │                              │ • source_repo   │
└────────┬─────────┘                              └────────┬────────┘
         │                                                 │
         │         ┌──────────────────────┐               │
         │         │ APP_ENV_INSTANCE     │               │
         ├────────►│ (App Deployment)     │◄──────────────┤
         │         │                      │               │
         │         │ • version            │               │
         │         │ • deployment_model   │               │
         │         │ • deployment_status  │               │
         │         └──────────────────────┘               │
         │                                                │
         │         ┌──────────────────────┐               │
         ├────────►│ COMPONENT_INSTANCE   │◄──────────────┘
         │         │                      │
         │         │ • version            │
         │         │ • deployment_status  │
         │         └──────────────────────┘
         │
         │                                        ┌──────────────────┐
         │         ┌──────────────────────┐      │ INTERFACE        │
         └────────►│ INTERFACE_ENDPOINT   │◄─────┤                  │
                   │                      │      │ • name           │
                   │ • endpoint           │      │ • direction      │
                   │ • test_mode          │      │ • pattern        │
                   │ • enabled            │      │ • frequency      │
                   └──────────────────────┘      │ • source_app_id  │
                                                 │ • target_app_id  │
                                                 └──────────────────┘
```

### Relationship Summary

| From | To | Cardinality | Description |
|------|-----|-------------|-------------|
| Environment | Instance | 1:N | One environment has many instances |
| Application | Component | 1:N | One application has many components |
| Application | Interface | 1:N | One app can be source/target of many interfaces |
| Instance + Application | App Deployment | 1:1 | One deployment per app per instance |
| Instance + Component | Component Instance | 1:1 | One component instance per component per instance |
| Instance + Interface | Interface Endpoint | 1:1 | One endpoint per interface per instance |

---

## Entity Lifecycle Summary

Understanding entity lifecycles is crucial for effective test environment management. This section provides a summary; for complete details including state transition diagrams, see the **[Lifecycle Guide](LIFECYCLE_GUIDE.md)**.

### Environment Lifecycle

| Stage | Description | Can Book? | Can Modify? |
|-------|-------------|-----------|-------------|
| **Planned** | Being designed and set up | ❌ | ✅ |
| **Active** | Fully operational | ✅ | ✅ |
| **Retiring** | Being phased out | ⚠️ Existing only | Limited |
| **Decommissioned** | Archived, read-only | ❌ | ❌ |

**Transition Path:** `Planned → Active → Retiring → Decommissioned`

### Environment Instance Lifecycle

**Operational Status:**
| Status | Can Book? | Description |
|--------|-----------|-------------|
| **Provisioning** | ❌ | Being set up |
| **Available** | ✅ | Ready for use |
| **Maintenance** | ❌ | Scheduled maintenance |
| **Broken** | ❌ | Has critical issues |

**Booking Status:**
| Status | Can Book? | Description |
|--------|-----------|-------------|
| **Available** | ✅ | No active bookings |
| **PartiallyBooked** | ✅ | Has capacity remaining |
| **FullyBooked** | ❌ | At maximum capacity |

### Application Deployment Lifecycle

| Status | Description | Action Required |
|--------|-------------|-----------------|
| **Aligned** | All components at expected versions | None |
| **Mixed** | Some components at different versions | Review |
| **OutOfSync** | Configuration drift | Investigate |
| **Broken** | Critical failures | Immediate action |

### Component Instance Lifecycle

| Status | Description | Alert Level |
|--------|-------------|-------------|
| **Deployed** | Successfully running | ✅ None |
| **PartiallyDeployed** | Some replicas running | ⚠️ Warning |
| **RollbackPending** | Rolling back | ⚠️ Info |
| **Failed** | Deployment failed | ❌ Critical |

### Interface Endpoint Test Modes

| Mode | Description | Typical Environment |
|------|-------------|---------------------|
| **Live** | Real connection | UAT, PreProd, Performance |
| **Virtualised** | Service virtualization | SIT, Integration |
| **Stubbed** | Simple mock | Development |
| **Disabled** | Turned off | Isolated testing |

**Promotion Path:** `Stubbed → Virtualised → Live`

> **📘 Complete Lifecycle Details**: See [LIFECYCLE_GUIDE.md](LIFECYCLE_GUIDE.md) for:
> - Detailed state transition diagrams
> - Lifecycle interaction rules
> - Troubleshooting lifecycle issues
> - Best practices per lifecycle stage

---

## Bulk Upload Guide

For setting up many items at once, use the **Bulk Upload** feature. This is the most efficient way to populate the system with your existing environment data.

### Accessing Bulk Upload

1. Go to **Settings** in the sidebar
2. Click on **Data Management** tab
3. Click **Go to Bulk Upload**

Or navigate directly to: `/settings/bulk-upload`

### Available Upload Types

| Tab | Entity | Description |
|-----|--------|-------------|
| Environments | `environments` | Top-level environment categories |
| Instances | `environment_instances` | Bookable environment instances |
| Applications | `applications` | Business applications |
| Interfaces | `interfaces` | App-to-app communication channels |
| Components | `app_components` | Application components/services |
| App Deployments | `application_environment_instances` | App → Instance mappings |
| Infrastructure | `infra_components` | VMs, containers, databases |
| **Interface Endpoints** | `interface_endpoints` | Interface configuration per instance |
| **Component Instances** | `component_instances` | Component deployment per instance |

### How Bulk Upload Works

1. **Select Tab** - Choose the entity type you want to upload
2. **Download Template** - Click the download button to get a CSV template
3. **Fill in Data** - Edit the CSV in Excel, Google Sheets, or any spreadsheet
4. **Upload File** - Paste CSV content or upload file
5. **Review Results** - See success/failure counts and error details

### Upload Order (Critical!)

Because entities reference each other, upload in this sequence:

```
1. Environments          ─┐
2. Applications          ─┼── No dependencies (upload first)
                          │
3. Instances             ─┤── Requires Environments
4. Interfaces            ─┤── Can reference Applications
5. Components            ─┤── Requires Applications
                          │
6. App Deployments       ─┤── Requires Applications + Instances
7. Infrastructure        ─┤── Requires Instances
                          │
8. Interface Endpoints   ─┤── Requires Interfaces + Instances
9. Component Instances   ─┘── Requires Components + Instances
```

### Interface Endpoints Bulk Upload

Upload interface configurations per environment instance.

**Required Fields:**
- `interface_name` - Name of the interface (must exist)
- `instance_name` - Name of the environment instance (must exist)

**Optional Fields:**
- `endpoint` - URL or connection string
- `test_mode` - `Live`, `Virtualised`, `Stubbed`, `Disabled`
- `enabled` - `true` or `false`
- `source_component_name` - Source component for tracing
- `target_component_name` - Target component for tracing

**Example CSV:**
```csv
interface_name,instance_name,endpoint,test_mode,enabled
Portal-to-Payment-API,SIT-1,https://payment-api.sit.local/v1,Live,true
Portal-to-Payment-API,UAT-1,https://payment-api.uat.local/v1,Live,true
Payment-to-VISA,SIT-1,https://stub.internal/visa,Stubbed,true
Payment-to-VISA,UAT-1,https://sandbox.visa.com/api,Virtualised,true
```

### Component Instances Bulk Upload

Upload component deployments per environment instance.

**Required Fields:**
- `application_name` - Name of the parent application
- `component_name` - Name of the component (must exist under application)
- `instance_name` - Name of the environment instance (must exist)

**Optional Fields:**
- `version` - Deployed version (e.g., "2.1.0")
- `deployment_status` - `Deployed`, `PartiallyDeployed`, `RollbackPending`, `Failed`

**Example CSV:**
```csv
application_name,component_name,instance_name,version,deployment_status
Payment Gateway,payment-api,SIT-1,2.1.0,Deployed
Payment Gateway,payment-api,UAT-1,2.0.0,Deployed
Payment Gateway,payment-processor,SIT-1,2.1.0,Deployed
Customer Portal,portal-ui,SIT-1,3.0.0-beta,Deployed
Customer Portal,portal-bff,SIT-1,2.9.0,Deployed
```

### CSV Format Guidelines

- Use **UTF-8 encoding** (important for special characters)
- First row must contain **exact header names** as shown in templates
- Use **commas** as delimiters
- Wrap text containing commas in **double quotes**
- Leave optional fields **empty** (not null or N/A)
- Date format: **YYYY-MM-DD** or **ISO 8601**
- Boolean values: `true` or `false` (lowercase)

### Error Messages and Solutions

| Error Message | Cause | Solution |
|---------------|-------|----------|
| `Name is required` | Missing required name field | Add name column with values |
| `Environment not found: X` | Environment doesn't exist | Upload environments first |
| `Application not found: X` | Application doesn't exist | Upload applications first |
| `Instance not found: X` | Instance doesn't exist | Upload instances first |
| `Interface not found: X` | Interface doesn't exist | Upload interfaces first |
| `Component not found: X in application Y` | Component doesn't exist | Upload components first |
| `Invalid test_mode: X` | Wrong test_mode value | Use: Live, Virtualised, Stubbed, Disabled |
| `Invalid deployment_status: X` | Wrong status value | Use: Deployed, PartiallyDeployed, RollbackPending, Failed |
| `Invalid category: X` | Wrong environment_category | Use: NonProd, PreProd, DR, Training, Sandpit |

---

## Sample Data Files

### Environments CSV

```csv
name,description,environment_category,lifecycle_stage,owner_team,support_group,data_sensitivity,usage_policies
Development-Alpha,Development environment for Alpha team,NonProd,Active,Alpha Team,IT Support,NonProdDummy,Development and unit testing only
Development-Beta,Development environment for Beta team,NonProd,Active,Beta Team,IT Support,NonProdDummy,Development and unit testing only
Integration-Testing,Shared integration testing environment,NonProd,Active,QA Team,IT Support,NonProdDummy,Integration and API testing
UAT-Environment,User acceptance testing environment,PreProd,Active,UAT Team,IT Support,Confidential,UAT testing with masked production data
Performance-Testing,Performance and load testing environment,NonProd,Active,Performance Team,IT Support,NonProdDummy,Load and stress testing
DR-Failover,Disaster recovery failover environment,DR,Active,DR Team,IT Support,PCI,DR testing and failover verification
Training-Environment,Training and demo environment,Training,Active,Training Team,IT Support,NonProdDummy,User training and product demos
Sandbox-Innovation,Innovation and experimentation sandbox,Sandpit,Active,Innovation Team,IT Support,NonProdDummy,POCs and experimentation
```

**Save as:** `environments.csv`

---

### Instances CSV

```csv
environment_name,name,operational_status,availability_window,capacity,primary_location,bookable
Development-Alpha,DEV-Alpha-1,Available,24x7,5,Sydney DC,true
Development-Alpha,DEV-Alpha-2,Available,24x7,5,Sydney DC,true
Development-Beta,DEV-Beta-1,Available,24x7,5,Sydney DC,true
Integration-Testing,INT-Instance-A,Available,Business Hours,10,Sydney DC,true
Integration-Testing,INT-Instance-B,Available,Business Hours,10,Melbourne DC,true
Integration-Testing,INT-Instance-C,Maintenance,Business Hours,10,Sydney DC,false
UAT-Environment,UAT-Instance-1,Available,Business Hours,20,Sydney DC,true
UAT-Environment,UAT-Instance-2,Available,Business Hours,20,Melbourne DC,true
Performance-Testing,PERF-Instance-1,Available,24x7,50,Sydney DC,true
DR-Failover,DR-Instance-1,Available,24x7,100,Brisbane DC,true
Training-Environment,TRAIN-Instance-1,Available,Business Hours,30,Sydney DC,true
Sandbox-Innovation,SANDBOX-1,Available,24x7,5,Sydney DC,true
```

**Save as:** `instances.csv`

---

### Applications CSV

```csv
name,business_domain,description,criticality,data_sensitivity,owner_team,test_owner
Customer-Portal,Retail Banking,Customer-facing internet banking portal,High,PCI,Digital Banking,QA Team
Mobile-Banking-App,Retail Banking,Mobile banking application for iOS and Android,High,PCI,Mobile Team,QA Team
Payment-Gateway,Payments,Core payment processing system,High,PCI,Payments Team,QA Team
Notification-Service,Communications,Email and SMS notification system,Medium,PII,Platform Team,QA Team
User-Authentication,Security,Centralized authentication and authorization,High,PII,Security Team,QA Team
Account-Management,Core Banking,Account creation and management system,High,PII,Core Banking Team,QA Team
Transaction-History,Reporting,Transaction history and statement generation,Medium,PCI,Reporting Team,QA Team
Fraud-Detection,Risk,Real-time fraud detection and prevention,High,PCI,Risk Team,QA Team
API-Gateway,Platform,Centralized API gateway and rate limiting,High,Confidential,Platform Team,QA Team
Content-Management,Marketing,Marketing content and banner management,Low,NonProdDummy,Marketing Team,QA Team
Loyalty-Program,Customer Experience,Customer loyalty points and rewards,Medium,PII,CX Team,QA Team
Support-Ticketing,Operations,Customer support ticket management,Medium,PII,Support Team,QA Team
```

**Save as:** `applications.csv`

---

### Interfaces CSV

```csv
name,direction,pattern,frequency,protocol,source_application_name,target_application_name,description
Portal-to-Auth-API,Outbound,REST,RealTime,HTTPS,Customer-Portal,User-Authentication,User login and authentication
Portal-to-Account-API,Outbound,REST,RealTime,HTTPS,Customer-Portal,Account-Management,Account balance and details
Portal-to-Payment-API,Outbound,REST,RealTime,HTTPS,Customer-Portal,Payment-Gateway,Payment initiation
Portal-to-History-API,Outbound,REST,RealTime,HTTPS,Customer-Portal,Transaction-History,Transaction history retrieval
Mobile-to-Auth-API,Outbound,REST,RealTime,HTTPS,Mobile-Banking-App,User-Authentication,Mobile authentication
Mobile-to-Account-API,Outbound,REST,RealTime,HTTPS,Mobile-Banking-App,Account-Management,Mobile account access
Mobile-to-Payment-API,Outbound,REST,RealTime,HTTPS,Mobile-Banking-App,Payment-Gateway,Mobile payments
Payment-to-Fraud-Check,Outbound,REST,RealTime,HTTPS,Payment-Gateway,Fraud-Detection,Real-time fraud check
Payment-to-Notification,Outbound,Messaging,RealTime,MQ,Payment-Gateway,Notification-Service,Payment confirmation notifications
Account-to-Notification,Outbound,Messaging,RealTime,MQ,Account-Management,Notification-Service,Account update notifications
Fraud-Alert-Notification,Outbound,Messaging,RealTime,MQ,Fraud-Detection,Notification-Service,Fraud alert notifications
History-Batch-Load,Inbound,File,Batch,SFTP,Transaction-History,,Daily transaction file import
API-Gateway-to-All,Bidirectional,REST,RealTime,HTTPS,API-Gateway,,API routing and rate limiting
Loyalty-Points-Sync,Outbound,REST,Batch,HTTPS,Payment-Gateway,Loyalty-Program,Sync loyalty points after purchase
```

**Save as:** `interfaces.csv`

---

### Components CSV

```csv
application_name,name,component_type,technology_stack,description
Customer-Portal,Portal-Frontend,UI,React,Customer-facing web interface
Customer-Portal,Portal-BFF,Service,Node.js,Backend for frontend service
Customer-Portal,Portal-Cache,Cache,Redis,Session and data caching
Mobile-Banking-App,iOS-App,Mobile,Swift,iOS native application
Mobile-Banking-App,Android-App,Mobile,Kotlin,Android native application
Mobile-Banking-App,Mobile-BFF,Service,Node.js,Mobile backend for frontend
Payment-Gateway,Payment-Processor,Service,Java,Core payment processing logic
Payment-Gateway,Payment-Validator,Service,Java,Payment validation rules
Payment-Gateway,Payment-DB,Database,PostgreSQL,Payment transaction database
User-Authentication,Auth-Service,Service,Go,Authentication microservice
User-Authentication,Token-Service,Service,Go,JWT token management
User-Authentication,Auth-DB,Database,PostgreSQL,User credentials database
Notification-Service,Email-Sender,Service,Python,Email notification sender
Notification-Service,SMS-Sender,Service,Python,SMS notification sender
Notification-Service,Notification-Queue,Queue,RabbitMQ,Notification message queue
Fraud-Detection,Fraud-Engine,Service,Python,ML-based fraud detection
Fraud-Detection,Rules-Engine,Service,Java,Rule-based fraud detection
API-Gateway,Kong-Gateway,Gateway,Kong,API gateway instance
API-Gateway,Rate-Limiter,Service,Redis,Rate limiting cache
```

**Save as:** `components.csv`

---

### Application-Instance Mappings CSV

```csv
application_name,instance_name,deployment_model,version,deployment_status
Customer-Portal,DEV-Alpha-1,Microservices,2.1.0,Aligned
Customer-Portal,INT-Instance-A,Microservices,2.0.0,Aligned
Customer-Portal,UAT-Instance-1,Microservices,2.0.0,Aligned
Mobile-Banking-App,DEV-Alpha-1,Microservices,3.0.0-beta,Aligned
Mobile-Banking-App,INT-Instance-A,Microservices,2.9.0,Aligned
Payment-Gateway,DEV-Alpha-1,Microservices,1.5.0,Aligned
Payment-Gateway,INT-Instance-A,Microservices,1.4.0,Aligned
Payment-Gateway,INT-Instance-B,Microservices,1.4.0,Aligned
Payment-Gateway,UAT-Instance-1,Microservices,1.4.0,Aligned
User-Authentication,DEV-Alpha-1,Microservices,4.0.0,Aligned
User-Authentication,INT-Instance-A,Microservices,3.9.0,Aligned
User-Authentication,UAT-Instance-1,Microservices,3.9.0,Aligned
Notification-Service,INT-Instance-A,Microservices,2.0.0,Aligned
Notification-Service,UAT-Instance-1,Microservices,2.0.0,Aligned
Fraud-Detection,INT-Instance-A,Microservices,1.2.0,Aligned
Fraud-Detection,UAT-Instance-1,Microservices,1.2.0,Aligned
API-Gateway,DEV-Alpha-1,Container,3.0.0,Aligned
API-Gateway,INT-Instance-A,Container,3.0.0,Aligned
API-Gateway,UAT-Instance-1,Container,3.0.0,Aligned
```

**Save as:** `app_instances.csv`

---

### Infrastructure Components CSV

```csv
instance_name,name,component_type,hostname,ip_address,os_version,status,owner_team
DEV-Alpha-1,dev-app-server-1,VM,dev-app-01.local,10.0.1.10,Ubuntu 22.04,Active,Infrastructure
DEV-Alpha-1,dev-db-server-1,VM,dev-db-01.local,10.0.1.20,Ubuntu 22.04,Active,DBA Team
DEV-Alpha-1,dev-cache-1,Container,dev-cache-01.local,10.0.1.30,Alpine Linux,Active,Infrastructure
INT-Instance-A,int-app-server-1,VM,int-app-01.local,10.0.2.10,RHEL 8,Active,Infrastructure
INT-Instance-A,int-app-server-2,VM,int-app-02.local,10.0.2.11,RHEL 8,Active,Infrastructure
INT-Instance-A,int-db-primary,VM,int-db-01.local,10.0.2.20,RHEL 8,Active,DBA Team
INT-Instance-A,int-db-replica,VM,int-db-02.local,10.0.2.21,RHEL 8,Active,DBA Team
INT-Instance-A,int-mq-server,VM,int-mq-01.local,10.0.2.30,RHEL 8,Active,Middleware Team
UAT-Instance-1,uat-app-server-1,VM,uat-app-01.local,10.0.3.10,RHEL 8,Active,Infrastructure
UAT-Instance-1,uat-app-server-2,VM,uat-app-02.local,10.0.3.11,RHEL 8,Active,Infrastructure
UAT-Instance-1,uat-db-primary,VM,uat-db-01.local,10.0.3.20,RHEL 8,Active,DBA Team
UAT-Instance-1,uat-lb,LoadBalancer,uat-lb-01.local,10.0.3.5,F5 BIG-IP,Active,Network Team
PERF-Instance-1,perf-app-cluster,Kubernetes,perf-k8s.local,10.0.4.10,Kubernetes 1.28,Active,Infrastructure
PERF-Instance-1,perf-db-cluster,Database,perf-db.local,10.0.4.20,PostgreSQL 15,Active,DBA Team
DR-Instance-1,dr-app-server-1,VM,dr-app-01.local,10.0.5.10,RHEL 8,Active,DR Team
DR-Instance-1,dr-db-primary,VM,dr-db-01.local,10.0.5.20,RHEL 8,Active,DR Team
```

**Save as:** `infra_components.csv`

---

### Interface Endpoints CSV

```csv
interface_name,instance_name,endpoint,test_mode,enabled
Portal-to-Auth-API,INT-Instance-A,https://auth.int.local/api/v1,Live,true
Portal-to-Auth-API,UAT-Instance-1,https://auth.uat.local/api/v1,Live,true
Portal-to-Payment-API,INT-Instance-A,https://payment.int.local/api/v1,Live,true
Portal-to-Payment-API,UAT-Instance-1,https://payment.uat.local/api/v1,Live,true
Payment-to-Fraud-Check,INT-Instance-A,https://fraud.int.local/check,Live,true
Payment-to-Fraud-Check,UAT-Instance-1,https://stub.internal/fraud-mock,Stubbed,true
API-Gateway-to-All,INT-Instance-A,https://api-gw.int.local,Live,true
API-Gateway-to-All,UAT-Instance-1,https://api-gw.uat.local,Live,true
```

**Save as:** `interface_endpoints.csv`

---

### Component Instances CSV

```csv
application_name,component_name,instance_name,version,deployment_status
Customer-Portal,Portal-Frontend,INT-Instance-A,2.1.0,Deployed
Customer-Portal,Portal-Frontend,UAT-Instance-1,2.0.0,Deployed
Customer-Portal,Portal-BFF,INT-Instance-A,2.1.0,Deployed
Customer-Portal,Portal-BFF,UAT-Instance-1,2.0.0,Deployed
Payment-Gateway,Payment-Processor,INT-Instance-A,1.5.0,Deployed
Payment-Gateway,Payment-Processor,UAT-Instance-1,1.4.0,Deployed
Payment-Gateway,Payment-Validator,INT-Instance-A,1.5.0,Deployed
Payment-Gateway,Payment-DB,INT-Instance-A,1.5.0,Deployed
User-Authentication,Auth-Service,INT-Instance-A,4.0.0,Deployed
User-Authentication,Auth-Service,UAT-Instance-1,3.9.0,Deployed
User-Authentication,Token-Service,INT-Instance-A,4.0.0,Deployed
Fraud-Detection,Fraud-Engine,INT-Instance-A,1.2.0,Deployed
Fraud-Detection,Rules-Engine,INT-Instance-A,1.2.0,Deployed
API-Gateway,Kong-Gateway,INT-Instance-A,3.0.0,Deployed
API-Gateway,Kong-Gateway,UAT-Instance-1,3.0.0,Deployed
```

**Save as:** `component_instances.csv`

---

## Quick Reference

### All Valid Enum Values

#### Environment Categories
| Value | Description |
|-------|-------------|
| `NonProd` | Development, SIT, Integration Testing |
| `PreProd` | UAT, Staging, Pre-Production |
| `DR` | Disaster Recovery |
| `Training` | Training environments |
| `Sandpit` | Experimentation, POCs |

#### Lifecycle Stages (Environments)
| Value | Description |
|-------|-------------|
| `Planned` | Being planned, not yet active |
| `Active` | Currently operational |
| `Retiring` | Being phased out |
| `Decommissioned` | No longer in use |

#### Operational Status (Instances)
| Value | Description |
|-------|-------------|
| `Available` | Ready for use/booking |
| `Broken` | Has issues, not functional |
| `Maintenance` | Scheduled maintenance |
| `Provisioning` | Being set up |

#### Booking Status (Instances)
| Value | Description |
|-------|-------------|
| `Available` | Can accept new bookings |
| `PartiallyBooked` | Some capacity booked |
| `FullyBooked` | At maximum capacity |

#### Criticality Levels (Applications)
| Value | Description |
|-------|-------------|
| `High` | Business critical |
| `Medium` | Important but not critical |
| `Low` | Nice to have |

#### Data Sensitivity
| Value | Description |
|-------|-------------|
| `PCI` | Payment Card Industry data |
| `PII` | Personally Identifiable Information |
| `Confidential` | Business sensitive data |
| `NonProdDummy` | Test/synthetic data only |

#### Interface Patterns
| Value | Description |
|-------|-------------|
| `REST` | RESTful HTTP API |
| `SOAP` | XML SOAP web service |
| `MQ` | IBM MQ messaging |
| `Kafka` | Apache Kafka streaming |
| `FileDrop` | File-based exchange |
| `FTP` | File Transfer Protocol |
| `SFTP` | Secure FTP |
| `FIX` | Financial Information eXchange |
| `Other` | Other integration patterns |

#### Interface Directions
| Value | Description |
|-------|-------------|
| `Inbound` | Receives data from external |
| `Outbound` | Sends data to external |
| `Bidirectional` | Two-way communication |

#### Interface Frequency
| Value | Description |
|-------|-------------|
| `RealTime` | Immediate, synchronous |
| `NearRealTime` | Slight delay, async |
| `Batch` | Scheduled batches |

#### Component Types
| Value | Description |
|-------|-------------|
| `API` | REST/GraphQL/gRPC API |
| `UI` | Frontend/User Interface |
| `Batch` | Batch processing jobs |
| `RuleEngine` | Business rules engine |
| `DBSchema` | Database schema |
| `MessageProcessor` | Message queue consumer |
| `Job` | Scheduled/background job |
| `Lambda` | Serverless function |
| `Other` | Other component types |

#### Test Modes (Interface Endpoints)
| Value | Description |
|-------|-------------|
| `Live` | Real connection to target |
| `Virtualised` | Service virtualization |
| `Stubbed` | Simple mock responses |
| `Disabled` | Interface turned off |

#### Deployment Status (Component Instances)
| Value | Description |
|-------|-------------|
| `Deployed` | Successfully deployed |
| `PartiallyDeployed` | Partial deployment |
| `RollbackPending` | Rollback in progress |
| `Failed` | Deployment failed |

#### Deployment Models (App Deployments)
| Value | Description |
|-------|-------------|
| `Monolith` | Single deployable unit |
| `Microservices` | Multiple services |
| `SaaS` | Third-party hosted |
| `COTS` | Commercial off-the-shelf |

#### App Deployment Status
| Value | Description |
|-------|-------------|
| `Aligned` | All components at expected versions |
| `Mixed` | Some components at different versions |
| `OutOfSync` | Differs from planned state |
| `Broken` | Has failures |

---

## Troubleshooting

### Common Upload Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Environment not found" | Referenced environment doesn't exist | Upload environments first |
| "Application not found" | Referenced application doesn't exist | Upload applications first |
| "Instance not found" | Referenced instance doesn't exist | Upload instances first |
| "Invalid category" | Wrong environment_category value | Use: NonProd, PreProd, DR, Training, Sandpit |
| "Invalid criticality" | Wrong criticality value | Use: High, Medium, Low |
| "Name is required" | Missing required field | Fill in all fields marked with * |

### Tips for Success

1. **Download templates first** - Use the template download button to get correctly formatted CSV files

2. **Check your references** - Make sure environments and applications exist before uploading items that reference them

3. **Use exact names** - When referencing environments or applications, use the exact name (case-sensitive)

4. **Preview before upload** - Always check the preview to catch issues before uploading

5. **Start small** - Test with a few rows first before uploading hundreds of records

---

## Need Help?

- Check the **Dashboard** for system status
- View **Activities** to see recent changes
- Contact your system administrator for access issues
- Check the **Topology** page to visualize your environment setup

---

## Related Documentation

| Document | Description |
|----------|-------------|
| [DEMO_GUIDE.md](DEMO_GUIDE.md) | Step-by-step demo walkthrough |
| [USER_GUIDE.md](USER_GUIDE.md) | Complete user documentation |
| [QUICK_REFERENCE.md](QUICK_REFERENCE.md) | Quick reference card |

---

*Document Version: 3.0 | Last Updated: December 2025*
