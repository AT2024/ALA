---
paths:
  - "**/*priority*.ts"
  - "**/*odata*.ts"
  - "backend/src/services/priorityService.ts"
---

# Priority ERP Integration Rules (CORRECTED)

## CRITICAL: Source of Truth Hierarchy

### WRONG: "ERP is always source of truth"
This is DANGEROUS for patient safety. ERP sync delays mean a USED device can appear "clean."

### CORRECT: Split Source of Truth

| Data Type | Source of Truth | Why |
|-----------|-----------------|-----|
| **Device USAGE** (used/unused) | LOCAL DB | Real-time, safety-critical |
| **Device METADATA** (expiry, model) | ERP | Inventory management |
| **Patient Treatment Records** | LOCAL DB | Direct observation |
| **Inventory Counts** | ERP | Business operations |

### The Golden Rule
**LOCAL DB wins for SAFETY. ERP wins for INVENTORY.**

## Safety-First Validation Pattern (FAIL-SAFE)

### CRITICAL: Medical Devices Must FAIL-CLOSED, Not FAIL-OPEN

If you cannot verify safety metadata (ERP offline), you MUST BLOCK, not proceed.

```typescript
// backend/src/services/applicatorService.ts
const CACHE_TTL_HOURS = 24;

export const validateApplicatorUsage = async (
  serialNumber: string,
  treatmentType: string
) => {
  // STEP 1: CHECK LOCAL DB FIRST (Safety - Real-time usage)
  const localUsage = await db.ApplicatorUsage.findOne({
    where: { serialNumber }
  });

  if (localUsage) {
    throw new Error(
      `SAFETY CRITICAL: Applicator ${serialNumber} was already used on ${localUsage.usedAt}`
    );
  }

  // STEP 2: CHECK ERP (Inventory - Metadata)
  let erpData = await priorityService.getApplicator(serialNumber);

  if (!erpData) {
    // ERP OFFLINE: Try local cache (fail-safe approach)
    const cachedData = await db.ApplicatorCache.findOne({
      where: { serialNumber }
    });

    if (!cachedData) {
      // FAIL-CLOSED: Cannot verify expiry = BLOCK
      throw new Error(
        `SAFETY BLOCK: Cannot verify applicator ${serialNumber} - ERP offline and no cached data`
      );
    }

    // Check if cache is stale (older than 24 hours)
    const cacheAge = Date.now() - new Date(cachedData.cachedAt).getTime();
    if (cacheAge > CACHE_TTL_HOURS * 60 * 60 * 1000) {
      throw new Error(
        `SAFETY BLOCK: Cached data for ${serialNumber} is stale. ERP verification required.`
      );
    }

    console.warn(`Using cached data for ${serialNumber} (ERP offline)`);
    erpData = cachedData;
  } else {
    // ERP responded - update local cache for offline resilience
    await db.ApplicatorCache.upsert({
      serialNumber,
      SIBD_NOUSE: erpData.SIBD_NOUSE,
      SIBD_EXPIRY: erpData.SIBD_EXPIRY,
      SIBD_TREATTYPE: erpData.SIBD_TREATTYPE,
      cachedAt: new Date()
    });
  }

  // STEP 3: VALIDATE METADATA
  if (erpData.SIBD_NOUSE === 'Y') {
    throw new Error(`INVENTORY ERROR: Applicator marked NO USE`);
  }
  if (new Date(erpData.SIBD_EXPIRY) < new Date()) {
    throw new Error(`INVENTORY ERROR: Applicator expired ${erpData.SIBD_EXPIRY}`);
  }

  // STEP 4: CONTEXT CHECK (Clinical match)
  if (erpData.SIBD_TREATTYPE && erpData.SIBD_TREATTYPE !== treatmentType) {
    throw new Error(
      `CLINICAL MISMATCH: Applicator type ${erpData.SIBD_TREATTYPE} cannot be used for ${treatmentType}`
    );
  }

  return true;
};
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

// WRONG
const query = { $select: '*' };
```

### Date Filtering (MANDATORY)
- FILTER at API level, never in application code
- USE `ge` (greater than or equal) for date ranges

### Pagination
- DEFAULT: 100 records per page
- MAXIMUM: 500 records (site lists)
- USE `$top` and `$skip` for server-side paging

## Error Handling & Retry

### Exponential Backoff with Jitter (MANDATORY)
- MAX ATTEMPTS: 4
- INITIAL DELAY: 200ms
- MAX DELAY: 60 seconds
- MULTIPLIER: 2.0x
- JITTER: 10%

### Transient Errors (RETRY)
- 408 Request Timeout
- 429 Too Many Requests
- 500-504 Server Errors
- ECONNRESET, ETIMEDOUT

### Non-Transient Errors (FAIL IMMEDIATELY)
- 400 Bad Request
- 401 Unauthorized
- 403 Forbidden
- 404 Not Found

## Circuit Breaker
- OPEN after 5 consecutive failures
- HALF_OPEN after 60 seconds
- Test single request before closing

## Logging Requirements

### Emoji Indicators (Existing Pattern)
- Real API data
- Test/mock data
- Fallback/error

## Pre-Commit Checklist
- [ ] Local DB checked BEFORE ERP for usage validation
- [ ] ERP offline = BLOCK (fail-safe), not proceed with warning
- [ ] $select specifies exact fields (no wildcards)
- [ ] Retry logic with exponential backoff
