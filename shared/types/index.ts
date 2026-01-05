/**
 * Shared Types - Re-export all types from a single entry point
 *
 * Usage:
 * - Frontend: import { Treatment, Applicator } from '@shared/types'
 * - Backend: import { Treatment, Applicator } from '../../shared/types'
 */

// Treatment types
export type {
  Treatment,
  TreatmentType,
  ContinuationEligibility,
  TreatmentFilterParams,
  ProgressStats,
  RemovalProgress,
} from './treatment.types';

// Applicator types
export type {
  Applicator,
  ApplicatorGroup,
  ApplicatorValidationResult,
  ApplicatorSummary,
  UsageType,
  AttachmentSyncStatus,
} from './applicator.types';

// Re-export applicator status types from the main file
export type { ApplicatorStatus } from '../applicatorStatuses';
export {
  APPLICATOR_STATUSES,
  ALL_STATUSES,
  TERMINAL_STATUSES,
  IN_PROGRESS_STATUSES,
  SUCCESS_STATUS,
  FAILURE_STATUSES,
  COMMENT_REQUIRED_STATUSES,
  ADMIN_REQUIRED_STATUSES,
  PANC_PROS_TRANSITIONS,
  SKIN_TRANSITIONS,
  GENERIC_TRANSITIONS,
  STATUS_LABELS,
  STATUS_DESCRIPTIONS,
  STATUS_EMOJIS,
  STATUS_COLORS,
  LIST_ITEM_COLORS,
  isTerminalStatus,
  isInProgressStatus,
  requiresComment,
  requiresAdminForConflict,
  getStatusLabel,
  getStatusEmoji,
  getStatusColors,
  getListItemColor,
} from '../applicatorStatuses';
