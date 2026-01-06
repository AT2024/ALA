import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import Layout from '@/components/Layout';
import { useTreatment } from '@/context/TreatmentContext';
import { useOffline } from '@/context/OfflineContext';
import { treatmentService, ContinuationEligibility, Treatment } from '@/services/treatmentService';
import PackageManager from '@/components/PackageManager';
import ConfirmationDialog from '@/components/Dialogs/ConfirmationDialog';
import SignatureModal from '@/components/Dialogs/SignatureModal';
import { getStatusColors, APPLICATOR_STATUSES } from '@/utils/applicatorStatus';

// Get status color classes based on status for table rows
// Uses shared STATUS_COLORS from @shared/applicatorStatuses
const getStatusColor = (status: string | undefined | null): string => {
  const colors = getStatusColors(status);
  return colors.row;
};

// Get status badge color classes
// Uses shared STATUS_COLORS from @shared/applicatorStatuses
const getStatusBadgeColor = (status: string | undefined | null, usageType: string): string => {
  // Use status if available, otherwise fallback to usageType mapping
  const effectiveStatus = status || (usageType === 'full' ? APPLICATOR_STATUSES.INSERTED : usageType === 'faulty' ? APPLICATOR_STATUSES.FAULTY : APPLICATOR_STATUSES.SEALED);
  const colors = getStatusColors(effectiveStatus);
  return `${colors.bg} ${colors.border} ${colors.text}`;
};

const UseList = () => {
  const navigate = useNavigate();
  const { currentTreatment, processedApplicators, setProcessedApplicators, setCurrentApplicator, sortApplicatorsByStatus, isPancreasOrProstate, setTreatment, clearTreatment } = useTreatment();
  const { isOnline } = useOffline();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Finalization flow state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [finalizationFlowType, setFinalizationFlowType] = useState<'hospital_auto' | 'alphatau_verification'>('alphatau_verification');
  const [finalizationUserData, setFinalizationUserData] = useState<{
    name: string;
    email: string;
    position?: string;
    site?: string;
  } | undefined>(undefined);

  // Treatment continuation state
  const [continuationEligibility, setContinuationEligibility] = useState<ContinuationEligibility | null>(null);
  const [parentTreatment, setParentTreatment] = useState<Treatment | null>(null);
  const [continuationLoading, setContinuationLoading] = useState(false);

  // Check continuation eligibility for completed treatments
  useEffect(() => {
    const checkEligibility = async () => {
      if (currentTreatment?.isComplete && isOnline) {
        try {
          const eligibility = await treatmentService.checkContinuable(currentTreatment.id);
          setContinuationEligibility(eligibility);
        } catch (err) {
          console.error('Failed to check continuation eligibility:', err);
        }
      }
    };
    checkEligibility();
  }, [currentTreatment?.id, currentTreatment?.isComplete, isOnline]);

  // Fetch parent treatment info if this is a continuation (for display purposes only)
  // NOTE: Parent applicator inheritance is handled by TreatmentDocumentation.tsx
  useEffect(() => {
    const fetchParent = async () => {
      if (currentTreatment?.parentTreatmentId && isOnline) {
        try {
          const parent = await treatmentService.getParentTreatment(currentTreatment.id);
          setParentTreatment(parent);
        } catch (err) {
          console.error('Failed to fetch parent treatment:', err);
        }
      }
    };
    fetchParent();
  }, [currentTreatment?.id, currentTreatment?.parentTreatmentId, isOnline]);

  // Load processed applicators from backend ONLY when returning to a completed treatment
  // and the local processedApplicators list is empty (session was cleared or user returned later)
  // This prevents overwriting active session data during normal workflow
  useEffect(() => {
    const loadApplicatorsFromBackend = async () => {
      // Only load from backend if:
      // 1. We have a treatment ID and are online
      // 2. Local processedApplicators is empty (no active session data)
      // 3. Treatment is already complete (viewing a finalized treatment)
      if (!currentTreatment?.id || !isOnline) return;
      if (processedApplicators.length > 0) return; // Don't overwrite active session
      if (!currentTreatment.isComplete) return; // Only for completed treatments

      try {
        const applicators = await treatmentService.getApplicators(currentTreatment.id);
        if (applicators && applicators.length > 0) {
          // Transform backend data to match frontend Applicator interface
          const formattedApplicators = applicators.map((app: any) => ({
            id: app.id,
            serialNumber: app.serialNumber,
            seedQuantity: app.seedQuantity,
            usageType: app.usageType || 'none',
            insertionTime: app.insertionTime,
            comments: app.comments,
            status: app.status || undefined,
            applicatorType: app.applicatorType,
            insertedSeedsQty: app.insertedSeedsQty || app.seedQuantity,
            attachmentFileCount: app.attachmentFileCount,
            attachmentSyncStatus: app.attachmentSyncStatus,
            catalog: app.catalog,
            seedLength: app.seedLength,
            package_label: app.packageLabel,
          }));

          setProcessedApplicators(formattedApplicators);
        }
      } catch (err) {
        console.error('Failed to load applicators from backend:', err);
        // Don't clear existing applicators on error - sessionStorage may have valid data
      }
    };

    loadApplicatorsFromBackend();
  // Note: processedApplicators.length is intentionally NOT in deps to prevent re-fetching
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTreatment?.id, currentTreatment?.isComplete, isOnline, setProcessedApplicators]);

  // Calculate treatment summary data using processed applicators
  const treatmentSummary = {
    timeInsertionStarted: processedApplicators.length > 0 
      ? processedApplicators.reduce((earliest, app) => {
          const appTime = new Date(app.insertionTime).getTime();
          const earliestTime = new Date(earliest).getTime();
          return appTime < earliestTime ? app.insertionTime : earliest;
        }, processedApplicators[0].insertionTime)
      : '',
    totalApplicatorUse: processedApplicators.filter(app => app.usageType === 'full' || app.usageType === 'faulty').length,
    faultyApplicator: processedApplicators.filter(app => app.usageType === 'faulty').length,
    notUsedApplicators: processedApplicators.filter(app => app.usageType === 'none').length,
    totalDartSeedsInserted: processedApplicators.reduce((sum, app) => {
      if (app.usageType === 'full') return sum + app.seedQuantity;
      if (app.usageType === 'faulty') return sum + (app.insertedSeedsQty || 0);
      return sum;
    }, 0),
    seedsInsertedBy: currentTreatment?.surgeon || 'Unknown'
  };

  // Calculate total activity
  const activityPerSeed = currentTreatment?.activityPerSeed || 0;
  const totalActivity = treatmentSummary.totalDartSeedsInserted * activityPerSeed;

  const handlePackageCreated = () => {
    // Trigger a re-render to show updated package labels
    setRefreshKey(prev => prev + 1);
    setSuccess('Package created successfully!');
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleEditApplicator = (applicatorSerialNumber: string) => {
    const applicator = processedApplicators.find(app => app.serialNumber === applicatorSerialNumber);
    if (applicator) {
      setCurrentApplicator(applicator);
      navigate('/treatment/scan'); // Back to treatment scan page with applicator details
    }
  };

  const handleNext = () => {
    // Takes to Treatment Documentation screen for inserting another applicator
    navigate('/treatment/scan');
  };

  // Start finalization process - shows confirmation dialog
  const handleFinalizeClick = () => {
    if (processedApplicators.length === 0) {
      setError('Please process at least one applicator before finalizing');
      return;
    }
    setShowConfirmDialog(true);
  };

  // User confirmed finalization - determine flow based on user type
  const handleConfirmFinalize = async () => {
    setShowConfirmDialog(false);

    // Finalization requires network connection for signature verification
    if (!isOnline) {
      setError("You're working offline. Treatment data is saved locally. Please reconnect to finalize and submit this treatment.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (!currentTreatment) {
        throw new Error('No treatment selected');
      }

      // Determine the finalization flow based on user's position code
      const response = await treatmentService.initializeFinalization(currentTreatment.id);

      // Store the flow type and user data for the modal
      setFinalizationFlowType(response.flow);
      setFinalizationUserData({
        name: response.signerName || '',
        email: response.signerEmail || '',
        position: response.signerPosition,
        site: currentTreatment.site
      });

      // Show signature modal for both flows (hospital sees simplified confirmation, Alpha Tau sees full verification)
      setShowSignatureModal(true);
      setLoading(false);
    } catch (err: any) {
      console.error('Finalization initialization failed:', err);
      setError(err.response?.data?.error || err.message || 'Failed to start finalization');
      setLoading(false);
    }
  };

  // Called when finalization is successful (either auto or via signature modal)
  const handleFinalizationSuccess = () => {
    setLoading(false);
    setSuccess('Treatment finalized successfully! PDF report has been generated and sent.');

    // Clear treatment data using context method (single source of truth for sessionStorage)
    clearTreatment();

    // Navigate back to procedure selection after a brief delay
    setTimeout(() => {
      navigate('/procedure-type');
    }, 2500);
  };

  // Handle signature modal success callback
  const handleSignatureSuccess = () => {
    setShowSignatureModal(false);
    handleFinalizationSuccess();
  };

  // Handle continuing a completed treatment
  const handleContinueTreatment = async () => {
    if (!currentTreatment || !continuationEligibility?.canContinue) {
      return;
    }

    if (!isOnline) {
      setError("You're working offline. Please reconnect to continue this treatment.");
      return;
    }

    setContinuationLoading(true);
    setError(null);

    try {
      const continuationTreatment = await treatmentService.createContinuation(currentTreatment.id);

      // Update context with new continuation treatment (clears applicators for fresh start)
      setTreatment(continuationTreatment);

      setSuccess('Continuation treatment created! You can now add more applicators.');

      // Navigate to scan page for the new treatment
      setTimeout(() => {
        navigate('/treatment/scan');
      }, 1500);
    } catch (err: any) {
      console.error('Failed to create continuation treatment:', err);
      setError(err.response?.data?.error || err.message || 'Failed to create continuation treatment');
    } finally {
      setContinuationLoading(false);
    }
  };

  if (!currentTreatment) {
    return (
      <Layout title="Use List" showBackButton>
        <div className="flex items-center justify-center py-10">
          <p>No treatment selected. Please select a treatment first.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Use List" showBackButton backPath="/treatment/scan">
      <div className="space-y-6">
        {/* Treatment Information */}
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-lg font-medium">Treatment Information</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <p className="text-sm text-gray-500">Patient ID</p>
              {currentTreatment.patientName ? (
                <p className="font-medium">{currentTreatment.patientName}</p>
              ) : (
                <p className="font-medium text-amber-600" title="Using order number (patient name not available)">
                  Order: {currentTreatment.subjectId}
                </p>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-500">Site</p>
              <p className="font-medium">{currentTreatment.site}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Type</p>
              <p className="font-medium capitalize">{currentTreatment.type}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Date</p>
              <p className="font-medium">{currentTreatment.date}</p>
            </div>
          </div>
        </div>

        {/* Parent Treatment Reference - shown for continuation treatments */}
        {currentTreatment.parentTreatmentId && parentTreatment && (
          <div className="rounded-lg border-2 border-blue-300 bg-blue-50 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-blue-800">Continuation Treatment</h3>
                <p className="mt-1 text-sm text-blue-700">
                  This treatment continues from a previous session. Original treatment date:{' '}
                  <span className="font-medium">{parentTreatment.date}</span>
                </p>
                <p className="mt-1 text-xs text-blue-600">
                  OPENED and LOADED applicators from the original treatment can be scanned and used.
                  Applicators in terminal states (INSERTED, FAULTY, etc.) cannot be reused.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Continue Treatment Option - shown for completed treatments within 24-hour window */}
        {currentTreatment.isComplete && continuationEligibility?.canContinue && (
          <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-amber-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-amber-800">Continue This Treatment</h3>
                <p className="mt-1 text-sm text-amber-700">
                  You have <span className="font-bold">{Math.floor(continuationEligibility.hoursRemaining || 0)}</span> hours remaining to continue this treatment.
                  {continuationEligibility.reusableApplicatorCount && continuationEligibility.reusableApplicatorCount > 0 && (
                    <span className="ml-1">
                      {continuationEligibility.reusableApplicatorCount} applicator(s) can still be used.
                    </span>
                  )}
                </p>
                <button
                  onClick={handleContinueTreatment}
                  disabled={continuationLoading || !isOnline}
                  className="mt-3 inline-flex items-center rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {continuationLoading ? (
                    <>
                      <svg className="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating...
                    </>
                  ) : (
                    'Continue Treatment'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Treatment completed but outside continuation window */}
        {currentTreatment.isComplete && continuationEligibility && !continuationEligibility.canContinue && continuationEligibility.reason && (
          <div className="rounded-lg border border-gray-300 bg-gray-50 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-gray-700">Treatment Completed</h3>
                <p className="mt-1 text-sm text-gray-600">{continuationEligibility.reason}</p>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        {error && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 border border-red-200">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-md bg-green-50 p-4 text-sm text-green-700 border border-green-200">
            {success}
          </div>
        )}

        {/* Package Manager - Only for pancreas/prostate treatments */}
        {isPancreasOrProstate() && currentTreatment && (
          <PackageManager
            key={refreshKey}
            treatmentId={currentTreatment.id}
            processedApplicators={processedApplicators}
            onPackageCreated={handlePackageCreated}
          />
        )}

        {/* Processed Applicators List */}
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-lg font-medium">Processed Applicators</h2>

          {processedApplicators.length === 0 ? (
            <div className="rounded-md bg-blue-50 p-4 text-sm text-blue-700">
              No applicators processed yet. Start by scanning and processing an applicator.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Serial Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Catalog
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Applicator Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Sources Qty.
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Length (mm)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Using Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Using Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Inserted Sources Qty.
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Comments
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Uploads
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {/* Deduplicate by serialNumber before rendering (Issue 5 fix) */}
                  {/* Filter out DISPOSED applicators - they should be hidden from UseList */}
                  {Array.from(
                    new Map(
                      sortApplicatorsByStatus(processedApplicators)
                        .filter(app => {
                          const status = app.status ||
                            (app.usageType === 'full' ? 'INSERTED' :
                             app.usageType === 'faulty' ? 'FAULTY' : 'SEALED');
                          return status.toUpperCase() !== 'DISPOSED';
                        })
                        .map(a => [a.serialNumber, a])
                    ).values()
                  ).map((applicator) => {
                      // Get effective status for color coding (fallback to usageType if status is null)
                      const effectiveStatus = applicator.status || (applicator.usageType === 'full' ? 'INSERTED' : applicator.usageType === 'faulty' ? 'FAULTY' : 'SEALED');
                      const rowColor = getStatusColor(effectiveStatus);

                      return (
                    <tr key={applicator.id || applicator.serialNumber} className={`hover:opacity-90 ${rowColor} relative`}>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                        <div className="flex items-center justify-between">
                          <span>
                            {applicator.serialNumber}
                            {/* TODO: Add asterisk if applicator was intended for another treatment */}
                          </span>
                          {applicator.package_label && (
                            <span className="ml-2 inline-flex items-center rounded-md bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-700 border border-purple-300">
                              {applicator.package_label}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {applicator.catalog || 'N/A'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {applicator.applicatorType || 'N/A'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {applicator.seedQuantity}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {applicator.seedLength ? `${applicator.seedLength}` : '-'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {applicator.insertionTime && !isNaN(new Date(applicator.insertionTime).getTime())
                          ? format(new Date(applicator.insertionTime), 'dd.MM.yyyy HH:mm')
                          : 'N/A'
                        }
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 border ${getStatusBadgeColor(applicator.status, applicator.usageType)}`}>
                          {applicator.status || (
                            applicator.usageType === 'full'
                              ? 'INSERTED'
                              : applicator.usageType === 'faulty'
                              ? 'FAULTY'
                              : 'SEALED'
                          )}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {applicator.usageType === 'full' 
                          ? applicator.seedQuantity
                          : applicator.usageType === 'faulty'
                          ? (applicator.insertedSeedsQty || 0)
                          : 0
                        }
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-32">
                        {applicator.comments ? (
                          <span className="truncate">{applicator.comments}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        {(applicator.attachmentFileCount ?? 0) > 0 ? (
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                              applicator.attachmentSyncStatus === 'synced' ? 'bg-green-100 text-green-800' :
                              applicator.attachmentSyncStatus === 'syncing' ? 'bg-blue-100 text-blue-800' :
                              applicator.attachmentSyncStatus === 'failed' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {applicator.attachmentFileCount ?? 0} file{(applicator.attachmentFileCount ?? 0) > 1 ? 's' : ''}
                              {applicator.attachmentSyncStatus === 'synced' && ' ✓'}
                              {applicator.attachmentSyncStatus === 'failed' && ' ✗'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">No files</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                        <button
                          onClick={() => handleEditApplicator(applicator.serialNumber)}
                          className="text-primary hover:text-primary/80"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {/* Treatment Summary */}
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-lg font-medium">Treatment Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Time Insertion Treatment Started</p>
                <p className="font-medium">
                  {treatmentSummary.timeInsertionStarted && !isNaN(new Date(treatmentSummary.timeInsertionStarted).getTime())
                    ? format(new Date(treatmentSummary.timeInsertionStarted), 'dd.MM.yyyy HH:mm')
                    : 'N/A'
                  }
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Applicator Use</p>
                <p className="font-medium">{treatmentSummary.totalApplicatorUse}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Faulty Applicator</p>
                <p className="font-medium text-red-600">{treatmentSummary.faultyApplicator}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Not Used Applicators</p>
                <p className="font-medium text-gray-600">{treatmentSummary.notUsedApplicators}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Total DaRT Sources Inserted</p>
                <p className="font-medium text-green-600">{treatmentSummary.totalDartSeedsInserted}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Activity</p>
                <p className="font-medium text-primary">
                  {totalActivity.toFixed(2)} µCi
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Sources Inserted By (Full Name)</p>
                <p className="font-medium">{treatmentSummary.seedsInsertedBy}</p>
              </div>
            </div>
          </div>
        </div>
        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={handleNext}
            className="flex-1 rounded-md border border-primary bg-white px-4 py-2 text-sm font-medium text-primary shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            Back to Treatment
          </button>
          <button
            onClick={handleFinalizeClick}
            disabled={loading || processedApplicators.length === 0}
            className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Finalize Treatment'}
          </button>
        </div>

        {/* Confirmation Dialog */}
        <ConfirmationDialog
          isOpen={showConfirmDialog}
          onClose={() => setShowConfirmDialog(false)}
          onConfirm={handleConfirmFinalize}
          title="Finalize Treatment"
          message={`Are you sure you want to finalize this treatment?\n\nThis will:\n• Generate a signed PDF report\n• Send the report to the clinic\n• Mark the treatment as complete\n\nThis action cannot be undone.`}
          confirmText="Yes, Finalize"
          cancelText="Cancel"
          type="warning"
          loading={loading}
        />

        {/* Signature Modal - shows different UI based on user type */}
        {/* Hospital users see simplified confirmation modal */}
        {/* Position 99 (Alpha Tau) users see full 3-step verification flow */}
        {currentTreatment && (
          <SignatureModal
            isOpen={showSignatureModal}
            onClose={() => {
              setShowSignatureModal(false);
              setLoading(false);
            }}
            treatmentId={currentTreatment.id}
            treatmentSite={currentTreatment.site}
            onSuccess={handleSignatureSuccess}
            flowType={finalizationFlowType}
            userData={finalizationUserData}
            isContinuation={!!currentTreatment.parentTreatmentId}
          />
        )}

        {/* Information Panel */}
        <div className="rounded-lg border bg-gray-50 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Information</h3>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• Only processed applicators are shown in the list</li>
            <li>• Active applicators (SEALED, OPENED, LOADED) are sorted to top</li>
            <li>• Finished applicators (INSERTED, FAULTY, etc.) are sorted to bottom</li>
            <li>• Within groups, sorted by source quantity (highest first)</li>
            <li>• Row colors indicate status: Red (OPENED), Yellow (LOADED), Green (INSERTED), Black (Terminal states)</li>
            <li>• Use 'Edit' to modify processed applicator details</li>
            <li>• Use 'Back to Treatment' to scan and process another applicator</li>
            <li>• Use 'Finalize Treatment' to generate a signed PDF report and complete the treatment</li>
            <li>• Total Activity = Total Sources × Activity Per Source</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
};

export default UseList;