---
paths:
  - "**/treatment/**"
  - "**/applicator/**"
  - "**/patient/**"
---

# Medical Safety Rules (CORRECTED)

## CRITICAL: Local DB First for Safety

### The Inversion Rule
- **LOCAL DB is source of truth for SAFETY** (used/unused, treatment records)
- **ERP is source of truth for INVENTORY** (expiry, model, serial validation)
- **If local and ERP disagree on usage: LOCAL WINS**

### Why This Matters
ERP sync can be delayed. If a device was just used:
- Local DB: "USED at 10:05:00"
- ERP (not yet synced): "AVAILABLE"

If you trust ERP, you allow reuse of a contaminated device. PATIENT HARM.

## Applicator Validation Flow

```
1. CHECK LOCAL DB -> Is it marked USED?
   - YES -> BLOCK (even if ERP says available)
   - NO -> Continue

2. CHECK ERP -> Metadata validation
   - ERP offline, no cache -> BLOCK (fail-safe)
   - ERP offline, stale cache -> BLOCK (fail-safe)
   - ERP offline, fresh cache -> Use cached data
   - Expired? -> BLOCK
   - NO USE flag? -> BLOCK
   - Valid -> Continue

3. CHECK TREATMENT TYPE -> Clinical match
   - Mismatch -> BLOCK

4. PROCEED -> Record usage in LOCAL DB FIRST
```

## Audit Logging

### What to Log (Process Safety Focus)
- WHO performed the action (userId)
- WHAT action was performed (scan, insert, complete)
- WHEN it happened (server timestamp)
- WHICH resources were affected (applicatorId, treatmentId)

### Simplified Approach (Data Already Pre-Masked)
Since patient_id is already pre-masked at source:
- Treat patient_id as a standard string identifier
- No complex masking rules needed
- Focus on PROCESS logging, not data privacy transformations

## State Machine (Treatment Status)
```
SCHEDULED -> ACTIVE -> COMPLETED
    |          |
 CANCELLED  CANCELLED
```

- VALIDATE transitions before allowing
- LOG all state changes
- PREVENT invalid transitions (400 error)

## No Soft Deletes on Clinical Data
```typescript
// WRONG
treatment.destroy(); // Soft delete, can be restored

// CORRECT
treatment.update({
  isVoided: true,
  voidedBy: userId,
  voidedAt: new Date(),
  voidReason: 'Entered in error'
});
```

## Fail-Safe Principles

### When Uncertain, BLOCK
- ERP offline + no cache = BLOCK
- ERP offline + stale cache = BLOCK
- Cannot verify expiry = BLOCK
- Local says USED, ERP says available = BLOCK (trust local)

### Never Fail-Open
Medical devices must never default to "allow" when verification fails.

## Pre-Commit Checklist (MANDATORY)
- [ ] Local DB checked BEFORE ERP for safety decisions
- [ ] Audit logging for all actions (who/what/when/which)
- [ ] State transitions validated
- [ ] No soft deletes (use is_voided flag)
- [ ] ERP offline = BLOCK, not proceed with warning
- [ ] medical-safety-reviewer APPROVED
