# BookMyEnv (BME) - Environment Booking System

A comprehensive, enterprise-grade Environment Booking and Management System (BME) for managing environments, applications, components, configurations, users, groups, SSO identity, integrations with Jira/GitLab/ServiceNow, bookings, and releases.

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
| Frontend | Next.js 14, React 18, Tailwind CSS, MUI |
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
    └── SECURITY.md             # Security documentation
```

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture, data model, flows |
| [USER_GUIDE.md](docs/USER_GUIDE.md) | Complete user documentation |
| [QUICK_REFERENCE.md](docs/QUICK_REFERENCE.md) | Quick reference card |
| [SECURITY.md](docs/SECURITY.md) | Security features and configuration |

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
