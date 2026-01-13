# DL-005: Database Migration Process Requirements

**Status**: Implemented
**Created**: 2026-01-13
**Author**: Claude Code

## Context

After deploying PR #25 (removal comment fields) to Azure production, the application failed with:
```
column "top_general_comments" does not exist
```

**Root Cause**: The PR added new columns to `Treatment.ts` model but did NOT create a corresponding SQL migration file. In development, `sequelize.sync({ alter: true })` auto-creates columns, masking the issue. Production requires manual migrations.

## Affected Columns

| Column | Status in Dev | Status in Prod (before fix) |
|--------|--------------|------------------------------|
| `top_general_comments` | ✅ Auto-created | ❌ Missing |
| `group_comments` | ✅ Auto-created | ❌ Missing |
| `individual_seed_comment` | ✅ Auto-created | ❌ Missing |
| `removal_general_comments` | ✅ Existed | ✅ Existed |

## How Development vs Production Differs

### Development Environment
```typescript
// backend/src/config/database.ts
await sequelize.sync({
  alter: process.env.NODE_ENV === 'development',  // TRUE in dev
  force: false
});
```
- Sequelize automatically adds/modifies columns to match model
- Changes appear instantly on server restart
- No migration files required

### Production Environment
```typescript
// alter: false in production
await sequelize.sync({ alter: false, force: false });
```
- Schema changes require manual SQL migrations
- Files stored in `backend/src/migrations/`
- Must be applied via `psql` or `docker exec`

## Decision: Migration Requirements

**Any model column addition MUST have a corresponding migration file.**

### Required Steps for Database Changes

1. **Modify the model** in `backend/src/models/*.ts`
2. **Create migration file** in `backend/src/migrations/YYYYMMDDHHMMSS-description.sql`
3. **Test locally** (auto-sync creates column)
4. **Before deploying**: Apply migration to Azure
5. **Deploy code** via `swarm-deploy`

### Migration File Template

```sql
-- ============================================================================
-- Migration: [Description]
-- Date: YYYY-MM-DD
-- Description: [What this migration does]
-- ============================================================================

BEGIN;

ALTER TABLE [table_name]
ADD COLUMN IF NOT EXISTS [column_name] [TYPE];

COMMENT ON COLUMN [table_name].[column_name] IS '[description]';

COMMIT;

-- ============================================================================
-- DOWN Migration (Rollback)
-- ============================================================================
-- BEGIN;
-- ALTER TABLE [table_name] DROP COLUMN IF EXISTS [column_name];
-- COMMIT;
```

### Applying Migrations to Azure

```bash
# SSH and run migration
ssh azureuser@20.217.84.100 "docker exec ala-db psql -U ala_user -d ala_production -f /path/to/migration.sql"

# Or inline SQL
ssh azureuser@20.217.84.100 "docker exec ala-db psql -U ala_user -d ala_production -c 'ALTER TABLE...'"
```

## Implementation Notes

### Fix Applied (2026-01-13)

Migration `20260113000000-add-removal-comment-fields.sql` created and applied:
- Added `top_general_comments` TEXT
- Added `group_comments` TEXT
- Added `individual_seed_comment` TEXT

### Documentation Updated

- Added migration requirements to `CLAUDE.md`
- Created this design log for future reference

## Verification Query

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'treatments'
AND column_name LIKE '%comment%'
ORDER BY column_name;
```

## Results

- ✅ Migration applied successfully
- ✅ All 4 comment columns now exist in production
- ✅ Application functioning correctly
- ✅ Process documented for future prevention
