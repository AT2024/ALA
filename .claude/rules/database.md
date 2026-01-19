---
paths:
  - "backend/src/models/**"
  - "backend/src/migrations/**"
---

# Database Rules - PostgreSQL/Sequelize

## Migration Requirements (MANDATORY)

### Golden Rule
**Any model column addition MUST have a corresponding migration file.**

Development uses `sequelize.sync({ alter: true })` which auto-creates columns.
Production requires manual migrations - columns won't exist otherwise.

### Pre-Commit Check Script
```bash
# Add to package.json scripts
"db:check-diff": "node scripts/check-model-migration-diff.js"

# Run before commit
npm run db:check-diff
```

### Migration File Location
`backend/src/migrations/YYYYMMDDHHMMSS-description.sql`

### Migration Template
```sql
BEGIN;
ALTER TABLE [table_name] ADD COLUMN IF NOT EXISTS [column] [TYPE];
COMMIT;
```

### Applying to Azure Production
```bash
ssh azureuser@20.217.84.100 "docker exec ala-db psql -U ala_user -d ala_production -c 'ALTER TABLE...'"
```

## No Soft Deletes on Clinical Data

### WRONG: Soft delete with `deletedAt`
```typescript
// Dangerous - allows "undelete" of clinical data
treatment.destroy(); // Sets deletedAt, can be restored
```

### CORRECT: Use `is_voided` flag
```typescript
// Explicit, auditable, non-reversible marking
treatment.update({ isVoided: true, voidedBy: userId, voidedAt: new Date() });
// Never "un-void" clinical data
```

## Model Definition Standards

### TypeScript Typing
- USE `declare` for Sequelize properties
- DEFINE explicit types for all columns
- USE enum types for status fields

```typescript
export class Treatment extends Model {
  declare id: number;
  declare status: 'SCHEDULED' | 'ACTIVE' | 'COMPLETED';
  declare dosage: number;
  declare createdAt: Date;
}
```

### Audit Columns (MANDATORY for medical tables)
Every medical data table MUST include:
- `createdAt` - When record was created
- `updatedAt` - When last modified
- `createdBy` - Who created (user ID)
- `isVoided` - Non-reversible void flag (not soft delete)

## Transaction Handling (MANDATORY for medical operations)

### When to Use Transactions
- Treatment status changes
- Patient data modifications
- Multi-step workflows
- Any operation affecting multiple tables

### Transaction Pattern
```typescript
const transaction = await sequelize.transaction();
try {
  await Treatment.create({ ... }, { transaction });
  await Activity.create({ ... }, { transaction });
  await transaction.commit();
} catch (error) {
  await transaction.rollback();
  throw error;
}
```

### Isolation Levels
- SERIALIZABLE: Treatment status changes, dosage adjustments
- REPEATABLE_READ: Multi-step reads + writes
- READ_COMMITTED: Read-only, reporting

## Query Optimization

### Field Selection
- ALWAYS use `attributes` to specify columns
- AVOID SELECT * patterns

### N+1 Prevention
- ALWAYS use `include` for associations
- NEVER loop and query

### Index Strategy
- INDEX all columns in WHERE clauses
- INDEX all foreign keys
- USE composite indexes for common query patterns

## Pre-Commit Checklist
- [ ] Migration file created for new columns
- [ ] `npm run db:check-diff` passes
- [ ] No soft deletes on clinical data (use is_voided)
- [ ] Transactions used for multi-step operations
