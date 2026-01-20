/**
 * OfflineBanner Component
 *
 * Displays network status and sync information.
 * States:
 * - Hidden: Online with no pending changes
 * - Yellow: Offline mode (no time limit)
 * - Blue: Online with pending changes and sync button
 * - Red: Conflicts exist requiring resolution
 */

import { useState, useEffect } from 'react';
import { WifiOff, RefreshCw, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';
import { useOffline, useOfflineDuration } from '@/context/OfflineContext';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

interface OfflineBannerProps {
  className?: string;
}

type BannerState = 'hidden' | 'offline' | 'pending' | 'syncing' | 'conflict' | 'success';

export function OfflineBanner({ className }: OfflineBannerProps) {
  const { isAuthenticated } = useAuth();
  const {
    isOnline,
    syncStatus,
    pendingChangesCount,
    conflictsCount,
    syncNow,
    lastSyncResult,
  } = useOffline();

  const offlineDuration = useOfflineDuration();
  const [bannerState, setBannerState] = useState<BannerState>('hidden');
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  // Calculate banner state
  useEffect(() => {
    // Don't show banner for unauthenticated users
    if (!isAuthenticated) {
      setBannerState('hidden');
      return;
    }

    // Safety: Use navigator.onLine as fallback for stale context state
    const actuallyOnline = typeof navigator !== 'undefined' ? navigator.onLine : isOnline;
    const effectiveIsOnline = isOnline || actuallyOnline;

    if (conflictsCount > 0) {
      setBannerState('conflict');
    } else if (syncStatus === 'syncing') {
      setBannerState('syncing');
    } else if (!effectiveIsOnline) {
      setBannerState('offline');
    } else if (pendingChangesCount > 0) {
      setBannerState('pending');
    } else if (showSuccessMessage && lastSyncResult?.success) {
      setBannerState('success');
    } else {
      setBannerState('hidden');
    }
  }, [isAuthenticated, isOnline, syncStatus, pendingChangesCount, conflictsCount, showSuccessMessage, lastSyncResult]);

  // NOTE: Session timeout countdown REMOVED - users can stay offline indefinitely

  // Show success message briefly after sync
  useEffect(() => {
    if (lastSyncResult?.success && lastSyncResult.synced > 0) {
      setShowSuccessMessage(true);
      const timeout = setTimeout(() => {
        setShowSuccessMessage(false);
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [lastSyncResult]);

  // Handle sync button click
  const handleSync = async () => {
    await syncNow();
  };

  // Don't render if hidden
  if (bannerState === 'hidden') {
    return null;
  }

  // Banner styles based on state
  const bannerStyles: Record<BannerState, string> = {
    hidden: '',
    offline: 'bg-yellow-500 text-yellow-900',
    pending: 'bg-primary text-white',
    syncing: 'bg-primary text-white',
    conflict: 'bg-red-500 text-white',
    success: 'bg-green-500 text-white',
  };

  // Render content based on state
  const renderContent = () => {
    switch (bannerState) {
      case 'offline':
        return (
          <>
            <div className="flex items-center gap-2">
              <WifiOff className="h-4 w-4" />
              <span className="font-medium">Offline</span>
              {offlineDuration && <span className="text-sm opacity-75">({offlineDuration})</span>}
            </div>
            <span className="text-sm">Changes saved locally</span>
          </>
        );

      case 'pending':
        return (
          <>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span>
                {pendingChangesCount} pending change{pendingChangesCount !== 1 ? 's' : ''}
              </span>
            </div>
            <button
              onClick={handleSync}
              className="flex items-center gap-1 rounded bg-white/20 px-3 py-1 text-sm font-medium hover:bg-white/30 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Sync Now
            </button>
          </>
        );

      case 'syncing':
        return (
          <>
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Syncing changes...</span>
            </div>
          </>
        );

      case 'conflict':
        return (
          <>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>
                {conflictsCount} conflict{conflictsCount !== 1 ? 's' : ''} require resolution
              </span>
            </div>
            <a
              href="/offline/conflicts"
              className="rounded bg-white/20 px-3 py-1 text-sm font-medium hover:bg-white/30 transition-colors"
            >
              Resolve
            </a>
          </>
        );

      case 'success':
        return (
          <>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <span>
                {lastSyncResult?.synced} change{lastSyncResult?.synced !== 1 ? 's' : ''} synced successfully
              </span>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2 text-sm',
        bannerStyles[bannerState],
        className
      )}
      role="alert"
      aria-live="polite"
    >
      {renderContent()}
    </div>
  );
}

export default OfflineBanner;
