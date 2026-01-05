/**
 * Offline Controller
 *
 * Handles offline sync operations including:
 * - Download bundles for offline use
 * - Sync changes back to server
 * - Conflict resolution
 * - Clock synchronization
 *
 * CRITICAL: All medical status conflicts require admin resolution
 */

import { Request, Response } from 'express';
import crypto from 'crypto';
import { Op } from 'sequelize';
import { Treatment, Applicator, SyncConflict, OfflineAuditLog } from '../models';
import logger from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    position?: number;
    sites?: string[];
    metadata?: {
      positionCode?: number | string;
      custName?: string;
      sites?: Array<{ custName: string; custDes?: string }>;
    };
  };
}

interface DownloadBundleRequest extends AuthenticatedRequest {
  body: {
    treatmentId: string;
    deviceId: string;
  };
}

interface SyncRequest extends AuthenticatedRequest {
  body: {
    deviceId: string;
    offlineSince: string;
    changes: SyncChange[];
  };
}

interface SyncChange {
  id: string;                    // Idempotency key
  entityType: 'treatment' | 'applicator';
  entityId: string;
  operation: 'create' | 'update' | 'status_change';
  data: Record<string, unknown>;
  localVersion: number;
  changedAt: string;
  changeHash: string;
}

interface ConflictResolutionRequest extends AuthenticatedRequest {
  params: {
    id: string;
  };
  body: {
    resolution: 'local_wins' | 'server_wins';
    adminOverride?: boolean;
  };
}

// Medical statuses that require admin resolution
const ADMIN_REQUIRED_STATUSES = ['INSERTED', 'FAULTY', 'DISPOSED', 'DEPLOYMENT_FAILURE'];

// Bundle expiry time (24 hours)
const BUNDLE_EXPIRY_HOURS = 24;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if user is admin (position 99)
 * Note: Position is stored in user.metadata.positionCode from Priority
 */
function isAdmin(user: AuthenticatedRequest['user']): boolean {
  return Number(user?.metadata?.positionCode) === 99;
}

/**
 * Check if a conflict requires admin resolution
 */
function requiresAdminResolution(
  entityType: 'treatment' | 'applicator',
  localData: Record<string, unknown>,
  serverData: Record<string, unknown>
): boolean {
  // Treatment conflicts always require admin
  if (entityType === 'treatment') {
    return true;
  }

  // Applicator medical status conflicts require admin
  if (entityType === 'applicator') {
    const localStatus = localData?.status as string;
    const serverStatus = serverData?.status as string;
    return ADMIN_REQUIRED_STATUSES.includes(localStatus) ||
           ADMIN_REQUIRED_STATUSES.includes(serverStatus);
  }

  return false;
}

/**
 * Compute SHA-256 hash of data for integrity verification
 */
function computeHash(data: Record<string, unknown>): string {
  const normalized = JSON.stringify(data, Object.keys(data).sort());
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

// ============================================================================
// Controllers
// ============================================================================

/**
 * POST /api/offline/download-bundle
 *
 * Download a treatment bundle for offline use.
 * Includes treatment, all applicators, and validation data.
 */
export const downloadBundle = async (req: DownloadBundleRequest, res: Response) => {
  try {
    const { treatmentId, deviceId } = req.body;
    const userId = req.user?.id;

    if (!treatmentId || !deviceId) {
      return res.status(400).json({
        success: false,
        error: 'treatmentId and deviceId are required',
      });
    }

    // Fetch treatment with applicators
    const treatment = await Treatment.findByPk(treatmentId, {
      include: [{ model: Applicator, as: 'applicators' }],
    });

    if (!treatment) {
      return res.status(404).json({
        success: false,
        error: 'Treatment not found',
      });
    }

    // Check user has access to this treatment's site
    // Note: Sites are stored as objects with custName and custDes in user.metadata.sites
    const userSites = req.user?.metadata?.sites || [];
    const userSiteCodes = userSites.map((s: { custName: string }) => s.custName);
    const isAdminUser = isAdmin(req.user);

    if (!isAdminUser && !userSiteCodes.includes(treatment.site)) {
      return res.status(403).json({
        success: false,
        error: 'You do not have access to this treatment',
      });
    }

    // Calculate expiry
    const downloadedAt = new Date();
    const expiresAt = new Date(downloadedAt.getTime() + BUNDLE_EXPIRY_HOURS * 60 * 60 * 1000);

    // Update treatment sync status
    await treatment.update({
      lastSyncedAt: downloadedAt,
      deviceId,
    });

    // Create audit log entry
    await OfflineAuditLog.create({
      entityType: 'treatment',
      entityId: treatmentId,
      operation: 'update',
      changedBy: userId!,
      deviceId,
      offlineSince: downloadedAt,
      offlineChangedAt: downloadedAt,
      syncedAt: downloadedAt,
      changeHash: computeHash({ action: 'download_bundle', treatmentId }),
      afterState: { downloaded: true, deviceId },
      metadata: { action: 'download_bundle' },
    });

    logger.info(`[Offline] Bundle downloaded: treatment=${treatmentId} user=${userId} device=${deviceId}`);

    // Build response
    return res.status(200).json({
      success: true,
      bundle: {
        treatment: {
          ...treatment.toJSON(),
          version: treatment.version,
        },
        applicators: (treatment as any).applicators?.map((app: Applicator) => ({
          ...app.toJSON(),
          version: app.version,
        })) || [],
        serverVersion: treatment.version,
        downloadedAt: downloadedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        offlineLimitations: {
          maxStatusTransition: 'INSERTED', // Full workflow allowed
          canFinalize: false,              // Finalization requires online
          requiresConfirmationFor: ['INSERTED', 'FAULTY'],
        },
      },
      // Note: encryptionKey is now derived client-side from user credentials
      // This is more secure as the server never sees the key
    });
  } catch (error) {
    logger.error('[Offline] Download bundle error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to download bundle',
    });
  }
};

/**
 * POST /api/offline/sync
 *
 * Sync offline changes back to server.
 * Handles version conflicts and creates conflict records for resolution.
 */
export const syncChanges = async (req: SyncRequest, res: Response) => {
  try {
    const { deviceId, offlineSince, changes } = req.body;
    const userId = req.user?.id;

    if (!deviceId || !changes || !Array.isArray(changes)) {
      return res.status(400).json({
        success: false,
        error: 'deviceId and changes array are required',
      });
    }

    const results: Array<{
      changeId: string;
      status: 'synced' | 'conflict' | 'error';
      message?: string;
      conflictId?: string;
    }> = [];

    for (const change of changes) {
      try {
        // Idempotency check - skip if already processed
        const existingAudit = await OfflineAuditLog.findOne({
          where: {
            changeHash: change.changeHash,
            entityId: change.entityId,
          },
        });

        if (existingAudit) {
          results.push({
            changeId: change.id,
            status: 'synced',
            message: 'Already processed',
          });
          continue;
        }

        // Process based on entity type
        if (change.entityType === 'treatment') {
          const result = await syncTreatmentChange(change, userId!, deviceId, offlineSince);
          results.push({ changeId: change.id, ...result });
        } else if (change.entityType === 'applicator') {
          const result = await syncApplicatorChange(change, userId!, deviceId, offlineSince);
          results.push({ changeId: change.id, ...result });
        } else {
          results.push({
            changeId: change.id,
            status: 'error',
            message: 'Unknown entity type',
          });
        }
      } catch (changeError) {
        logger.error(`[Offline] Sync change error: ${change.id}`, changeError);
        results.push({
          changeId: change.id,
          status: 'error',
          message: 'Failed to process change',
        });
      }
    }

    // Summary
    const synced = results.filter(r => r.status === 'synced').length;
    const conflicts = results.filter(r => r.status === 'conflict').length;
    const errors = results.filter(r => r.status === 'error').length;

    logger.info(`[Offline] Sync completed: user=${userId} device=${deviceId} synced=${synced} conflicts=${conflicts} errors=${errors}`);

    return res.status(200).json({
      success: true,
      results,
      summary: {
        total: changes.length,
        synced,
        conflicts,
        errors,
      },
    });
  } catch (error) {
    logger.error('[Offline] Sync error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to sync changes',
    });
  }
};

/**
 * Sync a treatment change
 */
async function syncTreatmentChange(
  change: SyncChange,
  userId: string,
  deviceId: string,
  offlineSince: string
): Promise<{ status: 'synced' | 'conflict' | 'error'; message?: string; conflictId?: string }> {
  const treatment = await Treatment.findByPk(change.entityId);

  if (!treatment) {
    return { status: 'error', message: 'Treatment not found' };
  }

  // Version conflict check
  if (treatment.version !== change.localVersion) {
    // Create conflict record
    const conflict = await SyncConflict.create({
      entityType: 'treatment',
      entityId: change.entityId,
      localData: change.data,
      serverData: treatment.toJSON() as unknown as Record<string, unknown>,
      conflictType: 'version_mismatch',
      deviceId,
      userId,
    });

    return {
      status: 'conflict',
      message: 'Version mismatch - treatment was modified on server',
      conflictId: conflict.id,
    };
  }

  // Apply changes
  await treatment.update({
    ...change.data,
    lastSyncedAt: new Date(),
    deviceId,
  });

  // Create audit log
  await OfflineAuditLog.create({
    entityType: 'treatment',
    entityId: change.entityId,
    operation: change.operation,
    changedBy: userId,
    deviceId,
    offlineSince: new Date(offlineSince),
    offlineChangedAt: new Date(change.changedAt),
    syncedAt: new Date(),
    changeHash: change.changeHash,
    beforeState: treatment.toJSON() as unknown as Record<string, unknown>,
    afterState: change.data,
    metadata: {},
  });

  return { status: 'synced' };
}

/**
 * Sync an applicator change
 */
async function syncApplicatorChange(
  change: SyncChange,
  userId: string,
  deviceId: string,
  offlineSince: string
): Promise<{ status: 'synced' | 'conflict' | 'error'; message?: string; conflictId?: string }> {
  const applicator = await Applicator.findByPk(change.entityId);

  if (!applicator) {
    return { status: 'error', message: 'Applicator not found' };
  }

  // Version conflict check
  if (applicator.version !== change.localVersion) {
    const serverData = applicator.toJSON() as unknown as Record<string, unknown>;
    const needsAdmin = requiresAdminResolution('applicator', change.data, serverData);

    // Create conflict record
    const conflict = await SyncConflict.create({
      entityType: 'applicator',
      entityId: change.entityId,
      localData: change.data,
      serverData,
      conflictType: needsAdmin ? 'status_conflict' : 'version_mismatch',
      deviceId,
      userId,
    });

    return {
      status: 'conflict',
      message: needsAdmin
        ? 'Medical status conflict - requires admin resolution'
        : 'Version mismatch - applicator was modified on server',
      conflictId: conflict.id,
    };
  }

  // Apply changes and reset offline flag after successful sync
  await applicator.update({
    ...change.data,
    syncedAt: new Date(),
    createdOffline: false,
  });

  // Create audit log
  await OfflineAuditLog.create({
    entityType: 'applicator',
    entityId: change.entityId,
    operation: change.operation,
    changedBy: userId,
    deviceId,
    offlineSince: new Date(offlineSince),
    offlineChangedAt: new Date(change.changedAt),
    syncedAt: new Date(),
    changeHash: change.changeHash,
    beforeState: applicator.toJSON() as unknown as Record<string, unknown>,
    afterState: change.data,
    metadata: {},
  });

  return { status: 'synced' };
}

/**
 * GET /api/offline/conflicts
 *
 * Get all unresolved conflicts for the current user
 */
export const getConflicts = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const isAdminUser = isAdmin(req.user);

    // Admins see all conflicts, users see only their own
    const whereClause = isAdminUser ? {} : { userId };

    const conflicts = await SyncConflict.findAll({
      where: {
        ...whereClause,
        resolvedAt: { [Op.is]: null },
      } as Record<string, unknown>,
      order: [['createdAt', 'DESC']],
    });

    return res.status(200).json({
      success: true,
      conflicts: conflicts.map(c => ({
        ...c.toJSON(),
        requiresAdmin: c.requiresAdminResolution(),
      })),
    });
  } catch (error) {
    logger.error('[Offline] Get conflicts error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get conflicts',
    });
  }
};

/**
 * POST /api/offline/conflicts/:id/resolve
 *
 * Resolve a sync conflict
 */
export const resolveConflict = async (req: ConflictResolutionRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { resolution, adminOverride } = req.body;
    const userId = req.user?.id;
    const isAdminUser = isAdmin(req.user);

    const conflict = await SyncConflict.findByPk(id);

    if (!conflict) {
      return res.status(404).json({
        success: false,
        error: 'Conflict not found',
      });
    }

    if (conflict.resolvedAt) {
      return res.status(400).json({
        success: false,
        error: 'Conflict already resolved',
      });
    }

    // Check admin requirement
    if (conflict.requiresAdminResolution() && !isAdminUser) {
      return res.status(403).json({
        success: false,
        error: 'This conflict requires admin resolution',
      });
    }

    // Apply resolution
    const winningData = resolution === 'local_wins' ? conflict.localData : conflict.serverData;
    const overwrittenData = resolution === 'local_wins' ? conflict.serverData : conflict.localData;

    if (conflict.entityType === 'treatment') {
      await Treatment.update(winningData, {
        where: { id: conflict.entityId },
      });
    } else if (conflict.entityType === 'applicator') {
      await Applicator.update(winningData, {
        where: { id: conflict.entityId },
      });
    }

    // Update conflict record
    await conflict.update({
      resolvedAt: new Date(),
      resolvedBy: userId,
      resolution: adminOverride ? 'admin_override' : resolution,
      overwrittenData,
    });

    logger.info(`[Offline] Conflict resolved: conflict=${id} resolution=${resolution} user=${userId}`);

    return res.status(200).json({
      success: true,
      message: 'Conflict resolved successfully',
    });
  } catch (error) {
    logger.error('[Offline] Resolve conflict error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to resolve conflict',
    });
  }
};

/**
 * GET /api/time
 *
 * Clock synchronization endpoint for accurate offline timestamps
 */
export const getServerTime = async (req: Request, res: Response) => {
  try {
    const now = new Date();
    return res.status(200).json({
      timestamp: now.toISOString(),
      serverTime: now.getTime(),
    });
  } catch (error) {
    logger.error('[Offline] Time sync error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get server time',
    });
  }
};
