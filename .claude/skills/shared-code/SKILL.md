# Shared Code Skill

Before writing any code, consult the shared utilities reference to avoid duplicating existing functionality.

## Reference File
See `/.claude/SHARED_UTILITIES.md` for the complete list of shared types, utilities, and anti-patterns.

## Quick Reference

### Shared Types (Import from `@shared/types`)
- `Treatment`, `TreatmentType`, `ContinuationEligibility`
- `Applicator`, `ApplicatorGroup`, `ApplicatorValidationResult`
- `ApplicatorStatus` and all status constants

### Status Helpers (Import from `shared/applicatorStatuses.ts`)
- `isTerminalStatus()`, `isInProgressStatus()`
- `requiresComment()`, `requiresAdminForConflict()`
- `getStatusLabel()`, `getStatusEmoji()`, `getStatusColors()`
- Status transition maps: `PANC_PROS_TRANSITIONS`, `SKIN_TRANSITIONS`

### Backend Utilities
- Authorization: `requireTreatmentAccess()`, `hasSiteAccess()`, `isAlphaTauAdmin()`
- Priority ID: `parseOrderIds()`, `getFirstOrderId()`, `isCombinedTreatment()`
- Finalization: `mergeApplicatorsForPdf()`, `finalizeAndSendPdf()`

### Frontend Context Methods
- `clearTreatment()` - Never manually clear sessionStorage
- `getFilteredAvailableApplicators()` - Single source of truth for filtering
- `sortApplicatorsByStatus()` - Consistent status ordering

## Anti-Patterns to Avoid

1. **DON'T** define local interfaces that exist in shared types
2. **DON'T** duplicate sessionStorage operations - use context methods
3. **DON'T** duplicate admin checks - use `isAlphaTauAdmin()`
4. **DON'T** parse Priority IDs manually - use `priorityIdParser`
5. **DON'T** duplicate PDF finalization - use `finalizationHelpers`

## When to Update This Reference

If you create a new shared utility:
1. Add it to `shared/` directory
2. Document it in `/.claude/SHARED_UTILITIES.md`
3. Export from appropriate index file
