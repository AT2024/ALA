import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { useTreatment } from '@/context/TreatmentContext';
import { useAuth } from '@/context/AuthContext';
import { treatmentService } from '@/services/treatmentService';

// Local Applicator interface that matches TreatmentContext
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
}

const SeedRemoval = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentTreatment, applicators, updateApplicator, totalSeeds, removedSeeds } =
    useTreatment();

  // Group applicators by seed quantity (reusing existing pattern)
  const groupedApplicators = applicators.reduce((groups, applicator) => {
    const seedCount = applicator.seedQuantity;
    if (!groups[seedCount]) {
      groups[seedCount] = [];
    }
    groups[seedCount].push(applicator);
    return groups;
  }, {} as Record<number, Applicator[]>);

  // Sort groups by seed count (descending)
  const sortedGroups = Object.entries(groupedApplicators).sort(
    ([a], [b]) => parseInt(b) - parseInt(a)
  );

  // TODO(human): Activity calculation logic for removal
  // Calculate total activity using existing activityPerSeed
  const totalActivity = applicators.reduce((sum, app) => {
    const remainingSeeds = app.insertedSeedsQty ?? app.seedQuantity;
    return sum + (remainingSeeds * (currentTreatment?.activityPerSeed || 0));
  }, 0);

  // Check if using test data and format date accordingly
  const isTestUser = user?.email === 'test@example.com';
  const displayDate = isTestUser 
    ? new Date().toLocaleDateString() // Always show today for test data
    : currentTreatment ? new Date(currentTreatment.date).toLocaleDateString() : '';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    if (!currentTreatment) {
      navigate('/treatment/select');
      return;
    }

    if (currentTreatment.type !== 'removal') {
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


  const handleAddComment = async (applicator: Applicator, comment: string) => {
    if (!currentTreatment) return;

    try {
      const updatedApplicator = {
        ...applicator,
        removalComments: comment,
      };

      // Update in backend
      await treatmentService.updateApplicator(
        currentTreatment.id,
        applicator.id,
        updatedApplicator
      );

      // Update in state
      updateApplicator(applicator.id, updatedApplicator);
    } catch (err: any) {
      setError(err.message || 'Failed to update comment');
    }
  };

  const handleCommentChange = (
    applicator: Applicator,
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    const updatedApplicator = {
      ...applicator,
      removalComments: e.target.value,
    };

    // Just update in state for now (will be saved on blur or form submit)
    updateApplicator(applicator.id, updatedApplicator);
  };

  // Seed reduction handlers using existing updateApplicator
  const handleReduceSeeds = async (applicator: Applicator, newSeedAmount: number) => {
    if (!currentTreatment) return;

    const clampedAmount = Math.max(0, Math.min(newSeedAmount, applicator.seedQuantity));
    
    try {
      const updatedApplicator = {
        ...applicator,
        insertedSeedsQty: clampedAmount,
        isRemoved: clampedAmount === 0,
        removalTime: clampedAmount === 0 ? new Date().toISOString() : null,
      };

      // Update in backend
      await treatmentService.updateApplicator(
        currentTreatment.id,
        applicator.id,
        updatedApplicator
      );

      // Update in state using existing method
      updateApplicator(applicator.id, updatedApplicator);
    } catch (err: any) {
      setError(err.message || 'Failed to update seed count');
    }
  };

  const handleReduceByOne = (applicator: Applicator) => {
    const currentSeeds = applicator.insertedSeedsQty ?? applicator.seedQuantity;
    handleReduceSeeds(applicator, currentSeeds - 1);
  };

  const handleCompleteTreatment = async () => {
    if (!currentTreatment) return;

    setIsCompleting(true);

    try {
      await treatmentService.completeTreatment(currentTreatment.id);
      navigate('/treatment/select');
    } catch (err: any) {
      setError(err.message || 'Failed to complete treatment');
    } finally {
      setIsCompleting(false);
    }
  };

  if (!currentTreatment) {
    return (
      <Layout title='Seed Removal' showBackButton>
        <div className='flex items-center justify-center py-10'>
          <p>No treatment selected. Please select a treatment first.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title='Seed Removal' showBackButton backPath='/treatment/select'>
      <div className='space-y-6'>
        <div className='rounded-lg border bg-white p-4 shadow-sm'>
          <h2 className='mb-4 text-lg font-medium'>Treatment Information</h2>
          <div className='grid grid-cols-2 gap-4 md:grid-cols-4'>
            <div>
              <p className='text-sm text-gray-500'>Subject ID</p>
              <p className='font-medium'>{currentTreatment.subjectId}</p>
            </div>
            <div>
              <p className='text-sm text-gray-500'>Site</p>
              <p className='font-medium'>{currentTreatment.site}</p>
            </div>
            <div>
              <p className='text-sm text-gray-500'>Type</p>
              <p className='font-medium capitalize'>{currentTreatment.type}</p>
            </div>
            <div>
              <p className='text-sm text-gray-500'>Date</p>
              <p className='font-medium'>{displayDate}</p>
            </div>
          </div>
        </div>

        {error && <div className='rounded-md bg-red-50 p-4 text-sm text-red-700'>{error}</div>}

        <div className='rounded-lg border bg-white p-4 shadow-sm'>
          <div className='mb-4 flex items-center justify-between'>
            <h2 className='text-lg font-medium'>Seed Removal Tracking</h2>
            <div className='flex items-center space-x-2'>
              <div className='rounded-md bg-green-50 px-3 py-1 text-sm font-medium text-green-700'>
                Activity: {totalActivity.toFixed(2)} µCi
              </div>
              <div className='rounded-md bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700'>
                Seeds: {removedSeeds} / {totalSeeds}
              </div>
            </div>
          </div>

          {loading ? (
            <div className='flex justify-center py-8'>
              <div className='h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent'></div>
            </div>
          ) : applicators.length === 0 ? (
            <div className='rounded-md bg-yellow-50 p-4 text-sm text-yellow-700'>
              No applicators found for this treatment.
            </div>
          ) : (
            <div className='space-y-6'>
              {sortedGroups.map(([seedCount, groupApplicators]) => (
                <div key={seedCount} className='space-y-4'>
                  <div className='border-b border-gray-200 pb-2'>
                    <h3 className='text-lg font-medium text-gray-900'>
                      {seedCount}-seed Applicators ({groupApplicators.length})
                    </h3>
                  </div>
                  
                  <div className='space-y-4'>
                    {groupApplicators.map((applicator) => {
                      const currentSeeds = applicator.insertedSeedsQty ?? applicator.seedQuantity;
                      const activityValue = currentSeeds * (currentTreatment?.activityPerSeed || 0);
                      const isPartiallyRemoved = currentSeeds < applicator.seedQuantity && currentSeeds > 0;
                      const isFullyRemoved = currentSeeds === 0;
                      
                      return (
                        <div
                          key={applicator.id}
                          className={`rounded-lg border p-4 ${
                            isFullyRemoved
                              ? 'border-green-200 bg-green-50'
                              : isPartiallyRemoved
                                ? 'border-yellow-200 bg-yellow-50'
                                : 'border-gray-200 bg-white'
                          }`}>
                          <div className='flex flex-col space-y-4'>
                            <div className='flex flex-col space-y-2 md:flex-row md:items-center md:justify-between md:space-y-0'>
                              <div>
                                <h4 className='text-md font-medium'>{applicator.serialNumber}</h4>
                                <p className='text-sm text-gray-500'>
                                  Seeds: {currentSeeds} / {applicator.seedQuantity} | Activity: {activityValue.toFixed(2)} µCi
                                </p>
                              </div>

                              <div className='flex items-center space-x-4'>
                                <div className='flex items-center space-x-2'>
                                  <input
                                    type='number'
                                    min='0'
                                    max={applicator.seedQuantity}
                                    value={currentSeeds}
                                    onChange={(e) => handleReduceSeeds(applicator, parseInt(e.target.value) || 0)}
                                    className='w-16 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-primary focus:outline-none focus:ring-primary'
                                  />
                                  <button
                                    onClick={() => handleReduceByOne(applicator)}
                                    disabled={currentSeeds === 0}
                                    className='rounded-md bg-red-100 px-2 py-1 text-sm font-medium text-red-700 hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed'>
                                    -1
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div>
                              <label
                                htmlFor={`comments-${applicator.id}`}
                                className='block text-sm font-medium text-gray-700'>
                                Removal Comments
                              </label>
                              <textarea
                                id={`comments-${applicator.id}`}
                                value={applicator.removalComments || ''}
                                onChange={(e) => handleCommentChange(applicator, e)}
                                onBlur={() =>
                                  applicator.removalComments &&
                                  handleAddComment(applicator, applicator.removalComments)
                                }
                                rows={2}
                                className='mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm'
                                placeholder='Add removal comments...'></textarea>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className='mt-6 flex flex-col space-y-2 md:flex-row md:items-center md:justify-between md:space-y-0'>
            <div className='space-y-1'>
              <div
                className={`text-lg font-medium ${
                  removedSeeds === totalSeeds ? 'text-green-600' : 'text-red-600'
                }`}>
                Seeds: {removedSeeds} / {totalSeeds} Removed
              </div>
              <div className='text-md font-medium text-green-600'>
                Total Activity: {totalActivity.toFixed(2)} µCi
              </div>
            </div>
            <button
              onClick={handleCompleteTreatment}
              disabled={isCompleting || loading}
              className='rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50'>
              {isCompleting
                ? 'Completing...'
                : removedSeeds === totalSeeds
                  ? 'Complete Treatment'
                  : 'Complete with Missing Seeds'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default SeedRemoval;
