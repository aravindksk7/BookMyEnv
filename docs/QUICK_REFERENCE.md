# BookMyEnv - Quick Reference Card

## 🔐 Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@bme.local | Admin@123 |
| Manager | envmgr@bme.local | Admin@123 |
| Lead | lead@bme.local | Admin@123 |
| Tester | tester@bme.local | Admin@123 |
| Viewer | viewer@bme.local | Admin@123 |

> **Note**: All demo users share the same password for simplicity. Change in production!

---

## 🌐 URLs

| Service | URL | Description |
|---------|-----|-------------|
| Frontend (HTTPS) | https://localhost | Main application |
| Frontend (HTTP) | http://localhost:3000 | Development only |
| Backend API | https://localhost/api | Via Nginx proxy |
| Health Check | https://localhost/health | System status |

---

## 🔒 Security Features

| Feature | Status |
|---------|--------|
| HTTPS/TLS | ✅ Enabled (TLS 1.2/1.3) |
| Rate Limiting | ✅ 5 login attempts/15min |
| Password Policy | ✅ Min 8 chars, mixed case, special |
| CORS | ✅ Explicit origins only |
| CSP Headers | ✅ Enabled |
| HSTS | ✅ Enabled with preload |

---

## 📋 Quick Actions

### Create a Booking
1. Bookings → + New Booking
2. Select Test Phase & Dates
3. Add Environment Instances
4. Submit

### Create an Environment
1. Environments → + Add Environment
2. Fill: Name, Category (NonProd/PreProd/DR)
3. Create

### Add Instance to Environment
1. Click Environment → Instances tab
2. + Add Instance
3. Fill: Name, Status, Capacity
4. Create

### Deploy Application to Instance
1. Applications → View Details
2. Deployments tab → Deploy to Environment
3. Select Instance, Version, Model
4. Deploy

### Undeploy Application
1. Applications → View Details
2. Deployments tab
3. Click Undeploy icon on row
4. Confirm

### Resolve Booking Conflict
1. Bookings → Conflicts tab
2. Click Resolve icon (gavel)
3. Select resolution type
4. Add notes → Apply

### Bulk Upload Data
1. Settings → Data Management
2. Go to Bulk Upload
3. Select entity tab (9 types available):
   - Environments, Instances, Applications
   - Interfaces, Components (App)
   - App-Instance Links, Infrastructure
   - Interface Endpoints, Component Instances
4. Download template → Fill → Upload

### Create a Release
1. Releases → + New Release
2. Fill: Name, Version, Dates
3. Select Environments & Apps
4. Create

---

## 📊 Status Codes

### Booking Status
| Status | Color | Meaning |
|--------|-------|---------|
| Requested | 🔵 Blue | Awaiting review |
| PendingApproval | 🟡 Yellow | Has conflicts |
| Approved | 🟢 Green | Confirmed |
| Active | 🟢 Green | In use |
| Completed | ⚪ Gray | Finished |
| Cancelled | 🔴 Red | Cancelled |

### Instance Status
| Status | Meaning |
|--------|---------|
| Available | Ready to book |
| Broken | Has issues, not functional |
| Maintenance | Under maintenance |
| Provisioning | Being set up |

### Release Status
| Status | Meaning |
|--------|--------|
| Planned | Scheduled |
| InProgress | Deploying |
| Completed | Done |
| RolledBack | Reverted |

### Deployment Status (Application)
| Status | Meaning |
|--------|--------|
| Aligned | All components match expected versions |
| Mixed | Some components at different versions |
| OutOfSync | Deployment differs from plan |
| Broken | Deployment has issues |

### Component Instance Status
| Status | Meaning |
|--------|--------|
| Deployed | Successfully deployed |
| PartiallyDeployed | Partial deployment |
| RollbackPending | Rollback in progress |
| Failed | Deployment failed |

### Interface Test Modes
| Mode | Meaning |
|------|--------|
| Live | Real connection to target |
| Virtualised | Service virtualization |
| Stubbed | Simple mock responses |
| Disabled | Interface turned off |

---

## 🔑 Role Permissions

| Action | Admin | Manager | Lead | Tester | Viewer |
|--------|:-----:|:-------:|:----:|:------:|:------:|
| Create Environment | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create Booking | ✅ | ✅ | ✅ | ✅ | ❌ |
| Approve Booking | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create Release | ✅ | ❌ | ✅ | ❌ | ❌ |
| Manage Users | ✅ | ❌ | ❌ | ❌ | ❌ |
| View All | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 🗂️ Environment Categories

| Category | Use Case |
|----------|----------|
| **NonProd** | Development, SIT, Testing |
| **PreProd** | UAT, Staging, Pre-Production |
| **DR** | Disaster Recovery |
| **Training** | Training environments |
| **Sandpit** | Sandbox/experimentation |

---

## 🧪 Test Phases

- **SIT** - System Integration Testing
- **UAT** - User Acceptance Testing
- **NFT** - Non-Functional Testing
- **Performance** - Load/Stress Testing
- **DRRehearsal** - DR Testing
- **PenTest** - Security Testing

---

## 📞 API Endpoints

```
POST /api/auth/login              # Login
GET  /api/environments            # List environments
GET  /api/environments/:id/apps   # Get apps in environment
GET  /api/bookings                # List bookings
POST /api/bookings                # Create booking
GET  /api/bookings/conflicts      # Get all conflicts
POST /api/bookings/:id/conflicts/resolve  # Resolve conflict
GET  /api/releases                # List releases
GET  /api/applications            # List applications
GET  /api/applications/:id/instances      # Get app deployments
POST /api/applications/:id/instances      # Deploy app to instance
DEL  /api/applications/:id/instances/:iid # Undeploy app
GET  /api/interfaces              # List interfaces
GET  /api/interfaces/:id/endpoints        # Get interface endpoints
GET  /api/groups                  # List groups
GET  /api/dashboard/stats         # Get statistics
GET  /health                      # Health check

# Bulk Upload Endpoints
POST /api/bulk-upload/environments        # Upload environments
POST /api/bulk-upload/instances           # Upload env instances
POST /api/bulk-upload/applications        # Upload applications
POST /api/bulk-upload/interfaces          # Upload interfaces
POST /api/bulk-upload/components          # Upload app components
POST /api/bulk-upload/app_instances       # Link apps to instances
POST /api/bulk-upload/infra_components    # Upload infra components
POST /api/bulk-upload/interface_endpoints # Upload interface endpoints
POST /api/bulk-upload/component_instances # Upload component instances
GET  /api/bulk-upload/template/:entity    # Download CSV template
```

---

## 🛠️ Docker Commands

```bash
# Start with HTTPS (recommended)
docker-compose -f docker-compose.https.yml up -d

# Or use the helper script (Windows)
.\start-https.ps1

# Generate SSL certificates (first time)
.\generate-ssl.ps1

# View logs
docker logs tem-backend
docker logs tem-frontend
docker logs tem-nginx

# Restart services
docker-compose -f docker-compose.https.yml restart

# Stop all
docker-compose -f docker-compose.https.yml down

# Development mode (HTTP only)
docker-compose up -d
```

---

## ☁️ AWS Deployment

```bash
# Deploy to AWS using Terraform
cd terraform
terraform init
terraform plan
terraform apply

# Deploy application code
.\deploy-aws.ps1   # Windows
./deploy-aws.sh    # Linux/Mac
```

See [terraform/README.md](../terraform/README.md) for complete AWS deployment guide.

---

## 🔧 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| JWT_SECRET | JWT signing key | **Required** |
| POSTGRES_PASSWORD | Database password | tem_password |
| NODE_ENV | Environment | development |
| RATE_LIMIT_MAX | API rate limit | 100/15min |
| AUTH_RATE_LIMIT_MAX | Login rate limit | 5/15min |

---

## 💡 Tips

1. **Use HTTPS** - Always use `docker-compose.https.yml` in production
2. **Book Early** - Reserve environments in advance
3. **Check Calendar** - Use calendar view for availability
4. **Clear Description** - Help others understand your booking
5. **Update Status** - Keep booking status current
6. **Release On Time** - Free resources when done
7. **Change Passwords** - Update demo passwords in production
8. **Track Deployments** - Keep app deployments up to date
9. **Resolve Conflicts** - Address booking conflicts promptly
10. **Use Bulk Upload** - Import large datasets efficiently

---

**Need Help?** Check the full [User Guide](USER_GUIDE.md) or [Security Guide](SECURITY.md).

---

**BookMyEnv v3.1.0** | December 2025
