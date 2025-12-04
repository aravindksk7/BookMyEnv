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
