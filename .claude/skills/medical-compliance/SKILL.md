# Medical Compliance Skill

## Data Integrity Principles

### No Soft Deletes on Clinical Data

Clinical data must never be "undeleted" - use explicit void flags instead.

```typescript
// WRONG - Allows accidental restoration
treatment.destroy(); // Sets deletedAt, can be restored

// CORRECT - Explicit, auditable, non-reversible
treatment.update({
  isVoided: true,
  voidedBy: userId,
  voidedAt: new Date(),
  voidReason: 'Entered in error'
});
// Never "un-void" clinical data
```

### Required Void Fields
All medical data tables should include:
- `is_voided` (boolean) - Void flag
- `voided_by` (UUID) - Who voided the record
- `voided_at` (timestamp) - When voided
- `void_reason` (text) - Why voided

## Audit Logging Requirements

### What to Log (Process Safety Focus)
- **WHO** performed the action (userId)
- **WHAT** action was performed (scan, insert, complete)
- **WHEN** it happened (server timestamp)
- **WHICH** resources were affected (applicatorId, treatmentId)

### Audit Log Pattern
```typescript
await ApplicatorAuditLog.create({
  applicatorId: applicator.id,
  action: 'STATUS_CHANGE',
  previousStatus: oldStatus,
  newStatus: newStatus,
  userId: req.user.id,
  timestamp: new Date(),
  details: JSON.stringify({ reason })
});
```

### Retention
- Audit logs must be retained for minimum 6 years (FDA 21 CFR Part 11)
- Never delete audit logs in application code
- Use database-level archival for old records

## Treatment State Machine

```
SCHEDULED → ACTIVE → COMPLETED
    ↓          ↓
 CANCELLED  CANCELLED
```

### Transition Rules
- VALIDATE transitions before allowing
- LOG all state changes
- PREVENT invalid transitions (return 400 error)

```typescript
const validTransitions = {
  'SCHEDULED': ['ACTIVE', 'CANCELLED'],
  'ACTIVE': ['COMPLETED', 'CANCELLED'],
  'COMPLETED': [], // Terminal
  'CANCELLED': [], // Terminal
};

if (!validTransitions[currentStatus].includes(newStatus)) {
  throw new Error(`Invalid transition: ${currentStatus} → ${newStatus}`);
}
```

## Fail-Safe Principles

### When Uncertain, BLOCK
- ERP offline + no cache = BLOCK
- ERP offline + stale cache (>24h) = BLOCK
- Cannot verify expiry = BLOCK
- Local says USED, ERP says available = BLOCK (trust local)

### Never Fail-Open
Medical devices must never default to "allow" when verification fails.

```typescript
// WRONG - Fail-open
if (!canVerify) {
  console.warn('Cannot verify, proceeding anyway');
  return true; // DANGEROUS
}

// CORRECT - Fail-closed
if (!canVerify) {
  throw new Error('SAFETY BLOCK: Cannot verify applicator');
}
```

## Transaction Requirements

### When to Use Transactions
- Treatment status changes
- Patient data modifications
- Multi-step workflows
- Any operation affecting multiple tables

### Transaction Pattern
```typescript
const transaction = await sequelize.transaction({
  isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE
});
try {
  await Treatment.update({ status: 'COMPLETED' }, { transaction });
  await Activity.create({ ... }, { transaction });
  await transaction.commit();
} catch (error) {
  await transaction.rollback();
  throw error;
}
```

## Pre-Commit Checklist

- [ ] No soft deletes on clinical data (use is_voided)
- [ ] Audit logging for all state changes
- [ ] State transitions validated
- [ ] Transactions used for multi-step operations
- [ ] ERP offline = BLOCK (fail-safe)
- [ ] Local DB checked BEFORE ERP for safety decisions
