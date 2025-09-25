import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MinusIcon } from '@heroicons/react/24/outline';
import Layout from '@/components/Layout';
import { useTreatment, ApplicatorGroup } from '@/context/TreatmentContext';
import { treatmentService, Applicator } from '@/services/treatmentService';

const SeedRemoval = () => {
  const navigate = useNavigate();
  const {
    currentTreatment,
    applicators,
    updateApplicator,
    totalSeeds,
    getApplicatorGroups,
    getRemovalProgress,
    setIndividualSeedsRemoved,
    getIndividualSeedsRemoved
  } = useTreatment();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  // Get data from context methods
  const applicatorGroups = getApplicatorGroups();
  const removalProgress = getRemovalProgress();
  const individualSeedsRemoved = getIndividualSeedsRemoved();
  const daysSinceInsertion = currentTreatment?.daysSinceInsertion || 0;

  // Destructure removal progress for easier access
  const {
    totalSeeds: progressTotalSeeds,
    effectiveTotalSeeds,
    effectiveRemovedSeeds
  } = removalProgress;

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

  const handleToggleRemoval = async (applicator: Applicator) => {
    if (!currentTreatment) return;

    try {
      const updatedApplicator = {
        ...applicator,
        isRemoved: !applicator.isRemoved,
        removalTime: !applicator.isRemoved ? new Date().toISOString() : null,
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
      setError(err.message || 'Failed to update applicator');
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

  const handleRemoveApplicatorGroup = async (group: ApplicatorGroup) => {
    if (!currentTreatment) return;

    try {
      // Find the first non-removed applicator in the group and mark it as removed
      const nextApplicatorToRemove = group.applicators.find(app => !app.isRemoved);
      if (nextApplicatorToRemove) {
        await handleToggleRemoval(nextApplicatorToRemove);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to remove applicator from group');
    }
  };

  const handleRemoveIndividualSeed = () => {
    setIndividualSeedsRemoved(individualSeedsRemoved + 1);
  };

  const handleResetIndividualSeeds = () => {
    setIndividualSeedsRemoved(0);
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
          <div className='grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4'>
            <div>
              <p className='text-sm text-gray-500'>Patient Number</p>
              <p className='font-medium'>{currentTreatment.subjectId}</p>
            </div>
            <div>
              <p className='text-sm text-gray-500'>Date of Insertion</p>
              <p className='font-medium'>{new Date(currentTreatment.date).toLocaleDateString()}</p>
            </div>
            <div>
              <p className='text-sm text-gray-500'>Total Seeds</p>
              <p className='font-medium'>{currentTreatment.seedQuantity || totalSeeds}</p>
            </div>
            <div>
              <p className='text-sm text-gray-500'>Total Activity</p>
              <p className='font-medium'>
                {currentTreatment.activityPerSeed && currentTreatment.seedQuantity
                  ? (currentTreatment.activityPerSeed * currentTreatment.seedQuantity).toFixed(1)
                  : 'N/A'} mCi
              </p>
            </div>
            <div>
              <p className='text-sm text-gray-500'>Surgeon</p>
              <p className='font-medium'>{currentTreatment.surgeon || 'N/A'}</p>
            </div>
            <div>
              <p className='text-sm text-gray-500'>Site</p>
              <p className='font-medium'>{currentTreatment.site}</p>
            </div>
            <div>
              <p className='text-sm text-gray-500'>Days Since Insertion</p>
              <p className='font-medium text-blue-600'>{daysSinceInsertion} days</p>
            </div>
            <div>
              <p className='text-sm text-gray-500'>Type</p>
              <p className='font-medium capitalize'>{currentTreatment.type}</p>
            </div>
          </div>

          {daysSinceInsertion > 0 && (
            <div className='mt-4 rounded-md bg-blue-50 p-3'>
              <p className='text-sm text-blue-700'>
                <span className='font-medium'>Note:</span> Seeds have been in place for {daysSinceInsertion} day{daysSinceInsertion !== 1 ? 's' : ''}.
              </p>
            </div>
          )}
        </div>

        {error && <div className='rounded-md bg-red-50 p-4 text-sm text-red-700'>{error}</div>}

        <div className='rounded-lg border bg-white p-4 shadow-sm'>
          <div className='mb-6 flex items-center justify-between'>
            <h2 className='text-lg font-medium'>Seed Removal Tracking</h2>
            <div className='flex items-center space-x-3'>
              <div className='flex items-center space-x-2'>
                <span className='text-sm text-gray-600'>Total Seeds:</span>
                <span className='font-medium'>{currentTreatment.seedQuantity || totalSeeds}</span>
                <button
                  onClick={handleRemoveIndividualSeed}
                  disabled={individualSeedsRemoved >= (currentTreatment.seedQuantity || progressTotalSeeds)}
                  className='rounded-full p-1 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed'
                  title='Remove individual seed'>
                  <MinusIcon className='h-4 w-4' />
                </button>
              </div>
              <div className='rounded-md bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700'>
                Removed: {effectiveRemovedSeeds} / {effectiveTotalSeeds}
              </div>
            </div>
          </div>

          {/* Individual seed counter display */}
          {individualSeedsRemoved > 0 && (
            <div className='mb-4 rounded-md bg-orange-50 p-3'>
              <div className='flex items-center justify-between'>
                <p className='text-sm text-orange-700'>
                  <span className='font-medium'>Individual seeds removed:</span> {individualSeedsRemoved}
                </p>
                <button
                  onClick={handleResetIndividualSeeds}
                  className='text-xs text-orange-600 hover:text-orange-800 underline'>
                  Reset
                </button>
              </div>
            </div>
          )}

          {/* Applicator Groups */}
          {applicatorGroups.length > 0 && (
            <div className='mb-6'>
              <h3 className='mb-3 text-md font-medium text-gray-700'>Applicator Groups</h3>
              <div className='space-y-3'>
                {applicatorGroups.map((group) => (
                  <div
                    key={group.seedCount}
                    className='rounded-lg border border-gray-200 bg-gray-50 p-4'>
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center space-x-4'>
                        <span className='text-sm font-medium text-gray-700'>
                          {group.totalApplicators} applicator{group.totalApplicators !== 1 ? 's' : ''} of {group.seedCount} seed{group.seedCount !== 1 ? 's' : ''}
                        </span>
                        <div className='flex items-center space-x-2'>
                          <span className='text-sm text-gray-600'>
                            Removed: {group.removedApplicators} / {group.totalApplicators}
                          </span>
                          <button
                            onClick={() => handleRemoveApplicatorGroup(group)}
                            disabled={group.removedApplicators >= group.totalApplicators}
                            className='rounded-full p-1 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed'
                            title='Remove one applicator from this group'>
                            <MinusIcon className='h-4 w-4' />
                          </button>
                        </div>
                      </div>
                      <div className='text-sm text-gray-500'>
                        {(group.removedApplicators * group.seedCount)} / {(group.totalApplicators * group.seedCount)} seeds
                      </div>
                    </div>

                    {/* Progress bar for this group */}
                    <div className='mt-2'>
                      <div className='flex items-center justify-between text-xs text-gray-500 mb-1'>
                        <span>Progress</span>
                        <span>{Math.round((group.removedApplicators / group.totalApplicators) * 100)}%</span>
                      </div>
                      <div className='w-full bg-gray-200 rounded-full h-2'>
                        <div
                          className='bg-green-600 h-2 rounded-full transition-all duration-300'
                          style={{ width: `${(group.removedApplicators / group.totalApplicators) * 100}%` }}>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <div className='flex justify-center py-8'>
              <div className='h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent'></div>
            </div>
          )}

          {/* Detailed Applicator List */}
          <div className='border-t pt-6'>
            <h3 className='mb-4 text-md font-medium text-gray-700'>Detailed Applicator List</h3>
            {applicators.length === 0 ? (
              <div className='rounded-md bg-yellow-50 p-4 text-sm text-yellow-700'>
                No applicators found for this treatment.
              </div>
            ) : (
              <div className='space-y-4'>
                {applicators.map((applicator) => (
                  <div
                    key={applicator.id}
                    className={`rounded-lg border p-4 ${
                      applicator.isRemoved
                        ? 'border-green-200 bg-green-50'
                        : 'border-gray-200 bg-white'
                    }`}>
                    <div className='flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0'>
                      <div>
                        <h4 className='text-md font-medium'>{applicator.serialNumber}</h4>
                        <p className='text-sm text-gray-500'>
                          Seeds: {applicator.seedQuantity} | Usage:{' '}
                          {applicator.usageType === 'full'
                            ? 'Full Use'
                            : applicator.usageType === 'faulty'
                              ? 'Faulty'
                              : 'No Use'}
                        </p>
                      </div>

                      <div className='flex items-center space-x-4'>
                        <div className='flex items-center'>
                          <input
                            id={`isRemoved-${applicator.id}`}
                            type='checkbox'
                            checked={applicator.isRemoved}
                            onChange={() => handleToggleRemoval(applicator)}
                            className='h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary'
                          />
                          <label
                            htmlFor={`isRemoved-${applicator.id}`}
                            className='ml-2 text-sm font-medium text-gray-700'>
                            {applicator.isRemoved ? 'Removed' : 'Mark as Removed'}
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className='mt-4'>
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
                ))}
              </div>
            )}
          </div>

          <div className='mt-6 flex items-center justify-between border-t pt-6'>
            <div
              className={`text-lg font-medium ${
                effectiveRemovedSeeds === effectiveTotalSeeds ? 'text-green-600' : 'text-red-600'
              }`}>
              Total: {effectiveRemovedSeeds} / {effectiveTotalSeeds} Seeds Removed
            </div>
            <button
              onClick={handleCompleteTreatment}
              disabled={isCompleting || loading}
              className='rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50'>
              {isCompleting
                ? 'Completing...'
                : effectiveRemovedSeeds === effectiveTotalSeeds
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
