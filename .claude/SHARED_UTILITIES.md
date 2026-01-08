# Shared Utilities Reference

This document lists shared code utilities that exist in the codebase to prevent duplicate code creation.

## Shared Types (`shared/types/`)

### Treatment Types (`shared/types/treatment.types.ts`)
- **`Treatment`** - Canonical treatment interface with all fields
- **`TreatmentType`** - Union type for treatment types
- **`ContinuationEligibility`** - Treatment continuation info
- **`TreatmentFilterParams`** - Query parameters for treatment filters
- **`ProgressStats`** - Treatment progress statistics
- **`RemovalProgress`** - Removal procedure progress

### Applicator Types (`shared/types/applicator.types.ts`)
- **`Applicator`** - Canonical applicator interface with all fields
- **`ApplicatorGroup`** - Grouping by seed count for UI display
- **`ApplicatorValidationResult`** - Priority API validation response
- **`ApplicatorSummary`** - Dashboard summary stats
- **`UsageType`** - Legacy 3-state type ('full' | 'faulty' | 'none')
- **`AttachmentSyncStatus`** - File sync status

### Index (`shared/types/index.ts`)
Single import point for all types and re-exports from `applicatorStatuses.ts`

**Usage:**
```typescript
// Frontend
import { Treatment, Applicator, ApplicatorGroup } from '@shared/types';

// Backend
import { Treatment, Applicator } from '../../shared/types';
```

## Applicator Status Constants (`shared/applicatorStatuses.ts`)

### Status Values
- **`APPLICATOR_STATUSES`** - All 8 status constants (SEALED, OPENED, LOADED, INSERTED, FAULTY, DISPOSED, DISCHARGED, DEPLOYMENT_FAILURE)
- **`ApplicatorStatus`** - TypeScript type derived from constants

### Status Groupings
- **`TERMINAL_STATUSES`** - No further transitions (INSERTED, FAULTY, DISPOSED, DISCHARGED, DEPLOYMENT_FAILURE)
- **`IN_PROGRESS_STATUSES`** - Active workflow (SEALED, OPENED, LOADED)
- **`FAILURE_STATUSES`** - Terminal failures (all except INSERTED)
- **`COMMENT_REQUIRED_STATUSES`** - Require explanation (all failure statuses)
- **`ADMIN_REQUIRED_STATUSES`** - Require admin for conflict resolution (INSERTED, FAULTY, DISPOSED, DEPLOYMENT_FAILURE)

### Transition Maps
- **`PANC_PROS_TRANSITIONS`** - Pancreas/prostate 3-stage workflow
- **`SKIN_TRANSITIONS`** - Simplified skin workflow
- **`GENERIC_TRANSITIONS`** - Fallback for unknown types

### UI Constants
- **`STATUS_LABELS`** - Human-readable labels
- **`STATUS_DESCRIPTIONS`** - Detailed descriptions
- **`STATUS_EMOJIS`** - Emoji icons
- **`STATUS_COLORS`** - Tailwind CSS color classes
- **`LIST_ITEM_COLORS`** - List item styling

### Helper Functions
- **`isTerminalStatus(status)`** - Check if terminal
- **`isInProgressStatus(status)`** - Check if in-progress
- **`requiresComment(status)`** - Check if comment needed
- **`requiresAdminForConflict(status)`** - Check if admin needed for conflicts
- **`getStatusLabel(status)`** - Get display label
- **`getStatusEmoji(status)`** - Get emoji
- **`getStatusColors(status)`** - Get color config
- **`getListItemColor(status)`** - Get list item classes

## Crypto Utilities (`shared/crypto.utils.ts`)

- **`computeHashNode(data)`** - SHA-256 hash (Node.js backend)
- **`computeHashWeb(data)`** - SHA-256 hash (Web Crypto API)
- **`normalizeForHash(data)`** - Normalize object for consistent hashing
- **`compareHashes(hash1, hash2)`** - Constant-time hash comparison

## Backend Authorization (`backend/src/utils/authorizationUtils.ts`)

### Treatment Access
- **`requireTreatmentAccess(treatment, user)`** - Throws ForbiddenError if no access
- **`hasTreatmentAccess(treatment, user)`** - Returns boolean
- **`denyIfNoTreatmentAccess(res, treatment, user)`** - Legacy helper

### Position 99 (Alpha Tau Admin)
- **`isAlphaTauAdmin(user)`** - Check if user has position code 99
- **`isAdmin(user)`** - Alias for isAlphaTauAdmin

### Site Access
- **`hasSiteAccess(user, site)`** - Check if user has access to site
- **`requireSiteAccess(user, site)`** - Throws ForbiddenError if no access
- **`getUserSiteCodes(user)`** - Get user's accessible sites

### User Context
- **`buildUserContext(req)`** - Build context for Priority API calls
- **`buildUserContextFromUser(user)`** - Build context from user object
- **`UserContext`** - Interface for Priority API context

## Priority ID Parser (`backend/src/utils/priorityIdParser.ts`)

- **`parseOrderIds(priorityId)`** - Parse JSON array or single ID to array
- **`getFirstOrderId(priorityId)`** - Get first order ID
- **`isCombinedTreatment(priorityId)`** - Check if multiple orders

**Usage:**
```typescript
import { parseOrderIds, getFirstOrderId } from '../utils/priorityIdParser';

// Single ID: "SO25000001" → ["SO25000001"]
// JSON array: '["SO25000001", "SO25000002"]' → ["SO25000001", "SO25000002"]
const orderIds = parseOrderIds(treatment.priorityId);
```

## Finalization Helpers (`backend/src/utils/finalizationHelpers.ts`)

Extracted from treatmentController.ts to eliminate ~100 lines of duplicate code in verifyAndFinalize() and autoFinalize().

### Types
- **`ApplicatorUsageType`** - 'full' | 'faulty' | 'none' | 'sealed'
- **`ApplicatorForPdf`** - Applicator structure for PDF generation
- **`SignatureDetails`** - Signature info (type, name, email, position, timestamp)
- **`FinalizationResult`** - Result with pdfId and emailStatus

### Functions
- **`mergeApplicatorsForPdf(processed, available)`** - Merge processed and unused applicators for PDF
- **`finalizeAndSendPdf(treatment, applicators, signature, continuationInfo?)`** - Generate PDF, store in DB, send email

**Usage:**
```typescript
import {
  mergeApplicatorsForPdf,
  finalizeAndSendPdf,
  SignatureDetails,
} from '../utils/finalizationHelpers';

const allApplicators = mergeApplicatorsForPdf(processedApplicators, availableApplicators);

const signatureDetails: SignatureDetails = {
  type: 'hospital_auto',
  signerName,
  signerEmail: req.user.email,
  signerPosition,
  signedAt: new Date(),
};

const { pdfId, emailStatus } = await finalizeAndSendPdf(
  treatment,
  allApplicators,
  signatureDetails,
  continuationInfo
);
```

## Frontend Context Methods

### TreatmentContext
- **`clearTreatment()`** - Clear all treatment data and sessionStorage
- **`getFilteredAvailableApplicators()`** - Central filtering (single source of truth)
- **`sortApplicatorsByStatus(applicators)`** - Sort by status order
- **`isPancreasOrProstate()`** - Check treatment type

### OfflineContext
- **`syncNow()`** - Trigger manual sync
- **`isDownloaded(treatmentId)`** - Check if treatment is offline
- **`downloadTreatment(treatmentId)`** - Download for offline use

## Sync Service (`frontend/src/services/syncService.ts`)

### Device ID Helper
- **`getOrCreateDeviceId()`** - Get or create unique device ID for offline sync

**Usage:**
```typescript
import { getOrCreateDeviceId } from '@/services/syncService';
const deviceId = getOrCreateDeviceId(); // Returns persisted or new ID
```

---

## Anti-Patterns to Avoid

### DON'T: Define types locally
```typescript
// BAD - duplicates shared type
interface Applicator {
  id: string;
  serialNumber: string;
  // ...
}
```

### DO: Import from shared
```typescript
// GOOD - single source of truth
import type { Applicator } from '@shared/types';
```

### DON'T: Duplicate sessionStorage operations
```typescript
// BAD - duplicates TreatmentContext logic
sessionStorage.removeItem('currentTreatment');
sessionStorage.removeItem('processedApplicators');
```

### DO: Use context methods
```typescript
// GOOD - single source of truth
const { clearTreatment } = useTreatment();
clearTreatment();
```

### DON'T: Duplicate admin checks
```typescript
// BAD - duplicates authorizationUtils
const isAlphaTau = Number(positionCode) === 99;
```

### DO: Use shared utilities
```typescript
// GOOD - single source of truth
import { isAlphaTauAdmin } from '../utils/authorizationUtils';
if (isAlphaTauAdmin(req.user)) { ... }
```

### DON'T: Duplicate Priority ID parsing
```typescript
// BAD - duplicates priorityIdParser
let orderIds: string[] = [];
if (treatment.priorityId) {
  try {
    const parsed = JSON.parse(treatment.priorityId);
    orderIds = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    orderIds = [treatment.priorityId];
  }
}
```

### DO: Use priorityIdParser
```typescript
// GOOD - single source of truth
import { parseOrderIds } from '../utils/priorityIdParser';
const orderIds = parseOrderIds(treatment.priorityId);
```

### DON'T: Duplicate PDF finalization logic
```typescript
// BAD - duplicates finalizationHelpers (~60 lines each time)
const processedSerials = new Set(processedApplicators.map(a => a.serialNumber));
const unusedApplicators = availableApplicators.filter(...).map(...);
const allApplicators = [...processed, ...unused];
const pdfBuffer = await generateTreatmentPdf(...);
const treatmentPdf = await TreatmentPdf.create(...);
// ... email sending logic
```

### DO: Use finalizationHelpers
```typescript
// GOOD - single source of truth
import { mergeApplicatorsForPdf, finalizeAndSendPdf } from '../utils/finalizationHelpers';
const allApplicators = mergeApplicatorsForPdf(processed, available);
const { pdfId, emailStatus } = await finalizeAndSendPdf(treatment, allApplicators, signature);
```

---

*Last Updated: 2026-01-05*
