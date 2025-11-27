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
| InUse | Currently booked |
| Maintenance | Under maintenance |
| Offline | Not operational |

### Release Status
| Status | Meaning |
|--------|---------|
| Planned | Scheduled |
| InProgress | Deploying |
| Completed | Done |
| RolledBack | Reverted |

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
POST /api/auth/login        # Login
GET  /api/environments      # List environments
GET  /api/bookings          # List bookings
POST /api/bookings          # Create booking
GET  /api/releases          # List releases
GET  /api/applications      # List applications
GET  /api/groups            # List groups
GET  /api/dashboard/stats   # Get statistics
GET  /health                # Health check
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

---

**Need Help?** Check the full [User Guide](USER_GUIDE.md) or [Security Guide](SECURITY.md).
