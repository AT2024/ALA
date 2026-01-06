/**
 * Applicator Type Definitions - Single Source of Truth
 *
 * This file contains the canonical Applicator interface used by both frontend and backend.
 * All components should import Applicator from this file to ensure consistency.
 *
 * Note: This is a merged interface that includes all fields from:
 * - TreatmentContext.tsx (frontend state management)
 * - treatmentService.ts (frontend API types)
 * - PackageManager.tsx (frontend component)
 * - Backend models and controllers
 *
 * Status workflow is managed by shared/applicatorStatuses.ts
 */

import type { ApplicatorStatus } from '../applicatorStatuses';

/**
 * Legacy usage type - kept for backwards compatibility
 * New code should use ApplicatorStatus from applicatorStatuses.ts
 */
export type UsageType = 'full' | 'faulty' | 'none';

/**
 * Attachment sync status for files stored in Priority ERP
 */
export type AttachmentSyncStatus = 'pending' | 'syncing' | 'synced' | 'failed' | null;

/**
 * Canonical Applicator interface
 *
 * Contains all applicator-related fields used across the application.
 * Some fields are optional as they may not be present in all contexts.
 */
export interface Applicator {
  // Core identification
  id: string;
  serialNumber: string;

  // Type and catalog information (from Priority ERP)
  applicatorType?: string; // PARTS.PARTDES field
  catalog?: string; // Priority PARTNAME field
  seedLength?: number; // Priority SIBD_SEEDLEN field

  // Medical data
  seedQuantity: number;
  insertedSeedsQty?: number;

  // Workflow status
  /**
   * Legacy 3-state usage type
   * @deprecated Use status field instead for 8-state workflow
   */
  usageType: UsageType;
  /**
   * 8-state workflow status (SEALED, OPENED, LOADED, INSERTED, FAULTY, DISPOSED, DISCHARGED, DEPLOYMENT_FAILURE)
   * This is the preferred status field for new implementations
   */
  status?: ApplicatorStatus;

  // Timestamps
  insertionTime: string;

  // Documentation
  comments?: string;
  image?: string;

  // Removal tracking
  isRemoved?: boolean;
  removalComments?: string;
  removalImage?: string;

  // Patient reference
  patientId?: string;

  // File attachment tracking (files stored in Priority ERP)
  attachmentFileCount?: number;
  attachmentSyncStatus?: AttachmentSyncStatus;
  attachmentFilename?: string;
  attachmentSizeBytes?: number;

  // Package label for pancreas/prostate treatments
  package_label?: string;

  // Continuation treatment tracking
  /** Indicates this applicator was inherited from a parent treatment (continuation workflow) */
  fromParentTreatment?: boolean;
}

/**
 * Applicator group for display in UI (e.g., grouped by seed count)
 */
export interface ApplicatorGroup {
  seedCount: number;
  totalApplicators: number;
  removedApplicators: number;
  applicators: Applicator[];
}

/**
 * Applicator validation result from Priority API
 */
export interface ApplicatorValidationResult {
  isValid: boolean;
  message?: string;
  scenario?: 'valid' | 'already_scanned' | 'wrong_treatment' | 'no_use' | 'not_allowed' | 'expired';
  applicator?: Applicator;
}

/**
 * Applicator summary for dashboard/progress display
 */
export interface ApplicatorSummary {
  seedQuantity: number;
  inserted: number;
  available: number;
  loaded: number;
  packaged: number;
}
