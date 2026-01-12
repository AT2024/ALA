# DL-XXX: Count Activity Only for INSERTED Status Applicators

**Status**: Draft
**Created**: 2026-01-12
**Author**: Claude (via design command)

## Context

Currently, the activity calculation in the app includes applicators with both "INSERTED" and "FAULTY" statuses. The business requirement is to count activity **only** for applicators with INSERTED status, excluding FAULTY and all other terminal statuses.

### Current Behavior

Activity is calculated using the formula:
```
Total Activity (µCi) = Sum of Inserted Seeds × Activity Per Seed
```

The "Sum of Inserted Seeds" currently includes:
- **Full use applicators** (usageType='full' → status=INSERTED): All `seedQuantity`
- **Faulty applicators** (usageType='faulty' → status=FAULTY): Only `insertedSeedsQty` (partial seeds)

### Desired Behavior

Activity should **only** count seeds from applicators with `status === 'INSERTED'` (or `usageType === 'full'` for backward compatibility).

## Affected Locations

### Backend

1. **PDF Generation Service** - `backend/src/services/pdfGenerationService.ts`
   - Lines 740-759: `calculateSummary()` function - PRIMARY calculation
   - Lines 309-310: PDF table display

2. **Treatment Controller** - `backend/src/controllers/treatmentController.ts`
   - Lines 619-620: Removal candidates activity calculation

### Frontend

3. **Use List Page** - `frontend/src/pages/Treatment/UseList.tsx`
   - Lines 154-155: Total activity calculation using `totalDartSeedsInserted`

4. **Seed Removal Page** - `frontend/src/pages/Treatment/SeedRemoval.tsx`
   - Lines 264-266: Activity display for removal context

5. **Treatment Selection Page** - `frontend/src/pages/Treatment/TreatmentSelection.tsx`
   - Lines 596, 864: Removal candidate activity display

## Design Questions

- [x] Should activity from FAULTY applicators be completely excluded? **Yes, per user request**
- [x] Should this change be reflected in historical data/reports or only new calculations? **New calculations only - historical reports stay as-is**
- [ ] Does the PDF report need to show breakdown of excluded vs included applicators?

## Proposed Solution

Modify all activity calculation locations to filter applicators by:
- `status === 'INSERTED'` (new status field)
- OR `usageType === 'full'` (backward compatibility)

Exclude:
- `status === 'FAULTY'` or `usageType === 'faulty'`
- All other terminal statuses (DISPOSED, DISCHARGED, DEPLOYMENT_FAILURE)

## Implementation Notes

### Files to Modify

1. `backend/src/services/pdfGenerationService.ts` - Remove faulty applicator seeds from total
2. `frontend/src/pages/Treatment/UseList.tsx` - Verify `totalDartSeedsInserted` excludes faulty
3. `frontend/src/pages/Treatment/SeedRemoval.tsx` - Verify activity display logic
4. `frontend/src/pages/Treatment/TreatmentSelection.tsx` - Verify removal candidate activity

### Key Change in pdfGenerationService.ts

```typescript
// BEFORE (lines 740-745):
const totalSeeds = applicators.reduce((sum, app) => {
  if (app.usageType === 'full') return sum + (app.seedQuantity || 0);
  if (app.usageType === 'faulty') return sum + (app.insertedSeedsQty || 0);
  return sum;
}, 0);

// AFTER:
const totalSeeds = applicators.reduce((sum, app) => {
  // Only count seeds from INSERTED status applicators
  const isInserted = app.status === 'INSERTED' || app.usageType === 'full';
  if (isInserted) return sum + (app.seedQuantity || 0);
  return sum;
}, 0);
```

## Results

> To be added after implementation