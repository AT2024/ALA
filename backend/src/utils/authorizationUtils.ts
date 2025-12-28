/**
 * Authorization utility functions
 *
 * Consolidates the repeated authorization check pattern that was duplicated 15+ times
 * across applicatorController.ts and treatmentController.ts
 */

import { Response } from 'express';

/**
 * User interface matching the req.user structure
 */
interface RequestUser {
  id: string;
  email: string;
  role: 'admin' | 'user';
}

/**
 * Treatment interface with minimal required fields for authorization
 */
interface TreatmentWithOwner {
  userId: string;
  [key: string]: any;
}

/**
 * Custom error class for authorization failures
 */
export class ForbiddenError extends Error {
  constructor(message: string = 'Not authorized to access this resource') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Check if user has access to a treatment
 * Throws ForbiddenError if access denied
 *
 * @param treatment - The treatment object with userId
 * @param user - The request user object
 * @throws ForbiddenError if user doesn't have access
 *
 * @example
 * const treatment = await treatmentService.getTreatmentById(treatmentId);
 * requireTreatmentAccess(treatment, req.user);
 * // If we get here, user has access
 */
export function requireTreatmentAccess(
  treatment: TreatmentWithOwner,
  user: RequestUser
): void {
  if (user.role !== 'admin' && treatment.userId !== user.id) {
    throw new ForbiddenError('Not authorized to modify this treatment');
  }
}

/**
 * Check if user has access to a treatment (non-throwing version)
 * Returns boolean instead of throwing
 *
 * @param treatment - The treatment object with userId
 * @param user - The request user object
 * @returns true if user has access, false otherwise
 */
export function hasTreatmentAccess(
  treatment: TreatmentWithOwner,
  user: RequestUser
): boolean {
  return user.role === 'admin' || treatment.userId === user.id;
}

/**
 * Helper to send 403 response (for gradual migration from old pattern)
 * Use requireTreatmentAccess() for new code
 *
 * @param res - Express response object
 * @param treatment - The treatment object
 * @param user - The request user
 * @returns true if access denied (response sent), false if access granted
 */
export function denyIfNoTreatmentAccess(
  res: Response,
  treatment: TreatmentWithOwner,
  user: RequestUser
): boolean {
  if (!hasTreatmentAccess(treatment, user)) {
    res.status(403);
    throw new ForbiddenError('Not authorized to modify this treatment');
  }
  return false;
}
