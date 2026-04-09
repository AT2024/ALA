---
paths:
  - "**/*priority*.ts"
  - "**/*odata*.ts"
  - "backend/src/services/priorityService.ts"
---

# Priority ERP Integration Rules

## Source of Truth (see medical-safety rule for full hierarchy)

LOCAL DB wins for SAFETY. ERP wins for INVENTORY. Never trust ERP alone for usage status.

## OData Query Standards

- ALWAYS use `$select` with exact fields (never wildcards)
- FILTER dates at API level: `$filter: SIBD_TREATDAY ge datetime'${date}'`
- Pagination: default 100, max 500, use `$top`/`$skip`

## Retry Pattern

- 4 attempts, 200ms initial, 2x multiplier, 10% jitter
- RETRY: 408, 429, 500-504, ECONNRESET, ETIMEDOUT
- FAIL IMMEDIATELY: 400, 401, 403, 404

## Circuit Breaker

OPEN after 5 consecutive failures → HALF_OPEN after 60s → test single request

## Cache

- Update `ApplicatorCache` on every successful ERP query
- 24-hour TTL — stale cache + ERP offline = BLOCK (fail-safe)
