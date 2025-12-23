# BookMyEnv (BME) - Environment Booking System

A comprehensive, enterprise-grade Environment Booking and Management System (BME) for managing environments, applications, deployments, bookings, releases, and more.

## ✨ Key Features

- **Environment Management** - Create and manage environments with multiple instances
- **Application Deployments** - Track application deployments across environment instances
- **Booking System** - Book environments with conflict detection and resolution
- **Refresh Lifecycle (v4.0)** - Schedule data refreshes with booking conflict detection and resolution workflows
- **Email Notifications (v5.0)** - Configurable email alerts via SMTP, SendGrid, or AWS SES
- **Dark Mode (v5.0)** - System-wide dark theme support with user preferences
- **Release Management** - Plan and track releases across environments
- **Bulk Data Upload** - Import data in bulk via CSV (7 entity types)
- **Real-time Monitoring** - Dashboard with live activity feed
- **External Integrations** - Connect with Jira, GitLab, ServiceNow
- **Role-based Access** - 5 user roles with granular permissions
- **SSO Support** - Azure AD, Okta, and other SAML/OIDC providers

## 🚀 Quick Start

### Prerequisites
- Docker Desktop installed and running
- PowerShell (Windows) or Bash (Linux/Mac)

### Start the Application (HTTPS - Recommended)

```powershell
# Windows - Generate SSL certs and start
.\generate-ssl.ps1
.\start-https.ps1

# Or using Docker Compose directly
docker-compose -f docker-compose.https.yml up -d
```

### Access Points (HTTPS - Production)
- **Frontend**: https://localhost
- **Backend API**: https://localhost/api
- **Health Check**: https://localhost/health

> **Note**: Accept the self-signed certificate warning in your browser for development.

### Development Mode (HTTP)

```powershell
# HTTP only (no SSL)
docker-compose up -d
```

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000

### Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@bme.local | Admin@123 |
| Environment Manager | envmgr@bme.local | Admin@123 |
| Project Lead | lead@bme.local | Admin@123 |
| Tester | tester@bme.local | Admin@123 |
| Viewer | viewer@bme.local | Admin@123 |

> ⚠️ **Security**: All demo users share the same password. Change in production!

## 🔒 Security Features

| Feature | Description |
|---------|-------------|
| **HTTPS/TLS** | TLS 1.2/1.3 via Nginx reverse proxy |
| **Rate Limiting** | 5 login attempts per 15 minutes |
| **Password Policy** | Min 8 chars, uppercase, lowercase, number, special char |
| **JWT Auth** | Secure tokens with configurable expiry |
| **CORS** | Explicit origin whitelist |
| **Security Headers** | CSP, HSTS, X-Frame-Options, etc. |
| **Input Validation** | express-validator on all endpoints |
| **bcrypt** | 12 rounds password hashing |

See [docs/SECURITY.md](docs/SECURITY.md) for complete security documentation.

## 🏗️ Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    Nginx     │────▶│   Frontend   │────▶│   Backend    │────▶│  PostgreSQL  │
│   (HTTPS)    │     │  (Next.js)   │     │  (Express)   │     │   Database   │
│   Port 443   │     │   Port 3000  │     │   Port 5000  │     │  (Internal)  │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

### Technology Stack

| Layer | Technology |
|-------|------------|
| Reverse Proxy | Nginx (SSL termination, security headers) |
| Frontend | Next.js 15, React 19, Tailwind CSS, MUI 6 |
| Backend | Node.js 22, Express.js, express-validator |
| Database | PostgreSQL 15 |
| Real-time | Socket.io |
| Auth | JWT + bcrypt + Rate Limiting |
| Containerization | Docker, Docker Compose |

### Domain Model (30+ Entities)

#### User & Identity Management
- User, UserGroup, UserGroupMembership
- IdentityProviderConfig, UserIdentity, SsoGroupMapping
- UserExternalAccount

#### Environment & Infrastructure
- Environment, EnvironmentInstance
- InfraComponent, Interface, InterfaceEndpoint

#### Application & Components
- Application, ApplicationEnvironmentInstance
- AppComponent, ComponentInstance

#### Configuration Management
- ConfigSet, ConfigItem, TestDataSet

#### Booking & Scheduling
- EnvironmentBooking, BookingResource, BookingApplication
- BookingConflict, ConflictResolution

#### Refresh Management (v4.0)
- RefreshIntent, RefreshImpactedResource
- RefreshBookingConflict, RefreshConflictResolution

#### Release Management
- Release, ReleaseApplication, ReleaseEnvironment, ReleaseComponentInstance
- Change

#### External Integrations
- ExternalToolIntegration, IntegrationLink
- JiraProjectMapping, GitLabProjectMapping, ServiceNowConfig

## 🔗 External Integrations

### Jira Integration
- Link issues, epics, releases to BME entities
- Sync issue status via webhooks
- JQL search from within BME
- Auto-create issues for conflicts

### GitLab Integration
- Link pipelines, MRs, tags to releases/components
- Trigger deployment pipelines from BME
- Track pipeline status via webhooks
- Auto-create releases from tags

### ServiceNow Integration
- Auto-create change tickets for bookings/releases
- Sync change approval status
- Link CMDB CIs to infrastructure
- Query change calendar for conflicts

## 📊 API Documentation

### Authentication
```
POST /api/auth/login         - Local login
POST /api/auth/sso/callback  - SSO callback
GET  /api/auth/me            - Current user
```

### Environments
```
GET    /api/environments                    - List environments
POST   /api/environments                    - Create environment
GET    /api/environments/:id                - Get environment
GET    /api/environments/:id/instances      - List instances
POST   /api/environments/:id/instances      - Create instance
GET    /api/environments/:id/applications   - List apps in environment
GET    /api/environment-instances/:id/availability - Check availability
```

### Applications & Deployments
```
GET    /api/applications                    - List applications
POST   /api/applications                    - Create application
GET    /api/applications/:id                - Get application
GET    /api/applications/:id/instances      - Get app deployments
POST   /api/applications/:id/instances      - Deploy app to instance
PUT    /api/applications/:id/instances/:iid - Update deployment
DELETE /api/applications/:id/instances/:iid - Undeploy application
```

### Bookings
```
GET    /api/bookings                        - List bookings
POST   /api/bookings                        - Create booking
GET    /api/bookings/:id                    - Get booking
PATCH  /api/bookings/:id/status             - Update status
GET    /api/bookings/calendar               - Calendar view
GET    /api/bookings/all-conflicts          - List all conflicts
GET    /api/bookings/:id/conflicts          - Get booking conflicts
POST   /api/bookings/:id/conflicts/resolve  - Resolve conflict
```

### Bulk Upload
```
POST   /api/bulk-upload/environments        - Bulk upload environments
POST   /api/bulk-upload/instances           - Bulk upload instances
POST   /api/bulk-upload/applications        - Bulk upload applications
POST   /api/bulk-upload/interfaces          - Bulk upload interfaces
POST   /api/bulk-upload/components          - Bulk upload components
POST   /api/bulk-upload/app-deployments     - Bulk upload deployments
POST   /api/bulk-upload/infrastructure      - Bulk upload infra
```

### Releases
```
GET    /api/releases                        - List releases
POST   /api/releases                        - Create release
GET    /api/releases/:id                    - Get release
PATCH  /api/releases/:id/status             - Update status
```

### Refresh Management (v4.0)
```
GET    /api/refresh/intents                 - List refresh intents
POST   /api/refresh/intents                 - Create refresh intent
GET    /api/refresh/intents/:id             - Get refresh intent
PATCH  /api/refresh/intents/:id/status      - Update status
GET    /api/refresh/intents/:id/conflicts   - Get booking conflicts
POST   /api/refresh/conflicts/:id/resolve   - Resolve conflict
POST   /api/refresh/conflicts/:id/force     - Force approve (admin)
POST   /api/refresh/notify                  - Send conflict notifications
```

### Integrations
```
GET    /api/integrations                    - List integrations
POST   /api/integrations                    - Create integration
POST   /api/integrations/:id/test           - Test connection
POST   /api/webhooks/:tool/:id              - Webhook receivers
```

## 🔐 User Roles & Permissions

| Role | Permissions |
|------|-------------|
| Admin | Full access, user/group management, IdP configuration |
| EnvironmentManager | Manage environments, approve bookings, manage configs |
| ProjectLead | Create bookings, manage releases, view all |
| Tester | Create bookings, view environments/applications |
| Viewer | Read-only access to all resources |

## 📁 Project Structure

```
test-env-management/
├── docker-compose.yml          # HTTP development mode
├── docker-compose.https.yml    # HTTPS production mode
├── .env                        # Environment variables (not in git)
├── .env.example                # Template for environment variables
├── start.ps1                   # HTTP startup script
├── start-https.ps1             # HTTPS startup script
├── generate-ssl.ps1            # SSL certificate generator
├── test-functional.ps1         # Functional test suite
│
├── nginx/                      # Reverse proxy configuration
│   ├── Dockerfile
│   ├── nginx.conf
│   └── ssl/                    # SSL certificates
│
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── database/
│   │   └── init.sql
│   └── src/
│       ├── config/
│       ├── controllers/
│       ├── middleware/
│       ├── routes/
│       └── server.js
│
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── app/
│       ├── contexts/
│       └── lib/
│
└── docs/
    ├── ARCHITECTURE.md         # System architecture
    ├── USER_GUIDE.md           # User documentation
    ├── QUICK_REFERENCE.md      # Quick reference card
    ├── SECURITY.md             # Security documentation
    ├── LIFECYCLE_GUIDE.md      # Entity lifecycle states & transitions
    └── WORKFLOW_GUIDE.md       # End-user workflow walkthroughs
```

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [DEMO_GUIDE.md](docs/DEMO_GUIDE.md) | Step-by-step demo walkthrough |
| [USER_GUIDE.md](docs/USER_GUIDE.md) | Complete user documentation |
| [WORKFLOW_GUIDE.md](docs/WORKFLOW_GUIDE.md) | **Step-by-step workflow guides for bookings, refreshes, and conflict resolution** |
| [LIFECYCLE_GUIDE.md](docs/LIFECYCLE_GUIDE.md) | Entity lifecycle states, transitions, and state diagrams |
| [QUICK_REFERENCE.md](docs/QUICK_REFERENCE.md) | Quick reference card |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture, data model, flows |
| [SECURITY.md](docs/SECURITY.md) | Security features and configuration |
| [DATA_SETUP_GUIDE.md](docs/DATA_SETUP_GUIDE.md) | Data import and setup guide |
| [UPGRADE_GUIDE_v5.0.0.md](docs/UPGRADE_GUIDE_v5.0.0.md) | **v5.0.0 upgrade guide with migration scripts** |
| [ENTERPRISE_APPROVAL.md](docs/ENTERPRISE_APPROVAL.md) | Enterprise architecture & security approval |
| [terraform/README.md](terraform/README.md) | AWS Terraform deployment guide |

## 🔄 Upgrading

### Upgrade to v5.0.0 (Email, Dark Mode, Schedule-X Calendar)

```powershell
# Windows
.\upgrade-v5.ps1

# Linux/Mac
chmod +x upgrade-v5.sh
./upgrade-v5.sh
```

See [UPGRADE_GUIDE_v5.0.0.md](docs/UPGRADE_GUIDE_v5.0.0.md) for detailed instructions.

## ☁️ AWS Cloud Deployment

BookMyEnv can be deployed to AWS using Terraform. The infrastructure includes:

- **VPC** with public/private subnets across 2 AZs
- **ECS Fargate** for serverless container hosting
- **RDS PostgreSQL** for managed database
- **S3 + CloudFront** for frontend static hosting with CDN
- **ALB** for backend load balancing
- **Secrets Manager** for secure credential storage

### Quick Deploy

```bash
cd terraform

# 1. Configure variables
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your settings

# 2. Initialize and apply
terraform init
terraform plan
terraform apply

# 3. Deploy application code
./deploy-aws.ps1   # Windows
./deploy-aws.sh    # Linux/Mac
```

### Estimated Monthly Cost: ~$76
- ECS Fargate (0.5 vCPU, 1GB): ~$30
- RDS PostgreSQL (db.t3.micro): ~$15
- ALB: ~$20
- CloudFront + S3: ~$11

See [terraform/README.md](terraform/README.md) for complete AWS deployment documentation.

## 🛠️ Development

### Running Locally (without Docker)

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

### Environment Variables

See `.env.example` files in backend and frontend directories.

## 📋 Changelog

### v4.0.0 (January 2025)
**Refresh Lifecycle Management**
- **Refresh Intent System**: Complete lifecycle for managing environment refresh requests (draft → scheduled → in_progress → completed)
- **Booking-Refresh Conflict Detection**: Automatic detection of conflicts between scheduled refreshes and active bookings
- **Impact Types**: DATA_OVERWRITE, DOWNTIME_REQUIRED, READ_ONLY, CONFIG_CHANGE, SCHEMA_CHANGE with severity-based conflict flags
- **Conflict Resolution Workflows**: RESCHEDULE, CANCEL, ACKNOWLEDGE_PROCEED options with required approvals for major conflicts
- **Real-time Notifications**: Automatic email alerts to booking owners when refresh conflicts detected
- **Force Approval**: Admin-only approval for major conflicts that require override

**Documentation Updates**
- New [WORKFLOW_GUIDE.md](docs/WORKFLOW_GUIDE.md) - Comprehensive step-by-step workflows for end users
- Updated [USER_GUIDE.md](docs/USER_GUIDE.md) - Added refresh lifecycle and conflict resolution sections
- Updated [LIFECYCLE_GUIDE.md](docs/LIFECYCLE_GUIDE.md) - Added refresh intent state diagrams

### v3.2.0 (January 2025)
**Major Frontend Upgrade**
- **Next.js**: 14.2 → 15.1 with Turbopack support
- **React**: 18.2 → 19.0 with new features
- **MUI Material**: 5.15 → 6.3 with Pigment CSS
- **MUI X-DataGrid**: 6.19 → 8.20
- **MUI X-Date-Pickers**: 6.18 → 8.0
- **TypeScript**: 5.3 → 5.7
- **ESLint**: 8.56 → 9.17 (new flat config format)

**Infrastructure Updates**
- Node.js base images updated to 22-alpine
- All npm vulnerabilities fixed
- Docker images optimized

**Bug Fixes**
- Fixed PASSWORD_REGEX pattern for proper digit matching

### v3.1.0 (December 2024)
- Initial AWS Terraform infrastructure
- Full feature set with all integrations

## 📝 License

MIT License

---

**BookMyEnv v4.0.0** | January 2025
