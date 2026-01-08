/**
 * OfflineDownloadButton Component
 *
 * Button to download a treatment for offline use.
 * States:
 * - Download icon: Not downloaded
 * - Spinner: Downloading
 * - Green checkmark: Downloaded
 * - Error icon: Failed
 */

import { useState } from 'react';
import { Download, Check, X, Loader2, Trash2 } from 'lucide-react';
import { useOffline } from '@/context/OfflineContext';
import { cn } from '@/lib/utils';
import api from '@/services/api';
import { offlineDb } from '@/services/indexedDbService';
import { storageService } from '@/services/storageService';
import { encryptionKeyService } from '@/services/encryptionKeyService';
import { getOrCreateDeviceId } from '@/services/syncService';

interface OfflineDownloadButtonProps {
  treatmentId: string;
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

type DownloadState = 'not_downloaded' | 'downloading' | 'downloaded' | 'error' | 'expired';

export function OfflineDownloadButton({
  treatmentId,
  className,
  showLabel = false,
  size = 'md',
}: OfflineDownloadButtonProps) {
  const { isDownloaded, refreshDownloadedTreatments, isOnline, refreshStorageStats } = useOffline();
  const [state, setState] = useState<DownloadState>(isDownloaded(treatmentId) ? 'downloaded' : 'not_downloaded');
  const [error, setError] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // Size classes
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-10 w-10',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  // Handle download
  const handleDownload = async () => {
    if (!isOnline) {
      setError('Cannot download while offline');
      return;
    }

    try {
      setState('downloading');
      setError(null);

      // Check storage space
      const hasSpace = await storageService.hasSpaceForWrite(50 * 1024); // Estimate 50KB
      if (!hasSpace) {
        setError('Insufficient storage space');
        setState('error');
        return;
      }

      // Get device ID (uses centralized helper from syncService)
      const deviceId = getOrCreateDeviceId();

      // Fetch bundle from server
      const response = await api.post('/offline/download-bundle', {
        treatmentId,
        deviceId,
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Download failed');
      }

      const { bundle } = response.data;

      // Ensure encryption is initialized from derived key
      // The key is derived from user credentials stored during login
      if (!offlineDb.isEncryptionReady()) {
        const derivedKey = await encryptionKeyService.getDerivedKey();
        if (derivedKey) {
          offlineDb.initializeEncryption(derivedKey);
        } else {
          console.warn('[OfflineDownloadButton] No encryption key available - data will not be encrypted');
        }
      }

      // Save treatment to IndexedDB
      await offlineDb.saveTreatment({
        id: bundle.treatment.id,
        type: bundle.treatment.type,
        subjectId: bundle.treatment.subjectId,
        patientName: bundle.treatment.patientName,
        site: bundle.treatment.site,
        date: bundle.treatment.date,
        isComplete: bundle.treatment.isComplete,
        userId: bundle.treatment.userId,
        surgeon: bundle.treatment.surgeon,
        seedQuantity: bundle.treatment.seedQuantity,
        activityPerSeed: bundle.treatment.activityPerSeed,
        version: bundle.treatment.version,
        syncStatus: 'synced',
        downloadedAt: bundle.downloadedAt,
        expiresAt: bundle.expiresAt,
        serverVersion: bundle.serverVersion,
      });

      // Save applicators
      if (bundle.applicators && bundle.applicators.length > 0) {
        await offlineDb.saveApplicators(
          bundle.applicators.map((app: any) => ({
            id: app.id,
            serialNumber: app.serialNumber,
            seedQuantity: app.seedQuantity,
            status: app.status,
            packageLabel: app.packageLabel,
            insertionTime: app.insertionTime,
            comments: app.comments,
            treatmentId: app.treatmentId,
            addedBy: app.addedBy,
            isRemoved: app.isRemoved,
            removalComments: app.removalComments,
            removalTime: app.removalTime,
            removedBy: app.removedBy,
            applicatorType: app.applicatorType,
            catalog: app.catalog,
            seedLength: app.seedLength,
            version: app.version,
            syncStatus: 'synced',
            createdOffline: false,
          }))
        );
      }

      // Refresh state
      await refreshDownloadedTreatments();
      await refreshStorageStats();

      setState('downloaded');

      // Show success toast
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 5000);
    } catch (err) {
      console.error('[OfflineDownloadButton] Download error:', err);
      setError(err instanceof Error ? err.message : 'Download failed');
      setState('error');
    }
  };

  // Handle remove
  const handleRemove = async () => {
    try {
      await offlineDb.deleteTreatment(treatmentId);
      await refreshDownloadedTreatments();
      await refreshStorageStats();
      setState('not_downloaded');
      setShowMenu(false);
    } catch (err) {
      console.error('[OfflineDownloadButton] Remove error:', err);
      setError('Failed to remove');
    }
  };

  // Render based on state
  const renderButton = () => {
    switch (state) {
      case 'not_downloaded':
        return (
          <button
            onClick={handleDownload}
            disabled={!isOnline}
            className={cn(
              'flex items-center justify-center rounded-full transition-colors',
              sizeClasses[size],
              isOnline
                ? 'bg-primary/20 text-primary hover:bg-primary/30'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed',
              className
            )}
            title={isOnline ? 'Download for offline use' : 'Cannot download while offline'}
            aria-label="Download for offline use"
          >
            <Download className={iconSizes[size]} />
          </button>
        );

      case 'downloading':
        return (
          <div
            className={cn(
              'flex items-center justify-center rounded-full bg-primary/20 text-primary',
              sizeClasses[size],
              className
            )}
            aria-label="Downloading..."
          >
            <Loader2 className={cn(iconSizes[size], 'animate-spin')} />
          </div>
        );

      case 'downloaded':
        return (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className={cn(
                'flex items-center justify-center rounded-full bg-green-100 text-green-600 hover:bg-green-200 transition-colors',
                sizeClasses[size],
                className
              )}
              title="Downloaded - Click for options"
              aria-label="Downloaded for offline use"
            >
              <Check className={iconSizes[size]} />
            </button>

            {showMenu && (
              <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-lg border py-1 z-10 min-w-[120px]">
                <button
                  onClick={handleRemove}
                  className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <Trash2 className="h-3 w-3" />
                  Remove
                </button>
              </div>
            )}
          </div>
        );

      case 'error':
        return (
          <button
            onClick={handleDownload}
            className={cn(
              'flex items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors',
              sizeClasses[size],
              className
            )}
            title={error || 'Download failed - Click to retry'}
            aria-label="Download failed - Click to retry"
          >
            <X className={iconSizes[size]} />
          </button>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <div className="inline-flex items-center gap-2">
        {renderButton()}
        {showLabel && (
          <span className="text-sm text-gray-600">
            {state === 'downloaded' && 'Available offline'}
            {state === 'downloading' && 'Downloading...'}
            {state === 'error' && error}
            {state === 'not_downloaded' && 'Download for offline'}
          </span>
        )}
      </div>

      {/* Success Toast - "Ready for offline use" */}
      {showSuccessToast && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50
                        bg-green-600 text-white rounded-lg shadow-lg p-4 animate-pulse">
          <div className="flex items-start gap-3">
            <Check className="h-6 w-6 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Ready for offline use</p>
              <p className="text-sm text-green-100 mt-1">
                Don't close the app while working offline. Your changes will sync when you reconnect.
              </p>
            </div>
            <button
              onClick={() => setShowSuccessToast(false)}
              className="ml-auto text-green-200 hover:text-white"
              aria-label="Dismiss"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default OfflineDownloadButton;
