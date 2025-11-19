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
 * Terminal states that cannot transition to any other status
 */
const TERMINAL_STATUSES: ApplicatorStatus[] = ['DISPOSED', 'DISCHARGED', 'UNACCOUNTED'];

/**
 * Get allowed next statuses for the current applicator status
 * @param currentStatus - Current status of the applicator
 * @returns Array of allowed next statuses
 */
export const getAllowedNextStatuses = (currentStatus: ApplicatorStatus | null | undefined): ApplicatorStatus[] => {
  // If no current status, allow all statuses (new applicator)
  if (!currentStatus) {
    return Object.keys(ALLOWED_TRANSITIONS) as ApplicatorStatus[];
  }

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
