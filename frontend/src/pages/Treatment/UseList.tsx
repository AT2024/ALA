import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import Layout from '@/components/Layout';
import { useTreatment } from '@/context/TreatmentContext';
import { PDFService } from '@/services/pdfService';
import PackageManager from '@/components/PackageManager';

// Get status color classes based on status for table rows
const getStatusColor = (status: string | undefined | null): string => {
  // If status is null/undefined, return default/white (backward compatibility)
  if (!status) {
    return 'bg-white';
  }

  switch (status) {
    case 'SEALED':
      return 'bg-white';
    case 'OPENED':
      return 'bg-red-50';
    case 'LOADED':
      return 'bg-yellow-50';
    case 'INSERTED':
      return 'bg-green-50';
    case 'FAULTY':
    case 'DISPOSED':
    case 'DISCHARGED':
    case 'DEPLOYMENT_FAILURE':
    case 'UNACCOUNTED':
      return 'bg-gray-900 text-white';
    default:
      return 'bg-white';
  }
};

// Get status badge color classes
const getStatusBadgeColor = (status: string | undefined | null, usageType: string): string => {
  // Use status if available, otherwise fallback to usageType
  const effectiveStatus = status || (usageType === 'full' ? 'INSERTED' : usageType === 'faulty' ? 'FAULTY' : 'SEALED');

  switch (effectiveStatus) {
    case 'SEALED':
      return 'bg-white border-gray-300 text-gray-800';
    case 'OPENED':
      return 'bg-red-50 border-red-300 text-red-800';
    case 'LOADED':
      return 'bg-yellow-50 border-yellow-300 text-yellow-800';
    case 'INSERTED':
      return 'bg-green-50 border-green-300 text-green-800';
    case 'FAULTY':
    case 'DISPOSED':
    case 'DISCHARGED':
    case 'DEPLOYMENT_FAILURE':
    case 'UNACCOUNTED':
      return 'bg-gray-900 text-white';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const UseList = () => {
  const navigate = useNavigate();
  const { currentTreatment, processedApplicators, setCurrentApplicator, sortApplicatorsByStatus, isPancreasOrProstate } = useTreatment();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

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

  const handleDownloadPDF = () => {
    if (!currentTreatment || processedApplicators.length === 0) {
      setError('No treatment data available to generate PDF');
      return;
    }

    try {
      // Calculate total activity for PDF
      const activityPerSeed = currentTreatment?.activityPerSeed || 0;
      const summaryWithActivity = {
        ...treatmentSummary,
        totalActivity: treatmentSummary.totalDartSeedsInserted * activityPerSeed
      };

      // Generate and download PDF
      PDFService.generateTreatmentReport(
        currentTreatment,
        processedApplicators,
        summaryWithActivity
      );

      setSuccess('PDF downloaded successfully!');
    } catch (error: any) {
      console.error('Error generating files:', error);
      setError('Failed to generate PDF. Please try again.');
    }
  };

  const handleFinalize = async () => {
    if (processedApplicators.length === 0) {
      setError('Please process at least one applicator before finalizing');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // TODO: Update ORDSTATUSDES= "Performed" FROM ORDERS WHERE Details=Patient ID
      // This would be implemented with the Priority system integration

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      setSuccess('Process completed successfully!');

      // Clear sessionStorage after successful finalization
      try {
        sessionStorage.removeItem('currentTreatment');
        sessionStorage.removeItem('processedApplicators');
        sessionStorage.removeItem('availableApplicators');
        sessionStorage.removeItem('individualSeedsRemoved');
      } catch (storageError) {
        console.error('Failed to clear sessionStorage:', storageError);
      }

      // Navigate back to procedure selection after a brief delay
      setTimeout(() => {
        navigate('/procedure-type');
      }, 2000);

    } catch (err: any) {
      setError(err.message || 'Failed to finalize treatment');
    } finally {
      setLoading(false);
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
                      Applicator Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Seeds Qty.
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Using Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Using Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Inserted Seeds Qty.
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
                  {sortApplicatorsByStatus(processedApplicators)
                    .map((applicator) => {
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
                        {applicator.applicatorType || 'N/A'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {applicator.seedQuantity}
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
                <p className="text-sm text-gray-500">Total Dart Seeds Inserted</p>
                <p className="font-medium text-green-600">{treatmentSummary.totalDartSeedsInserted}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Activity</p>
                <p className="font-medium text-primary">
                  {totalActivity.toFixed(2)} µCi
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Seeds Inserted By (Full Name)</p>
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
            onClick={handleDownloadPDF}
            disabled={processedApplicators.length === 0}
            className="flex-1 rounded-md border border-green-600 bg-white px-4 py-2 text-sm font-medium text-green-600 shadow-sm hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
          >
            Download PDF
          </button>
          <button
            onClick={handleFinalize}
            disabled={loading || processedApplicators.length === 0}
            className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Finalize'}
          </button>
        </div>

        {/* Information Panel */}
        <div className="rounded-lg border bg-gray-50 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Information</h3>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• Only processed applicators are shown in the list</li>
            <li>• Active applicators (SEALED, OPENED, LOADED) are sorted to top</li>
            <li>• Finished applicators (INSERTED, FAULTY, etc.) are sorted to bottom</li>
            <li>• Within groups, sorted by seed quantity (highest first)</li>
            <li>• Row colors indicate status: Red (OPENED), Yellow (LOADED), Green (INSERTED), Black (Terminal states)</li>
            <li>• Use 'Edit' to modify processed applicator details</li>
            <li>• Use 'Back to Treatment' to scan and process another applicator</li>
            <li>• Use 'Finalize' to complete the treatment</li>
            <li>• Total Activity = Total Seeds × Activity Per Seed</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
};

export default UseList;