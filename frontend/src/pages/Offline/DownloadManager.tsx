/**
 * DownloadManager Page
 *
 * Manages downloaded treatments for offline use.
 * Shows storage usage, expiry countdowns, and allows removal.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Database,
  Clock,
  Trash2,
  AlertTriangle,
  HardDrive,
  RefreshCw,
  Download,
  WifiOff
} from 'lucide-react';
import { useOffline } from '@/context/OfflineContext';
import { storageService } from '@/services/storageService';
import { cn } from '@/lib/utils';

export function DownloadManager() {
  const navigate = useNavigate();
  const {
    downloadedTreatments,
    removeTreatment,
    refreshDownloadedTreatments,
    storageStats,
    refreshStorageStats,
    isStorageLow,
    isOnline,
  } = useOffline();

  const [removing, setRemoving] = useState<string | null>(null);
  const [showIosWarning, setShowIosWarning] = useState(false);

  // Check for iOS
  useEffect(() => {
    if (storageService.isIos()) {
      setShowIosWarning(true);
    }
  }, []);

  // Handle remove treatment
  const handleRemove = async (treatmentId: string) => {
    try {
      setRemoving(treatmentId);
      await removeTreatment(treatmentId);
      await refreshStorageStats();
    } catch (error) {
      console.error('Failed to remove treatment:', error);
    } finally {
      setRemoving(null);
    }
  };

  // Calculate time remaining
  const getTimeRemaining = (expiresAt: string) => {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const diffMs = expiry.getTime() - now.getTime();

    if (diffMs <= 0) return 'Expired';

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Check if expiring soon (within 2 hours)
  const isExpiringSoon = (expiresAt: string) => {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const diffMs = expiry.getTime() - now.getTime();
    return diffMs > 0 && diffMs < 2 * 60 * 60 * 1000;
  };

  // Check if expired
  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) <= new Date();
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="rounded-lg p-2 hover:bg-gray-100"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Offline Downloads</h1>
              <p className="text-sm text-gray-600">
                {downloadedTreatments.length} treatment{downloadedTreatments.length !== 1 ? 's' : ''} available
              </p>
            </div>
            <button
              onClick={refreshDownloadedTreatments}
              className="ml-auto rounded-lg p-2 hover:bg-gray-100"
              aria-label="Refresh"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
        {/* Storage meter */}
        {storageStats?.storageEstimate && (
          <div className="rounded-lg bg-white p-4 shadow">
            <div className="flex items-center gap-3 mb-3">
              <HardDrive className="h-5 w-5 text-gray-500" />
              <span className="font-medium text-gray-900">Storage Usage</span>
            </div>
            <div className="h-3 w-full rounded-full bg-gray-200 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  storageStats.storageEstimate.percentUsed > 80 ? 'bg-red-500' :
                  storageStats.storageEstimate.percentUsed > 60 ? 'bg-yellow-500' : 'bg-green-500'
                )}
                style={{ width: `${Math.min(storageStats.storageEstimate.percentUsed, 100)}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-sm text-gray-600">
              <span>
                {storageService.formatBytes(storageStats.storageEstimate.used)} used
              </span>
              <span>
                {storageService.formatBytes(storageStats.storageEstimate.available)} available
              </span>
            </div>
            {isStorageLow && (
              <div className="mt-3 flex items-center gap-2 text-sm text-yellow-700 bg-yellow-50 rounded p-2">
                <AlertTriangle className="h-4 w-4" />
                <span>Storage is running low. Consider removing old downloads.</span>
              </div>
            )}
          </div>
        )}

        {/* iOS Warning */}
        {showIosWarning && (
          <div className="rounded-lg bg-yellow-50 p-4 shadow">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-yellow-800">iOS Storage Warning</h3>
                <p className="mt-1 text-sm text-yellow-700">
                  {storageService.getIosWarningMessage()}
                </p>
              </div>
              <button
                onClick={() => setShowIosWarning(false)}
                className="ml-auto text-yellow-600 hover:text-yellow-800"
                aria-label="Dismiss"
              >
                &times;
              </button>
            </div>
          </div>
        )}

        {/* Downloaded treatments */}
        {downloadedTreatments.length === 0 ? (
          <div className="rounded-lg bg-white p-8 text-center shadow">
            <WifiOff className="mx-auto h-12 w-12 text-gray-400" />
            <h2 className="mt-4 text-lg font-medium text-gray-900">No Offline Downloads</h2>
            <p className="mt-2 text-gray-600">
              Download treatments to work offline when you don&apos;t have a network connection.
            </p>
            {isOnline && (
              <button
                onClick={() => navigate('/procedure')}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                <Download className="h-4 w-4" />
                Start New Treatment
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {downloadedTreatments.map((treatment) => {
              const expired = isExpired(treatment.expiresAt);
              const expiringSoon = !expired && isExpiringSoon(treatment.expiresAt);

              return (
                <div
                  key={treatment.id}
                  className={cn(
                    'rounded-lg bg-white p-4 shadow',
                    expired && 'opacity-60'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-gray-400" />
                        <span className="font-medium text-gray-900">
                          {treatment.patientName || treatment.subjectId}
                        </span>
                        {expired && (
                          <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                            Expired
                          </span>
                        )}
                        {expiringSoon && (
                          <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                            Expiring Soon
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-sm text-gray-600">
                        <span className="capitalize">{treatment.type}</span>
                        {' • '}
                        {treatment.site}
                        {' • '}
                        {new Date(treatment.date).toLocaleDateString()}
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemove(treatment.id)}
                      disabled={removing === treatment.id}
                      className={cn(
                        'rounded-lg p-2 text-red-600 hover:bg-red-50',
                        removing === treatment.id && 'opacity-50'
                      )}
                      aria-label="Remove download"
                    >
                      {removing === treatment.id ? (
                        <RefreshCw className="h-5 w-5 animate-spin" />
                      ) : (
                        <Trash2 className="h-5 w-5" />
                      )}
                    </button>
                  </div>

                  {/* Expiry countdown */}
                  <div className={cn(
                    'mt-3 flex items-center gap-2 text-sm',
                    expired ? 'text-red-600' :
                    expiringSoon ? 'text-yellow-600' : 'text-gray-500'
                  )}>
                    <Clock className="h-4 w-4" />
                    <span>
                      {expired ? 'Data expired - please re-download' : (
                        <>Expires in {getTimeRemaining(treatment.expiresAt)}</>
                      )}
                    </span>
                  </div>

                  {/* Download info */}
                  <div className="mt-2 text-xs text-gray-400">
                    Downloaded {new Date(treatment.downloadedAt).toLocaleString()}
                    {' • '}
                    Version {treatment.serverVersion}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Clear all button */}
        {downloadedTreatments.length > 0 && (
          <div className="flex justify-center">
            <button
              onClick={async () => {
                if (confirm('Remove all downloaded treatments? This cannot be undone.')) {
                  for (const treatment of downloadedTreatments) {
                    await removeTreatment(treatment.id);
                  }
                  await refreshStorageStats();
                }
              }}
              className="text-sm text-red-600 hover:text-red-800 underline"
            >
              Clear All Downloads
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default DownloadManager;
