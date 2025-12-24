# BookMyEnv Production Schema Reference

> **Purpose**: Quick reference for database schema, common issues, and deployment patterns.  
> **Last Updated**: December 24, 2025

---

## Database Connection

```bash
# Connect to database
docker exec tem-postgres psql -U tem_user -d tem_db

# Check table schema
docker exec tem-postgres psql -U tem_user -d tem_db -c "\d table_name"
```

---

## Critical Schema Mappings

### audit_events Table (Actual Deployed Schema)

| Column Name | Type | Notes |
|-------------|------|-------|
| `audit_id` | UUID | Primary key |
| `timestamp_utc` | TIMESTAMP WITH TIME ZONE | NOT NULL, default NOW() |
| `actor_user_id` | UUID | FK to users |
| `actor_username` | VARCHAR(100) | ⚠️ NOT `actor_user_name` |
| `actor_display_name` | VARCHAR(255) | |
| `actor_role` | VARCHAR(30) | |
| `actor_ip_address` | VARCHAR(45) | ⚠️ NOT `ip_address` |
| `actor_user_agent` | TEXT | ⚠️ NOT `user_agent` |
| `entity_type` | VARCHAR(50) | NOT NULL |
| `entity_id` | VARCHAR(255) | |
| `entity_name` | VARCHAR(255) | ⚠️ NOT `entity_display_name` |
| `action_type` | VARCHAR(20) | NOT NULL |
| `action_description` | TEXT | ⚠️ NOT `comment` |
| `before_snapshot` | JSONB | |
| `after_snapshot` | JSONB | |
| `changed_fields` | JSONB | |
| `regulatory_tag` | VARCHAR(50) | |
| `session_id` | VARCHAR(255) | |
| `additional_context` | JSONB | ⚠️ NOT `metadata` |
| `source_system` | VARCHAR(50) | Default 'BookMyEnv' |

**Valid action_type values**: `CREATE`, `UPDATE`, `DELETE`, `LOGIN`, `LOGOUT`, `EXPORT`, `IMPORT`, `APPROVE`, `REJECT`, `EXECUTE`

### user_group_memberships Table

| Column Name | Type | Constraint |
|-------------|------|------------|
| `membership_id` | UUID | Primary key |
| `user_id` | UUID | FK to users |
| `group_id` | UUID | FK to user_groups |
| `membership_role` | VARCHAR(20) | CHECK: `Member`, `Lead`, `Owner`, `GroupAdmin` |
| `joined_at` | TIMESTAMP | |

---

## Common Schema Mismatches (init.sql vs Deployed)

| init.sql Column | Deployed Column | Table |
|-----------------|-----------------|-------|
| `actor_user_name` | `actor_username` | audit_events |
| `entity_display_name` | `entity_name` | audit_events |
| `ip_address` | `actor_ip_address` | audit_events |
| `user_agent` | `actor_user_agent` | audit_events |
| `comment` | `action_description` | audit_events |
| `metadata` | `additional_context` | audit_events |

---

## Default Credentials

| User | Email | Password | Role |
|------|-------|----------|------|
| admin | admin@bme.local | Admin@123 | Admin |
| envmgr | envmgr@bme.local | Admin@123 | EnvironmentManager |
| lead | lead@bme.local | Admin@123 | ProjectLead |
| tester | tester@bme.local | Admin@123 | Tester |
| viewer | viewer@bme.local | Admin@123 | Viewer |

---

## Test User IDs (Seeded)

```
Admin:              aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
EnvironmentManager: bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
ProjectLead:        cccccccc-cccc-cccc-cccc-cccccccccccc
Tester:             dddddddd-dddd-dddd-dddd-dddddddddddd
Viewer:             eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee
```

---

## Docker Commands

```powershell
# View running containers
docker ps --format "table {{.Names}}\t{{.Status}}"

# Rebuild and restart backend
docker-compose build backend --no-cache
docker-compose up -d backend

# Rebuild and restart frontend
docker-compose build frontend --no-cache
docker-compose up -d frontend

# View backend logs
docker logs tem-backend --tail 50

# Execute SQL migration
docker exec tem-postgres psql -U tem_user -d tem_db -f /path/to/migration.sql

# Run inline SQL
docker exec tem-postgres psql -U tem_user -d tem_db -c "SQL_STATEMENT"
```

---

## API Testing (PowerShell)

```powershell
# Login and get token
$loginResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" `
  -Method POST -ContentType "application/json" `
  -Body '{"email":"admin@bme.local","password":"Admin@123"}'
$token = $loginResponse.token

# Set headers for authenticated requests
$headers = @{ 
  "Authorization" = "Bearer $token"
  "Content-Type" = "application/json" 
}

# Test audit events
Invoke-RestMethod -Uri "http://localhost:5000/api/audit/events?page=1&limit=5" -Headers $headers

# Test groups
Invoke-RestMethod -Uri "http://localhost:5000/api/groups" -Headers $headers

# Add group member
$body = @{ user_id = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"; membership_role = "Lead" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:5000/api/groups/$groupId/members" -Method POST -Headers $headers -Body $body
```

---

## Known Issues & Fixes

### Issue 1: Membership Role Constraint
**Symptom**: Cannot add members with 'Lead' or 'Owner' roles  
**Cause**: Database constraint only allowed 'Member' and 'GroupAdmin'  
**Fix**:
```sql
ALTER TABLE user_group_memberships 
DROP CONSTRAINT IF EXISTS user_group_memberships_membership_role_check;

ALTER TABLE user_group_memberships 
ADD CONSTRAINT user_group_memberships_membership_role_check 
CHECK (membership_role IN ('Member', 'Lead', 'Owner', 'GroupAdmin'));
```

### Issue 2: Audit Events Query Failure
**Symptom**: "column X does not exist" errors on /audit page  
**Cause**: auditService.js column names don't match deployed schema  
**Fix**: Update queries in `backend/src/services/auditService.js` to use actual column names

---

## File Locations

| Purpose | Path |
|---------|------|
| Backend Controllers | `backend/src/controllers/` |
| Backend Services | `backend/src/services/` |
| Backend Routes | `backend/src/routes/` |
| Database Schema | `backend/database/init.sql` |
| Migrations | `backend/database/migrations/` |
| Frontend Pages | `frontend/src/app/(dashboard)/` |
| Frontend API Client | `frontend/src/lib/api.ts` |

---

## Debugging Checklist

1. **Check actual deployed schema** before modifying queries:
   ```bash
   docker exec tem-postgres psql -U tem_user -d tem_db -c "\d table_name"
   ```

2. **Verify constraint values** before adding data:
   ```bash
   docker exec tem-postgres psql -U tem_user -d tem_db -c "\d+ table_name"
   ```

3. **Always rebuild container** after code changes:
   ```bash
   docker-compose build service_name --no-cache
   docker-compose up -d service_name
   ```

4. **Check backend logs** for SQL errors:
   ```bash
   docker logs tem-backend --tail 100
   ```

5. **Test API directly** before checking frontend:
   ```powershell
   Invoke-RestMethod -Uri "http://localhost:5000/api/endpoint" -Headers $headers
   ```
