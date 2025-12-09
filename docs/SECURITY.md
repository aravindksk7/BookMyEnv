# BookMyEnv Security Guide

This document describes the security measures implemented in BookMyEnv and recommendations for production deployment.

## Security Features Implemented

### 1. Authentication & Authorization

#### Password Security
- **Bcrypt hashing** with 12 rounds (OWASP recommended)
- **Password strength validation**: Minimum 8 characters with uppercase, lowercase, number, and special character
- Passwords are never logged or exposed in API responses

#### JWT Token Security
- Tokens are signed with a secret key (must be set via environment variable)
- Default expiration: 24 hours
- User role embedded in token for authorization

#### Rate Limiting
- **General API**: 100 requests per 15 minutes per IP
- **Authentication endpoints**: 5 login attempts per 15 minutes per IP
- Protects against brute force and credential stuffing attacks

### 2. Input Validation
- **express-validator** middleware for all user inputs
- Email normalization and validation
- Username alphanumeric validation (3-50 characters)
- Request body size limited to 10KB (DoS protection)

### 3. HTTP Security Headers (via Helmet + Nginx)

| Header | Value | Purpose |
|--------|-------|---------|
| X-Frame-Options | SAMEORIGIN | Clickjacking protection |
| X-Content-Type-Options | nosniff | MIME sniffing protection |
| X-XSS-Protection | 1; mode=block | XSS filter |
| Strict-Transport-Security | max-age=31536000; includeSubDomains; preload | Force HTTPS |
| Referrer-Policy | strict-origin-when-cross-origin | Referrer leakage protection |
| Content-Security-Policy | Restrictive policy | XSS/injection protection |
| Permissions-Policy | Disabled features | Feature policy |

### 4. CORS Configuration
- Explicit allowed origins list
- Credentials support with proper validation
- No wildcard origins in production

### 5. Network Security
- Database NOT exposed externally (internal Docker network only)
- All external traffic via Nginx reverse proxy
- SSL/TLS encryption for all connections

### 6. SSL/TLS Configuration
- TLS 1.2 and 1.3 only (weak protocols disabled)
- Strong cipher suites
- HSTS enabled

## Production Deployment Checklist

### Required Environment Variables

Create a `.env` file with secure values:

```bash
# Database (use strong passwords!)
POSTGRES_USER=your_db_user
POSTGRES_PASSWORD=<GENERATE_SECURE_PASSWORD_32_CHARS>
POSTGRES_DB=bookmyenv_prod

# JWT Secret (CRITICAL - use crypto random!)
# Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=<64_CHAR_RANDOM_HEX_STRING>

# Application
NODE_ENV=production

# URLs (replace with your domain)
CORS_ORIGIN=https://yourdomain.com
FRONTEND_URL=https://yourdomain.com
```

### SSL Certificates

For production, replace self-signed certificates with proper certificates:

1. **Let's Encrypt (free)**:
   - Uncomment certbot configuration in nginx.conf
   - Use certbot for automatic certificate renewal

2. **Commercial certificates**:
   - Place certificate files in `nginx/ssl/`
   - Update paths in nginx.conf

### Security Hardening

1. **Remove development defaults**:
   ```bash
   # Ensure NODE_ENV=production
   # Ensure JWT_SECRET is unique and secure
   # Ensure database credentials are changed
   ```

2. **Enable OCSP stapling** (in nginx.conf, uncomment when using real certs):
   ```nginx
   ssl_stapling on;
   ssl_stapling_verify on;
   ```

3. **Database security**:
   - Remove port mapping from docker-compose.yml
   - Use Docker secrets for passwords
   - Enable PostgreSQL SSL if required

4. **Log management**:
   - Configure log rotation
   - Don't log sensitive data
   - Monitor for suspicious activity

### Vulnerability Scanning

Regularly run security audits:

```bash
# Check npm dependencies
cd backend && npm audit
cd ../frontend && npm audit

# Docker security scan
docker scan test-env-management-backend
```

## Demo Credentials

For development/testing only:

| User | Email | Password | Role |
|------|-------|----------|------|
| Admin | admin@bme.local | Admin@123 | Admin |
| Manager | envmgr@bme.local | Admin@123 | EnvironmentManager |
| Lead | lead@bme.local | Admin@123 | ProjectLead |
| Tester | tester@bme.local | Admin@123 | Tester |
| Viewer | viewer@bme.local | Admin@123 | Viewer |

**⚠️ IMPORTANT**: Change all demo passwords in production!

## Audit Logging & Compliance ⭐ NEW

BookMyEnv v4.2.0 introduces comprehensive audit logging for security and compliance requirements.

### Audit Trail Features

| Feature | Description |
|---------|-------------|
| **Immutable Logs** | Audit events are append-only with no update/delete operations |
| **Comprehensive Coverage** | All CRUD operations on environments, bookings, applications, releases, users |
| **Actor Tracking** | Records user ID, username, and IP address for all actions |
| **Entity Tracking** | Records entity type, ID, and display name for all changes |
| **Change Details** | Stores before/after values in JSON format |
| **Timestamp Precision** | Millisecond-precision timestamps in UTC |
| **Source System** | Tracks whether action was via UI, API, or system process |

### Audit Event Categories

```javascript
// Event categories captured
const AUDIT_CATEGORIES = {
  AUTHENTICATION: 'authentication',    // Login, logout, token refresh
  ENVIRONMENT: 'environment',          // Environment CRUD
  BOOKING: 'booking',                   // Booking operations
  APPLICATION: 'application',          // Application management
  RELEASE: 'release',                   // Release scheduling
  USER: 'user',                         // User management
  CONFIGURATION: 'configuration',       // System settings
  BULK_OPERATION: 'bulk_operation'     // Bulk uploads
};
```

### Audit Data Retention

| Setting | Default | Description |
|---------|---------|-------------|
| Retention Period | 90 days | Configurable via environment variable |
| Auto-Cleanup | Enabled | Scheduled job removes old records |
| Archive Option | Available | Export before deletion |

Configure retention in environment:
```bash
AUDIT_RETENTION_DAYS=90
AUDIT_AUTO_CLEANUP=true
```

### Audit Access Controls

Access to audit logs is role-restricted:

| Role | Permissions |
|------|-------------|
| Admin | Full access: view, search, export, manage templates |
| EnvironmentManager | View and search audit events |
| ProjectLead | View audit events for their projects |
| Tester | No audit access |
| Viewer | No audit access |

### Audit API Security

```javascript
// Audit endpoints are protected with RBAC
router.get('/audit/events', rbac('audit_read'), getEvents);
router.get('/audit/reports', rbac('audit_export'), generateReport);
router.post('/audit/templates', rbac('audit_manage'), createTemplate);
```

### Audit Data Protection

1. **Encryption at Rest**: Audit data follows same PostgreSQL encryption as other data
2. **Encryption in Transit**: All API calls use TLS 1.2+
3. **Access Logging**: Audit access itself is logged
4. **No PII in Details**: Passwords and sensitive fields are never recorded in change details

### Compliance Report Templates

Pre-configured templates for common compliance needs:

| Template | Description |
|----------|-------------|
| User Activity | All actions by a specific user over time period |
| Environment Changes | All modifications to environments |
| Access Report | Login/logout activity and session information |
| Booking History | Complete booking audit trail |
| Administrative Actions | User management and configuration changes |

### Sample Audit Query

```sql
-- Find all booking changes by a specific user in last 7 days
SELECT 
  action_type,
  entity_name,
  action_description,
  created_at
FROM audit_events
WHERE category = 'booking'
  AND actor_user_id = 'user-uuid'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

## Security Vulnerabilities Fixed

| Vulnerability | Severity | Fix Applied |
|--------------|----------|-------------|
| Demo password bypass | Critical | Removed - bcrypt only |
| Hardcoded JWT secret | Critical | Environment variable required |
| Open database port | High | Removed external port mapping |
| Missing rate limiting | High | Implemented on auth endpoints |
| No password validation | High | Added strength requirements |
| Role injection on register | High | Role forced to 'Tester' |
| Missing input validation | High | Added express-validator |
| No request size limit | Medium | Limited to 10KB |
| Missing CSP header | Medium | Added comprehensive policy |
| Missing Permissions-Policy | Low | Added to nginx |
| Low bcrypt rounds | Low | Increased to 12 |
| No audit logging | Medium | ⭐ Implemented comprehensive audit trail |

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly:
1. Do not create a public issue
2. Email security concerns to the maintainers
3. Allow time for a fix before disclosure

## Additional Resources

- [OWASP Security Guidelines](https://owasp.org/www-project-web-security-testing-guide/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Docker Security](https://docs.docker.com/engine/security/)
- [AWS Security Best Practices](https://aws.amazon.com/architecture/security-identity-compliance/)

## AWS Cloud Security

When deployed to AWS, BookMyEnv benefits from additional security features:

| Feature | Description |
|---------|-------------|
| **VPC Isolation** | Private subnets for database and backend |
| **Security Groups** | Least-privilege network access |
| **RDS Encryption** | Data encrypted at rest and in transit |
| **Secrets Manager** | Secure credential storage |
| **CloudFront SSL** | TLS 1.2/1.3 with managed certificates |
| **VPC Flow Logs** | Network traffic monitoring |
| **CloudWatch** | Centralized logging and alerting |
| **IAM Roles** | Fine-grained access control |

See [terraform/README.md](../terraform/README.md) for AWS deployment details.
