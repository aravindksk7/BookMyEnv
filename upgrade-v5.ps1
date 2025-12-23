# =====================================================
# BookMyEnv Upgrade Script - v5.0.0
# =====================================================
# This script upgrades BookMyEnv from v4.x to v5.0.0
# Safe to run multiple times - uses idempotent migrations
# =====================================================

param(
    [switch]$SkipBackup,
    [switch]$SkipBuild,
    [switch]$DryRun,
    [string]$BackupDir = ".\backups\$(Get-Date -Format 'yyyy-MM-dd_HH-mm')"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " BookMyEnv Upgrade to v5.0.0" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running from project root
if (-not (Test-Path ".\docker-compose.yml")) {
    Write-Host "ERROR: Must run from project root directory" -ForegroundColor Red
    exit 1
}

# =====================================================
# Step 1: Backup
# =====================================================
if (-not $SkipBackup) {
    Write-Host "[1/6] Creating backup..." -ForegroundColor Yellow
    
    # Create backup directory
    New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
    Write-Host "  Backup directory: $BackupDir"
    
    # Check if database is running
    $dbRunning = docker ps --filter "name=tem-postgres" --format "{{.Names}}"
    
    if ($dbRunning) {
        Write-Host "  Backing up database..."
        if (-not $DryRun) {
            docker exec tem-postgres pg_dump -U postgres -d test_env_db > "$BackupDir\database_backup.sql"
            $backupSize = (Get-Item "$BackupDir\database_backup.sql").Length / 1MB
            Write-Host "  Database backup: $([math]::Round($backupSize, 2)) MB" -ForegroundColor Green
        } else {
            Write-Host "  [DRY RUN] Would backup database" -ForegroundColor DarkGray
        }
    } else {
        Write-Host "  WARNING: Database not running, starting for backup..." -ForegroundColor Yellow
        if (-not $DryRun) {
            docker-compose up -d postgres
            Start-Sleep -Seconds 10
            docker exec tem-postgres pg_dump -U postgres -d test_env_db > "$BackupDir\database_backup.sql"
        }
    }
    
    # Backup config files
    Write-Host "  Backing up configuration files..."
    if (-not $DryRun) {
        Copy-Item docker-compose.yml "$BackupDir\" -ErrorAction SilentlyContinue
        Copy-Item .env "$BackupDir\" -ErrorAction SilentlyContinue
        if (Test-Path ".\nginx") {
            Copy-Item -Path ".\nginx\*" -Destination "$BackupDir\nginx\" -Recurse -ErrorAction SilentlyContinue
        }
    }
    
    # Tag current images
    Write-Host "  Tagging current Docker images..."
    if (-not $DryRun) {
        docker tag test-env-management-frontend:latest test-env-management-frontend:pre-v5 2>$null
        docker tag test-env-management-backend:latest test-env-management-backend:pre-v5 2>$null
    }
    
    Write-Host "  Backup complete!" -ForegroundColor Green
} else {
    Write-Host "[1/6] Skipping backup (--SkipBackup)" -ForegroundColor DarkGray
}

Write-Host ""

# =====================================================
# Step 2: Stop Services
# =====================================================
Write-Host "[2/6] Stopping services..." -ForegroundColor Yellow

if (-not $DryRun) {
    docker-compose down 2>$null
    Start-Sleep -Seconds 3
}

Write-Host "  Services stopped" -ForegroundColor Green
Write-Host ""

# =====================================================
# Step 3: Start Database
# =====================================================
Write-Host "[3/6] Starting database for migration..." -ForegroundColor Yellow

if (-not $DryRun) {
    docker-compose up -d postgres
    Write-Host "  Waiting for database to be ready..."
    
    # Wait for database to be ready
    $maxAttempts = 30
    $attempt = 0
    while ($attempt -lt $maxAttempts) {
        $attempt++
        try {
            $result = docker exec tem-postgres pg_isready -U postgres 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  Database ready!" -ForegroundColor Green
                break
            }
        } catch {}
        Start-Sleep -Seconds 1
    }
    
    if ($attempt -eq $maxAttempts) {
        Write-Host "  ERROR: Database did not become ready in time" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  [DRY RUN] Would start postgres" -ForegroundColor DarkGray
}

Write-Host ""

# =====================================================
# Step 4: Run Migration
# =====================================================
Write-Host "[4/6] Running database migration..." -ForegroundColor Yellow

$migrationFile = ".\backend\database\migrations\V5.0.0__email_settings_and_ui_enhancements.sql"

if (-not (Test-Path $migrationFile)) {
    Write-Host "  ERROR: Migration file not found: $migrationFile" -ForegroundColor Red
    exit 1
}

if (-not $DryRun) {
    Write-Host "  Applying V5.0.0 migration..."
    
    # Run migration
    Get-Content $migrationFile | docker exec -i tem-postgres psql -U postgres -d test_env_db
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR: Migration failed!" -ForegroundColor Red
        Write-Host "  Check the error above and consider rolling back" -ForegroundColor Red
        exit 1
    }
    
    # Verify migration
    Write-Host "  Verifying migration..."
    $verification = docker exec tem-postgres psql -U postgres -d test_env_db -t -c "SELECT COUNT(*) FROM system_settings;"
    $settingsCount = [int]$verification.Trim()
    
    if ($settingsCount -ge 4) {
        Write-Host "  Migration verified! ($settingsCount settings created)" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: Expected at least 4 settings, found $settingsCount" -ForegroundColor Yellow
    }
} else {
    Write-Host "  [DRY RUN] Would run migration: $migrationFile" -ForegroundColor DarkGray
}

Write-Host ""

# =====================================================
# Step 5: Build and Start Services
# =====================================================
if (-not $SkipBuild) {
    Write-Host "[5/6] Building and starting services..." -ForegroundColor Yellow
    
    if (-not $DryRun) {
        Write-Host "  Building frontend..."
        docker-compose build frontend
        
        Write-Host "  Building backend..."
        docker-compose build backend
        
        Write-Host "  Starting all services..."
        docker-compose up -d
        
        # Wait for services to be healthy
        Write-Host "  Waiting for services to be healthy..."
        Start-Sleep -Seconds 15
    } else {
        Write-Host "  [DRY RUN] Would build and start services" -ForegroundColor DarkGray
    }
    
    Write-Host "  Services started!" -ForegroundColor Green
} else {
    Write-Host "[5/6] Skipping build (--SkipBuild)" -ForegroundColor DarkGray
    if (-not $DryRun) {
        docker-compose up -d
    }
}

Write-Host ""

# =====================================================
# Step 6: Verification
# =====================================================
Write-Host "[6/6] Running verification..." -ForegroundColor Yellow

if (-not $DryRun) {
    # Check container status
    Write-Host "  Container Status:"
    docker-compose ps --format "table {{.Name}}\t{{.Status}}"
    Write-Host ""
    
    # Test API health
    Write-Host "  Testing API..."
    try {
        $health = Invoke-RestMethod -Uri "http://localhost:4000/api/config/features" -Method GET -TimeoutSec 10
        Write-Host "  API responding: OK" -ForegroundColor Green
    } catch {
        Write-Host "  WARNING: API not responding yet (may need more time)" -ForegroundColor Yellow
    }
    
    # Test frontend
    Write-Host "  Testing Frontend..."
    try {
        $frontend = Invoke-WebRequest -Uri "http://localhost:3000" -Method GET -TimeoutSec 10
        if ($frontend.StatusCode -eq 200) {
            Write-Host "  Frontend responding: OK" -ForegroundColor Green
        }
    } catch {
        Write-Host "  WARNING: Frontend not responding yet (may need more time)" -ForegroundColor Yellow
    }
    
    # Show new features status
    Write-Host ""
    Write-Host "  New Features Status:" -ForegroundColor Cyan
    $features = docker exec tem-postgres psql -U postgres -d test_env_db -t -c "SELECT flag_key, is_enabled FROM feature_flags;"
    $features -split "`n" | Where-Object { $_.Trim() } | ForEach-Object {
        $parts = $_ -split '\|'
        $key = $parts[0].Trim()
        $enabled = $parts[1].Trim()
        $status = if ($enabled -eq 't') { "✓ Enabled" } else { "✗ Disabled" }
        $color = if ($enabled -eq 't') { "Green" } else { "DarkGray" }
        Write-Host "    $key : $status" -ForegroundColor $color
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Upgrade Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Login to the application: http://localhost:3000"
Write-Host "  2. Configure email settings in Settings > Email Configuration"
Write-Host "  3. Try the new dark mode toggle in the header"
Write-Host "  4. Check the /refresh page for the new Schedule-X calendar"
Write-Host ""
Write-Host "Backup Location: $BackupDir" -ForegroundColor DarkGray
Write-Host ""
Write-Host "If issues occur, see: docs/UPGRADE_GUIDE_v5.0.0.md" -ForegroundColor DarkGray
Write-Host ""
