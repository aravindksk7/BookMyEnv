# BookMyEnv - Data Setup Guide

A simple guide to setting up your test environment management system. This guide explains how to create environments, applications, instances, interfaces, and configurations.

---

## Table of Contents

1. [Understanding the Data Model](#understanding-the-data-model)
2. [Getting Started](#getting-started)
3. [Creating Environments](#creating-environments)
4. [Creating Instances](#creating-instances)
5. [Creating Applications](#creating-applications)
6. [Creating Interfaces](#creating-interfaces)
7. [Creating Configurations](#creating-configurations)
8. [Linking It All Together](#linking-it-all-together)
9. [Bulk Upload Guide](#bulk-upload-guide)
10. [Sample Data Files](#sample-data-files)

---

## Understanding the Data Model

Think of BookMyEnv like organizing a company's IT landscape:

```
┌─────────────────────────────────────────────────────────────────┐
│                        ENVIRONMENT                               │
│  (e.g., "Development Environment", "Testing Environment")        │
│                                                                   │
│   ┌─────────────────┐    ┌─────────────────┐                     │
│   │    INSTANCE 1   │    │    INSTANCE 2   │   (Can be booked)   │
│   │  (e.g., DEV-1)  │    │  (e.g., DEV-2)  │                     │
│   └────────┬────────┘    └────────┬────────┘                     │
│            │                      │                               │
│   ┌────────▼────────┐    ┌────────▼────────┐                     │
│   │  APPLICATIONS   │    │  APPLICATIONS   │                     │
│   │  deployed here  │    │  deployed here  │                     │
│   └─────────────────┘    └─────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        APPLICATIONS                              │
│  (e.g., "Payment System", "User Portal", "API Gateway")         │
│                                                                   │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                     INTERFACES                           │   │
│   │  (How applications talk to each other)                   │   │
│   │  e.g., "Payment API", "User Auth Service"               │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                   CONFIGURATIONS                         │   │
│   │  (Settings for each application/environment)            │   │
│   │  e.g., "Database URL", "API Key", "Timeout"             │   │
│   └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Key Concepts

| Term | What It Means | Example |
|------|---------------|---------|
| **Environment** | A category or type of testing area | "Non-Production", "Pre-Production", "DR" |
| **Instance** | A specific copy of an environment that can be booked | "DEV-Instance-1", "TEST-Instance-A" |
| **Application** | A software system that runs in environments | "Online Banking Portal", "Payment Gateway" |
| **Interface** | A connection point between applications | "REST API", "Message Queue", "File Transfer" |
| **Configuration** | Settings and values for applications | "Database connection string", "API timeout" |

---

## Getting Started

### Logging In

1. Open your browser and go to `http://localhost:3000`
2. Log in with your credentials:
   - **Email:** `admin@bme.local`
   - **Password:** `Admin@123`

### Navigation

After logging in, you'll see the sidebar with these options:
- **Dashboard** - Overview of your system
- **Environments** - Manage environments and instances
- **Applications** - Manage applications
- **Interfaces** - Manage application interfaces
- **Configs** - Manage configurations
- **Bookings** - Book environment instances
- **Settings** - User and system settings (including Bulk Upload)

---

## Creating Environments

Environments are the top-level containers that represent different types of testing areas.

### Step-by-Step (Manual)

1. Click **Environments** in the sidebar
2. Click the **+ Add Environment** button
3. Fill in the form:

| Field | Description | Example |
|-------|-------------|---------|
| **Name*** | Unique name for the environment | `Development-Team-A` |
| **Description** | What this environment is for | `Development environment for mobile team` |
| **Category*** | Type of environment | `NonProd`, `PreProd`, `DR`, `Training`, `Sandpit` |
| **Lifecycle Stage** | Current status | `Active`, `Provisioning`, `Decommissioning`, `Archived` |
| **Owner Team** | Team responsible | `Mobile Development Team` |
| **Support Group** | Who to contact for issues | `IT Support` |
| **Data Sensitivity** | Type of data allowed | `NonProdDummy`, `PII`, `PCI`, `Confidential` |

4. Click **Save**

### Environment Categories Explained

| Category | When to Use |
|----------|-------------|
| **NonProd** | Development and general testing |
| **PreProd** | Final testing before production |
| **DR** | Disaster recovery environments |
| **Training** | User training and demos |
| **Sandpit** | Experimentation and POCs |

---

## Creating Instances

Instances are the bookable copies of environments. One environment can have multiple instances.

### Step-by-Step (Manual)

1. Go to **Environments** page
2. Click on an environment to expand it
3. Click **+ Add Instance**
4. Fill in the form:

| Field | Description | Example |
|-------|-------------|---------|
| **Name*** | Unique name within the environment | `Instance-1` |
| **Operational Status** | Current availability | `Available`, `InUse`, `Maintenance`, `Offline` |
| **Availability Window** | When it can be used | `24x7`, `Business Hours`, `Weekdays Only` |
| **Capacity** | How many users/tests it can handle | `10` |
| **Primary Location** | Where it's hosted | `Sydney Data Center` |
| **Bookable** | Can users book this instance? | `Yes` / `No` |

5. Click **Save**

### Why Multiple Instances?

Imagine you have a "Development" environment. You might have:
- **DEV-Instance-1** - For Team Alpha
- **DEV-Instance-2** - For Team Beta  
- **DEV-Instance-3** - For automated testing

Each team can book their own instance without interfering with others.

---

## Creating Applications

Applications are the software systems that get deployed to your environments.

### Step-by-Step (Manual)

1. Click **Applications** in the sidebar
2. Click **+ Add Application**
3. Fill in the form:

| Field | Description | Example |
|-------|-------------|---------|
| **Name*** | Unique application name | `Online Banking Portal` |
| **Business Domain** | What business area it belongs to | `Retail Banking`, `Payments`, `HR` |
| **Description** | What the application does | `Customer-facing internet banking application` |
| **Criticality** | How important is it? | `High`, `Medium`, `Low` |
| **Data Sensitivity** | What kind of data it handles | `PCI`, `PII`, `Confidential`, `NonProdDummy` |
| **Owner Team** | Team that owns it | `Digital Banking Team` |
| **Test Owner** | Team that tests it | `QA Team` |

4. Click **Save**

### Linking Applications to Instances

After creating applications and instances, you can link them:

1. Go to the **Topology** page
2. Or on the Environment page, click on an instance and use "Deploy Application"
3. This shows which applications are deployed where

---

## Creating Interfaces

Interfaces define how applications communicate with each other.

### Step-by-Step (Manual)

1. Click **Interfaces** in the sidebar
2. Click **+ Add Interface**
3. Fill in the form:

| Field | Description | Example |
|-------|-------------|---------|
| **Name*** | Unique interface name | `Payment-API` |
| **Direction** | Flow of data | `Inbound`, `Outbound`, `Bidirectional` |
| **Pattern** | Type of integration | `REST`, `SOAP`, `GraphQL`, `Messaging`, `File` |
| **Frequency** | How often it's called | `RealTime`, `Batch`, `OnDemand` |
| **Protocol** | Technical protocol | `HTTPS`, `SFTP`, `MQ`, `Kafka` |
| **Source Application** | Where data comes from | `Online Banking Portal` |
| **Target Application** | Where data goes to | `Payment Gateway` |
| **Description** | What this interface does | `Sends payment requests to payment processor` |

4. Click **Save**

### Interface Patterns Explained

| Pattern | Description | Example Use Case |
|---------|-------------|------------------|
| **REST** | Web API calls | Mobile app calling backend |
| **SOAP** | XML-based web services | Legacy system integration |
| **GraphQL** | Flexible query API | Modern web applications |
| **Messaging** | Async message queues | Order processing |
| **File** | File-based transfer | Batch data imports |
| **Database** | Direct DB connections | Reporting systems |

---

## Creating Configurations

Configurations store settings and values for your applications and environments.

### Step-by-Step (Manual)

1. Click **Configs** in the sidebar
2. Click **+ Add Config**
3. Fill in the form:

| Field | Description | Example |
|-------|-------------|---------|
| **Key*** | Configuration name | `database.connection.url` |
| **Value*** | Configuration value | `jdbc:postgresql://db:5432/myapp` |
| **Environment** | Which environment (optional) | `Development-Team-A` |
| **Application** | Which application (optional) | `Online Banking Portal` |
| **Description** | What this config is for | `Database connection string for app` |
| **Is Secret** | Is this a sensitive value? | `Yes` (will be masked) |

4. Click **Save**

### Configuration Best Practices

- Use consistent naming: `category.subcategory.name`
  - Examples: `database.pool.size`, `api.timeout.seconds`, `feature.dark-mode.enabled`
- Mark passwords and API keys as **secrets**
- Add descriptions so others understand what values to use

---

## Linking It All Together

Here's the typical workflow for setting up a complete test environment:

### 1. Create the Environment
```
Environment: "Integration Testing"
Category: NonProd
Description: "Shared integration testing environment"
```

### 2. Create Instances
```
Instance 1: "INT-Instance-A"
  - Status: Available
  - Capacity: 5 teams
  - Bookable: Yes

Instance 2: "INT-Instance-B"  
  - Status: Available
  - Capacity: 5 teams
  - Bookable: Yes
```

### 3. Create Applications
```
Application 1: "Customer Portal"
  - Domain: Retail
  - Criticality: High

Application 2: "Payment Service"
  - Domain: Payments
  - Criticality: High

Application 3: "Notification Service"
  - Domain: Communications
  - Criticality: Medium
```

### 4. Create Interfaces Between Apps
```
Interface 1: "Portal-to-Payment-API"
  - Source: Customer Portal
  - Target: Payment Service
  - Pattern: REST
  - Direction: Outbound

Interface 2: "Payment-to-Notification"
  - Source: Payment Service
  - Target: Notification Service
  - Pattern: Messaging
  - Direction: Outbound
```

### 5. Add Configurations
```
Config 1: "payment.api.url"
  - Value: "https://payment-api.int.local"
  - Environment: Integration Testing
  - Application: Customer Portal

Config 2: "notification.queue.name"
  - Value: "payment-notifications"
  - Environment: Integration Testing
  - Application: Payment Service
```

### 6. Deploy Applications to Instances
Link your applications to the instances where they're deployed.

### 7. Book and Use!
Teams can now book instances for their testing.

---

## Bulk Upload Guide

For setting up many items at once, use the **Bulk Upload** feature.

### Accessing Bulk Upload

1. Go to **Settings** in the sidebar
2. Click on **Data Management** tab
3. Click **Go to Bulk Upload**

Or navigate directly to: `/settings/bulk-upload`

### How Bulk Upload Works

1. **Download a Template** - Get the CSV template for the entity type
2. **Fill in Your Data** - Edit the CSV in Excel or any spreadsheet
3. **Upload the File** - Drag and drop or browse to select
4. **Preview** - Review the data before uploading
5. **Upload** - Click to process the data
6. **Review Results** - See what succeeded and what failed

### Upload Order (Important!)

Because items reference each other, upload in this order:

1. **Environments** first (no dependencies)
2. **Applications** second (no dependencies)
3. **Instances** third (requires environments to exist)
4. **Interfaces** fourth (can reference applications)
5. **Components** fifth (requires applications to exist)
6. **App-Instance Mappings** sixth (requires both apps and instances)
7. **Configurations** last (can reference environments and applications)

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

## Quick Reference Card

### Environment Categories
| Value | Description |
|-------|-------------|
| `NonProd` | Development, Testing |
| `PreProd` | UAT, Staging |
| `DR` | Disaster Recovery |
| `Training` | Training environments |
| `Sandpit` | Experimentation |

### Lifecycle Stages
| Value | Description |
|-------|-------------|
| `Active` | Currently in use |
| `Provisioning` | Being set up |
| `Decommissioning` | Being retired |
| `Archived` | No longer active |

### Operational Status (Instances)
| Value | Description |
|-------|-------------|
| `Available` | Ready to use/book |
| `InUse` | Currently booked |
| `Maintenance` | Under maintenance |
| `Offline` | Not available |

### Criticality Levels
| Value | Description |
|-------|-------------|
| `High` | Business critical |
| `Medium` | Important but not critical |
| `Low` | Nice to have |

### Data Sensitivity
| Value | Description |
|-------|-------------|
| `PCI` | Payment card data |
| `PII` | Personal information |
| `Confidential` | Business sensitive |
| `NonProdDummy` | Test/dummy data only |

### Interface Patterns
| Value | Description |
|-------|-------------|
| `REST` | RESTful API |
| `SOAP` | SOAP web service |
| `GraphQL` | GraphQL API |
| `gRPC` | gRPC service |
| `Messaging` | Message queue |
| `File` | File transfer |
| `Database` | Direct DB |
| `EventStream` | Event streaming |

### Interface Directions
| Value | Description |
|-------|-------------|
| `Inbound` | Receives data |
| `Outbound` | Sends data |
| `Bidirectional` | Both ways |

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

*Document Version: 1.0 | Last Updated: December 2024*
