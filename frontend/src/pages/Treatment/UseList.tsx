import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import Layout from '@/components/Layout';
import { useTreatment } from '@/context/TreatmentContext';
import { treatmentService, Applicator } from '@/services/treatmentService';

const UseList = () => {
  const navigate = useNavigate();
  const { currentTreatment, applicators, setCurrentApplicator } = useTreatment();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportType, setExportType] = useState<'csv' | 'pdf'>('csv');
  const [isExporting, setIsExporting] = useState(false);
  
  useEffect(() => {
    if (!currentTreatment) {
      navigate('/treatment/select');
      return;
    }
    
    // If no applicators in state, fetch them from the server
    if (applicators.length === 0) {
      fetchApplicators();
    }
  }, [currentTreatment, applicators.length]);

  const fetchApplicators = async () => {
    if (!currentTreatment) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await treatmentService.getApplicators(currentTreatment.id);
      // This would normally update the state in the TreatmentContext
      // But for demo purposes, we're just logging
      console.log('Fetched applicators:', data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch applicators');
    } finally {
      setLoading(false);
    }
  };

  const handleEditApplicator = (applicator: Applicator) => {
    setCurrentApplicator(applicator);
    navigate('/treatment/applicator');
  };

  const handleExport = async () => {
    if (!currentTreatment) return;
    
    setIsExporting(true);
    
    try {
      const blob = await treatmentService.exportTreatment(currentTreatment.id, exportType);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `treatment-${currentTreatment.id}.${exportType}`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.message || `Failed to export as ${exportType.toUpperCase()}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleScanMore = () => {
    navigate('/treatment/scan');
  };

  const handleComplete = async () => {
    if (!currentTreatment) return;
    
    setLoading(true);
    
    try {
      await treatmentService.completeTreatment(currentTreatment.id);
      navigate('/treatment/select');
    } catch (err: any) {
      setError(err.message || 'Failed to complete treatment');
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
    <Layout title="Use List" showBackButton backPath="/treatment/select">
      <div className="space-y-6">
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-lg font-medium">Treatment Information</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <p className="text-sm text-gray-500">Subject ID</p>
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
              <p className="font-medium">{new Date(currentTreatment.date).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium">Applicators</h2>
            <div className="flex items-center space-x-2">
              <select
                value={exportType}
                onChange={(e) => setExportType(e.target.value as 'csv' | 'pdf')}
                className="rounded-md border border-gray-300 px-3 py-1 text-sm focus:border-primary focus:outline-none focus:ring-primary"
              >
                <option value="csv">CSV</option>
                <option value="pdf">PDF</option>
              </select>
              <button
                onClick={handleExport}
                disabled={isExporting || applicators.length === 0}
                className="rounded-md bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground hover:bg-secondary/90 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 disabled:opacity-50"
              >
                {isExporting ? 'Exporting...' : 'Export'}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            </div>
          ) : applicators.length === 0 ? (
            <div className="rounded-md bg-blue-50 p-4 text-sm text-blue-700">
              No applicators added yet. Start by scanning an applicator.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Serial Number
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Seed Quantity
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Usage Type
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Insertion Time
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Comments
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {applicators.map((applicator) => (
                    <tr key={applicator.id || applicator.serialNumber} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                        {applicator.serialNumber}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {applicator.seedQuantity}
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
                            ? 'Full Use'
                            : applicator.usageType === 'faulty'
                            ? 'Faulty'
                            : 'No Use'
                          }
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {format(new Date(applicator.insertionTime), 'MMM d, yyyy HH:mm')}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {applicator.comments ? (
                          <span className="line-clamp-1">{applicator.comments}</span>
                        ) : (
                          <span className="text-gray-400">No comments</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                        <button
                          onClick={() => handleEditApplicator(applicator)}
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

          <div className="mt-6 flex justify-between">
            <button
              onClick={handleScanMore}
              className="rounded-md border border-primary bg-white px-4 py-2 text-sm font-medium text-primary shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              Scan More Applicators
            </button>
            <button
              onClick={handleComplete}
              disabled={loading || applicators.length === 0}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Complete Treatment'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default UseList;
