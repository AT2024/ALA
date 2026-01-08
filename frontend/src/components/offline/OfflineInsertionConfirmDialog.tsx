/**
 * OfflineInsertionConfirmDialog Component
 *
 * Double-confirmation dialog for setting INSERTED status while offline.
 * CRITICAL SAFETY: This ensures users understand the implications of
 * marking an applicator as INSERTED while offline.
 */

import { useState } from 'react';
import { AlertTriangle, CheckCircle, X, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OfflineInsertionConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  applicatorSerial: string;
  status: 'INSERTED' | 'FAULTY';
}

export function OfflineInsertionConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  applicatorSerial,
  status,
}: OfflineInsertionConfirmDialogProps) {
  const [confirmed, setConfirmed] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (confirmed) {
      onConfirm();
      onClose();
      setConfirmed(false);
    }
  };

  const handleClose = () => {
    setConfirmed(false);
    onClose();
  };

  const isInserted = status === 'INSERTED';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className={cn(
          'flex items-center gap-3 rounded-t-lg px-4 py-3',
          isInserted ? 'bg-yellow-50' : 'bg-red-50'
        )}>
          <div className={cn(
            'flex h-10 w-10 items-center justify-center rounded-full',
            isInserted ? 'bg-yellow-100' : 'bg-red-100'
          )}>
            <AlertTriangle className={cn(
              'h-5 w-5',
              isInserted ? 'text-yellow-600' : 'text-red-600'
            )} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Offline Status Change
            </h2>
            <p className="text-sm text-gray-600">
              {applicatorSerial}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="ml-auto rounded p-1 hover:bg-gray-200"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-4">
          <div className="mb-4 flex items-start gap-3 rounded-lg bg-yellow-50 p-3">
            <WifiOff className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium">You are currently offline</p>
              <p className="mt-1">
                You are about to mark this applicator as <strong>{status}</strong> while offline.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-medium text-gray-900">What happens next:</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                <span>This change will be saved locally on your device</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                <span>When you reconnect, the change will be synced to the server</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-500" />
                <span>This action will be flagged for verification during sync</span>
              </li>
              {isInserted && (
                <li className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-500" />
                  <span>If there&apos;s a conflict, an administrator will need to resolve it</span>
                </li>
              )}
            </ul>
          </div>

          {/* Confirmation checkbox */}
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span className="text-sm text-gray-700">
              I understand that I am marking this applicator as <strong>{status}</strong> while offline,
              and this action will be synced and verified when I reconnect.
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-gray-200 px-4 py-3">
          <button
            onClick={handleClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!confirmed}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-medium text-white',
              confirmed
                ? isInserted
                  ? 'bg-yellow-600 hover:bg-yellow-700'
                  : 'bg-red-600 hover:bg-red-700'
                : 'cursor-not-allowed bg-gray-400'
            )}
          >
            Confirm {status}
          </button>
        </div>
      </div>
    </div>
  );
}

export default OfflineInsertionConfirmDialog;
