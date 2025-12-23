# BookMyEnv v5.0.0 Upgrade Guide

## Overview

This guide provides detailed instructions for upgrading BookMyEnv from version 4.x to version 5.0.0. This version introduces:

- **Email Configuration System** - Configurable email notifications via SMTP, SendGrid, or AWS SES
- **Dark Mode Theme** - System-wide dark theme support with user preferences
- **Schedule-X Calendar** - Improved calendar component with better performance and dark mode
- **User Preferences** - Per-user UI and notification settings
- **Email Templates** - Customizable email templates for notifications
- **Feature Flags** - Dynamic feature toggle system

## Pre-Upgrade Checklist

Before starting the upgrade, ensure:

- [ ] Database backup completed
- [ ] Application backup completed
- [ ] Docker images tagged (current version)
- [ ] At least 30 minutes maintenance window
- [ ] Access to database (direct or via container)

## Backup Procedures

### 1. Database Backup

```powershell
# Create backup directory
$backupDir = ".\backups\$(Get-Date -Format 'yyyy-MM-dd_HH-mm')"
New-Item -ItemType Directory -Force -Path $backupDir

# Backup PostgreSQL database
docker exec tem-postgres pg_dump -U postgres -d test_env_db > "$backupDir\database_backup.sql"

# Verify backup
Get-Content "$backupDir\database_backup.sql" | Select-Object -First 20
Write-Host "Backup size: $((Get-Item "$backupDir\database_backup.sql").Length / 1MB) MB"
```

### 2. Application Backup

```powershell
# Backup configuration files
Copy-Item docker-compose.yml "$backupDir\"
Copy-Item .env "$backupDir\" -ErrorAction SilentlyContinue

# Backup any custom configurations
Copy-Item -Path ".\nginx\*" -Destination "$backupDir\nginx\" -Recurse -ErrorAction SilentlyContinue

# Tag current Docker images
docker tag test-env-management-frontend:latest test-env-management-frontend:pre-v5
docker tag test-env-management-backend:latest test-env-management-backend:pre-v5
```

## Upgrade Steps

### Step 1: Stop Running Services

```powershell
# Stop all services gracefully
docker-compose down

# Verify all containers stopped
docker ps --filter "name=tem-"
```

### Step 2: Pull Latest Code

```powershell
# Pull latest changes
git fetch origin
git checkout feature/refresh-lifecycle
git pull origin feature/refresh-lifecycle

# Alternatively, if using releases
git checkout v5.0.0
```

### Step 3: Run Database Migration

The migration script is designed to be safe and idempotent:
- All tables use `IF NOT EXISTS`
- All inserts use `ON CONFLICT DO NOTHING`
- Wrapped in a transaction for atomicity

#### Option A: Via Docker (Recommended)

```powershell
# Start only the database
docker-compose up -d postgres

# Wait for database to be ready
Start-Sleep -Seconds 10

# Run migration
docker exec -i tem-postgres psql -U postgres -d test_env_db < .\backend\database\migrations\V5.0.0__email_settings_and_ui_enhancements.sql
```

#### Option B: Direct PostgreSQL Connection

```powershell
# If you have psql installed locally
$env:PGPASSWORD = "postgres"
psql -h localhost -p 5432 -U postgres -d test_env_db -f .\backend\database\migrations\V5.0.0__email_settings_and_ui_enhancements.sql
```

### Step 4: Verify Migration

```powershell
# Connect to database and verify
docker exec -it tem-postgres psql -U postgres -d test_env_db -c "
SELECT version, description, executed_at 
FROM schema_migrations 
ORDER BY executed_at DESC 
LIMIT 5;
"

# Check new tables exist
docker exec -it tem-postgres psql -U postgres -d test_env_db -c "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('system_settings', 'user_preferences', 'email_templates', 'feature_flags', 'email_notification_log')
ORDER BY table_name;
"

# Verify default settings
docker exec -it tem-postgres psql -U postgres -d test_env_db -c "
SELECT setting_key, description FROM system_settings;
"
```

Expected output:
```
 setting_key          | description
----------------------+--------------------------------------------------
 app_metadata         | Application metadata and feature flags
 email_config         | Email notification configuration...
 notification_defaults| Default notification preferences
 ui_defaults          | Default UI preferences for new users
```

### Step 5: Rebuild and Start Services

```powershell
# Rebuild all images with new code
docker-compose build

# Start all services
docker-compose up -d

# Check service health
docker-compose ps
docker-compose logs --tail=50 frontend
docker-compose logs --tail=50 backend
```

### Step 6: Post-Upgrade Verification

```powershell
# Test frontend loads
Start-Process "http://localhost:3000"

# Test API health
Invoke-RestMethod -Uri "http://localhost:4000/api/config/features" -Method GET

# Test login still works
$loginBody = @{
    username = "admin"
    password = "admin"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:4000/api/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
Write-Host "Login successful: $($response.user.username)"
```

## New Features Configuration

### Configure Email Settings

After upgrade, configure email notifications via the Settings page or API:

#### Via UI:
1. Login as Admin
2. Navigate to Settings → Email Configuration
3. Enable email and select provider (SMTP/SendGrid/AWS SES)
4. Enter credentials
5. Send test email to verify

#### Via API:
```powershell
$token = "your-jwt-token"
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

$emailConfig = @{
    enabled = $true
    provider = "smtp"
    smtp = @{
        host = "smtp.example.com"
        port = 587
        secure = $false
        user = "notifications@example.com"
        pass = "your-password"
    }
    from = @{
        name = "BookMyEnv"
        email = "notifications@example.com"
    }
    appUrl = "https://bookmyenv.example.com"
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri "http://localhost:4000/api/email/config" -Method PUT -Headers $headers -Body $emailConfig
```

### Feature Flags

Feature flags can be toggled via database:

```sql
-- Enable/disable features
UPDATE feature_flags SET is_enabled = true WHERE flag_key = 'dark_mode';
UPDATE feature_flags SET is_enabled = false WHERE flag_key = 'email_notifications';

-- Enable feature for specific groups only
UPDATE feature_flags 
SET enabled_for_groups = ARRAY['group-uuid-1', 'group-uuid-2']::uuid[]
WHERE flag_key = 'bulk_operations';
```

## Migration Details

### New Tables Created

| Table | Purpose |
|-------|---------|
| `schema_migrations` | Tracks database migration history |
| `system_settings` | Application-wide configuration |
| `user_preferences` | Per-user UI and notification settings |
| `email_templates` | Customizable email templates |
| `email_notification_log` | Email delivery tracking |
| `feature_flags` | Dynamic feature toggles |

### Schema Changes to Existing Tables

| Table | Change | Impact |
|-------|--------|--------|
| `audit_log` | Added `notification_sent`, `notification_sent_at`, `notification_error` columns | None - columns are nullable |

### Default Email Templates

The following email templates are created:

1. **booking_confirmed** - Sent when booking is confirmed
2. **booking_reminder** - Sent before booking starts
3. **refresh_scheduled** - Sent when refresh is scheduled
4. **refresh_completed** - Sent when refresh completes
5. **conflict_detected** - Sent when booking conflicts with refresh

Templates can be customized via database or future admin UI.

## Rollback Procedure

If issues occur, rollback using:

### Step 1: Stop Services

```powershell
docker-compose down
```

### Step 2: Restore Database

```powershell
# Drop and recreate database
docker exec -it tem-postgres psql -U postgres -c "DROP DATABASE test_env_db;"
docker exec -it tem-postgres psql -U postgres -c "CREATE DATABASE test_env_db;"

# Restore from backup
docker exec -i tem-postgres psql -U postgres -d test_env_db < .\backups\<timestamp>\database_backup.sql
```

### Step 3: Restore Previous Images

```powershell
# Restore tagged images
docker tag test-env-management-frontend:pre-v5 test-env-management-frontend:latest
docker tag test-env-management-backend:pre-v5 test-env-management-backend:latest

# Start services
docker-compose up -d
```

### Step 4: Remove New Tables Only (Partial Rollback)

If you need to keep existing data but remove v5.0.0 schema changes:

```sql
BEGIN;

-- Remove new tables (safe - doesn't affect existing data)
DROP TABLE IF EXISTS email_notification_log CASCADE;
DROP TABLE IF EXISTS email_templates CASCADE;
DROP TABLE IF EXISTS user_preferences CASCADE;
DROP TABLE IF EXISTS feature_flags CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS schema_migrations CASCADE;

-- Remove added columns from audit_log
ALTER TABLE audit_log DROP COLUMN IF EXISTS notification_sent;
ALTER TABLE audit_log DROP COLUMN IF EXISTS notification_sent_at;
ALTER TABLE audit_log DROP COLUMN IF EXISTS notification_error;

COMMIT;
```

## Troubleshooting

### Migration Fails: "relation already exists"

This shouldn't happen with `IF NOT EXISTS`, but if it does:

```sql
-- Check if table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'system_settings'
);

-- If true, table exists - migration may have partially run
-- Check migration status
SELECT * FROM schema_migrations WHERE version = '5.0.0';
```

### Email Not Sending

1. Check email configuration in Settings
2. Verify credentials are correct
3. Check email log:
```sql
SELECT * FROM email_notification_log 
WHERE status = 'failed' 
ORDER BY sent_at DESC LIMIT 10;
```

### Dark Mode Not Working

1. Clear browser cache and localStorage
2. Check if feature flag is enabled:
```sql
SELECT is_enabled FROM feature_flags WHERE flag_key = 'dark_mode';
```

### Calendar Not Loading

1. Check browser console for errors
2. Verify Schedule-X feature flag:
```sql
SELECT is_enabled FROM feature_flags WHERE flag_key = 'schedule_x_calendar';
```

## Support

For issues during upgrade:

1. Check logs: `docker-compose logs --tail=100`
2. Review migration output for errors
3. Contact support with:
   - Migration log output
   - Docker logs
   - Screenshot of any errors

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 5.0.0 | 2025-12-23 | Email config, dark mode, Schedule-X calendar |
| 4.0.0 | 2025-12-15 | Refresh lifecycle management |
| 3.0.0 | 2025-11-01 | Booking system enhancements |
