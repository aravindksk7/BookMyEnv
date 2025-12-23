# =====================================================
# BookMyEnv Rollback Script - v5.0.0 → v4.x
# =====================================================
# This script rolls back from v5.0.0 to the previous version
# Use this if the upgrade fails or causes issues
# =====================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupDir,
    [switch]$RemoveNewTablesOnly,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Red
Write-Host " BookMyEnv Rollback from v5.0.0" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host ""

# Check backup directory exists
if (-not (Test-Path $BackupDir)) {
    Write-Host "ERROR: Backup directory not found: $BackupDir" -ForegroundColor Red
    exit 1
}

# Confirm rollback
if (-not $Force) {
    Write-Host "WARNING: This will rollback to a previous version!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Backup directory: $BackupDir"
    Write-Host ""
    $confirm = Read-Host "Type 'ROLLBACK' to confirm"
    if ($confirm -ne "ROLLBACK") {
        Write-Host "Rollback cancelled." -ForegroundColor Yellow
        exit 0
    }
}

Write-Host ""

# =====================================================
# Stop Services
# =====================================================
Write-Host "[1/4] Stopping services..." -ForegroundColor Yellow
docker-compose down 2>$null
Start-Sleep -Seconds 3
Write-Host "  Services stopped" -ForegroundColor Green
Write-Host ""

# =====================================================
# Option A: Remove new tables only (partial rollback)
# =====================================================
if ($RemoveNewTablesOnly) {
    Write-Host "[2/4] Removing v5.0.0 schema changes only..." -ForegroundColor Yellow
    
    docker-compose up -d postgres
    Start-Sleep -Seconds 10
    
    $rollbackSql = @"
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

SELECT 'Schema rollback complete' as status;
"@

    $rollbackSql | docker exec -i tem-postgres psql -U postgres -d test_env_db
    
    Write-Host "  Schema changes removed" -ForegroundColor Green
    Write-Host ""
    Write-Host "[3/4] Restoring previous Docker images..." -ForegroundColor Yellow
    
} else {
    # =====================================================
    # Option B: Full database restore
    # =====================================================
    Write-Host "[2/4] Starting database for restore..." -ForegroundColor Yellow
    docker-compose up -d postgres
    Start-Sleep -Seconds 10
    
    Write-Host "  Dropping and recreating database..."
    docker exec tem-postgres psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'test_env_db' AND pid <> pg_backend_pid();" 2>$null
    docker exec tem-postgres psql -U postgres -c "DROP DATABASE IF EXISTS test_env_db;"
    docker exec tem-postgres psql -U postgres -c "CREATE DATABASE test_env_db;"
    
    Write-Host "  Restoring database from backup..."
    $backupFile = Join-Path $BackupDir "database_backup.sql"
    if (-not (Test-Path $backupFile)) {
        Write-Host "ERROR: Database backup not found: $backupFile" -ForegroundColor Red
        exit 1
    }
    
    Get-Content $backupFile | docker exec -i tem-postgres psql -U postgres -d test_env_db
    
    Write-Host "  Database restored" -ForegroundColor Green
    Write-Host ""
    Write-Host "[3/4] Restoring previous Docker images..." -ForegroundColor Yellow
}

# =====================================================
# Restore Docker Images
# =====================================================
$frontendPreV5 = docker images -q test-env-management-frontend:pre-v5 2>$null
$backendPreV5 = docker images -q test-env-management-backend:pre-v5 2>$null

if ($frontendPreV5) {
    Write-Host "  Restoring frontend image..."
    docker tag test-env-management-frontend:pre-v5 test-env-management-frontend:latest
    Write-Host "  Frontend restored" -ForegroundColor Green
} else {
    Write-Host "  WARNING: Pre-v5 frontend image not found, will use current" -ForegroundColor Yellow
}

if ($backendPreV5) {
    Write-Host "  Restoring backend image..."
    docker tag test-env-management-backend:pre-v5 test-env-management-backend:latest
    Write-Host "  Backend restored" -ForegroundColor Green
} else {
    Write-Host "  WARNING: Pre-v5 backend image not found, will use current" -ForegroundColor Yellow
}

Write-Host ""

# =====================================================
# Restore Config Files
# =====================================================
Write-Host "[4/4] Restoring configuration files..." -ForegroundColor Yellow

$dockerComposeBackup = Join-Path $BackupDir "docker-compose.yml"
if (Test-Path $dockerComposeBackup) {
    Copy-Item $dockerComposeBackup ".\docker-compose.yml" -Force
    Write-Host "  docker-compose.yml restored" -ForegroundColor Green
}

$envBackup = Join-Path $BackupDir ".env"
if (Test-Path $envBackup) {
    Copy-Item $envBackup ".\.env" -Force
    Write-Host "  .env restored" -ForegroundColor Green
}

Write-Host ""

# =====================================================
# Start Services
# =====================================================
Write-Host "Starting services..." -ForegroundColor Yellow
docker-compose up -d
Start-Sleep -Seconds 10

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " Rollback Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Please verify:" -ForegroundColor Yellow
Write-Host "  1. Application loads: http://localhost:3000"
Write-Host "  2. Login works correctly"
Write-Host "  3. Data is intact"
Write-Host ""
docker-compose ps
Write-Host ""
