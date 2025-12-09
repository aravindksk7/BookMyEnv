# BookMyEnv - Windows Server Deployment Guide

This guide provides comprehensive instructions for deploying BookMyEnv on a Windows Server (on-premises or cloud VM).

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Server Preparation](#server-preparation)
3. [Docker Installation](#docker-installation)
4. [Application Setup](#application-setup)
5. [HTTP Deployment](#http-deployment)
6. [HTTPS Deployment](#https-deployment)
7. [SSL Certificate Configuration](#ssl-certificate-configuration)
8. [Firewall Configuration](#firewall-configuration)
9. [Environment Variables](#environment-variables)
10. [Accessing from Remote Machines](#accessing-from-remote-machines)
11. [Troubleshooting](#troubleshooting)
12. [Maintenance & Operations](#maintenance--operations)
13. [Backup & Recovery](#backup--recovery)

---

## Prerequisites

### Hardware Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 4 GB | 8+ GB |
| Storage | 20 GB | 50+ GB SSD |
| Network | 100 Mbps | 1 Gbps |

### Software Requirements

- **Operating System**: Windows Server 2019 or later (Windows Server 2022 recommended)
- **Docker Desktop** or **Docker Engine** (with WSL2 backend)
- **Git** (for cloning repository)
- **PowerShell 5.1+** (included with Windows Server)
- **OpenSSL** (for generating SSL certificates - included in Git for Windows)

### Network Requirements

- Static IP address (recommended for production)
- DNS record pointing to server (optional, for hostname access)
- Ports 80 (HTTP) and 443 (HTTPS) available

---

## Server Preparation

### 1. Update Windows Server

```powershell
# Open PowerShell as Administrator
# Check for updates
Get-WindowsUpdate -Install -AcceptAll -AutoReboot
```

### 2. Install Git for Windows

Download and install from: https://git-scm.com/download/win

Or use winget:
```powershell
winget install --id Git.Git -e --source winget
```

### 3. Clone the Repository

```powershell
# Navigate to desired installation directory
cd C:\

# Create environment directory
New-Item -ItemType Directory -Path "C:\ENV" -Force
cd C:\ENV

# Clone the repository
git clone https://github.com/aravindksk7/BookMyEnv.git test-env-management
cd test-env-management
```

---

## Docker Installation

### Option 1: Docker Desktop (Recommended for Windows Server with Desktop Experience)

1. **Enable Hyper-V and Containers features**:
```powershell
# Run as Administrator
Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V -All
Enable-WindowsOptionalFeature -Online -FeatureName Containers -All

# Restart the server
Restart-Computer
```

2. **Install WSL2**:
```powershell
wsl --install
# Restart if prompted
```

3. **Download and Install Docker Desktop**:
   - Download from: https://www.docker.com/products/docker-desktop
   - Run the installer
   - Select "Use WSL 2 instead of Hyper-V" during installation
   - Restart after installation

4. **Configure Docker Desktop**:
   - Open Docker Desktop
   - Go to Settings → General → Enable "Start Docker Desktop when you log in"
   - Go to Settings → Resources → Adjust memory/CPU as needed

### Option 2: Docker Engine on Windows Server Core

For Windows Server Core (no GUI):

```powershell
# Install Docker provider
Install-Module -Name DockerMsftProvider -Repository PSGallery -Force

# Install Docker
Install-Package -Name docker -ProviderName DockerMsftProvider -Force

# Start Docker service
Start-Service Docker

# Enable auto-start
Set-Service -Name Docker -StartupType Automatic
```

### Verify Docker Installation

```powershell
# Check Docker version
docker --version

# Check Docker Compose version
docker-compose --version

# Test Docker
docker run hello-world
```

---

## Application Setup

### 1. Create Environment Configuration

```powershell
cd C:\ENV\test-env-management

# Copy example environment file
Copy-Item .env.example .env -ErrorAction SilentlyContinue

# If .env.example doesn't exist, create .env manually
```

### 2. Configure Environment Variables

Create or edit the `.env` file:

```powershell
# Create .env file with required configuration
@"
# Database Configuration
POSTGRES_USER=tem_user
POSTGRES_PASSWORD=YourSecurePassword123!
POSTGRES_DB=tem_db

# Security - IMPORTANT: Change these for production!
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long-change-this
JWT_EXPIRES_IN=24h

# Server URLs - Replace with your server's IP or hostname
CORS_ORIGIN=https://your-server-ip-or-hostname
FRONTEND_URL=https://your-server-ip-or-hostname

# For HTTP deployment, use:
# CORS_ORIGIN=http://your-server-ip-or-hostname
# FRONTEND_URL=http://your-server-ip-or-hostname

# Frontend API URLs (use relative for nginx proxy)
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_WS_URL=

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX=10

# Environment
NODE_ENV=production
"@ | Out-File -FilePath .env -Encoding UTF8
```

### 3. Generate Secure JWT Secret

```powershell
# Generate a secure random JWT secret
$bytes = New-Object byte[] 64
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$jwtSecret = [Convert]::ToBase64String($bytes)
Write-Host "Generated JWT Secret: $jwtSecret"

# Update .env file with the generated secret
(Get-Content .env) -replace 'JWT_SECRET=.*', "JWT_SECRET=$jwtSecret" | Set-Content .env
```

---

## HTTP Deployment

For internal/development use without SSL:

### 1. Start the Application

```powershell
cd C:\ENV\test-env-management

# Start all services
docker-compose up -d

# Check status
docker-compose ps
```

### 2. Verify Deployment

```powershell
# Check if containers are running
docker ps

# Test backend health
Invoke-RestMethod -Uri "http://localhost:5000/health"

# View logs if needed
docker-compose logs -f
```

### 3. Access the Application

- **Local**: http://localhost:3000
- **Remote**: http://your-server-ip:3000

---

## HTTPS Deployment

For production use with SSL encryption:

### 1. Generate SSL Certificates

#### Option A: Self-Signed Certificates (Development/Internal Use)

```powershell
cd C:\ENV\test-env-management

# Run the SSL generation script
.\generate-ssl.ps1
```

Or manually with OpenSSL:

```powershell
# Navigate to SSL directory
cd C:\ENV\test-env-management\nginx\ssl

# Generate private key
openssl genrsa -out server.key 2048

# Generate certificate signing request (CSR)
# Replace the values with your server details
openssl req -new -key server.key -out server.csr -subj "/C=AU/ST=State/L=City/O=Organization/CN=your-server-hostname"

# Generate self-signed certificate (valid for 365 days)
openssl x509 -req -days 365 -in server.csr -signkey server.key -out server.crt

# For certificates with Subject Alternative Names (recommended)
# First, create/edit openssl.cnf, then:
openssl req -new -x509 -key server.key -out server.crt -days 365 -config openssl.cnf -extensions v3_req
```

#### Option B: Let's Encrypt Certificates (Public-facing servers)

For servers with public domain names:

```powershell
# Install Certbot (requires Python)
pip install certbot

# Generate certificate (server must be accessible on port 80)
certbot certonly --standalone -d your-domain.com

# Copy certificates to nginx ssl directory
Copy-Item "C:\Certbot\live\your-domain.com\fullchain.pem" "C:\ENV\test-env-management\nginx\ssl\server.crt"
Copy-Item "C:\Certbot\live\your-domain.com\privkey.pem" "C:\ENV\test-env-management\nginx\ssl\server.key"
```

#### Option C: Corporate/Enterprise Certificates

If your organization has a Certificate Authority:

1. Generate a CSR (Certificate Signing Request):
```powershell
openssl req -new -newkey rsa:2048 -nodes -keyout server.key -out server.csr -subj "/C=AU/ST=State/L=City/O=YourCompany/CN=server-hostname.domain.com"
```

2. Submit CSR to your CA team
3. Place received certificate as `nginx/ssl/server.crt`
4. Keep the private key as `nginx/ssl/server.key`

### 2. Configure SSL for Your Server

Edit `nginx/ssl/openssl.cnf` to include your server's IP/hostname:

```ini
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = v3_req
x509_extensions = v3_req

[dn]
C = AU
ST = State
L = City
O = Organization
CN = your-server-hostname

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = your-server-hostname
DNS.3 = your-server-hostname.domain.com
IP.1 = 127.0.0.1
IP.2 = your-server-ip-address
```

### 3. Start HTTPS Deployment

```powershell
cd C:\ENV\test-env-management

# Start with HTTPS configuration
docker-compose -f docker-compose.https.yml up -d

# Check status
docker-compose -f docker-compose.https.yml ps

# View logs
docker-compose -f docker-compose.https.yml logs -f
```

### 4. Verify HTTPS Deployment

```powershell
# Test HTTPS endpoint (ignore certificate errors for self-signed)
Invoke-RestMethod -Uri "https://localhost/health" -SkipCertificateCheck

# Or use curl
curl -k https://localhost/health
```

### 5. Access the Application

- **Local**: https://localhost
- **Remote**: https://your-server-ip or https://your-server-hostname

---

## SSL Certificate Configuration

### Understanding SSL Files

| File | Description |
|------|-------------|
| `server.key` | Private key (keep secure, never share) |
| `server.crt` | SSL certificate (public) |
| `server.csr` | Certificate Signing Request (for CA) |
| `openssl.cnf` | OpenSSL configuration with SANs |

### Certificate Location

```
C:\ENV\test-env-management\nginx\ssl\
├── server.key      # Private key
├── server.crt      # SSL certificate
└── openssl.cnf     # OpenSSL config
```

### Renewing Certificates

For self-signed certificates:
```powershell
cd C:\ENV\test-env-management
.\generate-ssl.ps1

# Restart nginx to load new certificates
docker-compose -f docker-compose.https.yml restart nginx
```

For Let's Encrypt:
```powershell
certbot renew
# Copy renewed certificates and restart nginx
```

---

## Firewall Configuration

### Windows Firewall Rules

```powershell
# Run as Administrator

# Allow HTTP (port 80)
New-NetFirewallRule -DisplayName "BookMyEnv HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow

# Allow HTTPS (port 443)
New-NetFirewallRule -DisplayName "BookMyEnv HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow

# For development/HTTP-only deployment, allow port 3000 and 5000
New-NetFirewallRule -DisplayName "BookMyEnv Frontend" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
New-NetFirewallRule -DisplayName "BookMyEnv Backend" -Direction Inbound -Protocol TCP -LocalPort 5000 -Action Allow

# Verify rules
Get-NetFirewallRule -DisplayName "BookMyEnv*" | Format-Table Name, DisplayName, Enabled
```

### Corporate Firewall/Network

Ensure these ports are open:

| Port | Protocol | Direction | Purpose |
|------|----------|-----------|---------|
| 80 | TCP | Inbound | HTTP (redirects to HTTPS) |
| 443 | TCP | Inbound | HTTPS |
| 3000 | TCP | Inbound | Direct frontend (dev only) |
| 5000 | TCP | Inbound | Direct backend API (dev only) |

---

## Environment Variables

### Complete Environment Variable Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTGRES_USER` | Yes | `tem_user` | Database username |
| `POSTGRES_PASSWORD` | Yes | - | Database password (use strong password) |
| `POSTGRES_DB` | Yes | `tem_db` | Database name |
| `JWT_SECRET` | Yes | - | Secret for JWT signing (min 32 chars) |
| `JWT_EXPIRES_IN` | No | `24h` | JWT token expiration |
| `CORS_ORIGIN` | Yes | - | Allowed origin for CORS |
| `FRONTEND_URL` | Yes | - | Frontend URL for redirects |
| `NEXT_PUBLIC_API_URL` | No | `/api` | API URL (use `/api` for nginx) |
| `NEXT_PUBLIC_WS_URL` | No | - | WebSocket URL (empty for nginx) |
| `NODE_ENV` | No | `production` | Environment mode |
| `RATE_LIMIT_WINDOW_MS` | No | `900000` | Rate limit window (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | No | `100` | Max requests per window |
| `AUTH_RATE_LIMIT_MAX` | No | `10` | Max auth attempts per window |

### Production .env Template

```env
# Database
POSTGRES_USER=tem_user
POSTGRES_PASSWORD=ChangeThisToSecurePassword123!
POSTGRES_DB=tem_db

# JWT Security
JWT_SECRET=generate-a-64-character-random-string-here-use-powershell-command
JWT_EXPIRES_IN=8h

# URLs - Replace YOUR_SERVER with actual IP or hostname
CORS_ORIGIN=https://YOUR_SERVER
FRONTEND_URL=https://YOUR_SERVER
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_WS_URL=

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX=5

# Environment
NODE_ENV=production
```

---

## Accessing from Remote Machines

### Browser Access

1. **Using IP Address**:
   - HTTP: `http://192.168.1.100`
   - HTTPS: `https://192.168.1.100`

2. **Using Hostname**:
   - HTTP: `http://server-name.domain.com`
   - HTTPS: `https://server-name.domain.com`

### Accepting Self-Signed Certificates

When using self-signed certificates, browsers will show a security warning:

**Chrome/Edge**:
1. Click "Advanced"
2. Click "Proceed to [site] (unsafe)"

**Firefox**:
1. Click "Advanced"
2. Click "Accept the Risk and Continue"

**For Enterprise Deployment**:
- Import the `server.crt` into the Windows Certificate Store as a Trusted Root CA
- Distribute via Group Policy for domain-joined machines

### Adding Certificate to Trusted Store

```powershell
# Import certificate to Local Machine Trusted Root (Run as Admin)
Import-Certificate -FilePath "C:\ENV\test-env-management\nginx\ssl\server.crt" -CertStoreLocation Cert:\LocalMachine\Root

# For current user only
Import-Certificate -FilePath "C:\ENV\test-env-management\nginx\ssl\server.crt" -CertStoreLocation Cert:\CurrentUser\Root
```

---

## Troubleshooting

### Common Issues and Solutions

#### 1. Container Fails to Start

```powershell
# Check container logs
docker-compose -f docker-compose.https.yml logs backend
docker-compose -f docker-compose.https.yml logs frontend
docker-compose -f docker-compose.https.yml logs nginx

# Check container status
docker ps -a

# Restart specific container
docker-compose -f docker-compose.https.yml restart backend
```

#### 2. Database Connection Error

```powershell
# Check if postgres is running
docker-compose -f docker-compose.https.yml ps postgres

# Check postgres logs
docker-compose -f docker-compose.https.yml logs postgres

# Verify database is healthy
docker exec tem-postgres pg_isready -U tem_user -d tem_db
```

#### 3. 500 Error on Login (CORS Issue)

**Symptoms**: Login works on localhost but fails from remote machines

**Solution**: Ensure CORS is properly configured:
```powershell
# Check .env file
Get-Content .env | Select-String "CORS_ORIGIN|FRONTEND_URL"

# Ensure these are set to your server's URL
# CORS_ORIGIN=https://your-server-ip
# FRONTEND_URL=https://your-server-ip

# Rebuild and restart
docker-compose -f docker-compose.https.yml down
docker-compose -f docker-compose.https.yml up -d --build
```

#### 4. SSL Certificate Errors

```powershell
# Verify certificate files exist
Test-Path "C:\ENV\test-env-management\nginx\ssl\server.crt"
Test-Path "C:\ENV\test-env-management\nginx\ssl\server.key"

# Check certificate details
openssl x509 -in nginx/ssl/server.crt -text -noout

# Regenerate certificates
.\generate-ssl.ps1

# Restart nginx
docker-compose -f docker-compose.https.yml restart nginx
```

#### 5. Port Already in Use

```powershell
# Find process using port 80
netstat -ano | findstr :80

# Find process using port 443
netstat -ano | findstr :443

# Kill process by PID (replace 1234 with actual PID)
Stop-Process -Id 1234 -Force

# Or stop IIS if running
Stop-Service W3SVC
```

#### 6. Content Security Policy (CSP) Violation

**Symptoms**: Browser console shows CSP errors

**Solution**: The nginx configuration handles CSP. If issues persist:
```powershell
# Check nginx configuration
docker exec tem-nginx cat /etc/nginx/conf.d/default.conf | Select-String "Content-Security-Policy"

# Rebuild nginx if needed
docker-compose -f docker-compose.https.yml build nginx
docker-compose -f docker-compose.https.yml up -d nginx
```

#### 7. WebSocket Connection Failed

```powershell
# Check if nginx is proxying websockets
docker-compose -f docker-compose.https.yml logs nginx | Select-String "socket"

# Verify backend socket.io is running
docker-compose -f docker-compose.https.yml logs backend | Select-String "socket"
```

### Viewing Logs

```powershell
# All services
docker-compose -f docker-compose.https.yml logs -f

# Specific service
docker-compose -f docker-compose.https.yml logs -f backend
docker-compose -f docker-compose.https.yml logs -f frontend
docker-compose -f docker-compose.https.yml logs -f nginx
docker-compose -f docker-compose.https.yml logs -f postgres

# Last 100 lines
docker-compose -f docker-compose.https.yml logs --tail=100 backend
```

### Health Checks

```powershell
# Check all container health
docker ps --format "table {{.Names}}\t{{.Status}}"

# Test API health endpoint
Invoke-RestMethod -Uri "https://localhost/health" -SkipCertificateCheck

# Test database connectivity
docker exec tem-postgres pg_isready -U tem_user -d tem_db
```

---

## Maintenance & Operations

### Starting and Stopping

```powershell
# Start application
docker-compose -f docker-compose.https.yml up -d

# Stop application
docker-compose -f docker-compose.https.yml down

# Restart all services
docker-compose -f docker-compose.https.yml restart

# Restart specific service
docker-compose -f docker-compose.https.yml restart backend
```

### Updating the Application

```powershell
cd C:\ENV\test-env-management

# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.https.yml down
docker-compose -f docker-compose.https.yml build
docker-compose -f docker-compose.https.yml up -d
```

### Monitoring Resource Usage

```powershell
# Container resource usage
docker stats

# Specific container
docker stats tem-backend tem-frontend tem-nginx tem-postgres
```

### Cleaning Up

```powershell
# Remove unused images
docker image prune -f

# Remove unused volumes (CAUTION: may delete data)
docker volume prune -f

# Full cleanup (CAUTION: removes all stopped containers)
docker system prune -f
```

### Setting Up Auto-Start on Boot

Create a scheduled task to start Docker containers on boot:

```powershell
# Create startup script
@"
Start-Sleep -Seconds 30  # Wait for Docker to start
Set-Location C:\ENV\test-env-management
docker-compose -f docker-compose.https.yml up -d
"@ | Out-File -FilePath "C:\ENV\start-bookmyenv.ps1" -Encoding UTF8

# Create scheduled task
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-ExecutionPolicy Bypass -File C:\ENV\start-bookmyenv.ps1"
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName "Start BookMyEnv" -Action $action -Trigger $trigger -Principal $principal -Description "Start BookMyEnv containers on boot"
```

---

## Backup & Recovery

### Database Backup

```powershell
# Create backup directory
New-Item -ItemType Directory -Path "C:\ENV\backups" -Force

# Backup database
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
docker exec tem-postgres pg_dump -U tem_user -d tem_db > "C:\ENV\backups\tem_db_$timestamp.sql"

# Compressed backup
docker exec tem-postgres pg_dump -U tem_user -d tem_db | gzip > "C:\ENV\backups\tem_db_$timestamp.sql.gz"
```

### Database Restore

```powershell
# Stop application (keep database running)
docker-compose -f docker-compose.https.yml stop backend frontend nginx

# Restore from backup
Get-Content "C:\ENV\backups\tem_db_20241209_120000.sql" | docker exec -i tem-postgres psql -U tem_user -d tem_db

# Restart application
docker-compose -f docker-compose.https.yml start backend frontend nginx
```

### Automated Backup Script

```powershell
# Save as C:\ENV\backup-bookmyenv.ps1
$backupDir = "C:\ENV\backups"
$retentionDays = 7
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"

# Create backup
docker exec tem-postgres pg_dump -U tem_user -d tem_db > "$backupDir\tem_db_$timestamp.sql"

# Remove old backups
Get-ChildItem -Path $backupDir -Filter "tem_db_*.sql" | 
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$retentionDays) } | 
    Remove-Item -Force

Write-Host "Backup completed: tem_db_$timestamp.sql"
```

Schedule daily backups:
```powershell
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-ExecutionPolicy Bypass -File C:\ENV\backup-bookmyenv.ps1"
$trigger = New-ScheduledTaskTrigger -Daily -At "2:00AM"
Register-ScheduledTask -TaskName "Backup BookMyEnv" -Action $action -Trigger $trigger -Description "Daily BookMyEnv database backup"
```

---

## Quick Reference Commands

```powershell
# Navigate to application directory
cd C:\ENV\test-env-management

# Start (HTTPS)
docker-compose -f docker-compose.https.yml up -d

# Stop
docker-compose -f docker-compose.https.yml down

# Restart
docker-compose -f docker-compose.https.yml restart

# View logs
docker-compose -f docker-compose.https.yml logs -f

# Check status
docker-compose -f docker-compose.https.yml ps

# Rebuild after code changes
docker-compose -f docker-compose.https.yml up -d --build

# Health check
Invoke-RestMethod -Uri "https://localhost/health" -SkipCertificateCheck

# Database backup
docker exec tem-postgres pg_dump -U tem_user -d tem_db > backup.sql
```

---

## Support

For issues and feature requests, please visit:
- **Repository**: https://github.com/aravindksk7/BookMyEnv
- **Issues**: https://github.com/aravindksk7/BookMyEnv/issues

---

*Last Updated: December 2024*
*Version: 3.4.1*
