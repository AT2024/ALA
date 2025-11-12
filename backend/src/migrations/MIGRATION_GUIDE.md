# Patient Name Field Migration Guide

## Overview

This migration adds a `patient_name` field to the `treatments` table to store the actual patient identifier (from Priority DETAILS field), separate from the `subjectId` which stores the order number (ORDNAME).

## Field Details

- **Database Column**: `patient_name` (snake_case)
- **Sequelize Model**: `patientName` (camelCase)
- **Type**: VARCHAR(255), nullable
- **Purpose**: Store patient identifier from Priority DETAILS field
- **Backward Compatibility**: Existing treatments will have NULL value

## Usage in Code

### Creating a New Treatment

```typescript
const treatment = await Treatment.create({
  type: 'insertion',
  subjectId: 'ORD123456', // Order number from ORDNAME
  patientName: 'PATIENT-ID-789', // Patient identifier from DETAILS
  site: '100078',
  date: new Date(),
  userId: user.id,
  // ... other fields
});
```

### Updating Existing Treatment

```typescript
await treatment.update({
  patientName: 'PATIENT-ID-789'
});
```

### Querying by Patient Name

```typescript
const treatments = await Treatment.findAll({
  where: {
    patientName: 'PATIENT-ID-789'
  }
});
```

### Handling Nullable Field

```typescript
// Check if patientName exists
if (treatment.patientName) {
  console.log(`Patient: ${treatment.patientName}`);
} else {
  console.log('Patient name not available (legacy data)');
}
```

## Development Environment

In development mode, the schema change is **automatic**:
1. Update the model file (already done)
2. Restart the server
3. Sequelize auto-sync applies the change

## Production Environment

For production deployment, follow these steps:

### Option 1: Using psql (Recommended)

```bash
# SSH to production server
ssh azureuser@20.217.84.100

# Connect to database container
docker exec -it deployment_db_1 psql -U postgres -d ala_db

# Run the migration
\i /app/migrations/20251111000000-add-patient-name.sql

# Verify
\d treatments
```

### Option 2: Manual SQL

```sql
-- Connect to production database and run:
ALTER TABLE treatments
ADD COLUMN IF NOT EXISTS patient_name VARCHAR(255) NULL;

COMMENT ON COLUMN treatments.patient_name IS 'Patient identifier from Priority DETAILS field';
```

### Verification

```sql
-- Check column was added correctly
SELECT column_name, data_type, is_nullable, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'treatments' AND column_name = 'patient_name';

-- Expected result:
-- column_name   | data_type         | is_nullable | character_maximum_length
-- patient_name  | character varying | YES         | 255
```

## Rollback (if needed)

```sql
-- Remove the column
ALTER TABLE treatments DROP COLUMN IF EXISTS patient_name;
```

## Integration with Priority API

When fetching orders from Priority, populate this field:

```typescript
// Example: Fetching from Priority and creating treatment
const priorityOrder = await priorityService.getOrder(orderId);

const treatment = await Treatment.create({
  subjectId: priorityOrder.ORDNAME,        // Order number
  patientName: priorityOrder.DETAILS,      // Patient identifier
  // ... other fields
});
```

## Data Migration Strategy

For existing treatments without `patientName`:

1. **Lazy population**: Update when user next accesses the treatment
2. **Batch backfill**: Script to fetch from Priority and update (optional)
3. **Accept NULL**: Leave as NULL for historical data (simplest)

Currently using **option 3** (accept NULL) for simplicity.

## Testing

### Unit Test Example

```typescript
describe('Treatment with patientName', () => {
  it('should create treatment with patient name', async () => {
    const treatment = await Treatment.create({
      type: 'insertion',
      subjectId: 'ORD123',
      patientName: 'PATIENT-456',
      site: '100078',
      date: new Date(),
      userId: testUser.id
    });

    expect(treatment.patientName).toBe('PATIENT-456');
  });

  it('should handle missing patient name', async () => {
    const treatment = await Treatment.create({
      type: 'insertion',
      subjectId: 'ORD123',
      // patientName not provided
      site: '100078',
      date: new Date(),
      userId: testUser.id
    });

    expect(treatment.patientName).toBeNull();
  });
});
```

## Migration Checklist

- [x] Update TypeScript interface (TreatmentAttributes)
- [x] Add field to model class properties
- [x] Add to TreatmentCreationAttributes optional fields
- [x] Add database column mapping in Treatment.init()
- [x] Create SQL migration file
- [x] Document migration process
- [ ] Test in development environment
- [ ] Run migration in production
- [ ] Update API endpoints to include patientName
- [ ] Update frontend to display patientName
- [ ] Add tests for patientName field
