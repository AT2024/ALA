/**
 * Time Routes
 *
 * Clock synchronization endpoint for offline PWA functionality.
 * Used to ensure accurate timestamps when device clocks may be skewed.
 */

import express from 'express';
import { getServerTime } from '../controllers/offlineController';
import { clockSyncLimiter } from '../middleware/offlineRateLimit';

const router = express.Router();

/**
 * GET /api/time
 * Get current server time for clock synchronization
 *
 * Response:
 * {
 *   timestamp: string,  // ISO 8601 format
 *   serverTime: number  // Unix timestamp in milliseconds
 * }
 */
router.get('/', clockSyncLimiter, getServerTime);

export default router;
