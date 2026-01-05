/**
 * Offline Validation Service
 *
 * Validates operations that can be performed offline.
 * Ensures patient safety by restricting certain operations.
 *
 * CRITICAL SAFETY RULES:
 * - INSERTED/FAULTY status changes require confirmation
 * - Treatment finalization is ALWAYS blocked offline
 * - Only pre-downloaded applicators can be scanned offline
 */

import {
  ApplicatorStatus,
  APPLICATOR_STATUSES,
  isTerminalStatus,
  PANC_PROS_TRANSITIONS,
  SKIN_TRANSITIONS,
  GENERIC_TRANSITIONS,
} from '../../../shared/applicatorStatuses';
import { offlineDb } from './indexedDbService';

// Treatment type for determining which transition rules to use
export type TreatmentType = 'panc_pros' | 'skin' | 'generic';

// ============================================================================
// Types
// ============================================================================

export interface OfflineValidationResult {
  allowed: boolean;
  requiresConfirmation: boolean;
  message: string;
  warningLevel: 'none' | 'info' | 'warning' | 'error';
}

export interface OfflineLimitations {
  maxStatusTransition: ApplicatorStatus;
  canFinalize: boolean;
  requiresConfirmationFor: ApplicatorStatus[];
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Statuses that require double confirmation when changed offline
 */
const CONFIRMATION_REQUIRED_STATUSES: ApplicatorStatus[] = [
  APPLICATOR_STATUSES.INSERTED,
  APPLICATOR_STATUSES.FAULTY,
];

/**
 * Get treatment-specific transition rules (SAME as online mode)
 * This ensures offline behavior matches online exactly
 */
function getTransitionsForTreatmentType(treatmentType: TreatmentType): Record<ApplicatorStatus, ApplicatorStatus[]> {
  switch (treatmentType) {
    case 'panc_pros':
      return PANC_PROS_TRANSITIONS;
    case 'skin':
      return SKIN_TRANSITIONS;
    default:
      return GENERIC_TRANSITIONS;
  }
}

/**
 * Default offline bundle expiry time in hours
 */
const DEFAULT_EXPIRY_HOURS = 24;

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Check if a status transition is valid while offline
 *
 * IMPORTANT: This now uses the SAME transition rules as online mode.
 * The only difference is that changes are queued for sync instead of being immediate.
 *
 * @param currentStatus - Current applicator status (null for new)
 * @param newStatus - Desired new status
 * @param treatmentType - Treatment type for determining transition rules (defaults to 'generic')
 * @returns Validation result with details
 */
export function isValidOfflineStatusTransition(
  currentStatus: ApplicatorStatus | null,
  newStatus: ApplicatorStatus,
  treatmentType: TreatmentType = 'generic'
): OfflineValidationResult {
  // Same-status is allowed (no actual transition happening) - this is a no-op
  // This handles cases where user selects an applicator but doesn't change status
  if (currentStatus === newStatus) {
    return {
      allowed: true,
      requiresConfirmation: false,
      message: '',
      warningLevel: 'none',
    };
  }

  // Get treatment-specific transitions (SAME as online mode)
  const transitions = getTransitionsForTreatmentType(treatmentType);

  // Handle null status (new applicator = implicitly SEALED)
  const effectiveCurrentStatus = currentStatus || APPLICATOR_STATUSES.SEALED;
  const allowedStatuses = transitions[effectiveCurrentStatus] || [];

  if (!allowedStatuses.includes(newStatus)) {
    // Check if this is a terminal status
    if (isTerminalStatus(currentStatus)) {
      return {
        allowed: false,
        requiresConfirmation: false,
        message: `Cannot transition from ${currentStatus} - terminal status`,
        warningLevel: 'error',
      };
    }

    return {
      allowed: false,
      requiresConfirmation: false,
      message: `Status transition from ${currentStatus || 'SEALED'} to ${newStatus} is not allowed. Valid transitions: ${allowedStatuses.join(', ') || 'none'}`,
      warningLevel: 'error',
    };
  }

  // Check if confirmation is required (INSERTED, FAULTY are medical-critical)
  const requiresConfirmation = CONFIRMATION_REQUIRED_STATUSES.includes(newStatus);

  if (requiresConfirmation) {
    return {
      allowed: true,
      requiresConfirmation: true,
      message: `Setting status to ${newStatus} requires confirmation. This change will sync when you reconnect.`,
      warningLevel: 'warning',
    };
  }

  return {
    allowed: true,
    requiresConfirmation: false,
    message: '',
    warningLevel: 'none',
  };
}

/**
 * Validate an applicator scan while offline
 *
 * @param serialNumber - Scanned serial number
 * @param treatmentId - Current treatment ID
 * @returns Validation result
 */
export async function validateOfflineScan(
  serialNumber: string,
  treatmentId: string
): Promise<OfflineValidationResult> {
  // Check if applicator was pre-downloaded
  const applicator = await offlineDb.getApplicatorBySerial(serialNumber);

  if (!applicator) {
    return {
      allowed: false,
      requiresConfirmation: false,
      message: 'This applicator was not downloaded for offline use. You can only scan pre-downloaded applicators while offline.',
      warningLevel: 'error',
    };
  }

  // Check if applicator belongs to current treatment
  if (applicator.treatmentId !== treatmentId) {
    return {
      allowed: false,
      requiresConfirmation: false,
      message: 'This applicator belongs to a different treatment.',
      warningLevel: 'error',
    };
  }

  // Check if treatment data is expired
  const treatment = await offlineDb.getTreatment(treatmentId);
  if (!treatment) {
    return {
      allowed: false,
      requiresConfirmation: false,
      message: 'Treatment data not found in offline storage.',
      warningLevel: 'error',
    };
  }

  if (await offlineDb.isTreatmentExpired(treatmentId)) {
    return {
      allowed: false,
      requiresConfirmation: false,
      message: `Offline data has expired. Please sync and re-download when online. (Expired: ${new Date(treatment.expiresAt).toLocaleString()})`,
      warningLevel: 'error',
    };
  }

  return {
    allowed: true,
    requiresConfirmation: false,
    message: '',
    warningLevel: 'none',
  };
}

/**
 * Validate treatment finalization while offline
 * Finalization is ALWAYS blocked offline
 */
export function validateOfflineFinalization(): OfflineValidationResult {
  return {
    allowed: false,
    requiresConfirmation: false,
    message: 'Treatment finalization requires a network connection for digital signature verification. Please connect to the network to finalize this treatment.',
    warningLevel: 'error',
  };
}

/**
 * Check if a treatment is available for offline use
 *
 * @param treatmentId - Treatment ID to check
 * @returns True if downloaded and not expired
 */
export async function isTreatmentAvailableOffline(treatmentId: string): Promise<boolean> {
  const treatment = await offlineDb.getTreatment(treatmentId);
  if (!treatment) return false;

  return !(await offlineDb.isTreatmentExpired(treatmentId));
}

/**
 * Get offline limitations for display
 */
export function getOfflineLimitations(): OfflineLimitations {
  return {
    maxStatusTransition: APPLICATOR_STATUSES.INSERTED,
    canFinalize: false,
    requiresConfirmationFor: CONFIRMATION_REQUIRED_STATUSES,
  };
}

/**
 * Get detailed message about offline restrictions
 */
export function getOfflineRestrictionsMessage(): string {
  return `
While offline, you can:
- Scan and process pre-downloaded applicators
- Change status up to INSERTED (with confirmation)
- Add comments to applicators

While offline, you CANNOT:
- Scan applicators that weren't downloaded
- Finalize treatments (requires signature verification)
- Create new treatments
- Access applicators from other treatments

All changes will be synced when you reconnect to the network.
  `.trim();
}

/**
 * Validate adding a comment while offline
 */
export function validateOfflineComment(comment: string): OfflineValidationResult {
  if (!comment || comment.trim().length === 0) {
    return {
      allowed: false,
      requiresConfirmation: false,
      message: 'Comment cannot be empty.',
      warningLevel: 'error',
    };
  }

  if (comment.length > 1000) {
    return {
      allowed: false,
      requiresConfirmation: false,
      message: 'Comment is too long. Maximum 1000 characters.',
      warningLevel: 'error',
    };
  }

  return {
    allowed: true,
    requiresConfirmation: false,
    message: 'Comment will be synced when you reconnect.',
    warningLevel: 'info',
  };
}

/**
 * Check if bundle data is about to expire
 *
 * @param expiresAt - Bundle expiry timestamp
 * @param warningThresholdHours - Hours before expiry to show warning (default: 2)
 */
export function checkBundleExpiry(
  expiresAt: string | Date,
  warningThresholdHours: number = 2
): {
  expired: boolean;
  expiringS: boolean;
  hoursRemaining: number;
  message: string;
} {
  const expiryDate = new Date(expiresAt);
  const now = new Date();
  const hoursRemaining = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursRemaining <= 0) {
    return {
      expired: true,
      expiringS: false,
      hoursRemaining: 0,
      message: 'Offline data has expired. Please sync and re-download.',
    };
  }

  if (hoursRemaining <= warningThresholdHours) {
    return {
      expired: false,
      expiringS: true,
      hoursRemaining,
      message: `Offline data expires in ${Math.round(hoursRemaining * 60)} minutes. Consider syncing soon.`,
    };
  }

  return {
    expired: false,
    expiringS: false,
    hoursRemaining,
    message: '',
  };
}

// ============================================================================
// Exports
// ============================================================================

export {
  CONFIRMATION_REQUIRED_STATUSES,
  DEFAULT_EXPIRY_HOURS,
};
