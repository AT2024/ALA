/**
 * Applicator status transition rules and utilities
 * Mirrors backend validation logic from applicatorService.ts
 */

export type ApplicatorStatus =
  | 'SEALED'
  | 'OPENED'
  | 'LOADED'
  | 'INSERTED'
  | 'FAULTY'
  | 'DISPOSED'
  | 'DISCHARGED'
  | 'DEPLOYMENT_FAILURE'
  | 'UNACCOUNTED';

/**
 * Valid status transitions - EXACT copy from backend
 * Source: backend/src/services/applicatorService.ts lines 602-612
 */
const ALLOWED_TRANSITIONS: Record<ApplicatorStatus, ApplicatorStatus[]> = {
  'SEALED': ['OPENED', 'FAULTY', 'UNACCOUNTED'],
  'OPENED': ['LOADED', 'FAULTY', 'DISPOSED', 'UNACCOUNTED'],
  'LOADED': ['INSERTED', 'FAULTY', 'DEPLOYMENT_FAILURE', 'UNACCOUNTED'],
  'INSERTED': ['DISCHARGED', 'DISPOSED'],
  'FAULTY': ['DISPOSED', 'DISCHARGED'],
  'DEPLOYMENT_FAILURE': ['DISPOSED', 'FAULTY'],
  'DISPOSED': [],
  'DISCHARGED': [],
  'UNACCOUNTED': [],
};

/**
 * Pancreas/Prostate 3-step workflow transitions
 * Step 1: SEALED → OPENED
 * Step 2: OPENED → {LOADED, FAULTY, DISPOSED}
 * Step 3: LOADED → {INSERTED, DISCHARGED, DEPLOYMENT_FAILURE, UNACCOUNTED}
 */
const PANCREAS_PROSTATE_TRANSITIONS: Record<ApplicatorStatus, ApplicatorStatus[]> = {
  'SEALED': ['OPENED'],
  'OPENED': ['LOADED', 'FAULTY', 'DISPOSED'],
  'LOADED': ['INSERTED', 'DISCHARGED', 'DEPLOYMENT_FAILURE', 'UNACCOUNTED'],
  'INSERTED': [],
  'FAULTY': [],
  'DISPOSED': [],
  'DISCHARGED': [],
  'DEPLOYMENT_FAILURE': [],
  'UNACCOUNTED': [],
};

/**
 * Skin workflow transitions
 * SEALED → {INSERTED, OPENED, FAULTY}
 */
const SKIN_TRANSITIONS: Record<ApplicatorStatus, ApplicatorStatus[]> = {
  'SEALED': ['INSERTED', 'OPENED', 'FAULTY'],
  'OPENED': ['INSERTED', 'FAULTY'],
  'LOADED': [],
  'INSERTED': [],
  'FAULTY': [],
  'DISPOSED': [],
  'DISCHARGED': [],
  'DEPLOYMENT_FAILURE': [],
  'UNACCOUNTED': [],
};

/**
 * Terminal states that cannot transition to any other status
 * Used for validation purposes (these statuses have no allowed next transitions)
 */
const TERMINAL_STATUSES: ApplicatorStatus[] = [
  'DISPOSED',
  'DISCHARGED',
  'UNACCOUNTED'
];

/**
 * Finished states representing completed applicators
 * INSERTED and FAULTY are kept visible for documentation and PDF generation
 * Only truly terminal/failed states are hidden from the work list
 */
export const FINISHED_STATUSES: ApplicatorStatus[] = [
  'INSERTED',
  'FAULTY',
  'DISPOSED',
  'DISCHARGED',
  'DEPLOYMENT_FAILURE',
  'UNACCOUNTED'
];

/**
 * Treatment context for workflow detection
 * Allows checking multiple fields to determine treatment type
 */
export interface TreatmentContext {
  site?: string;           // Hospital/clinic site (may contain treatment type)
  priorityId?: string;     // Order ID (e.g., "PANC-HEAD-001", "PROST-LEFT-001")
  patientName?: string;    // Patient details (may contain PANC-, PROST- patterns)
  subjectId?: string;      // Patient reference (may contain patterns)
}

/**
 * Detect if treatment is pancreas or prostate based on multiple context fields
 * Checks: site name, order ID prefix, patient details patterns
 */
const isPancreasOrProstate = (context?: TreatmentContext | string): boolean => {
  // Handle legacy string parameter (just site)
  if (typeof context === 'string') {
    const siteLower = context.toLowerCase();
    return siteLower.includes('pancreas') || siteLower.includes('prostate') || siteLower.includes('לבלב');
  }

  if (!context) return false;

  // Check site field for treatment type keywords
  if (context.site) {
    const siteLower = context.site.toLowerCase();
    if (siteLower.includes('pancreas') || siteLower.includes('prostate') || siteLower.includes('לבלב')) {
      return true;
    }
  }

  // Check order ID for PANC- or PROST- prefix (test data pattern)
  if (context.priorityId) {
    const orderUpper = context.priorityId.toUpperCase();
    if (orderUpper.startsWith('PANC-') || orderUpper.startsWith('PROST-')) {
      return true;
    }
  }

  // Check patient name/details for PANC- or PROST- patterns
  if (context.patientName) {
    const nameUpper = context.patientName.toUpperCase();
    if (nameUpper.includes('PANC-') || nameUpper.includes('PROST-') ||
        nameUpper.includes('PANC_') || nameUpper.includes('PROST_')) {
      return true;
    }
  }

  // Check subject ID for patterns
  if (context.subjectId) {
    const subjectUpper = context.subjectId.toUpperCase();
    if (subjectUpper.includes('PANC') || subjectUpper.includes('PROST')) {
      return true;
    }
  }

  return false;
};

/**
 * Detect if treatment is skin based on multiple context fields
 */
const isSkin = (context?: TreatmentContext | string): boolean => {
  // Handle legacy string parameter (just site)
  if (typeof context === 'string') {
    const siteLower = context.toLowerCase();
    return siteLower.includes('skin') || siteLower.includes('עור');
  }

  if (!context) return false;

  // Check site field for skin keywords
  if (context.site) {
    const siteLower = context.site.toLowerCase();
    if (siteLower.includes('skin') || siteLower.includes('עור')) {
      return true;
    }
  }

  // Check order ID for SKIN- prefix (test data pattern)
  if (context.priorityId) {
    const orderUpper = context.priorityId.toUpperCase();
    if (orderUpper.startsWith('SKIN-')) {
      return true;
    }
  }

  // Check patient name/details for SKIN patterns
  if (context.patientName) {
    const nameUpper = context.patientName.toUpperCase();
    if (nameUpper.includes('SKIN-') || nameUpper.includes('SKIN_')) {
      return true;
    }
  }

  return false;
};

/**
 * Get allowed next statuses for the current applicator status
 * @param currentStatus - Current status of the applicator
 * @param treatmentContext - Treatment context object OR legacy site string
 * @returns Array of allowed next statuses based on workflow
 */
export const getAllowedNextStatuses = (
  currentStatus: ApplicatorStatus | null | undefined,
  treatmentContext?: TreatmentContext | string
): ApplicatorStatus[] => {
  // NEW APPLICATORS: Return treatment-specific initial status
  if (!currentStatus) {
    // Pancreas/Prostate: MUST start with SEALED (3-step workflow)
    if (isPancreasOrProstate(treatmentContext)) {
      return ['SEALED'];
    }

    // Skin: Also starts with SEALED (but workflow allows direct insertion later)
    if (isSkin(treatmentContext)) {
      return ['SEALED'];
    }

    // Unknown treatment type: allow all statuses as safe fallback
    return Object.keys(ALLOWED_TRANSITIONS) as ApplicatorStatus[];
  }

  // EXISTING APPLICATORS: Use treatment-specific workflow transitions
  if (isPancreasOrProstate(treatmentContext)) {
    return PANCREAS_PROSTATE_TRANSITIONS[currentStatus] || [];
  }

  if (isSkin(treatmentContext)) {
    return SKIN_TRANSITIONS[currentStatus] || [];
  }

  // Fallback to generic transitions
  return ALLOWED_TRANSITIONS[currentStatus] || [];
};

/**
 * Check if a status is terminal (cannot transition to any other status)
 * @param status - Status to check
 * @returns True if status is terminal
 */
export const isTerminalStatus = (status: ApplicatorStatus | null | undefined): boolean => {
  if (!status) return false;
  return TERMINAL_STATUSES.includes(status);
};

/**
 * Check if a status transition is valid
 * @param fromStatus - Current status
 * @param toStatus - Target status
 * @returns True if transition is allowed
 */
export const isValidTransition = (
  fromStatus: ApplicatorStatus | null | undefined,
  toStatus: ApplicatorStatus
): boolean => {
  // New applicators can transition to any status
  if (!fromStatus) return true;

  const allowedStatuses = ALLOWED_TRANSITIONS[fromStatus] || [];
  return allowedStatuses.includes(toStatus);
};

/**
 * In-progress states that should STAY in "Choose from List"
 * User can select these applicators to continue working with them
 */
export const IN_PROGRESS_STATUSES: ApplicatorStatus[] = ['SEALED', 'OPENED', 'LOADED'];

/**
 * States that should be REMOVED from "Choose from List"
 * These represent completed or dead-end applicators
 */
export const LIST_REMOVAL_STATUSES: ApplicatorStatus[] = [
  'INSERTED',
  'FAULTY',
  'DISPOSED',
  'DISCHARGED',
  'DEPLOYMENT_FAILURE',
  'UNACCOUNTED'
];

/**
 * Check if status should keep applicator in "Choose from List"
 * @param status - Applicator status
 * @returns True if applicator should remain in the active selection list
 */
export const isInProgressStatus = (status: ApplicatorStatus | string | null | undefined): boolean => {
  if (!status) return true; // No status = treat as SEALED (in-progress)
  return IN_PROGRESS_STATUSES.includes(status as ApplicatorStatus);
};

/**
 * Check if status should remove applicator from "Choose from List"
 * @param status - Applicator status
 * @returns True if applicator should be removed from active selection list
 */
export const shouldRemoveFromList = (status: ApplicatorStatus | string | null | undefined): boolean => {
  if (!status) return false; // No status = keep in list
  return LIST_REMOVAL_STATUSES.includes(status as ApplicatorStatus);
};

/**
 * Get color classes for "Choose from List" dropdown items
 * @param status - Applicator status
 * @returns Tailwind CSS classes for background and border
 */
export const getListItemColor = (status: ApplicatorStatus | string | null | undefined): string => {
  switch (status) {
    case 'SEALED': return 'bg-gray-50 border-l-4 border-l-gray-400';
    case 'OPENED': return 'bg-red-50 border-l-4 border-l-red-500';
    case 'LOADED': return 'bg-yellow-50 border-l-4 border-l-yellow-500';
    default: return 'bg-gray-50 border-l-4 border-l-gray-400'; // Default to SEALED style
  }
};

/**
 * Get emoji icon for applicator status in list view
 * @param status - Applicator status
 * @returns Emoji representing the status
 */
export const getStatusEmoji = (status: ApplicatorStatus | string | null | undefined): string => {
  switch (status) {
    case 'SEALED': return '📦';
    case 'OPENED': return '📂';
    case 'LOADED': return '🔧';
    default: return '📦'; // Default to sealed
  }
};

/**
 * Get human-readable status label
 * @param status - Applicator status
 * @returns Display label for the status
 */
export const getStatusLabel = (status: ApplicatorStatus | string | null | undefined): string => {
  switch (status) {
    case 'SEALED': return 'Sealed';
    case 'OPENED': return 'Opened';
    case 'LOADED': return 'Loaded';
    case 'INSERTED': return 'Inserted';
    case 'FAULTY': return 'Faulty';
    case 'DISPOSED': return 'Disposed';
    case 'DISCHARGED': return 'Discharged';
    case 'DEPLOYMENT_FAILURE': return 'Deployment Failure';
    case 'UNACCOUNTED': return 'Unaccounted';
    default: return 'Unknown';
  }
};
