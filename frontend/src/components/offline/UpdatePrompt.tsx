/**
 * UpdatePrompt Component
 *
 * Shows a non-intrusive notification when a new version is available.
 * CRITICAL: For medical safety, updates are NOT applied automatically.
 * Users must explicitly choose when to update.
 */

import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UpdatePromptProps {
  className?: string;
}

export function UpdatePrompt({ className }: UpdatePromptProps) {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(registration) {
      console.log('[PWA] Service worker registered:', registration);
    },
    onRegisterError(error) {
      console.error('[PWA] Service worker registration error:', error);
    },
  });

  const handleUpdate = () => {
    updateServiceWorker(true);
  };

  const handleDismiss = () => {
    setNeedRefresh(false);
  };

  if (!needRefresh) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50',
        'rounded-lg bg-primary text-white shadow-lg',
        'animate-in slide-in-from-bottom duration-300',
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3 p-4">
        <RefreshCw className="h-5 w-5 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-medium">Update Available</h4>
          <p className="mt-1 text-sm text-white/80">
            A new version of the app is available. Update when you&apos;re ready.
          </p>
          <div className="mt-3 flex gap-3">
            <button
              onClick={handleUpdate}
              className="rounded bg-white px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
            >
              Update Now
            </button>
            <button
              onClick={handleDismiss}
              className="rounded border border-white/40 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/80 transition-colors"
            >
              Later
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="rounded p-1 hover:bg-primary/80"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default UpdatePrompt;
