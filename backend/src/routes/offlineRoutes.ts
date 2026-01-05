/**
 * Offline Routes
 *
 * API endpoints for offline-first PWA functionality:
 * - /api/offline/download-bundle - Download treatment for offline use
 * - /api/offline/sync - Sync offline changes
 * - /api/offline/conflicts - Get unresolved conflicts
 * - /api/offline/conflicts/:id/resolve - Resolve a conflict
 */

import express from 'express';
import {
  downloadBundle,
  syncChanges,
  getConflicts,
  resolveConflict,
} from '../controllers/offlineController';
import { protect } from '../middleware/authMiddleware';
import {
  downloadBundleLimiter,
  syncLimiter,
  conflictResolutionLimiter,
} from '../middleware/offlineRateLimit';
import { validateUUID } from '../middleware/uuidValidationMiddleware';
import { criticalOperationHealthCheck, databaseHealthCheck } from '../middleware/databaseHealthMiddleware';

const router = express.Router();

// All offline routes require authentication
router.use(protect);

/**
 * POST /api/offline/download-bundle
 * Download a treatment bundle for offline use
 */
router.post(
  '/download-bundle',
  downloadBundleLimiter,
  criticalOperationHealthCheck,
  downloadBundle
);

/**
 * POST /api/offline/sync
 * Sync offline changes back to server
 */
router.post(
  '/sync',
  syncLimiter,
  criticalOperationHealthCheck,
  syncChanges
);

/**
 * GET /api/offline/conflicts
 * Get all unresolved conflicts for current user
 */
router.get(
  '/conflicts',
  databaseHealthCheck,
  getConflicts
);

/**
 * POST /api/offline/conflicts/:id/resolve
 * Resolve a sync conflict
 */
router.post(
  '/conflicts/:id/resolve',
  validateUUID('id'),
  conflictResolutionLimiter,
  criticalOperationHealthCheck,
  resolveConflict
);

export default router;
