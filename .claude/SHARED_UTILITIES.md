# Shared Utilities Reference

Consult before writing new code. Import from these — never duplicate.

## Types (`shared/types/`)

- `treatment.types.ts`: Treatment, TreatmentType, ContinuationEligibility, TreatmentFilterParams, ProgressStats, RemovalProgress
- `applicator.types.ts`: Applicator, ApplicatorGroup, ApplicatorValidationResult, ApplicatorSummary, UsageType, AttachmentSyncStatus
- `index.ts`: Single import point. Frontend: `from "@shared/types"`, Backend: `from "../../shared/types"`

## Applicator Statuses (`shared/applicatorStatuses.ts`)

- 8 statuses: SEALED, OPENED, LOADED, INSERTED, FAULTY, DISPOSED, DISCHARGED, DEPLOYMENT_FAILURE
- Groupings: TERMINAL_STATUSES, IN_PROGRESS_STATUSES, FAILURE_STATUSES, COMMENT_REQUIRED_STATUSES, ADMIN_REQUIRED_STATUSES
- Transitions: PANC_PROS_TRANSITIONS, SKIN_TRANSITIONS, GENERIC_TRANSITIONS
- UI: STATUS_LABELS, STATUS_COLORS, STATUS_EMOJIS, STATUS_DESCRIPTIONS, LIST_ITEM_COLORS
- Helpers: isTerminalStatus, isInProgressStatus, requiresComment, requiresAdminForConflict, getStatusLabel, getStatusEmoji, getStatusColors, getListItemColor

## Crypto (`shared/crypto.utils.ts`)

computeHashNode, computeHashWeb, normalizeForHash, compareHashes

## Auth (`backend/src/utils/authorizationUtils.ts`)

- Treatment: requireTreatmentAccess, hasTreatmentAccess, denyIfNoTreatmentAccess
- Admin: isAlphaTauAdmin (position 99), isAdmin
- Site: hasSiteAccess, requireSiteAccess, getUserSiteCodes
- Context: buildUserContext, buildUserContextFromUser, UserContext

## Priority ID (`backend/src/utils/priorityIdParser.ts`)

parseOrderIds, getFirstOrderId, isCombinedTreatment

## Finalization (`backend/src/utils/finalizationHelpers.ts`)

- Types: ApplicatorUsageType, ApplicatorForPdf, SignatureDetails, FinalizationResult
- Functions: mergeApplicatorsForPdf, finalizeAndSendPdf

## Frontend Contexts

- TreatmentContext: clearTreatment, getFilteredAvailableApplicators, sortApplicatorsByStatus, isPancreasOrProstate
- OfflineContext: syncNow, isDownloaded, downloadTreatment
- syncService: getOrCreateDeviceId

## Rules

- Always import types from `@shared/types` — never define locally
- Use `clearTreatment()` — never manually clear sessionStorage
- Use `isAlphaTauAdmin(user)` — never check position === 99 directly
- Use `parseOrderIds()` — never manually parse Priority IDs
- Use `mergeApplicatorsForPdf` + `finalizeAndSendPdf` — never inline PDF logic
