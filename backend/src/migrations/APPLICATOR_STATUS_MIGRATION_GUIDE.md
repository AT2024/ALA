# Applicator Status Fields Migration Guide

## Overview

This migration adds `status` and `package_label` fields to the `applicators` table to implement the 9-state applicator workflow. This is Step 1 of the file upload feature implementation.

**IMPORTANT**: This guide now documents the CORRECT 9-state model. Previous versions incorrectly listed only 6 states.

## Field Details

### Status Field
- **Database Column**: `status` (snake_case - no mapping needed)
- **Sequelize Model**: `status` (same name)
- **Type**: VARCHAR(50), nullable
- **Values**: 9 states (see workflow below)
  - `'SEALED'` - Initial state, unopened package
  - `'OPENED'` - Package opened, not yet loaded
  - `'LOADED'` - Loaded into delivery device
  - `'INSERTED'` - Successfully inserted into patient
  - `'FAULTY'` - Faulty applicator
  - `'DISPOSED'` - Disposed without use
  - `'DISCHARGED'` - Discharged after use
  - `'DEPLOYMENT_FAILURE'` - Failed deployment
  - `'UNACCOUNTED'` - Lost or unaccounted for
- **Purpose**: Track applicator workflow state throughout its lifecycle
- **Backward Compatibility**: Nullable, with automatic backfill from `usageType`

### Package Label Field
- **Database Column**: `package_label` (snake_case)
- **Sequelize Model**: `packageLabel` (camelCase)
- **Type**: VARCHAR(10), nullable
- **Values**: Single letter A-Z or null
- **Purpose**: Group applicators from the same package for tracking
- **Backward Compatibility**: Nullable for existing records

## 9-State Workflow

```
SEALED → OPENED → LOADED → INSERTED → [DISCHARGED | DISPOSED]
           ↓         ↓           ↓
         FAULTY  DEPLOYMENT_FAILURE  UNACCOUNTED
```

### State Descriptions

1. **SEALED**: Applicator in unopened package (initial state)
   - Transition to: OPENED, FAULTY, UNACCOUNTED

2. **OPENED**: Package opened, applicators visible but not loaded
   - Transition to: LOADED, FAULTY, DISPOSED, UNACCOUNTED

3. **LOADED**: Loaded into delivery device, ready for insertion
   - Transition to: INSERTED, FAULTY, DEPLOYMENT_FAILURE, UNACCOUNTED

4. **INSERTED**: Successfully inserted into patient (terminal success state)
   - Transition to: DISCHARGED, DISPOSED

5. **FAULTY**: Applicator marked as faulty (terminal state)
   - Transition to: DISPOSED, DISCHARGED

6. **DEPLOYMENT_FAILURE**: Failed deployment attempt (terminal state)
   - Transition to: DISPOSED, FAULTY

7. **DISPOSED**: Properly disposed of (terminal state)
   - No further transitions

8. **DISCHARGED**: Discharged after use (terminal state)
   - No further transitions

9. **UNACCOUNTED**: Lost or unaccounted for (terminal state)
   - No further transitions

### Terminal States

Once an applicator reaches a terminal state, no further status transitions are allowed:
- **INSERTED** (success path)
- **DISPOSED** (disposed path)
- **DISCHARGED** (discharged path)
- **UNACCOUNTED** (lost path)

## Data Migration Strategy

The migration automatically backfills `status` from existing `usageType` values:

```sql
UPDATE applicators SET status = CASE
  WHEN usage_type = 'full' THEN 'INSERTED'
  WHEN usage_type = 'faulty' THEN 'FAULTY'
  WHEN usage_type = 'none' THEN 'DISPOSED'
  ELSE 'SEALED'
END;
```

**Important**: The `usageType` field is preserved for backward compatibility and Priority ERP sync.

## Usage in Code

### Creating a New Applicator (Post-Scan)

```typescript
import { ApplicatorStatus } from '../models/Applicator';

const applicator = await Applicator.create({
  serialNumber: 'APP12345',
  seedQuantity: 100,
  usageType: 'full', // Keep for Priority sync
  status: 'SCANNED', // New workflow state
  packageLabel: 'A', // Group with other applicators from package A
  insertionTime: new Date(),
  treatmentId: treatment.id,
  addedBy: user.id,
});
```

### Updating Applicator Status

```typescript
// When applicator is inserted
await applicator.update({
  status: 'INSERTED',
  insertionTime: new Date(),
});

// When applicator is removed
await applicator.update({
  status: 'REMOVED',
  removalTime: new Date(),
  isRemoved: true,
});

// When applicator is disposed
await applicator.update({
  status: 'DISPOSED',
});

// Mark as faulty
await applicator.update({
  status: 'FAULTY',
  usageType: 'faulty', // Keep both in sync
});
```

### Querying by Status

```typescript
// Get all scanned applicators ready for insertion
const scannedApplicators = await Applicator.findAll({
  where: {
    status: 'SCANNED',
    treatmentId: treatment.id,
  },
  order: [['packageLabel', 'ASC']],
});

// Get all applicators from package A
const packageA = await Applicator.findAll({
  where: {
    packageLabel: 'A',
    treatmentId: treatment.id,
  },
});

// Count applicators by status
const statusCounts = await Applicator.findAll({
  attributes: [
    'status',
    [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
  ],
  group: ['status'],
});
```

### Type Safety

```typescript
import Applicator, { ApplicatorStatus } from '../models/Applicator';

// TypeScript will enforce valid status values
const validStatus: ApplicatorStatus = 'INSERTED'; // OK
const invalidStatus: ApplicatorStatus = 'INVALID'; // Type error

// Use in functions
function updateApplicatorStatus(
  applicator: Applicator,
  newStatus: ApplicatorStatus
): Promise<Applicator> {
  return applicator.update({ status: newStatus });
}
```

## Development Environment

In development mode, the schema change is **automatic**:
1. Update the model file (already done)
2. Restart the server
3. Sequelize auto-sync applies the change with `alter: true`

## Production Environment

For production deployment, follow these steps:

### Step 1: Apply Migration

```bash
# SSH to production server
ssh azureuser@20.217.84.100

# Connect to database container
docker exec -it deployment_db_1 psql -U postgres -d ala_db

# Run the migration
\i /app/migrations/20251119000000-add-applicator-status-fields.sql

# Or copy/paste the SQL directly
```

### Step 2: Verify Migration

```sql
-- Check columns were added
SELECT column_name, data_type, is_nullable, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'applicators' AND column_name IN ('status', 'package_label')
ORDER BY column_name;

-- Expected result:
-- column_name   | data_type         | is_nullable | character_maximum_length
-- package_label | character varying | YES         | 10
-- status        | character varying | YES         | 50

-- Check indexes were created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'applicators'
AND indexname IN ('idx_applicators_status', 'idx_applicators_package_label');

-- Verify status backfill
SELECT usage_type, status, COUNT(*) as count
FROM applicators
GROUP BY usage_type, status
ORDER BY usage_type, status;

-- Check for NULL status values (should be 0)
SELECT COUNT(*) as null_status_count
FROM applicators
WHERE status IS NULL;
```

### Step 3: Deploy Updated Code

```bash
# On local machine, commit changes
git add backend/src/models/Applicator.ts
git add backend/src/migrations/20251119000000-add-applicator-status-fields.sql
git commit -m "feat: Add status and package_label fields for 9-state workflow"
git push

# On production server
cd ~/ala-improved/deployment
./swarm-deploy
```

## Rollback (if needed)

```sql
BEGIN;
DROP INDEX IF EXISTS idx_applicators_package_label;
DROP INDEX IF EXISTS idx_applicators_status;
ALTER TABLE applicators DROP COLUMN IF EXISTS package_label;
ALTER TABLE applicators DROP COLUMN IF EXISTS status;
COMMIT;
```

## Testing

### Unit Test Example

```typescript
describe('Applicator with status field', () => {
  it('should create applicator with SCANNED status', async () => {
    const applicator = await Applicator.create({
      serialNumber: 'APP123',
      seedQuantity: 100,
      usageType: 'full',
      status: 'SCANNED',
      packageLabel: 'A',
      insertionTime: new Date(),
      treatmentId: treatment.id,
      addedBy: user.id,
    });

    expect(applicator.status).toBe('SCANNED');
    expect(applicator.packageLabel).toBe('A');
  });

  it('should enforce valid status values', async () => {
    const applicator = await Applicator.build({
      serialNumber: 'APP123',
      seedQuantity: 100,
      usageType: 'full',
      status: 'INVALID_STATUS' as any, // Force invalid value
      insertionTime: new Date(),
      treatmentId: treatment.id,
      addedBy: user.id,
    });

    await expect(applicator.validate()).rejects.toThrow();
  });

  it('should handle NULL status for backward compatibility', async () => {
    const applicator = await Applicator.create({
      serialNumber: 'APP123',
      seedQuantity: 100,
      usageType: 'full',
      status: null, // Explicitly NULL
      insertionTime: new Date(),
      treatmentId: treatment.id,
      addedBy: user.id,
    });

    expect(applicator.status).toBeNull();
  });

  it('should query applicators by package label', async () => {
    await Applicator.bulkCreate([
      { serialNumber: 'A1', packageLabel: 'A', status: 'SCANNED', /* ... */ },
      { serialNumber: 'A2', packageLabel: 'A', status: 'SCANNED', /* ... */ },
      { serialNumber: 'B1', packageLabel: 'B', status: 'SCANNED', /* ... */ },
    ]);

    const packageA = await Applicator.findAll({
      where: { packageLabel: 'A' },
    });

    expect(packageA).toHaveLength(2);
  });
});
```

## Migration Checklist

- [x] Define ApplicatorStatus type and export it
- [x] Update TypeScript interface (ApplicatorAttributes)
- [x] Add fields to model class properties
- [x] Add to ApplicatorCreationAttributes optional fields
- [x] Add database column mappings in Applicator.init()
- [x] Add validation for status field
- [x] Add indexes for status and package_label
- [x] Create SQL migration file with transaction
- [x] Include backfill logic for existing data
- [x] Add rollback (DOWN migration)
- [x] Document migration process
- [x] Update migrations README
- [ ] Test in development environment
- [ ] Run migration in production
- [ ] Update API endpoints to use status field
- [ ] Update frontend to display status
- [ ] Add comprehensive tests for status transitions
- [ ] Implement status transition validation logic

## Audit Trail System

### Overview

The `applicator_audit_log` table tracks ALL status transitions for regulatory compliance and data integrity.

### Schema

```sql
CREATE TABLE applicator_audit_log (
    id UUID PRIMARY KEY,
    applicator_id UUID NOT NULL REFERENCES applicators(id),
    old_status VARCHAR(50),          -- NULL for initial creation
    new_status VARCHAR(50) NOT NULL,
    changed_by VARCHAR(255) NOT NULL, -- User email
    changed_at TIMESTAMP NOT NULL,
    reason TEXT,                      -- Optional reason
    request_id VARCHAR(100),          -- For tracing
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);
```

### Setup Instructions

1. **Apply Migration**:
   ```bash
   docker exec -it deployment_db_1 psql -U postgres -d ala_db
   \i /app/migrations/20251119000001-create-audit-log.sql
   ```

2. **Verify Table Created**:
   ```sql
   \d applicator_audit_log
   ```

3. **Check Indexes**:
   ```sql
   SELECT indexname, indexdef
   FROM pg_indexes
   WHERE tablename = 'applicator_audit_log';
   ```

### Usage in Code

The audit logging is automatic when using `applicatorService` functions:

```typescript
import { ApplicatorAuditLog } from '../models';

// Query audit trail for an applicator
const auditLogs = await ApplicatorAuditLog.findAll({
  where: { applicatorId: applicator.id },
  order: [['changedAt', 'DESC']],
  include: [{ model: Applicator, as: 'applicator' }]
});

// Get timeline of status changes
const timeline = auditLogs.map(log => ({
  timestamp: log.changedAt,
  from: log.oldStatus,
  to: log.newStatus,
  by: log.changedBy,
  reason: log.reason
}));
```

### Critical Requirements

- **ALWAYS log status changes**: Every status transition MUST be logged
- **User identification**: Always pass user email to `logStatusChange()`
- **Transaction support**: Audit logs should be part of the same transaction
- **Non-blocking**: Audit log failures should log error but not block operation

## Next Steps (File Upload Feature)

This migration is **Step 1** of the 9-state workflow implementation. Remaining steps:

- **Step 2**: API endpoint for file upload and batch applicator creation
- **Step 3**: Frontend component for file upload
- **Step 4**: Status transition validation and business logic (DONE - see validateStatusTransition)
- **Step 5**: Priority ERP sync updates for new workflow
- **Step 6**: Comprehensive testing and documentation
- **Step 7**: Audit trail integration (DONE - see ApplicatorAuditLog)

## Important Notes

### Field Naming Convention
- **status**: No snake_case mapping needed (same in DB and model)
- **packageLabel** → `package_label`: Follows existing camelCase to snake_case pattern

### Backward Compatibility
- Both fields are **nullable** to support existing applicators
- Automatic backfill ensures existing data has appropriate status
- `usageType` field is **preserved** for Priority ERP integration
- No breaking changes to existing API endpoints

### Performance
- Indexes added for both `status` and `package_label` fields
- Queries by status or package will be fast
- Migration uses transaction for atomic changes

### Data Integrity
- Sequelize validation enforces only valid status values
- Migration backfill ensures no orphaned records
- Preserves all existing applicator data
