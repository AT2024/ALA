# Priority API Integration Skill

## Source of Truth Hierarchy (CRITICAL)

| Data Type | Source of Truth | Why |
|-----------|-----------------|-----|
| **Device USAGE** | LOCAL DB | Real-time, safety-critical |
| **Device METADATA** | ERP | Inventory management |
| **Patient Treatment Records** | LOCAL DB | Direct observation |
| **Inventory Counts** | ERP | Business operations |

**Golden Rule: LOCAL DB wins for SAFETY. ERP wins for INVENTORY.**

## Applicator Validation Pattern

```typescript
// 1. CHECK LOCAL DB FIRST (Safety)
const localUsage = await db.ApplicatorUsage.findOne({ where: { serialNumber } });
if (localUsage) {
  throw new Error(`SAFETY CRITICAL: Already used on ${localUsage.usedAt}`);
}

// 2. CHECK ERP (Inventory metadata)
let erpData = await priorityService.getApplicator(serialNumber);

// 3. FAIL-CLOSED if ERP offline
if (!erpData) {
  const cached = await db.ApplicatorCache.findOne({ where: { serialNumber } });
  if (!cached || isCacheStale(cached, 24)) {
    throw new Error('SAFETY BLOCK: Cannot verify - ERP offline');
  }
  erpData = cached;
}

// 4. VALIDATE metadata
if (erpData.SIBD_NOUSE === 'Y') throw new Error('Marked NO USE');
if (new Date(erpData.SIBD_EXPIRY) < new Date()) throw new Error('Expired');
```

## OData Query Standards

### Field Selection (MANDATORY)
```typescript
// CORRECT
const query = {
  $select: 'ORDNAME,CUSTNAME,SIBD_TREATDAY,SIBD_SEEDQTY',
  $filter: `SIBD_TREATDAY ge datetime'${date}'`,
  $top: 100
};

// WRONG - Never use wildcards
const query = { $select: '*' };
```

### Pagination
- DEFAULT: 100 records per page
- MAXIMUM: 500 records (site lists)
- Use `$top` and `$skip` for server-side paging

## Retry Pattern

- MAX ATTEMPTS: 4
- INITIAL DELAY: 200ms
- MULTIPLIER: 2.0x
- JITTER: 10%

### Transient Errors (RETRY)
408, 429, 500-504, ECONNRESET, ETIMEDOUT

### Non-Transient Errors (FAIL)
400, 401, 403, 404

## Circuit Breaker
- OPEN after 5 consecutive failures
- HALF_OPEN after 60 seconds
- Test single request before closing

## ApplicatorCache Usage

The `ApplicatorCache` model stores ERP metadata for offline resilience:

```typescript
// Update cache on every successful ERP query
await ApplicatorCache.upsert({
  serialNumber,
  SIBD_NOUSE: erpData.SIBD_NOUSE,
  SIBD_EXPIRY: erpData.SIBD_EXPIRY,
  SIBD_TREATTYPE: erpData.SIBD_TREATTYPE,
  cachedAt: new Date()
});

// Check cache age (24h TTL)
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const isStale = (Date.now() - cache.cachedAt.getTime()) > CACHE_TTL_MS;
```

## Pre-Integration Checklist

- [ ] Local DB checked BEFORE ERP for usage validation
- [ ] ERP offline = BLOCK (fail-safe), not proceed with warning
- [ ] $select specifies exact fields (no wildcards)
- [ ] Retry logic with exponential backoff
- [ ] Cache updated on every successful ERP query
