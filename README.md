# BookMyEnv (BME) - Environment Booking System

A comprehensive, enterprise-grade Environment Booking and Management System (BME) for managing environments, applications, components, configurations, users, groups, SSO identity, integrations with Jira/GitLab/ServiceNow, bookings, and releases.

## 🚀 Quick Start

### Prerequisites
- Docker Desktop installed and running
- PowerShell (Windows) or Bash (Linux/Mac)

### Start the Application

```powershell
# Windows
.\start.ps1

# Or using Docker Compose directly
docker-compose up --build
```

### Access Points
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **PostgreSQL**: localhost:5432

### Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@bme.local | Admin@123 |
| Environment Manager | envmgr@bme.local | Manager@123 |
| Project Lead | lead@bme.local | Lead@123 |
| Tester | tester@bme.local | Tester@123 |
| Viewer | viewer@bme.local | Viewer@123 |

## 🏗️ Architecture

### Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React 18, Tailwind CSS, MUI |
| Backend | Node.js, Express.js |
| Database | PostgreSQL 15 |
| Real-time | Socket.io |
| Auth | JWT + SSO (OIDC/SAML) |
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
GET    /api/environment-instances/:id/availability - Check availability
```

### Bookings
```
GET    /api/bookings                        - List bookings
POST   /api/bookings                        - Create booking
GET    /api/bookings/:id                    - Get booking
PATCH  /api/bookings/:id/status             - Update status
GET    /api/bookings/calendar               - Calendar view
GET    /api/bookings/conflicts              - Detect conflicts
```

### Releases
```
GET    /api/releases                        - List releases
POST   /api/releases                        - Create release
GET    /api/releases/:id                    - Get release
PATCH  /api/releases/:id/status             - Update status
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
├── docker-compose.yml
├── start.ps1
├── README.md
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
│       ├── services/
│       └── server.js
│
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── next.config.js
    ├── tailwind.config.js
    └── src/
        ├── app/
        ├── components/
        └── lib/
```

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

## 📝 License

MIT License
