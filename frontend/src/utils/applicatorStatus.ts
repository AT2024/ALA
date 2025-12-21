/**
 * Applicator status transition rules and utilities
 *
 * This file re-exports shared constants and adds frontend-specific utilities.
 * All status definitions come from @shared/applicatorStatuses (single source of truth).
 */

import type { ApplicatorStatus } from '@shared/applicatorStatuses';
import {
  // Constants
  APPLICATOR_STATUSES,
  ALL_STATUSES,
  TERMINAL_STATUSES,
  IN_PROGRESS_STATUSES,
  COMMENT_REQUIRED_STATUSES,
  // Transitions
  PANC_PROS_TRANSITIONS,
  SKIN_TRANSITIONS,
  GENERIC_TRANSITIONS,
  // Labels and colors
  STATUS_LABELS,
  STATUS_COLORS,
  LIST_ITEM_COLORS,
  STATUS_EMOJIS,
  // Helper functions
  isTerminalStatus,
  isInProgressStatus,
  requiresComment,
  getStatusLabel,
  getStatusEmoji,
  getStatusColors,
  getListItemColor,
} from '@shared/applicatorStatuses';

// Re-export type separately (required with isolatedModules)
export type { ApplicatorStatus };

// Re-export constants and functions from shared module for convenience
export {
  // Constants
  APPLICATOR_STATUSES,
  ALL_STATUSES,
  TERMINAL_STATUSES,
  IN_PROGRESS_STATUSES,
  COMMENT_REQUIRED_STATUSES,
  // Transitions
  PANC_PROS_TRANSITIONS,
  SKIN_TRANSITIONS,
  GENERIC_TRANSITIONS,
  // Labels and colors
  STATUS_LABELS,
  STATUS_COLORS,
  LIST_ITEM_COLORS,
  STATUS_EMOJIS,
  // Helper functions
  isTerminalStatus,
  isInProgressStatus,
  requiresComment,
  getStatusLabel,
  getStatusEmoji,
  getStatusColors,
  getListItemColor,
};

/**
 * Finished states representing completed applicators (terminal statuses)
 * These are removed from "Choose from List" and shown in "Use List Table"
 */
export const FINISHED_STATUSES: ApplicatorStatus[] = TERMINAL_STATUSES;

/**
 * States that should be REMOVED from "Choose from List"
 * Same as TERMINAL_STATUSES - these represent completed or dead-end applicators
 */
export const LIST_REMOVAL_STATUSES: ApplicatorStatus[] = TERMINAL_STATUSES;

/**
 * Treatment context for workflow detection
 * Allows checking multiple fields to determine treatment type
 */
export interface TreatmentContext {
  site?: string;           // Hospital/clinic site (may contain treatment type)
  priorityId?: string;     // Order ID (e.g., "PANC-HEAD-001", "PROST-LEFT-001")
  patientName?: string;    // Patient details (may contain PANC-, PROST- patterns)
  subjectId?: string;      // Patient reference (may contain patterns)
  getApplicatorSummary?: () => { sealed: number; opened: number; loaded: number; inserted: number; total: number };
}

/**
 * Detect if treatment is pancreas or prostate based on multiple context fields
 * Checks: site name, order ID prefix, patient details patterns
 */
export const isPancreasOrProstate = (context?: TreatmentContext | string): boolean => {
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
export const isSkin = (context?: TreatmentContext | string): boolean => {
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
 * Get the transition map for a specific treatment type
 */
export const getTransitionsForTreatment = (
  treatmentContext?: TreatmentContext | string
): Record<ApplicatorStatus, ApplicatorStatus[]> => {
  if (isPancreasOrProstate(treatmentContext)) {
    return PANC_PROS_TRANSITIONS;
  }
  if (isSkin(treatmentContext)) {
    return SKIN_TRANSITIONS;
  }
  return GENERIC_TRANSITIONS;
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
  // Get treatment-specific transition map
  const transitions = getTransitionsForTreatment(treatmentContext);

  // NEW APPLICATORS: They are implicitly SEALED, show transitions FROM SEALED
  if (!currentStatus) {
    return transitions[APPLICATOR_STATUSES.SEALED] || [];
  }

  // EXISTING APPLICATORS: Use treatment-specific workflow transitions
  return transitions[currentStatus] || [];
};

/**
 * Check if a status transition is valid
 * @param fromStatus - Current status
 * @param toStatus - Target status
 * @param treatmentContext - Treatment context for workflow-specific validation
 * @returns True if transition is allowed
 */
export const isValidTransition = (
  fromStatus: ApplicatorStatus | null | undefined,
  toStatus: ApplicatorStatus,
  treatmentContext?: TreatmentContext | string
): boolean => {
  // New applicators are implicitly SEALED, validate transitions FROM SEALED
  if (!fromStatus) {
    const transitions = getTransitionsForTreatment(treatmentContext);
    const allowedFromSealed = transitions[APPLICATOR_STATUSES.SEALED] || [];
    return allowedFromSealed.includes(toStatus);
  }

  const allowedStatuses = getAllowedNextStatuses(fromStatus, treatmentContext);
  return allowedStatuses.includes(toStatus);
};

/**
 * Check if status should remove applicator from "Choose from List"
 * @param status - Applicator status
 * @returns True if applicator should be removed from active selection list
 */
export const shouldRemoveFromList = (status: ApplicatorStatus | string | null | undefined): boolean => {
  if (!status) return false; // No status = keep in list
  return isTerminalStatus(status);
};

/**
 * Get the current workflow stage for PANC/PROS treatment
 * Stage 1: Working with SEALED applicators
 * Stage 2: Working with OPENED applicators
 * Stage 3: Working with LOADED applicators
 */
export const getCurrentStage = (treatmentContext?: TreatmentContext): 1 | 2 | 3 => {
  if (!treatmentContext?.getApplicatorSummary) {
    return 1; // Default to stage 1
  }

  const summary = treatmentContext.getApplicatorSummary();

  // If there are LOADED applicators, we're in stage 3
  if (summary.loaded > 0) return 3;

  // If there are OPENED applicators, we're in stage 2
  if (summary.opened > 0) return 2;

  // Default to stage 1 (working with SEALED)
  return 1;
};

/**
 * Get the statuses that should be shown in "Choose from List" based on current stage
 * For PANC/PROS: Shows only applicators matching the current workflow stage
 * For SKIN: Shows only SEALED applicators
 */
export const getStageFilterStatuses = (
  treatmentContext?: TreatmentContext | string
): ApplicatorStatus[] => {
  if (isSkin(treatmentContext)) {
    // SKIN: Only show SEALED (they go directly to terminal states)
    return [APPLICATOR_STATUSES.SEALED];
  }

  if (isPancreasOrProstate(treatmentContext)) {
    // PANC/PROS: Show based on current stage
    // For now, show all in-progress statuses - stage filtering happens in TreatmentContext
    return IN_PROGRESS_STATUSES;
  }

  // Default: show all in-progress statuses
  return IN_PROGRESS_STATUSES;
};
