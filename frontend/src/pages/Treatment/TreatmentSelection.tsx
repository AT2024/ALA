import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import Layout from '@/components/Layout';
import { useTreatment } from '@/context/TreatmentContext';
import { treatmentService, Treatment } from '@/services/treatmentService';

const TreatmentSelection = () => {
  const { setTreatment } = useTreatment();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [treatments, setTreatments] = useState<Treatment[]>([]);

  const [treatmentType, setTreatmentType] = useState<'insertion' | 'removal'>('insertion');
  const [searchParams, setSearchParams] = useState({
    subjectId: '',
    site: '',
    date: format(new Date(), 'yyyy-MM-dd'),
  });

  useEffect(() => {
    fetchTreatments();
  }, [treatmentType]);

  const fetchTreatments = async () => {
    setLoading(true);
    setError(null);

    try {
      // Filter parameters
      const params = {
        type: treatmentType,
        ...searchParams,
      };

      // Only include non-empty params
      const filteredParams = Object.entries(params).reduce(
        (acc, [key, value]) => {
          if (value) {
            if (key === 'type') {
              acc[key] = value as 'insertion' | 'removal';
            } else {
              acc[key] = value;
            }
          }
          return acc;
        },
        {} as Record<string, any>
      );

      const data = await treatmentService.getTreatments(filteredParams);
      setTreatments(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch treatments');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTreatments();
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value;
    setSearchParams({ ...searchParams, date });
  };

  const handleSelectTreatment = (treatment: Treatment) => {
    setTreatment(treatment);
    if (treatment.type === 'insertion') {
      navigate('/treatment/scan');
    } else {
      navigate('/treatment/removal');
    }
  };

  return (
    <Layout title='Treatment Selection'>
      <div className='space-y-6'>
        <div className='rounded-lg border bg-white p-4 shadow-sm'>
          <h2 className='mb-4 text-lg font-medium'>Select Treatment Type</h2>
          <div className='flex space-x-4'>
            <button
              onClick={() => setTreatmentType('insertion')}
              className={`flex-1 rounded-md px-4 py-2 ${
                treatmentType === 'insertion'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}>
              Insertion
            </button>
            <button
              onClick={() => setTreatmentType('removal')}
              className={`flex-1 rounded-md px-4 py-2 ${
                treatmentType === 'removal'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}>
              Removal
            </button>
          </div>
        </div>

        <div className='rounded-lg border bg-white p-4 shadow-sm'>
          <h2 className='mb-4 text-lg font-medium'>Search Treatments</h2>
          <form onSubmit={handleSearch} className='space-y-4'>
            <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
              <div>
                <label htmlFor='subjectId' className='block text-sm font-medium text-gray-700'>
                  Subject ID
                </label>
                <input
                  type='text'
                  id='subjectId'
                  value={searchParams.subjectId}
                  onChange={(e) => setSearchParams({ ...searchParams, subjectId: e.target.value })}
                  className='mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm'
                />
              </div>
              <div>
                <label htmlFor='site' className='block text-sm font-medium text-gray-700'>
                  Treatment Site
                </label>
                <input
                  type='text'
                  id='site'
                  value={searchParams.site}
                  onChange={(e) => setSearchParams({ ...searchParams, site: e.target.value })}
                  className='mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm'
                />
              </div>
              <div>
                <label htmlFor='date' className='block text-sm font-medium text-gray-700'>
                  Date
                </label>
                <input
                  type='date'
                  id='date'
                  value={searchParams.date}
                  onChange={handleDateChange}
                  className='mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm'
                />
              </div>
            </div>
            <div className='flex justify-end'>
              <button
                type='submit'
                className='rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2'>
                Search
              </button>
            </div>
          </form>
        </div>

        <div className='rounded-lg border bg-white p-4 shadow-sm'>
          <h2 className='mb-4 text-lg font-medium'>Available Treatments</h2>

          {loading ? (
            <div className='flex justify-center py-8'>
              <div className='h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent'></div>
            </div>
          ) : error ? (
            <div className='rounded-md bg-red-50 p-4 text-sm text-red-700'>{error}</div>
          ) : treatments.length === 0 ? (
            <div className='rounded-md bg-blue-50 p-4 text-sm text-blue-700'>
              No treatments found. Try adjusting your search criteria.
            </div>
          ) : (
            <div className='overflow-hidden rounded-lg border'>
              <table className='min-w-full divide-y divide-gray-200'>
                <thead className='bg-gray-50'>
                  <tr>
                    <th
                      scope='col'
                      className='px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500'>
                      Subject ID
                    </th>
                    <th
                      scope='col'
                      className='px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500'>
                      Site
                    </th>
                    <th
                      scope='col'
                      className='px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500'>
                      Date
                    </th>
                    <th
                      scope='col'
                      className='px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500'>
                      Type
                    </th>
                    <th
                      scope='col'
                      className='px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500'>
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-gray-200 bg-white'>
                  {treatments.map((treatment) => (
                    <tr key={treatment.id} className='hover:bg-gray-50'>
                      <td className='whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900'>
                        {treatment.subjectId}
                      </td>
                      <td className='whitespace-nowrap px-6 py-4 text-sm text-gray-500'>
                        {treatment.site}
                      </td>
                      <td className='whitespace-nowrap px-6 py-4 text-sm text-gray-500'>
                        {format(new Date(treatment.date), 'MMM d, yyyy')}
                      </td>
                      <td className='whitespace-nowrap px-6 py-4 text-sm text-gray-500'>
                        <span
                          className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                            treatment.type === 'insertion'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                          {treatment.type === 'insertion' ? 'Insertion' : 'Removal'}
                        </span>
                      </td>
                      <td className='whitespace-nowrap px-6 py-4 text-right text-sm font-medium'>
                        <button
                          onClick={() => handleSelectTreatment(treatment)}
                          className='text-primary hover:text-primary/80'>
                          Select
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default TreatmentSelection;
