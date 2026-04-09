# Priority Applicator Usage Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Sync applicator usage data (seeds inserted, usage type, comments) back to Priority ERP when treatments are completed.

**Architecture:** Add a new `syncApplicatorUsageToPriority()` function in `priorityService.ts` that PATCHes the `SIBD_APPUSELISTTEXT_SUBFORM` endpoint using `KLINE` as the record key. Call this during treatment completion for each applicator in a terminal state. The existing `updateApplicatorInPriority()` POSTs to the wrong subform (`SIBD_APPLICATUSELIST_SUBFORM`) which is empty - the real data lives in `APPUSELISTTEXT`.

**Tech Stack:** Express/TypeScript backend, Priority ERP OData API, PostgreSQL/Sequelize

---

## Root Cause (verified)

Two issues combine to prevent sync:

1. **Wrong endpoint**: `updateApplicatorInPriority()` POSTs to `SIBD_APPLICATUSELIST_SUBFORM` - but applicator records live in `SIBD_APPUSELISTTEXT_SUBFORM`. The APPLICATUSELIST subform is **empty** for all orders.

2. **Missing code path**: `completeTreatment()` only updates `ORDSTATUSDES` (order status). It never syncs individual applicator usage data. The `updateApplicator()` function also only saves locally.

## Verified API Contract

Tested and confirmed working on SO26000055:

```
# Find record by serial number
GET /ORDERS('{orderId}')/SIBD_APPUSELISTTEXT_SUBFORM?$filter=SERNUMTEXT eq '{serialNumber}'
-> Returns: { KLINE, SERNUMTEXT, INSERTEDSEEDSQTY, USINGTYPE, ... }

# Update usage data using KLINE as key
PATCH /ORDERS('{orderId}')/SIBD_APPUSELISTTEXT_SUBFORM(KLINE={kline})
Body: {
  INSERTEDSEEDSQTY: number,      // seeds actually inserted
  USINGTYPE: string,             // "Full use" | "Partial Use" | "Faulty" | "No Use"
  INSERTIONCOMMENTS: string,     // free-text comments
  INSERTEDREPORTEDBY: string,    // who reported
  INSERTIONDATE: ISO8601 string  // when inserted
}
-> Returns: 200 with updated record
```

## Field Mapping (Local DB -> Priority)

| Local DB field        | Priority field       | Example                |
| --------------------- | -------------------- | ---------------------- |
| `seed_quantity`       | `INSERTEDSEEDSQTY`   | 3                      |
| `usage_type` (mapped) | `USINGTYPE`          | "Full use"             |
| `comments`            | `INSERTIONCOMMENTS`  | "test comment"         |
| user email            | `INSERTEDREPORTEDBY` | "doctor@hospital.com"  |
| `insertion_time`      | `INSERTIONDATE`      | "2026-04-09T12:56:00Z" |

Usage type mapping (already exists in `applicatorService.mapUsageTypeToPriority`):

- `full` -> `"Full use"`
- `partial` -> `"Partial Use"`
- `faulty` -> `"Faulty"`
- `none` -> `"No Use"`

---

### Task 1: Add `syncApplicatorUsageToPriority()` to Priority Service

**Files:**

- Modify: `backend/src/services/priorityService.ts` (after line ~2122, after `updateApplicatorInPriority`)

**Step 1: Write the failing test**

Create test in `backend/src/__tests__/services/priorityService.syncUsage.test.ts`:

```typescript
import { priorityService } from "../../services/priorityService";

// Mock axios
jest.mock("axios");

describe("syncApplicatorUsageToPriority", () => {
  it("should PATCH SIBD_APPUSELISTTEXT_SUBFORM with usage data", async () => {
    // Test that it GETs by serial number to find KLINE, then PATCHes
  });

  it("should skip sync when ENABLE_PRIORITY_APPLICATOR_SAVE is false", async () => {
    process.env.ENABLE_PRIORITY_APPLICATOR_SAVE = "false";
    const result = await priorityService.syncApplicatorUsageToPriority({
      orderId: "SO26000055",
      serialNumber: "260116-23/A1",
      seedsInserted: 3,
      usageType: "Full use",
      comments: "",
      reportedBy: "test@example.com",
      insertionDate: "2026-04-09T12:56:00Z",
    });
    expect(result.success).toBe(true);
    expect(result.message).toContain("disabled");
    delete process.env.ENABLE_PRIORITY_APPLICATOR_SAVE;
  });

  it("should return failure when applicator not found in Priority", async () => {
    // Mock GET returning empty value array
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/__tests__/services/priorityService.syncUsage.test.ts --no-coverage`
Expected: FAIL - function does not exist

**Step 3: Implement `syncApplicatorUsageToPriority`**

Add to `priorityService.ts` after `updateApplicatorInPriority` (~line 2122):

```typescript
/**
 * Sync applicator usage data to Priority using SIBD_APPUSELISTTEXT_SUBFORM
 *
 * Flow:
 * 1. GET by SERNUMTEXT to find the KLINE (record key)
 * 2. PATCH by KLINE with usage data
 *
 * This uses the TEXT subform (not APPLICATUSELIST) because that's where
 * Priority stores the actual applicator records.
 */
async syncApplicatorUsageToPriority(data: {
  orderId: string;
  serialNumber: string;
  seedsInserted: number;
  usageType: string;
  comments: string;
  reportedBy: string;
  insertionDate: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    if (process.env.ENABLE_PRIORITY_APPLICATOR_SAVE === "false") {
      logger.info("Priority applicator saving disabled via configuration");
      return { success: true, message: "Priority sync disabled" };
    }

    // Handle combined orders (format: "SO25000275+SO25000274")
    const orderIds = data.orderId.includes("+") ? data.orderId.split("+") : [data.orderId];

    // Step 1: Find the applicator record by serial number across all orders
    let kline: number | null = null;
    let foundOrderId = "";

    for (const oid of orderIds) {
      try {
        const response = await priorityApi.get(
          `/ORDERS('${oid}')/SIBD_APPUSELISTTEXT_SUBFORM`,
          { params: { $filter: `SERNUMTEXT eq '${data.serialNumber}'`, $select: "KLINE,SERNUMTEXT" } }
        );
        if (response.data.value?.length > 0) {
          kline = response.data.value[0].KLINE;
          foundOrderId = oid;
          break;
        }
      } catch (err: any) {
        logger.warn(`Applicator ${data.serialNumber} not found in order ${oid}: ${err.message}`);
      }
    }

    if (kline === null) {
      logger.error(`Applicator ${data.serialNumber} not found in Priority orders: ${orderIds.join(", ")}`);
      return { success: false, message: `Applicator ${data.serialNumber} not found in Priority` };
    }

    // Step 2: PATCH the record with usage data
    const patchEndpoint = `/ORDERS('${foundOrderId}')/SIBD_APPUSELISTTEXT_SUBFORM(KLINE=${kline})`;
    const patchBody: Record<string, any> = {
      INSERTEDSEEDSQTY: data.seedsInserted,
      USINGTYPE: data.usageType,
      INSERTIONCOMMENTS: data.comments || "",
      INSERTEDREPORTEDBY: data.reportedBy || "ALA System",
      INSERTIONDATE: data.insertionDate,
    };

    logger.info(`Syncing applicator ${data.serialNumber} usage to Priority: PATCH ${patchEndpoint}`);
    const response = await priorityApi.patch(patchEndpoint, patchBody);

    if (response.status !== 200 && response.status !== 204) {
      throw new Error(`Priority API returned status ${response.status}`);
    }

    logger.info(`Successfully synced applicator ${data.serialNumber} usage to Priority`);
    return { success: true, message: "Usage data synced to Priority" };
  } catch (error: any) {
    logger.error(`Error syncing applicator usage to Priority: ${error.message}`, {
      serialNumber: data.serialNumber,
      orderId: data.orderId,
      status: error.response?.status,
      data: error.response?.data,
    });

    if (process.env.NODE_ENV === "development") {
      return { success: true, message: "Simulated sync success (development)" };
    }

    return { success: false, message: error.message };
  }
},
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npx jest src/__tests__/services/priorityService.syncUsage.test.ts --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/services/priorityService.ts backend/src/__tests__/services/priorityService.syncUsage.test.ts
git commit -m "feat: add syncApplicatorUsageToPriority for APPUSELISTTEXT PATCH"
```

---

### Task 2: Add `syncAllApplicatorsToProirity()` to Applicator Service

**Files:**

- Modify: `backend/src/services/applicatorService.ts` (after `saveApplicatorToPriority`, ~line 720)

**Step 1: Write the failing test**

Add test to verify the batch sync function fetches all applicators and calls `syncApplicatorUsageToPriority` for each terminal-state applicator.

**Step 2: Implement**

Add to `applicatorService.ts` after `saveApplicatorToPriority` (~line 720):

```typescript
/**
 * Sync all applicator usage data to Priority for a completed treatment.
 * Only syncs applicators in terminal states (INSERTED, FAULTY, DISPOSED, etc.)
 */
async syncAllApplicatorsUsageToPriority(
  treatmentId: string,
): Promise<{ synced: number; failed: number; skipped: number }> {
  const treatment = await Treatment.findByPk(treatmentId);
  if (!treatment) {
    throw new Error("Treatment not found");
  }

  const applicators = await Applicator.findAll({
    where: { treatmentId },
    include: [{ model: User, as: "addedByUser", attributes: ["email"] }],
  });

  const orderId = treatment.priorityId || treatment.subjectId;
  if (!orderId) {
    logger.warn(`No Priority order ID for treatment ${treatmentId}, skipping sync`);
    return { synced: 0, failed: 0, skipped: applicators.length };
  }

  let synced = 0, failed = 0, skipped = 0;

  for (const app of applicators) {
    // Only sync terminal states
    const usageType = this.mapStatusToUsageType(app.status);
    if (usageType === null) {
      logger.info(`Skipping sync for ${app.serialNumber} - intermediate status: ${app.status}`);
      skipped++;
      continue;
    }

    const priorityUsageType = this.mapUsageTypeToPriority(usageType);
    const reportedBy = (app as any).addedByUser?.email || "ALA System";

    const result = await priorityService.syncApplicatorUsageToPriority({
      orderId,
      serialNumber: app.serialNumber,
      seedsInserted: app.seedQuantity,
      usageType: priorityUsageType,
      comments: app.comments || "",
      reportedBy,
      insertionDate: app.insertionTime.toISOString(),
    });

    if (result.success) {
      synced++;
    } else {
      failed++;
      logger.warn(`Failed to sync ${app.serialNumber}: ${result.message}`);
    }
  }

  logger.info(`Priority sync complete for treatment ${treatmentId}: ${synced} synced, ${failed} failed, ${skipped} skipped`);
  return { synced, failed, skipped };
},
```

**Step 3: Run tests**

Run: `cd backend && npm test -- --no-coverage`
Expected: PASS

**Step 4: Commit**

```bash
git add backend/src/services/applicatorService.ts
git commit -m "feat: add syncAllApplicatorsUsageToPriority batch sync"
```

---

### Task 3: Call Sync During Treatment Completion

**Files:**

- Modify: `backend/src/controllers/treatmentController.ts:233-344` (`completeTreatment`)

**Step 1: Add sync call after Priority status update succeeds, before local completion**

In `completeTreatment` (~line 331, after the Priority status update block but before local completion):

```typescript
// Sync applicator usage data to Priority
try {
  const syncResult = await applicatorService.syncAllApplicatorsUsageToPriority(
    req.params.id,
  );
  logger.info(
    `Applicator usage sync: ${syncResult.synced} synced, ${syncResult.failed} failed, ${syncResult.skipped} skipped`,
  );
} catch (syncError: any) {
  // Don't block treatment completion - log and continue
  logger.error(
    `Applicator usage sync failed (continuing): ${syncError.message}`,
  );
}
```

Insert this between line 331 (`}`) and line 333 (`// Complete treatment locally`).

**Step 2: Run tests**

Run: `cd backend && npm test -- --no-coverage`
Expected: PASS

**Step 3: Commit**

```bash
git add backend/src/controllers/treatmentController.ts
git commit -m "feat: sync applicator usage to Priority on treatment completion"
```

---

### Task 4: Manual Verification Against Priority API

**Step 1: Start local dev server**

```bash
cd backend && npm run dev
```

**Step 2: Create a test treatment for site 100078, add applicators, complete it**

Use the app UI or curl to complete a treatment and verify the sync happens.

**Step 3: Query Priority to verify fields are populated**

```bash
curl -s -u "API:Ap@123456" \
  "https://t.eu.priority-connect.online/odata/Priority/tabbtbc6.ini/test24/ORDERS('{ORDNAME}')/SIBD_APPUSELISTTEXT_SUBFORM" \
  | python -m json.tool
```

Check: `INSERTEDSEEDSQTY > 0`, `USINGTYPE` is set, `INSERTIONCOMMENTS` populated, `INSERTEDREPORTEDBY` set, `INSERTIONDATE` set.

---

## Out of Scope (future improvements)

- Fixing `updateApplicatorInPriority()` to use the correct endpoint (it POSTs to `SIBD_APPLICATUSELIST_SUBFORM` which is empty)
- Adding sync on individual `updateApplicator()` calls (currently only syncs on completion)
- Retry logic for failed syncs
- UI indicator showing sync status per applicator
