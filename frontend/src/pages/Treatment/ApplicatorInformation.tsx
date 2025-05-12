import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import Layout from '@/components/Layout';
import { useTreatment } from '@/context/TreatmentContext';
import { treatmentService } from '@/services/treatmentService';

const ApplicatorInformation = () => {
  const navigate = useNavigate();
  const { currentTreatment, currentApplicator, addApplicator, updateApplicator } = useTreatment();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seedQuantity, setSeedQuantity] = useState(currentApplicator?.seedQuantity || 0);
  const [usageType, setUsageType] = useState<'full' | 'faulty' | 'none'>(
    currentApplicator?.usageType || 'full'
  );
  const [insertionTime, setInsertionTime] = useState<string>(
    currentApplicator
      ? format(new Date(currentApplicator.insertionTime), "yyyy-MM-dd'T'HH:mm")
      : format(new Date(), "yyyy-MM-dd'T'HH:mm")
  );
  const [comments, setComments] = useState<string>(currentApplicator?.comments || '');
  const [imagePreview, setImagePreview] = useState<string | undefined>(
    currentApplicator?.image || undefined
  );

  useEffect(() => {
    if (!currentTreatment || !currentApplicator) {
      navigate('/treatment/scan');
    }
  }, [currentTreatment, currentApplicator, navigate]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentTreatment || !currentApplicator) {
      setError('No treatment or applicator selected');
      return;
    }

    // Validate - if usage type is 'faulty', comments are required
    if (usageType === 'faulty' && !comments.trim()) {
      setError('Comments are required for faulty applicators');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const applicatorData = {
        id: currentApplicator.id || '',
        serialNumber: currentApplicator.serialNumber,
        seedQuantity,
        usageType,
        insertionTime: new Date(insertionTime).toISOString(),
        comments: comments || undefined,
        image: imagePreview,
      };

      if (currentApplicator.id) {
        // Update existing applicator
        const updatedApplicator = await treatmentService.updateApplicator(
          currentTreatment.id,
          currentApplicator.id,
          applicatorData
        );
        updateApplicator(currentApplicator.id, updatedApplicator);
      } else {
        // Add new applicator
        const newApplicator = await treatmentService.addApplicator(
          currentTreatment.id,
          applicatorData
        );
        addApplicator(newApplicator);
      }

      // Navigate to the use list
      navigate('/treatment/list');
    } catch (err: any) {
      setError(err.message || 'Failed to save applicator information');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    // Go back to scanner
    navigate('/treatment/scan');
  };

  if (!currentTreatment || !currentApplicator) {
    return (
      <Layout title='Applicator Information' showBackButton>
        <div className='flex items-center justify-center py-10'>
          <p>No applicator selected. Please scan an applicator first.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title='Applicator Information' showBackButton>
      <div className='mx-auto max-w-2xl space-y-6'>
        <div className='rounded-lg border bg-white p-4 shadow-sm'>
          <h2 className='mb-4 text-lg font-medium'>Treatment Information</h2>
          <div className='grid grid-cols-2 gap-4'>
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

        <div className='rounded-lg border bg-white p-4 shadow-sm'>
          <h2 className='mb-4 text-lg font-medium'>Applicator Details</h2>

          <div className='mb-4 rounded-md bg-blue-50 p-3 text-blue-800'>
            <div className='flex'>
              <div className='flex-shrink-0'>
                <svg className='h-5 w-5 text-blue-500' viewBox='0 0 20 20' fill='currentColor'>
                  <path
                    fillRule='evenodd'
                    d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z'
                    clipRule='evenodd'
                  />
                </svg>
              </div>
              <div className='ml-3 flex-1 md:flex md:justify-between'>
                <p className='text-sm'>
                  Serial Number:{' '}
                  <span className='font-semibold'>{currentApplicator.serialNumber}</span>
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className='mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700'>{error}</div>
          )}

          <form onSubmit={handleSubmit} className='space-y-4'>
            <div>
              <label htmlFor='usageType' className='block text-sm font-medium text-gray-700'>
                Usage Type *
              </label>
              <select
                id='usageType'
                value={usageType}
                onChange={(e) => setUsageType(e.target.value as 'full' | 'faulty' | 'none')}
                className='mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm'
                required>
                <option value='full'>Full Use</option>
                <option value='faulty'>Faulty</option>
                <option value='none'>No Use</option>
              </select>
            </div>

            <div>
              <label htmlFor='seedQuantity' className='block text-sm font-medium text-gray-700'>
                Seed Quantity *
              </label>
              <input
                type='number'
                id='seedQuantity'
                value={seedQuantity}
                onChange={(e) => setSeedQuantity(parseInt(e.target.value) || 0)}
                min='0'
                className='mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm'
                required
              />
            </div>

            <div>
              <label htmlFor='insertionTime' className='block text-sm font-medium text-gray-700'>
                Insertion Time *
              </label>
              <input
                type='datetime-local'
                id='insertionTime'
                value={insertionTime}
                onChange={(e) => setInsertionTime(e.target.value)}
                className='mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm'
                required
              />
            </div>

            <div>
              <label htmlFor='comments' className='block text-sm font-medium text-gray-700'>
                Comments {usageType === 'faulty' && '*'}
              </label>
              <textarea
                id='comments'
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={3}
                className='mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm'
                required={usageType === 'faulty'}></textarea>
              {usageType === 'faulty' && (
                <p className='mt-1 text-sm text-red-500'>
                  Comments are required for faulty applicators
                </p>
              )}
            </div>

            <div>
              <label htmlFor='image' className='block text-sm font-medium text-gray-700'>
                Upload Image
              </label>
              <input
                type='file'
                id='image'
                accept='image/*'
                onChange={handleImageChange}
                className='mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm'
              />
              {imagePreview && (
                <div className='mt-2'>
                  <img
                    src={imagePreview}
                    alt='Preview'
                    className='h-40 w-auto rounded-md object-cover'
                  />
                </div>
              )}
            </div>

            <div className='flex justify-between pt-4'>
              <button
                type='button'
                onClick={handleCancel}
                className='rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2'>
                Cancel
              </button>
              <button
                type='submit'
                disabled={isLoading}
                className='rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50'>
                {isLoading ? 'Saving...' : 'Save Applicator'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default ApplicatorInformation;
