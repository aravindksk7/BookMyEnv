# Upgrade Guide: v5.x → v6.0.0

This guide covers upgrading BookMyEnv from version 5.x to 6.0.0.

## Overview of Changes

Version 6.0.0 introduces significant **performance and scalability improvements**:

1. **Database Search Indexes** - GIN trigram indexes for efficient text searches
2. **API Pagination** - All list endpoints now support pagination
3. **N+1 Query Fixes** - Optimized database queries for detail views

---

## Pre-Upgrade Checklist

- [ ] Backup your PostgreSQL database
- [ ] Review current API integrations for pagination changes
- [ ] Test in a staging environment first
- [ ] Schedule maintenance window (migration takes ~1-2 minutes)

---

## Database Migration

### Option 1: Fresh Installation (Recommended for Dev/Test)

If starting fresh, the new `init.sql` includes all indexes automatically.

```bash
docker-compose down -v
docker-compose up -d
```

### Option 2: Apply Migration to Existing Database

For existing databases, run the migration:

```bash
# Using Docker
docker exec -i tem-postgres psql -U tem_user -d tem_db < backend/database/migrations/V5.1.0__search_indexes_and_performance.sql

# Or using PowerShell
Get-Content backend/database/migrations/V5.1.0__search_indexes_and_performance.sql | docker exec -i tem-postgres psql -U tem_user -d tem_db
```

### Migration Contents

The migration creates:

1. **pg_trgm Extension** - Required for trigram text search indexes
2. **11 GIN Indexes** for ILIKE search optimization:

| Table | Indexed Columns |
|-------|-----------------|
| environments | name, description |
| applications | name, description |
| environment_bookings | title, description |
| interfaces | name |
| releases | name, description |
| users | display_name, username |

3. **Additional B-tree indexes** for filtering:
   - `idx_environments_category` - environment_category column
   - `idx_environments_lifecycle` - lifecycle_stage column
   - `idx_applications_criticality` - criticality column
   - `idx_applications_domain` - business_domain column

---

## API Changes

### New Pagination Parameters

All list endpoints now support pagination query parameters:

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `page` | integer | 1 | - | Page number (1-indexed) |
| `limit` | integer | 20 | 100 | Items per page |

### Response Format Changes

**Before (v5.x):**
```json
{
  "environments": [...]
}
```

**After (v6.0.0):**
```json
{
  "environments": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalItems": 150,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### Affected Endpoints

| Endpoint | Pagination Support |
|----------|-------------------|
| `GET /api/environments` | ✅ Yes |
| `GET /api/applications` | ✅ Yes |
| `GET /api/bookings` | ✅ Yes |
| `GET /api/instances` | ✅ Yes |
| `GET /api/environments/:id` | No (single item) |
| `GET /api/applications/:id` | No (single item) |

### Backward Compatibility

- **Without pagination params**: Returns first 20 items with pagination metadata
- **Legacy integrations**: Will still work but only receive first page of results
- **Recommendation**: Update integrations to handle pagination for complete data

---

## Frontend Integration

If you have custom frontend code consuming the API:

### JavaScript Example

```javascript
// Fetch all environments with pagination
async function fetchAllEnvironments() {
  const allEnvironments = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(`/api/environments?page=${page}&limit=100`);
    const data = await response.json();
    
    allEnvironments.push(...data.environments);
    hasMore = data.pagination.hasNextPage;
    page++;
  }

  return allEnvironments;
}

// Or fetch a single page
async function fetchEnvironmentsPage(page = 1, limit = 20) {
  const response = await fetch(`/api/environments?page=${page}&limit=${limit}`);
  return response.json();
}
```

### React Hook Example

```jsx
function useEnvironments(page = 1, limit = 20) {
  const [data, setData] = useState({ environments: [], pagination: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/environments?page=${page}&limit=${limit}`)
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [page, limit]);

  return { ...data, loading };
}
```

---

## Performance Verification

After upgrading, verify the improvements:

### Test Search Performance

```sql
-- Connect to database
docker exec -it tem-postgres psql -U tem_user -d tem_db

-- Verify indexes exist
\di idx_*_trgm

-- Test query plan (should show Index Scan with large datasets)
EXPLAIN ANALYZE SELECT * FROM environments WHERE name ILIKE '%test%';
```

### Test API Pagination

```powershell
# Run the pagination test script
.\test-pagination.ps1
```

Expected output: `Results: 25 passed, 0 failed`

---

## Rollback Procedure

If issues arise, rollback to v5.x:

```bash
# Restore from git
git checkout v5.0.0

# Rebuild containers
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Note: Indexes can remain - they don't affect v5.x functionality
```

To remove indexes (optional):

```sql
DROP INDEX IF EXISTS idx_environments_name_trgm;
DROP INDEX IF EXISTS idx_environments_description_trgm;
-- ... repeat for other indexes
DROP EXTENSION IF EXISTS pg_trgm;
```

---

## Breaking Changes

| Change | Impact | Migration |
|--------|--------|-----------|
| Pagination in responses | Medium | Update API consumers to handle `pagination` object |
| Default limit of 20 | Low | Add `?limit=100` or loop through pages for full data |

---

## Support

For issues during upgrade:

1. Check container logs: `docker logs tem-backend`
2. Verify database connection: `docker exec tem-postgres pg_isready`
3. Run health check: `curl http://localhost:5000/health`
4. Review [GitHub Issues](https://github.com/aravindksk7/BookMyEnv/issues)

---

## Version History

| Version | Release Date | Key Features |
|---------|--------------|--------------|
| 6.0.0 | 2025-12-24 | Performance & Scalability (Pagination, Search Indexes, N+1 Fixes) |
| 5.0.0 | 2025-12-15 | Email Notifications, Dark Mode, UI Enhancements |
| 4.2.0 | 2025-12-09 | Audit & Compliance System |
| 4.0.0 | 2025-12-08 | Refresh Lifecycle Management |
