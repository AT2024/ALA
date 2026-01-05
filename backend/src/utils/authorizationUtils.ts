/**
 * Authorization utility functions
 *
 * Consolidates the repeated authorization check pattern that was duplicated 15+ times
 * across applicatorController.ts and treatmentController.ts
 *
 * Also includes:
 * - Position 99 (Alpha Tau admin) checks
 * - Site access validation
 * - User context building for Priority API calls
 */

import { Request, Response } from 'express';

/**
 * Site information from user metadata
 */
interface UserSite {
  custName: string;
  custDes?: string;
}

/**
 * User metadata from Priority system
 */
interface UserMetadata {
  positionCode?: number | string;
  custName?: string;
  sites?: UserSite[];
  [key: string]: any;
}

/**
 * User interface matching the req.user structure
 */
interface RequestUser {
  id: string;
  email: string;
  role: 'admin' | 'user';
  metadata?: UserMetadata;
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
  constructor(message = 'Not authorized to access this resource') {
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

// =============================================================================
// POSITION 99 (ALPHA TAU ADMIN) CHECKS
// =============================================================================

/**
 * Check if user is an Alpha Tau admin (position code 99)
 * Position code 99 users have full access to all sites
 *
 * @param user - The request user object with metadata
 * @returns true if user has position code 99
 */
export function isAlphaTauAdmin(user: RequestUser | undefined): boolean {
  return Number(user?.metadata?.positionCode) === 99;
}

/**
 * Alias for isAlphaTauAdmin for backwards compatibility
 * Used in offlineController.ts
 */
export const isAdmin = isAlphaTauAdmin;

// =============================================================================
// SITE ACCESS VALIDATION
// =============================================================================

/**
 * Check if user has access to a specific site
 * Alpha Tau admins (position 99) have access to all sites
 * Other users only have access to their assigned sites
 *
 * @param user - The request user object
 * @param site - The site code (custName) to check
 * @returns true if user has access to the site
 */
export function hasSiteAccess(user: RequestUser | undefined, site: string): boolean {
  if (!user) return false;

  // Alpha Tau admins have access to all sites
  if (isAlphaTauAdmin(user)) {
    return true;
  }

  // Get user's assigned sites
  const userSites = user.metadata?.sites || [];
  const userSiteCodes = userSites.map((s) => s.custName);

  return userSiteCodes.includes(site);
}

/**
 * Check site access and throw ForbiddenError if denied
 *
 * @param user - The request user object
 * @param site - The site code to check
 * @throws ForbiddenError if user doesn't have site access
 */
export function requireSiteAccess(user: RequestUser | undefined, site: string): void {
  if (!hasSiteAccess(user, site)) {
    throw new ForbiddenError(`Not authorized to access site: ${site}`);
  }
}

/**
 * Get list of site codes the user has access to
 * Returns all sites for Alpha Tau admins (empty array means "all")
 *
 * @param user - The request user object
 * @returns Array of site codes, or empty array for full access
 */
export function getUserSiteCodes(user: RequestUser | undefined): string[] {
  if (!user) return [];

  // Alpha Tau admins - return empty array to indicate full access
  if (isAlphaTauAdmin(user)) {
    return [];
  }

  const userSites = user.metadata?.sites || [];
  return userSites.map((s) => s.custName);
}

// =============================================================================
// USER CONTEXT BUILDING
// =============================================================================

/**
 * User context for Priority API calls
 * Includes identifier and metadata for test mode detection
 */
export interface UserContext {
  identifier: string;
  userMetadata?: UserMetadata;
}

/**
 * Build user context object for Priority API calls
 * Used to pass user information to Priority service methods
 *
 * @param req - Express request with user attached
 * @returns UserContext object for Priority API calls
 */
export function buildUserContext(req: Request & { user?: RequestUser }): UserContext {
  return {
    identifier: req.user?.email || req.user?.id || '',
    userMetadata: req.user?.metadata,
  };
}

/**
 * Build user context from a user object directly
 * Useful when you have the user but not the request
 *
 * @param user - The user object
 * @returns UserContext object for Priority API calls
 */
export function buildUserContextFromUser(user: RequestUser | undefined): UserContext {
  return {
    identifier: user?.email || user?.id || '',
    userMetadata: user?.metadata,
  };
}
