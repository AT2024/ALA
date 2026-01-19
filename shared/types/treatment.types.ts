/**
 * Treatment Type Definitions - Single Source of Truth
 *
 * This file contains the canonical Treatment interface used by both frontend and backend.
 * All components should import Treatment from this file to ensure consistency.
 *
 * Note: This is a merged interface that includes all fields from:
 * - TreatmentContext.tsx (frontend state management)
 * - treatmentService.ts (frontend API types)
 * - Backend models and controllers
 */

/**
 * Treatment type enum - all supported treatment types
 */
export type TreatmentType =
  | 'insertion'
  | 'removal'
  | 'pancreas_insertion'
  | 'prostate_insertion'
  | 'skin_insertion';

/**
 * Treatment indication type from Priority SIBD_INDICATION field
 * Used to determine applicator workflow (pancreas/prostate use 3-stage, skin uses 2-stage)
 */
export type TreatmentIndication = 'pancreas' | 'prostate' | 'skin' | string | null;

/**
 * Canonical Treatment interface
 *
 * Contains all treatment-related fields used across the application.
 * Some fields are optional as they may not be present in all contexts.
 */
export interface Treatment {
  // Core identification
  id: string;
  type: TreatmentType;
  subjectId: string;
  site: string;
  date: string;
  isComplete: boolean;

  // Patient information
  patientName?: string;
  email?: string;

  // Medical data
  seedQuantity?: number;
  activityPerSeed?: number;
  surgeon?: string;
  daysSinceInsertion?: number; // For removal treatments

  // Priority ERP integration
  priorityId?: string; // Priority order ID (e.g., "PANC-HEAD-001")
  originalTreatmentId?: string; // For removal treatments - links to original insertion
  indication?: TreatmentIndication; // Treatment indication from Priority SIBD_INDICATION

  // Treatment continuation (24-hour window)
  parentTreatmentId?: string; // Reference to parent treatment for continuations
  lastActivityAt?: string; // Last applicator activity timestamp

  // User tracking
  userId?: string;

  // Timestamps
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Continuation eligibility information
 * Used to determine if a treatment can be continued within the 24-hour window
 */
export interface ContinuationEligibility {
  canContinue: boolean;
  reason?: string;
  hoursRemaining?: number;
  parentPdfCreatedAt?: string;
  reusableApplicatorCount?: number;
}

/**
 * Treatment filter parameters for querying treatments
 */
export interface TreatmentFilterParams {
  type?: 'insertion' | 'removal';
  subjectId?: string;
  site?: string;
  date?: string;
}

/**
 * Progress statistics for treatment tracking
 */
export interface ProgressStats {
  totalApplicators: number;
  usedApplicators: number;
  totalSeeds: number;
  insertedSeeds: number;
  completionPercentage: number;
  usageTypeDistribution: {
    // 8-state workflow statuses
    sealed: number;
    opened: number;
    loaded: number;
    inserted: number;
    faulty: number;
    disposed: number;
    discharged: number;
    deploymentFailure: number;
    // Legacy fallback counts (for backward compatibility)
    full: number;
    none: number;
  };
  seedsRemaining: number;
  applicatorsRemaining: number;
}

/**
 * Removal progress tracking
 */
export interface RemovalProgress {
  totalSeeds: number;
  removedSeeds: number;
  effectiveTotalSeeds: number;
  effectiveRemovedSeeds: number;
}
