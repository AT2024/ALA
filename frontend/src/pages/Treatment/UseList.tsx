import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import Layout from '@/components/Layout';
import { useTreatment } from '@/context/TreatmentContext';

const UseList = () => {
  const navigate = useNavigate();
  const { currentTreatment, applicators, processedApplicators, setCurrentApplicator } = useTreatment();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  const handleEditApplicator = (applicatorSerialNumber: string) => {
    const applicator = processedApplicators.find(app => app.serialNumber === applicatorSerialNumber);
    if (applicator) {
      setCurrentApplicator(applicator);
      navigate('/treatment/scan'); // Takes to Treatment Documentation screen
    }
  };

  const handleNext = () => {
    // Takes to Treatment Documentation screen for inserting another applicator
    navigate('/treatment/scan');
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
              <p className="font-medium">{currentTreatment.subjectId}</p>
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
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {processedApplicators
                    .sort((a, b) => b.seedQuantity - a.seedQuantity) // Sort by Seeds Qty as specified
                    .map((applicator) => (
                    <tr key={applicator.id || applicator.serialNumber} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                        {applicator.serialNumber}
                        {/* TODO: Add asterisk if applicator was intended for another treatment */}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {applicator.applicatorType || 'N/A'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {applicator.seedQuantity}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {format(new Date(applicator.insertionTime), 'dd.MM.yyyy HH:mm')}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                          applicator.usageType === 'full'
                            ? 'bg-green-100 text-green-800'
                            : applicator.usageType === 'faulty'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {applicator.usageType === 'full'
                            ? 'Full use'
                            : applicator.usageType === 'faulty'
                            ? 'Faulty'
                            : 'No Use'
                          }
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
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                        <button
                          onClick={() => handleEditApplicator(applicator.serialNumber)}
                          className="text-primary hover:text-primary/80"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
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
                  {treatmentSummary.timeInsertionStarted 
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
            Next
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
            <li>• Applicators are sorted by Seeds Qty. as specified</li>
            <li>• Use 'Edit' to modify processed applicator details</li>
            <li>• Use 'Next' to scan and process another applicator</li>
            <li>• Use 'Finalize' to complete the treatment</li>
            <li>• Total Activity = Total Seeds × Activity Per Seed</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
};

export default UseList;