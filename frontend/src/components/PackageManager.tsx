import { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import api from '@/services/api';

interface Applicator {
  id: string;
  serialNumber: string;
  applicatorType?: string;
  seedQuantity: number;
  usageType: 'full' | 'faulty' | 'none';
  insertionTime: string;
  insertedSeedsQty?: number;
  comments?: string;
  image?: string;
  isRemoved?: boolean;
  removalComments?: string;
  removalImage?: string;
  returnedFromNoUse?: boolean;
  patientId?: string;
  attachmentFileCount?: number;
  attachmentSyncStatus?: 'pending' | 'syncing' | 'synced' | 'failed' | null;
  attachmentFilename?: string;
  status?: 'SEALED' | 'OPENED' | 'LOADED' | 'INSERTED' | 'FAULTY' | 'DISPOSED' | 'DISCHARGED' | 'DEPLOYMENT_FAILURE' | 'UNACCOUNTED';
  package_label?: string;
}

interface PackageManagerProps {
  treatmentId: string;
  processedApplicators: Applicator[];
  onPackageCreated: () => void;
}

interface PackageSummary {
  seedQuantity: number;
  inserted: number;
  available: number;
  loaded: number;
  packaged: number;
}

const PackageManager = ({ treatmentId, processedApplicators, onPackageCreated }: PackageManagerProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedApplicators, setSelectedApplicators] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Calculate summary data by applicator type (seed quantity)
  const calculateSummary = (): PackageSummary[] => {
    const summaryMap: { [key: number]: PackageSummary } = {};

    processedApplicators.forEach((app) => {
      if (!summaryMap[app.seedQuantity]) {
        summaryMap[app.seedQuantity] = {
          seedQuantity: app.seedQuantity,
          inserted: 0,
          available: 0,
          loaded: 0,
          packaged: 0,
        };
      }

      const status = app.status || (app.usageType === 'full' ? 'INSERTED' : app.usageType === 'faulty' ? 'FAULTY' : 'SEALED');

      if (status === 'INSERTED') {
        summaryMap[app.seedQuantity].inserted++;
      }

      if (status === 'SEALED' || status === 'OPENED' || status === 'LOADED') {
        summaryMap[app.seedQuantity].available++;
      }

      if (status === 'LOADED') {
        summaryMap[app.seedQuantity].loaded++;
      }

      if (app.package_label) {
        summaryMap[app.seedQuantity].packaged++;
      }
    });

    return Object.values(summaryMap).sort((a, b) => a.seedQuantity - b.seedQuantity);
  };

  // Get loaded applicators grouped by seed quantity
  const getLoadedApplicatorsByType = (): { [key: number]: Applicator[] } => {
    const grouped: { [key: number]: Applicator[] } = {};

    processedApplicators.forEach((app) => {
      const status = app.status || (app.usageType === 'full' ? 'INSERTED' : app.usageType === 'faulty' ? 'FAULTY' : 'SEALED');

      if (status === 'LOADED' && !app.package_label) {
        if (!grouped[app.seedQuantity]) {
          grouped[app.seedQuantity] = [];
        }
        grouped[app.seedQuantity].push(app);
      }
    });

    return grouped;
  };

  const handleOpenDialog = () => {
    setSelectedApplicators([]);
    setError(null);
    setSuccess(null);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedApplicators([]);
    setError(null);
  };

  const handleToggleApplicator = (applicatorId: string) => {
    setSelectedApplicators((prev) => {
      if (prev.includes(applicatorId)) {
        return prev.filter((id) => id !== applicatorId);
      } else {
        return [...prev, applicatorId];
      }
    });
  };

  const validateSelection = (): { valid: boolean; error?: string } => {
    if (selectedApplicators.length !== 4) {
      return { valid: false, error: 'You must select exactly 4 applicators' };
    }

    // Get seed quantities of selected applicators
    const selectedApps = processedApplicators.filter((app) => selectedApplicators.includes(app.id));
    const seedQuantities = new Set(selectedApps.map((app) => app.seedQuantity));

    if (seedQuantities.size > 1) {
      return { valid: false, error: 'All selected applicators must be of the same type (seed quantity)' };
    }

    // Verify all are LOADED status
    const allLoaded = selectedApps.every((app) => {
      const status = app.status || (app.usageType === 'full' ? 'INSERTED' : app.usageType === 'faulty' ? 'FAULTY' : 'SEALED');
      return status === 'LOADED';
    });

    if (!allLoaded) {
      return { valid: false, error: 'All selected applicators must have LOADED status' };
    }

    return { valid: true };
  };

  const handleCreatePackage = async () => {
    const validation = validateSelection();
    if (!validation.valid) {
      setError(validation.error || 'Invalid selection');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.post(`/treatments/${treatmentId}/package`, {
        applicatorIds: selectedApplicators,
      });

      const packageLabel = response.data.package_label;
      setSuccess(`Package ${packageLabel} created successfully!`);

      // Close dialog after short delay and trigger refresh
      setTimeout(() => {
        handleCloseDialog();
        onPackageCreated();
      }, 1500);
    } catch (err: any) {
      console.error('Error creating package:', err);
      setError(err.response?.data?.error || 'Failed to create package');
    } finally {
      setLoading(false);
    }
  };

  const summary = calculateSummary();
  const loadedByType = getLoadedApplicatorsByType();
  const hasLoadedApplicators = Object.keys(loadedByType).length > 0;

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium">Package Management</h2>
        <button
          onClick={handleOpenDialog}
          disabled={!hasLoadedApplicators}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Create Package
        </button>
      </div>

      {/* Success message */}
      {success && (
        <div className="mb-4 rounded-md bg-green-50 p-4 text-sm text-green-700 border border-green-200">
          {success}
        </div>
      )}

      {/* Summary Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Inserted
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Available
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Loaded
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Package
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {summary.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-sm text-gray-500 text-center">
                  No applicators processed yet
                </td>
              </tr>
            ) : (
              summary.map((item) => (
                <tr key={item.seedQuantity}>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    {item.seedQuantity} seed{item.seedQuantity > 1 ? 's' : ''}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {item.inserted}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {item.available}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {item.loaded}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {Math.floor(item.packaged / 4)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Package Creation Dialog */}
      <Transition appear show={isDialogOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={handleCloseDialog}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <Dialog.Title
                      as="h3"
                      className="text-lg font-medium leading-6 text-gray-900"
                    >
                      Create Package (Select 4 Applicators)
                    </Dialog.Title>
                    <button
                      onClick={handleCloseDialog}
                      className="text-gray-400 hover:text-gray-500"
                    >
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>

                  {/* Error message */}
                  {error && (
                    <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700 border border-red-200">
                      {error}
                    </div>
                  )}

                  {/* Success message */}
                  {success && (
                    <div className="mb-4 rounded-md bg-green-50 p-4 text-sm text-green-700 border border-green-200">
                      {success}
                    </div>
                  )}

                  {/* Selection info */}
                  <div className="mb-4 rounded-md bg-blue-50 p-4 text-sm text-blue-700">
                    Selected: {selectedApplicators.length} / 4 applicators
                  </div>

                  {/* Loaded applicators grouped by type */}
                  <div className="space-y-6 max-h-96 overflow-y-auto">
                    {Object.entries(loadedByType).map(([seedQuantity, applicators]) => (
                      <div key={seedQuantity}>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">
                          {seedQuantity} seed{parseInt(seedQuantity) > 1 ? 's' : ''} ({applicators.length} available)
                        </h4>
                        <div className="space-y-2">
                          {applicators.map((app) => (
                            <div
                              key={app.id}
                              onClick={() => handleToggleApplicator(app.id)}
                              className={`flex items-center justify-between p-3 border rounded-md cursor-pointer transition-colors ${
                                selectedApplicators.includes(app.id)
                                  ? 'border-primary bg-primary/10'
                                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={selectedApplicators.includes(app.id)}
                                  onChange={() => {}}
                                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                                />
                                <div>
                                  <p className="text-sm font-medium text-gray-900">
                                    {app.serialNumber}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    Type: {app.applicatorType || 'N/A'}
                                  </p>
                                </div>
                              </div>
                              <span className="inline-flex rounded-full px-2 py-1 text-xs font-semibold bg-yellow-50 border border-yellow-300 text-yellow-800">
                                LOADED
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Action buttons */}
                  <div className="mt-6 flex gap-3">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleCreatePackage}
                      className="inline-flex w-full justify-center rounded-md bg-primary px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 sm:text-sm disabled:opacity-50"
                    >
                      {loading ? 'Creating...' : 'Create Package'}
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleCloseDialog}
                      className="inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 sm:text-sm disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
};

export default PackageManager;
