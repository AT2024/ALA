---
paths:
  - "**/treatment/**"
  - "**/applicator/**"
  - "**/patient/**"
---

# Medical Safety Rules

## Source of Truth (CRITICAL)

- **LOCAL DB** = truth for SAFETY (usage tracking, treatment records)
- **ERP** = truth for INVENTORY (expiry, model, serial)
- **If local and ERP disagree on usage: LOCAL WINS** (ERP sync can be delayed)

## Applicator Validation Flow

1. CHECK LOCAL DB → USED? → BLOCK (even if ERP says available)
2. CHECK ERP → Offline + no fresh cache? → BLOCK (fail-safe)
3. CHECK TREATMENT TYPE → Mismatch? → BLOCK
4. PROCEED → Record usage in LOCAL DB FIRST

## Fail-Safe: When Uncertain, BLOCK

Medical devices must never default to "allow" when verification fails.

## State Machine

`SCHEDULED → ACTIVE → COMPLETED` (both can → `CANCELLED`). Validate transitions; log all changes.

## Clinical Data

- NO soft deletes — use `is_voided` flag with `voidedBy`, `voidedAt`, `voidReason`
- Audit log: WHO/WHAT/WHEN/WHICH for all actions
- Transactions with SERIALIZABLE isolation for status changes
