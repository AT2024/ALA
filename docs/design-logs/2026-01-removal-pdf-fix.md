# DL-004: Fix PDF Generation for Removal Procedure Report

**Status**: Implemented
**Created**: 2026-01-11
**Author**: Claude (requested by Amitai)

## Context

The Removal Procedure Report (FR-4001-01E) was generating incorrect data:
1. Source Removal Tracking table showed all applicators as removed
2. Total showed 23/20 (impossible - more removed than inserted)
3. User only removed 2 applicators + 3 individual sources, expected 5/20

## Root Cause Analysis

After 5 phases of debugging, the root cause was found:

**File:** `frontend/src/components/Dialogs/SignatureModal.tsx`

**THE BUG:**
```typescript
usageType: app.isRemoved ? 'full' as const : (app.usageType || 'none' as const)
```

**Problem Flow:**
1. Backend returns applicators with `usageType: 'full'` (from test data USINGTYPE field)
2. Backend returns `isRemoved: false` for ALL applicators
3. User toggles some applicators as removed → `isRemoved: true`
4. SignatureModal mapping for non-removed: `app.usageType || 'none'` → Since `app.usageType` is `'full'`, stays `'full'`
5. ALL applicators end up with `usageType: 'full'` → 20 + 3 individual = 23

## Decision

**Fix:** Always use `'none'` for non-removed applicators, ignoring existing `usageType`:

```typescript
usageType: app.isRemoved ? 'full' as const : 'none' as const
```

## Implementation Notes

**Files Modified:**
- `frontend/src/components/Dialogs/SignatureModal.tsx:50-53` - Simplified mapping logic
- `backend/src/controllers/treatmentController.ts:1033-1048, 1137-1148` - Use frontend data for removal treatments

**Commits:**
- `7d9d6f3` fix(pdf): correct removal count by ignoring test data usageType

## Results

### Outcome
- Removal PDF now correctly shows only user-selected removals
- Test: 2 applicators removed + 3 individual = 5/20 total (verified)

### Phases Completed
1. **Phase 1**: Fixed SignatureModal to use `applicators` instead of `availableApplicators` for removal
2. **Phase 2**: Added `isRemoved → usageType` mapping
3. **Phase 3**: Fixed backend `mergeApplicatorsForPdf()` to preserve `usageType`
4. **Phase 4**: Fixed backend to use frontend data instead of test data with hardcoded `usageType: 'full'`
5. **Phase 5**: Fixed frontend to ignore existing `usageType` for non-removed applicators

### Lessons Learned
- Test data with hardcoded values can mask bugs in production logic
- The `usageType` field has different meanings in different contexts (insertion vs removal)
- For removal treatments, `usageType` should be derived solely from `isRemoved` boolean
