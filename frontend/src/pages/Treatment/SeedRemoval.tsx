import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { useTreatment } from '@/context/TreatmentContext';
import { treatmentService, Applicator } from '@/services/treatmentService';

const SeedRemoval = () => {
  const navigate = useNavigate();
  const { currentTreatment, applicators, updateApplicator, totalSeeds, removedSeeds } =
    useTreatment();

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
              <p className='font-medium'>{new Date(currentTreatment.date).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        {error && <div className='rounded-md bg-red-50 p-4 text-sm text-red-700'>{error}</div>}

        <div className='rounded-lg border bg-white p-4 shadow-sm'>
          <div className='mb-4 flex items-center justify-between'>
            <h2 className='text-lg font-medium'>Seed Removal Tracking</h2>
            <div className='flex items-center space-x-2'>
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
                      <h3 className='text-md font-medium'>{applicator.serialNumber}</h3>
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

          <div className='mt-6 flex items-center justify-between'>
            <div
              className={`text-lg font-medium ${
                removedSeeds === totalSeeds ? 'text-green-600' : 'text-red-600'
              }`}>
              Total: {removedSeeds} / {totalSeeds} Seeds Removed
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
