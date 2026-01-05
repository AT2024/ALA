/**
 * Applicator Status Constants - Single Source of Truth
 *
 * This file contains ALL applicator status definitions, transitions, labels, and colors.
 * Both frontend and backend import from this file to ensure consistency.
 *
 * To add/modify a status:
 * 1. Update APPLICATOR_STATUSES object
 * 2. Update relevant arrays (TERMINAL_STATUSES, IN_PROGRESS_STATUSES)
 * 3. Update transitions maps (PANC_PROS_TRANSITIONS, SKIN_TRANSITIONS, GENERIC_TRANSITIONS)
 * 4. Update STATUS_LABELS and STATUS_COLORS
 */

// =============================================================================
// STATUS DEFINITIONS
// =============================================================================

/**
 * All applicator statuses as a const object for type safety
 * Using 'as const' ensures TypeScript treats these as literal types
 */
export const APPLICATOR_STATUSES = {
  SEALED: 'SEALED',
  OPENED: 'OPENED',
  LOADED: 'LOADED',
  INSERTED: 'INSERTED',
  FAULTY: 'FAULTY',
  DISPOSED: 'DISPOSED',
  DISCHARGED: 'DISCHARGED',
  DEPLOYMENT_FAILURE: 'DEPLOYMENT_FAILURE',
} as const;

/**
 * Type for applicator status - derived from APPLICATOR_STATUSES
 */
export type ApplicatorStatus = typeof APPLICATOR_STATUSES[keyof typeof APPLICATOR_STATUSES];

/**
 * Array of all valid status values (for validation)
 */
export const ALL_STATUSES: ApplicatorStatus[] = Object.values(APPLICATOR_STATUSES);

// =============================================================================
// STATUS GROUPINGS
// =============================================================================

/**
 * Terminal statuses - applicators cannot transition from these states
 * These are removed from "Choose from List" and shown in "Use List Table"
 */
export const TERMINAL_STATUSES: ApplicatorStatus[] = [
  APPLICATOR_STATUSES.INSERTED,
  APPLICATOR_STATUSES.FAULTY,
  APPLICATOR_STATUSES.DISPOSED,
  APPLICATOR_STATUSES.DISCHARGED,
  APPLICATOR_STATUSES.DEPLOYMENT_FAILURE,
];

/**
 * In-progress statuses - applicators in active workflow
 * These stay in "Choose from List" for continued processing
 */
export const IN_PROGRESS_STATUSES: ApplicatorStatus[] = [
  APPLICATOR_STATUSES.SEALED,
  APPLICATOR_STATUSES.OPENED,
  APPLICATOR_STATUSES.LOADED,
];

/**
 * Success terminal status - shown in GREEN
 */
export const SUCCESS_STATUS: ApplicatorStatus = APPLICATOR_STATUSES.INSERTED;

/**
 * Failure terminal statuses - shown in BLACK
 */
export const FAILURE_STATUSES: ApplicatorStatus[] = [
  APPLICATOR_STATUSES.FAULTY,
  APPLICATOR_STATUSES.DISPOSED,
  APPLICATOR_STATUSES.DISCHARGED,
  APPLICATOR_STATUSES.DEPLOYMENT_FAILURE,
];

/**
 * Medical statuses that require admin resolution when conflicts occur
 * These statuses have patient safety implications and cannot be auto-resolved
 * Used in offline sync conflict resolution
 */
export const ADMIN_REQUIRED_STATUSES: ApplicatorStatus[] = [
  APPLICATOR_STATUSES.INSERTED,
  APPLICATOR_STATUSES.FAULTY,
  APPLICATOR_STATUSES.DISPOSED,
  APPLICATOR_STATUSES.DEPLOYMENT_FAILURE,
];

/**
 * Statuses that require comments (for documentation/audit purposes)
 * All terminal failure statuses require a comment to explain why the applicator
 * was not used successfully (for medical audit trail)
 */
export const COMMENT_REQUIRED_STATUSES: ApplicatorStatus[] = [
  APPLICATOR_STATUSES.FAULTY,
  APPLICATOR_STATUSES.DISPOSED,
  APPLICATOR_STATUSES.DISCHARGED,
  APPLICATOR_STATUSES.DEPLOYMENT_FAILURE,
];

// =============================================================================
// TREATMENT-SPECIFIC TRANSITIONS
// =============================================================================

/**
 * Pancreas/Prostate 3-stage workflow transitions
 * Stage 1: SEALED → OPENED
 * Stage 2: OPENED → LOADED, FAULTY, DISPOSED
 * Stage 3: LOADED → INSERTED, DISCHARGED, DEPLOYMENT_FAILURE
 */
export const PANC_PROS_TRANSITIONS: Record<ApplicatorStatus, ApplicatorStatus[]> = {
  [APPLICATOR_STATUSES.SEALED]: [APPLICATOR_STATUSES.OPENED],
  [APPLICATOR_STATUSES.OPENED]: [
    APPLICATOR_STATUSES.LOADED,
    APPLICATOR_STATUSES.FAULTY,
    APPLICATOR_STATUSES.DISPOSED,
  ],
  [APPLICATOR_STATUSES.LOADED]: [
    APPLICATOR_STATUSES.INSERTED,
    APPLICATOR_STATUSES.DISCHARGED,
    APPLICATOR_STATUSES.DEPLOYMENT_FAILURE,
  ],
  // Terminal states - no transitions allowed
  [APPLICATOR_STATUSES.INSERTED]: [],
  [APPLICATOR_STATUSES.FAULTY]: [],
  [APPLICATOR_STATUSES.DISPOSED]: [],
  [APPLICATOR_STATUSES.DISCHARGED]: [],
  [APPLICATOR_STATUSES.DEPLOYMENT_FAILURE]: [],
};

/**
 * Skin workflow transitions - simplified, no OPENED/LOADED stages
 * SEALED → INSERTED, FAULTY
 */
export const SKIN_TRANSITIONS: Record<ApplicatorStatus, ApplicatorStatus[]> = {
  [APPLICATOR_STATUSES.SEALED]: [
    APPLICATOR_STATUSES.INSERTED,
    APPLICATOR_STATUSES.FAULTY,
  ],
  // All others are terminal or not applicable
  [APPLICATOR_STATUSES.OPENED]: [],
  [APPLICATOR_STATUSES.LOADED]: [],
  [APPLICATOR_STATUSES.INSERTED]: [],
  [APPLICATOR_STATUSES.FAULTY]: [],
  [APPLICATOR_STATUSES.DISPOSED]: [],
  [APPLICATOR_STATUSES.DISCHARGED]: [],
  [APPLICATOR_STATUSES.DEPLOYMENT_FAILURE]: [],
};

/**
 * Generic/fallback transitions (for unknown treatment types)
 */
export const GENERIC_TRANSITIONS: Record<ApplicatorStatus, ApplicatorStatus[]> = {
  [APPLICATOR_STATUSES.SEALED]: [APPLICATOR_STATUSES.OPENED, APPLICATOR_STATUSES.FAULTY],
  [APPLICATOR_STATUSES.OPENED]: [
    APPLICATOR_STATUSES.LOADED,
    APPLICATOR_STATUSES.FAULTY,
    APPLICATOR_STATUSES.DISPOSED,
  ],
  [APPLICATOR_STATUSES.LOADED]: [
    APPLICATOR_STATUSES.INSERTED,
    APPLICATOR_STATUSES.FAULTY,
    APPLICATOR_STATUSES.DEPLOYMENT_FAILURE,
  ],
  [APPLICATOR_STATUSES.INSERTED]: [APPLICATOR_STATUSES.DISCHARGED, APPLICATOR_STATUSES.DISPOSED],
  [APPLICATOR_STATUSES.FAULTY]: [APPLICATOR_STATUSES.DISPOSED, APPLICATOR_STATUSES.DISCHARGED],
  [APPLICATOR_STATUSES.DEPLOYMENT_FAILURE]: [APPLICATOR_STATUSES.DISPOSED, APPLICATOR_STATUSES.FAULTY],
  [APPLICATOR_STATUSES.DISPOSED]: [],
  [APPLICATOR_STATUSES.DISCHARGED]: [],
};

// =============================================================================
// UI DISPLAY LABELS
// =============================================================================

/**
 * Human-readable labels for each status
 */
export const STATUS_LABELS: Record<ApplicatorStatus, string> = {
  [APPLICATOR_STATUSES.SEALED]: 'Sealed',
  [APPLICATOR_STATUSES.OPENED]: 'Opened',
  [APPLICATOR_STATUSES.LOADED]: 'Loaded',
  [APPLICATOR_STATUSES.INSERTED]: 'Inserted',
  [APPLICATOR_STATUSES.FAULTY]: 'Faulty',
  [APPLICATOR_STATUSES.DISPOSED]: 'Disposed',
  [APPLICATOR_STATUSES.DISCHARGED]: 'Discharged',
  [APPLICATOR_STATUSES.DEPLOYMENT_FAILURE]: 'Deployment Failure',
};

/**
 * Detailed descriptions for dropdown options
 */
export const STATUS_DESCRIPTIONS: Record<ApplicatorStatus, string> = {
  [APPLICATOR_STATUSES.SEALED]: 'unopened',
  [APPLICATOR_STATUSES.OPENED]: 'package opened',
  [APPLICATOR_STATUSES.LOADED]: 'ready for insertion',
  [APPLICATOR_STATUSES.INSERTED]: 'successfully deployed',
  [APPLICATOR_STATUSES.FAULTY]: 'defective equipment',
  [APPLICATOR_STATUSES.DISPOSED]: 'discarded',
  [APPLICATOR_STATUSES.DISCHARGED]: 'sources expelled',
  [APPLICATOR_STATUSES.DEPLOYMENT_FAILURE]: 'failed deployment',
};

/**
 * Emoji icons for status display
 */
export const STATUS_EMOJIS: Record<ApplicatorStatus, string> = {
  [APPLICATOR_STATUSES.SEALED]: '📦',
  [APPLICATOR_STATUSES.OPENED]: '📂',
  [APPLICATOR_STATUSES.LOADED]: '🔧',
  [APPLICATOR_STATUSES.INSERTED]: '✅',
  [APPLICATOR_STATUSES.FAULTY]: '❌',
  [APPLICATOR_STATUSES.DISPOSED]: '🗑️',
  [APPLICATOR_STATUSES.DISCHARGED]: '💨',
  [APPLICATOR_STATUSES.DEPLOYMENT_FAILURE]: '⚠️',
};

// =============================================================================
// UI COLOR CLASSES (Tailwind CSS)
// =============================================================================

/**
 * Color configuration for each status
 * Used for both row backgrounds and badge styling
 */
export const STATUS_COLORS = {
  [APPLICATOR_STATUSES.SEALED]: {
    bg: 'bg-white',
    bgLight: 'bg-gray-50',
    text: 'text-gray-800',
    border: 'border-gray-300',
    row: 'bg-white',
  },
  [APPLICATOR_STATUSES.OPENED]: {
    bg: 'bg-red-50',
    bgLight: 'bg-red-50',
    text: 'text-red-600',
    border: 'border-red-300',
    row: 'bg-red-50',
  },
  [APPLICATOR_STATUSES.LOADED]: {
    bg: 'bg-yellow-50',
    bgLight: 'bg-yellow-50',
    text: 'text-yellow-600',
    border: 'border-yellow-300',
    row: 'bg-yellow-50',
  },
  [APPLICATOR_STATUSES.INSERTED]: {
    bg: 'bg-green-50',
    bgLight: 'bg-green-50',
    text: 'text-green-600',
    border: 'border-green-300',
    row: 'bg-green-50',
  },
  [APPLICATOR_STATUSES.FAULTY]: {
    bg: 'bg-gray-900',
    bgLight: 'bg-gray-900',
    text: 'text-white',
    border: 'border-gray-900',
    row: 'bg-gray-900 text-white',
  },
  [APPLICATOR_STATUSES.DISPOSED]: {
    bg: 'bg-gray-900',
    bgLight: 'bg-gray-900',
    text: 'text-white',
    border: 'border-gray-900',
    row: 'bg-gray-900 text-white',
  },
  [APPLICATOR_STATUSES.DISCHARGED]: {
    bg: 'bg-gray-900',
    bgLight: 'bg-gray-900',
    text: 'text-white',
    border: 'border-gray-900',
    row: 'bg-gray-900 text-white',
  },
  [APPLICATOR_STATUSES.DEPLOYMENT_FAILURE]: {
    bg: 'bg-gray-900',
    bgLight: 'bg-gray-900',
    text: 'text-white',
    border: 'border-gray-900',
    row: 'bg-gray-900 text-white',
  },
} as const;

/**
 * List item color classes for "Choose from List" dropdown
 */
export const LIST_ITEM_COLORS: Record<ApplicatorStatus, string> = {
  [APPLICATOR_STATUSES.SEALED]: 'bg-gray-50 border-l-4 border-l-gray-400',
  [APPLICATOR_STATUSES.OPENED]: 'bg-red-50 border-l-4 border-l-red-500',
  [APPLICATOR_STATUSES.LOADED]: 'bg-yellow-50 border-l-4 border-l-yellow-500',
  [APPLICATOR_STATUSES.INSERTED]: 'bg-green-50 border-l-4 border-l-green-500',
  [APPLICATOR_STATUSES.FAULTY]: 'bg-gray-900 text-white border-l-4 border-l-gray-900',
  [APPLICATOR_STATUSES.DISPOSED]: 'bg-gray-900 text-white border-l-4 border-l-gray-900',
  [APPLICATOR_STATUSES.DISCHARGED]: 'bg-gray-900 text-white border-l-4 border-l-gray-900',
  [APPLICATOR_STATUSES.DEPLOYMENT_FAILURE]: 'bg-gray-900 text-white border-l-4 border-l-gray-900',
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if a status is terminal (no further transitions allowed)
 */
export const isTerminalStatus = (status: ApplicatorStatus | string | null | undefined): boolean => {
  if (!status) return false;
  return TERMINAL_STATUSES.includes(status as ApplicatorStatus);
};

/**
 * Check if a status is in-progress (can still transition)
 */
export const isInProgressStatus = (status: ApplicatorStatus | string | null | undefined): boolean => {
  if (!status) return true; // No status = treat as SEALED (in-progress)
  return IN_PROGRESS_STATUSES.includes(status as ApplicatorStatus);
};

/**
 * Check if a status requires comments
 */
export const requiresComment = (status: ApplicatorStatus | string | null | undefined): boolean => {
  if (!status) return false;
  return COMMENT_REQUIRED_STATUSES.includes(status as ApplicatorStatus);
};

/**
 * Check if a status requires admin resolution when conflicts occur
 * Used in offline sync conflict detection
 */
export const requiresAdminForConflict = (status: ApplicatorStatus | string | null | undefined): boolean => {
  if (!status) return false;
  return ADMIN_REQUIRED_STATUSES.includes(status as ApplicatorStatus);
};

/**
 * Get the display label for a status
 */
export const getStatusLabel = (status: ApplicatorStatus | string | null | undefined): string => {
  if (!status) return 'Unknown';
  return STATUS_LABELS[status as ApplicatorStatus] || 'Unknown';
};

/**
 * Get the emoji for a status
 */
export const getStatusEmoji = (status: ApplicatorStatus | string | null | undefined): string => {
  if (!status) return '📦';
  return STATUS_EMOJIS[status as ApplicatorStatus] || '📦';
};

/**
 * Get color configuration for a status
 */
export const getStatusColors = (status: ApplicatorStatus | string | null | undefined) => {
  if (!status) return STATUS_COLORS[APPLICATOR_STATUSES.SEALED];
  return STATUS_COLORS[status as ApplicatorStatus] || STATUS_COLORS[APPLICATOR_STATUSES.SEALED];
};

/**
 * Get list item color classes for a status
 */
export const getListItemColor = (status: ApplicatorStatus | string | null | undefined): string => {
  if (!status) return LIST_ITEM_COLORS[APPLICATOR_STATUSES.SEALED];
  return LIST_ITEM_COLORS[status as ApplicatorStatus] || LIST_ITEM_COLORS[APPLICATOR_STATUSES.SEALED];
};
