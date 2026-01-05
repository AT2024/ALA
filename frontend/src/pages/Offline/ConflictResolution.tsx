/**
 * ConflictResolution Page
 *
 * Displays and resolves sync conflicts.
 * Medical status conflicts require admin resolution.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Shield, Check, X, ArrowLeft, RefreshCw } from 'lucide-react';
import { useOffline } from '@/context/OfflineContext';
import { offlineDb, OfflineConflict } from '@/services/indexedDbService';
import api from '@/services/api';
import { cn } from '@/lib/utils';

export function ConflictResolution() {
  const navigate = useNavigate();
  const { refreshDownloadedTreatments } = useOffline();
  const [conflicts, setConflicts] = useState<OfflineConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch conflicts
  useEffect(() => {
    loadConflicts();
  }, []);

  const loadConflicts = async () => {
    try {
      setLoading(true);
      const localConflicts = await offlineDb.getConflicts();
      setConflicts(localConflicts);
    } catch (err) {
      console.error('Failed to load conflicts:', err);
      setError('Failed to load conflicts');
    } finally {
      setLoading(false);
    }
  };

  // Resolve a conflict
  const handleResolve = async (conflict: OfflineConflict, resolution: 'local_wins' | 'server_wins') => {
    if (!conflict.id) return;

    try {
      setResolving(conflict.id);
      setError(null);

      // Call server to resolve
      await api.post(`/offline/conflicts/${conflict.id}/resolve`, {
        resolution,
      });

      // Remove from local storage
      await offlineDb.removeConflict(conflict.id);

      // Refresh lists
      await loadConflicts();
      await refreshDownloadedTreatments();
    } catch (err) {
      console.error('Failed to resolve conflict:', err);
      setError('Failed to resolve conflict. Please try again.');
    } finally {
      setResolving(null);
    }
  };

  // Format value for display
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  // Get changed fields between local and server
  const getChangedFields = (local: Record<string, unknown>, server: Record<string, unknown>) => {
    const changes: Array<{ field: string; local: unknown; server: unknown }> = [];
    const allKeys = new Set([...Object.keys(local), ...Object.keys(server)]);

    for (const key of allKeys) {
      if (JSON.stringify(local[key]) !== JSON.stringify(server[key])) {
        changes.push({
          field: key,
          local: local[key],
          server: server[key],
        });
      }
    }

    return changes;
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

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
              <h1 className="text-xl font-semibold text-gray-900">Sync Conflicts</h1>
              <p className="text-sm text-gray-600">
                {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} to resolve
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-6">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {conflicts.length === 0 ? (
          <div className="rounded-lg bg-white p-8 text-center shadow">
            <Check className="mx-auto h-12 w-12 text-green-500" />
            <h2 className="mt-4 text-lg font-medium text-gray-900">No Conflicts</h2>
            <p className="mt-2 text-gray-600">
              All your changes have been synced successfully.
            </p>
            <button
              onClick={() => navigate('/')}
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Return Home
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {conflicts.map((conflict) => {
              const changes = getChangedFields(conflict.localData, conflict.serverData);

              return (
                <div
                  key={conflict.id}
                  className="rounded-lg bg-white shadow"
                >
                  {/* Conflict header */}
                  <div className={cn(
                    'flex items-center gap-3 rounded-t-lg px-4 py-3',
                    conflict.requiresAdmin ? 'bg-red-50' : 'bg-yellow-50'
                  )}>
                    {conflict.requiresAdmin ? (
                      <Shield className="h-5 w-5 text-red-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    )}
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {conflict.entityType === 'treatment' ? 'Treatment' : 'Applicator'} Conflict
                      </h3>
                      <p className="text-sm text-gray-600">
                        ID: {conflict.entityId.slice(0, 8)}...
                      </p>
                    </div>
                    {conflict.requiresAdmin && (
                      <span className="ml-auto rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
                        Requires Admin
                      </span>
                    )}
                  </div>

                  {/* Changes table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-gray-600">Field</th>
                          <th className="px-4 py-2 text-left font-medium text-blue-600">Your Change</th>
                          <th className="px-4 py-2 text-left font-medium text-green-600">Server Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {changes.map((change, idx) => (
                          <tr key={change.field} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-2 font-medium text-gray-900">{change.field}</td>
                            <td className="px-4 py-2 text-blue-700">{formatValue(change.local)}</td>
                            <td className="px-4 py-2 text-green-700">{formatValue(change.server)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-3 border-t border-gray-200 px-4 py-3">
                    <button
                      onClick={() => handleResolve(conflict, 'server_wins')}
                      disabled={resolving === conflict.id}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium',
                        resolving === conflict.id
                          ? 'cursor-not-allowed bg-gray-100'
                          : 'hover:bg-gray-50'
                      )}
                    >
                      <X className="h-4 w-4" />
                      Keep Server
                    </button>
                    <button
                      onClick={() => handleResolve(conflict, 'local_wins')}
                      disabled={resolving === conflict.id || conflict.requiresAdmin}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white',
                        resolving === conflict.id || conflict.requiresAdmin
                          ? 'cursor-not-allowed bg-gray-400'
                          : 'bg-blue-600 hover:bg-blue-700'
                      )}
                    >
                      {resolving === conflict.id ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      {conflict.requiresAdmin ? 'Requires Admin' : 'Apply My Change'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default ConflictResolution;
