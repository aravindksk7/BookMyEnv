#!/bin/bash
# =====================================================
# BookMyEnv Upgrade Script - v5.0.0
# =====================================================
# This script upgrades BookMyEnv from v4.x to v5.0.0
# Safe to run multiple times - uses idempotent migrations
# =====================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Variables
SKIP_BACKUP=false
SKIP_BUILD=false
DRY_RUN=false
BACKUP_DIR="./backups/$(date +%Y-%m-%d_%H-%M)"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-backup)
            SKIP_BACKUP=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --backup-dir)
            BACKUP_DIR="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo -e "${CYAN}========================================"
echo " BookMyEnv Upgrade to v5.0.0"
echo -e "========================================${NC}"
echo ""

# Check if running from project root
if [ ! -f "./docker-compose.yml" ]; then
    echo -e "${RED}ERROR: Must run from project root directory${NC}"
    exit 1
fi

# =====================================================
# Step 1: Backup
# =====================================================
if [ "$SKIP_BACKUP" = false ]; then
    echo -e "${YELLOW}[1/6] Creating backup...${NC}"
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    echo "  Backup directory: $BACKUP_DIR"
    
    # Check if database is running
    if docker ps --filter "name=tem-postgres" --format "{{.Names}}" | grep -q "tem-postgres"; then
        echo "  Backing up database..."
        if [ "$DRY_RUN" = false ]; then
            docker exec tem-postgres pg_dump -U postgres -d test_env_db > "$BACKUP_DIR/database_backup.sql"
            BACKUP_SIZE=$(du -h "$BACKUP_DIR/database_backup.sql" | cut -f1)
            echo -e "  ${GREEN}Database backup: $BACKUP_SIZE${NC}"
        else
            echo "  [DRY RUN] Would backup database"
        fi
    else
        echo -e "  ${YELLOW}WARNING: Database not running, starting for backup...${NC}"
        if [ "$DRY_RUN" = false ]; then
            docker-compose up -d postgres
            sleep 10
            docker exec tem-postgres pg_dump -U postgres -d test_env_db > "$BACKUP_DIR/database_backup.sql"
        fi
    fi
    
    # Backup config files
    echo "  Backing up configuration files..."
    if [ "$DRY_RUN" = false ]; then
        cp docker-compose.yml "$BACKUP_DIR/" 2>/dev/null || true
        cp .env "$BACKUP_DIR/" 2>/dev/null || true
        if [ -d "./nginx" ]; then
            cp -r ./nginx "$BACKUP_DIR/" 2>/dev/null || true
        fi
    fi
    
    # Tag current images
    echo "  Tagging current Docker images..."
    if [ "$DRY_RUN" = false ]; then
        docker tag test-env-management-frontend:latest test-env-management-frontend:pre-v5 2>/dev/null || true
        docker tag test-env-management-backend:latest test-env-management-backend:pre-v5 2>/dev/null || true
    fi
    
    echo -e "  ${GREEN}Backup complete!${NC}"
else
    echo "[1/6] Skipping backup (--skip-backup)"
fi

echo ""

# =====================================================
# Step 2: Stop Services
# =====================================================
echo -e "${YELLOW}[2/6] Stopping services...${NC}"

if [ "$DRY_RUN" = false ]; then
    docker-compose down 2>/dev/null || true
    sleep 3
fi

echo -e "  ${GREEN}Services stopped${NC}"
echo ""

# =====================================================
# Step 3: Start Database
# =====================================================
echo -e "${YELLOW}[3/6] Starting database for migration...${NC}"

if [ "$DRY_RUN" = false ]; then
    docker-compose up -d postgres
    echo "  Waiting for database to be ready..."
    
    # Wait for database to be ready
    MAX_ATTEMPTS=30
    ATTEMPT=0
    while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
        ATTEMPT=$((ATTEMPT + 1))
        if docker exec tem-postgres pg_isready -U postgres >/dev/null 2>&1; then
            echo -e "  ${GREEN}Database ready!${NC}"
            break
        fi
        sleep 1
    done
    
    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
        echo -e "  ${RED}ERROR: Database did not become ready in time${NC}"
        exit 1
    fi
else
    echo "  [DRY RUN] Would start postgres"
fi

echo ""

# =====================================================
# Step 4: Run Migration
# =====================================================
echo -e "${YELLOW}[4/6] Running database migration...${NC}"

MIGRATION_FILE="./backend/database/migrations/V5.0.0__email_settings_and_ui_enhancements.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "  ${RED}ERROR: Migration file not found: $MIGRATION_FILE${NC}"
    exit 1
fi

if [ "$DRY_RUN" = false ]; then
    echo "  Applying V5.0.0 migration..."
    
    # Run migration
    cat "$MIGRATION_FILE" | docker exec -i tem-postgres psql -U postgres -d test_env_db
    
    if [ $? -ne 0 ]; then
        echo -e "  ${RED}ERROR: Migration failed!${NC}"
        echo -e "  ${RED}Check the error above and consider rolling back${NC}"
        exit 1
    fi
    
    # Verify migration
    echo "  Verifying migration..."
    SETTINGS_COUNT=$(docker exec tem-postgres psql -U postgres -d test_env_db -t -c "SELECT COUNT(*) FROM system_settings;" | tr -d ' ')
    
    if [ "$SETTINGS_COUNT" -ge 4 ]; then
        echo -e "  ${GREEN}Migration verified! ($SETTINGS_COUNT settings created)${NC}"
    else
        echo -e "  ${YELLOW}WARNING: Expected at least 4 settings, found $SETTINGS_COUNT${NC}"
    fi
else
    echo "  [DRY RUN] Would run migration: $MIGRATION_FILE"
fi

echo ""

# =====================================================
# Step 5: Build and Start Services
# =====================================================
if [ "$SKIP_BUILD" = false ]; then
    echo -e "${YELLOW}[5/6] Building and starting services...${NC}"
    
    if [ "$DRY_RUN" = false ]; then
        echo "  Building frontend..."
        docker-compose build frontend
        
        echo "  Building backend..."
        docker-compose build backend
        
        echo "  Starting all services..."
        docker-compose up -d
        
        # Wait for services to be healthy
        echo "  Waiting for services to be healthy..."
        sleep 15
    else
        echo "  [DRY RUN] Would build and start services"
    fi
    
    echo -e "  ${GREEN}Services started!${NC}"
else
    echo "[5/6] Skipping build (--skip-build)"
    if [ "$DRY_RUN" = false ]; then
        docker-compose up -d
    fi
fi

echo ""

# =====================================================
# Step 6: Verification
# =====================================================
echo -e "${YELLOW}[6/6] Running verification...${NC}"

if [ "$DRY_RUN" = false ]; then
    # Check container status
    echo "  Container Status:"
    docker-compose ps
    echo ""
    
    # Test API health
    echo "  Testing API..."
    if curl -s --max-time 10 "http://localhost:4000/api/config/features" >/dev/null 2>&1; then
        echo -e "  ${GREEN}API responding: OK${NC}"
    else
        echo -e "  ${YELLOW}WARNING: API not responding yet (may need more time)${NC}"
    fi
    
    # Test frontend
    echo "  Testing Frontend..."
    if curl -s --max-time 10 "http://localhost:3000" >/dev/null 2>&1; then
        echo -e "  ${GREEN}Frontend responding: OK${NC}"
    else
        echo -e "  ${YELLOW}WARNING: Frontend not responding yet (may need more time)${NC}"
    fi
    
    # Show new features status
    echo ""
    echo -e "  ${CYAN}New Features Status:${NC}"
    docker exec tem-postgres psql -U postgres -d test_env_db -t -c "SELECT flag_key || ' : ' || CASE WHEN is_enabled THEN 'Enabled' ELSE 'Disabled' END FROM feature_flags;"
fi

echo ""
echo -e "${CYAN}========================================"
echo -e "${GREEN} Upgrade Complete!"
echo -e "${CYAN}========================================${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Login to the application: http://localhost:3000"
echo "  2. Configure email settings in Settings > Email Configuration"
echo "  3. Try the new dark mode toggle in the header"
echo "  4. Check the /refresh page for the new Schedule-X calendar"
echo ""
echo "Backup Location: $BACKUP_DIR"
echo ""
echo "If issues occur, see: docs/UPGRADE_GUIDE_v5.0.0.md"
echo ""
