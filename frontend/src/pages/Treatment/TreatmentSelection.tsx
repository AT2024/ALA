import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import Layout from '@/components/Layout';
import { useTreatment } from '@/context/TreatmentContext';
import { treatmentService, Treatment } from '@/services/treatmentService';
import { useAuth } from '@/context/AuthContext';
import { priorityService } from '@/services/priorityService';

const TreatmentSelection = () => {
  const { setTreatment } = useTreatment();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [surgeons, setSurgeons] = useState<string[]>([]);
  const [sites, setSites] = useState<string[]>([]);

  const [treatmentType, setTreatmentType] = useState<'insertion' | 'removal'>('insertion');
  const [searchParams, setSearchParams] = useState({
    subjectId: '',
    site: user?.custName || '',
    date: format(new Date(), 'yyyy-MM-dd'),
    seedQuantity: '',
    activityPerSeed: '',
    surgeon: '',
  });

  // Fetch initial data
  useEffect(() => {
    fetchTreatments();

    // Fetch surgeons and sites if user has access
    if (user) {
      fetchSurgeonsAndSites();
    }
  }, [treatmentType, user]);

  const fetchSurgeonsAndSites = async () => {
    try {
      // Get contacts from Priority system
      const contacts = await priorityService.getContacts();

      // Extract unique surgeons from contacts
      const surgeonsList = contacts
        .filter((contact) => contact.POSITIONCODE === '20') // Assuming 20 is the position code for surgeons
        .map((contact) => contact.NAME);

      setSurgeons([...new Set(surgeonsList)]);

      // Get sites user has access to
      if (user?.positionCode === '99') {
        // Admin sees all sites
        const allSites = contacts.map((contact) => contact.CUSTDES).filter((site) => site); // Filter out empty values

        setSites([...new Set(allSites)]);
      } else if (user?.sites) {
        // Regular user sees only assigned sites
        setSites(user.sites);
      }
    } catch (err: any) {
      console.error('Error fetching surgeons and sites:', err);
    }
  };

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

  const handleCreateTreatment = async () => {
    if (!searchParams.site || !searchParams.date || !searchParams.subjectId) {
      setError('Site, Date, and Patient ID are required to create a new treatment');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Replace this block with the correct method to create a treatment.
      // If you have a function to create a treatment, import and use it here.
      // For now, we'll throw an error to indicate this needs implementation.
      throw new Error('Treatment creation is not implemented. Please implement createTreatment in treatmentService.');
    } catch (err: any) {
      setError(err.message || 'Failed to create treatment');
    } finally {
      setLoading(false);
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
                <label htmlFor='site' className='block text-sm font-medium text-gray-700'>
                  Treatment Site *
                </label>
                <select
                  id='site'
                  value={searchParams.site}
                  onChange={(e) => setSearchParams({ ...searchParams, site: e.target.value })}
                  className='mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm'
                  required>
                  <option value=''>Select Site</option>
                  {sites.map((site, index) => (
                    <option key={index} value={site}>
                      {site}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor='date' className='block text-sm font-medium text-gray-700'>
                  Date *
                </label>
                <input
                  type='date'
                  id='date'
                  value={searchParams.date}
                  onChange={handleDateChange}
                  className='mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm'
                  required
                />
              </div>

              <div>
                <label htmlFor='subjectId' className='block text-sm font-medium text-gray-700'>
                  Patient ID *
                </label>
                <input
                  type='text'
                  id='subjectId'
                  value={searchParams.subjectId}
                  onChange={(e) => setSearchParams({ ...searchParams, subjectId: e.target.value })}
                  className='mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm'
                />
              </div>
            </div>

            <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
              <div>
                <label htmlFor='seedQuantity' className='block text-sm font-medium text-gray-700'>
                  Seed Quantity
                </label>
                <input
                  type='number'
                  id='seedQuantity'
                  value={searchParams.seedQuantity}
                  onChange={(e) =>
                    setSearchParams({ ...searchParams, seedQuantity: e.target.value })
                  }
                  className='mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm'
                />
              </div>

              <div>
                <label
                  htmlFor='activityPerSeed'
                  className='block text-sm font-medium text-gray-700'>
                  Activity Per Seed (µCi)
                </label>
                <input
                  type='number'
                  id='activityPerSeed'
                  value={searchParams.activityPerSeed}
                  onChange={(e) =>
                    setSearchParams({ ...searchParams, activityPerSeed: e.target.value })
                  }
                  className='mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm'
                />
              </div>

              <div>
                <label htmlFor='surgeon' className='block text-sm font-medium text-gray-700'>
                  Surgeon
                </label>
                <select
                  id='surgeon'
                  value={searchParams.surgeon}
                  onChange={(e) => setSearchParams({ ...searchParams, surgeon: e.target.value })}
                  className='mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm'>
                  <option value=''>Select Surgeon</option>
                  {surgeons.map((surgeon, index) => (
                    <option key={index} value={surgeon}>
                      {surgeon}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className='flex justify-between'>
              <button
                type='button'
                onClick={handleCreateTreatment}
                className='rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'>
                Create New Treatment
              </button>

              <button
                type='submit'
                className='rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2'>
                Search
              </button>
            </div>
          </form>
        </div>

        {error && <div className='rounded-md bg-red-50 p-4 text-sm text-red-700'>{error}</div>}

        <div className='rounded-lg border bg-white p-4 shadow-sm'>
          <h2 className='mb-4 text-lg font-medium'>Available Treatments</h2>

          {loading ? (
            <div className='flex justify-center py-8'>
              <div className='h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent'></div>
            </div>
          ) : treatments.length === 0 ? (
            <div className='rounded-md bg-blue-50 p-4 text-sm text-blue-700'>
              No treatments found. Try adjusting your search criteria or create a new treatment
              using the form above.
            </div>
          ) : (
            <div className='overflow-hidden rounded-lg border'>
              <table className='min-w-full divide-y divide-gray-200'>
                <thead className='bg-gray-50'>
                  <tr>
                    <th
                      scope='col'
                      className='px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500'>
                      Patient ID
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
                      Status
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
                      <td className='whitespace-nowrap px-6 py-4 text-sm text-gray-500'>
                        <span
                          className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                            treatment.isComplete
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                          {treatment.isComplete ? 'Completed' : 'In Progress'}
                        </span>
                      </td>
                      <td className='whitespace-nowrap px-6 py-4 text-right text-sm font-medium'>
                        <button
                          onClick={() => handleSelectTreatment(treatment)}
                          disabled={treatment.isComplete}
                          className={`text-primary hover:text-primary/80 ${treatment.isComplete ? 'cursor-not-allowed opacity-50' : ''}`}>
                          {treatment.isComplete ? 'Completed' : 'Select'}
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
