---
paths:
  - "backend/src/models/**"
  - "backend/src/migrations/**"
---

# Database Rules

## Migration Requirements (MANDATORY)

**Any model column addition MUST have a corresponding migration file.**

- Dev uses `sequelize.sync({ alter: true })` (auto-creates columns)
- Production requires manual migration — columns won't exist otherwise
- Location: `backend/src/migrations/YYYYMMDDHHMMSS-description.sql`
- Run `npm run db:check-diff` before commit

```sql
BEGIN;
ALTER TABLE [table_name] ADD COLUMN IF NOT EXISTS [column] [TYPE];
COMMIT;
```

## Model Standards

- USE `declare` for Sequelize properties with explicit types
- Medical tables MUST include: `createdAt`, `updatedAt`, `createdBy`, `isVoided`
- USE `is_voided` flag, not soft deletes (see medical-safety rule)

## Query Optimization

- ALWAYS use `attributes` to specify columns (no SELECT \*)
- USE `include` for associations (prevent N+1)
- INDEX all WHERE clause columns and foreign keys

## Transactions

- SERIALIZABLE: treatment status changes, dosage adjustments
- REPEATABLE_READ: multi-step reads + writes
- READ_COMMITTED: read-only, reporting
