/**
 * Offline Rate Limiting Middleware
 *
 * Rate limiters specifically designed for offline sync operations.
 * These are more restrictive than general API limits to prevent abuse.
 */

import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Request } from 'express';

// Type for request with user info
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
}

/**
 * Rate limiter for download bundle requests
 * - 10 bundles per hour per user
 * - This is more restrictive because downloads are resource-intensive
 */
export const downloadBundleLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 bundles per hour
  keyGenerator: (req: AuthenticatedRequest) => {
    // Use user ID if authenticated, otherwise fall back to IP
    return req.user?.id || ipKeyGenerator(req.ip || 'unknown');
  },
  message: {
    error: 'Too many download requests. You can download up to 10 treatment bundles per hour.',
    retryAfter: 3600,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for sync requests
 * - 10 syncs per minute per device
 * - Matches existing strictRateLimit pattern for consistency
 */
export const syncLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 syncs per minute (matches strictRateLimit)
  keyGenerator: (req: AuthenticatedRequest) => {
    // Use device ID from body if available, then user ID, then IP
    const deviceId = req.body?.deviceId;
    const userId = req.user?.id;
    return deviceId || userId || ipKeyGenerator(req.ip || 'unknown');
  },
  message: {
    error: 'Too many sync requests. Please wait before syncing again.',
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for conflict resolution
 * - 30 resolutions per 15 minutes
 * - More lenient because resolving conflicts is important
 */
export const conflictResolutionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  keyGenerator: (req: AuthenticatedRequest) => {
    return req.user?.id || ipKeyGenerator(req.ip || 'unknown');
  },
  message: {
    error: 'Too many conflict resolution requests. Please try again later.',
    retryAfter: 900,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for clock sync requests
 * - 60 requests per minute (effectively once per second)
 * - Very lenient because this is a lightweight operation
 */
export const clockSyncLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 1 per second average
  message: {
    error: 'Too many time sync requests.',
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});
