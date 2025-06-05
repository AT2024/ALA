import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, addDays, subDays } from 'date-fns';
import Layout from '@/components/Layout';
import { useTreatment } from '@/context/TreatmentContext';
import { useAuth } from '@/context/AuthContext';

// Priority system integration - no more mock data needed
// Sites, patients, and surgeons will be fetched from Priority system

interface PriorityPatient {
  id: string;
  seedQty: number;
  activityPerSeed: number;
  ordName?: string;
  reference?: string;
}

interface PrioritySite {
  custName: string;
  custDes: string;
}

const TreatmentSelection = () => {
  const { setTreatment, procedureType } = useTreatment();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: user?.email || '',
    site: '',
    date: format(new Date(), 'dd.MMM.yyyy'),
    patientId: '',
    seedQty: '',
    activityPerSeed: '',
    surgeon: ''
  });

  const [availablePatients, setAvailablePatients] = useState<PriorityPatient[]>([]);
  const [availableSites, setAvailableSites] = useState<PrioritySite[]>([]);
  const [availableSurgeons, setAvailableSurgeons] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [sitesLoading, setSitesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load available sites and set default site based on user
  useEffect(() => {
    const loadUserSites = async () => {
      if (!user) return;
      
      setSitesLoading(true);
      try {
        // For ATM users (fullAccess), fetch all sites
        // For site users, use their assigned site
        if (user.fullAccess && user.sites && user.sites.length > 0) {
          // Convert user.sites to PrioritySite format
          const userSites: PrioritySite[] = user.sites.map(site => ({
            custName: site,
            custDes: site // Use site name as description for now
          }));
          setAvailableSites(userSites);
        } else if (user.custName) {
          // Site users have access to their own site only
          setAvailableSites([{
            custName: user.custName,
            custDes: user.custName
          }]);
          setFormData(prev => ({ ...prev, site: user.custName || '' }));
        }
        
        // Load surgeons from Priority (for now use mock data)
        // TODO: Implement Priority surgeon fetching
        setAvailableSurgeons([
          'Dr. Smith, John',
          'Dr. Johnson, Sarah', 
          'Dr. Williams, Michael',
          'Dr. Brown, Emily',
          'Dr. Davis, Robert'
        ]);
      } catch (err) {
        console.error('Error loading user sites:', err);
        setError('Failed to load available sites');
      } finally {
        setSitesLoading(false);
      }
    };
    
    loadUserSites();
  }, [user]);

  // Fetch patients when site and date change
  useEffect(() => {
    if (formData.site && formData.date) {
      fetchPatientsForSiteAndDate();
    }
  }, [formData.site, formData.date]);

  const fetchPatientsForSiteAndDate = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log(`Fetching patients for site: ${formData.site}, date: ${formData.date}`);
      
      // Convert date format from DD.MMM.YYYY to YYYY-MM-DD for Priority API
      const dateForApi = convertDateForPriority(formData.date);
      
      // Call Priority service to get orders for the site and date
      const response = await fetch('/api/priority/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          site: formData.site,
          date: dateForApi,
          procedureType: procedureType
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch patients: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Transform Priority data to our patient format
      const patients: PriorityPatient[] = data.orders?.map((order: any) => ({
        id: order.DETAILS || order.REFERENCE || `PAT-${order.ORDNAME}`,
        seedQty: parseInt(order.SBD_SEEDQTY) || 0,
        activityPerSeed: parseFloat(order.SBD_PREFACTIV) || 0,
        ordName: order.ORDNAME,
        reference: order.REFERENCE
      })) || [];
      
      console.log(`Found ${patients.length} patients for site ${formData.site}`);
      setAvailablePatients(patients);
      
      // If no patients found, show helpful message
      if (patients.length === 0) {
        setError(`No scheduled procedures found for ${formData.site} on ${formData.date}`);
      }
    } catch (err: any) {
      console.error('Error fetching patients:', err);
      setError(err.message || 'Failed to fetch patients for selected site and date');
      setAvailablePatients([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (direction: 'yesterday' | 'today' | 'tomorrow') => {
    const currentDate = new Date();
    let newDate: Date;
    
    switch (direction) {
      case 'yesterday':
        newDate = subDays(currentDate, 1);
        break;
      case 'tomorrow':
        newDate = addDays(currentDate, 1);
        break;
      default:
        newDate = currentDate;
    }
    
    setFormData(prev => ({ 
      ...prev, 
      date: format(newDate, 'dd.MMM.yyyy'),
      patientId: '', // Reset patient selection when date changes
      seedQty: '',
      activityPerSeed: ''
    }));
  };

  const handlePatientSelection = (patientId: string) => {
    const selectedPatient = availablePatients.find(p => p.id === patientId);
    
    if (selectedPatient) {
      console.log('Selected patient:', selectedPatient);
      setFormData(prev => ({
        ...prev,
        patientId: selectedPatient.id,
        seedQty: selectedPatient.seedQty.toString(),
        activityPerSeed: selectedPatient.activityPerSeed.toString()
      }));
    }
  };
  
  // Helper function to convert date format for Priority API
  const convertDateForPriority = (dateStr: string): string => {
    try {
      // Convert from DD.MMM.YYYY to YYYY-MM-DD
      const [day, month, year] = dateStr.split('.');
      const monthMap: { [key: string]: string } = {
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
        'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
        'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
      };
      
      const monthNum = monthMap[month] || '01';
      return `${year}-${monthNum}-${day.padStart(2, '0')}`;
    } catch (error) {
      console.error('Error converting date:', error);
      return new Date().toISOString().split('T')[0]; // fallback to today
    }
  };

  const handleSubmit = () => {
    // Validation
    if (!formData.email || !formData.site || !formData.patientId || !formData.surgeon) {
      setError('Please fill in all required fields (Email, Site, Patient ID, Surgeon)');
      return;
    }

    // Create treatment object
    const treatment = {
      id: `treatment-${Date.now()}`,
      type: procedureType as 'insertion' | 'removal',
      subjectId: formData.patientId,
      site: formData.site,
      date: formData.date,
      isComplete: false,
      email: formData.email,
      seedQuantity: parseInt(formData.seedQty) || 0,
      activityPerSeed: parseFloat(formData.activityPerSeed) || 0,
      surgeon: formData.surgeon
    };

    setTreatment(treatment);
    
    // Navigate to Treatment Documentation screen
    navigate('/treatment/scan');
  };

  return (
    <Layout title="Treatment Selection" showBackButton={true}>
      <div className="space-y-6">
        {/* Header showing procedure type */}
        <div className="rounded-lg border bg-blue-50 p-4">
          <h2 className="text-lg font-medium text-blue-900">
            {procedureType === 'insertion' ? 'Treatment Insertion' : 'Treatment Removal'} Setup
          </h2>
          <p className="text-sm text-blue-700">
            Please fill in the treatment details below
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 border border-red-200">
            {error}
          </div>
        )}
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <form className="space-y-6">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                E-mail *
              </label>
              <input
                type="email"
                id="email"
                maxLength={32}
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="block w-full max-w-md rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
                required
              />
            </div>

            {/* Site Field */}
            <div>
              <label htmlFor="site" className="block text-sm font-medium text-gray-700 mb-2">
                Site *
              </label>
              {sitesLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                  <span className="text-sm text-gray-500">Loading sites...</span>
                </div>
              ) : user?.fullAccess ? (
                // ATM users: choose from scrolling list of all sites
                <select
                  id="site"
                  value={formData.site}
                  onChange={(e) => setFormData(prev => ({ ...prev, site: e.target.value }))}
                  className="block w-full max-w-md rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
                  required
                >
                  <option value="">Select Site</option>
                  {availableSites.map((site) => (
                    <option key={site.custName} value={site.custName}>
                      {site.custDes} ({site.custName})
                    </option>
                  ))}
                </select>
              ) : (
                // Site users: filled automatically from their assigned site (read-only)
                <input
                  type="text"
                  id="site"
                  value={formData.site}
                  readOnly
                  className="block w-full max-w-md rounded-md border border-gray-300 bg-gray-50 px-3 py-2 shadow-sm sm:text-sm"
                />
              )}
            </div>

            {/* Date Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleDateChange('yesterday')}
                  className="rounded-md bg-gray-100 px-3 py-2 text-sm hover:bg-gray-200"
                >
                  Yesterday
                </button>
                <button
                  type="button"
                  onClick={() => handleDateChange('today')}
                  className="rounded-md bg-primary px-3 py-2 text-sm text-white hover:bg-primary/90"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => handleDateChange('tomorrow')}
                  className="rounded-md bg-gray-100 px-3 py-2 text-sm hover:bg-gray-200"
                >
                  Tomorrow
                </button>
                <input
                  type="text"
                  value={formData.date}
                  readOnly
                  className="block rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm"
                />
              </div>
            </div>
            {/* Patient ID Field */}
            <div>
              <label htmlFor="patientId" className="block text-sm font-medium text-gray-700 mb-2">
                Patient ID *
              </label>
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                  <span className="text-sm text-gray-500">Loading patients...</span>
                </div>
              ) : availablePatients.length > 1 ? (
                <select
                  id="patientId"
                  value={formData.patientId}
                  onChange={(e) => handlePatientSelection(e.target.value)}
                  className="block w-full max-w-md rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
                  required
                >
                  <option value="">Select Patient ID</option>
                  {availablePatients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.id}
                    </option>
                  ))}
                </select>
              ) : availablePatients.length === 1 ? (
                <input
                  type="text"
                  value={availablePatients[0].id}
                  onClick={() => handlePatientSelection(availablePatients[0].id)}
                  readOnly
                  className="block w-full max-w-md cursor-pointer rounded-md border border-gray-300 bg-gray-50 px-3 py-2 shadow-sm sm:text-sm"
                />
              ) : (
                <div className="text-sm text-gray-500">
                  No patients scheduled for selected site and date
                </div>
              )}
            </div>
            {/* Seed Quantity Field (Read-only) */}
            <div>
              <label htmlFor="seedQty" className="block text-sm font-medium text-gray-700 mb-2">
                Seed Qty.
              </label>
              <input
                type="text"
                id="seedQty"
                value={formData.seedQty}
                readOnly
                className="block w-full max-w-md rounded-md border border-gray-300 bg-gray-50 px-3 py-2 shadow-sm sm:text-sm"
                placeholder="Auto-filled after selecting Patient ID"
              />
            </div>

            {/* Activity Per Seed Field (Read-only) */}
            <div>
              <label htmlFor="activityPerSeed" className="block text-sm font-medium text-gray-700 mb-2">
                Activity Per Seed (µCi)
              </label>
              <input
                type="text"
                id="activityPerSeed"
                value={formData.activityPerSeed}
                readOnly
                className="block w-full max-w-md rounded-md border border-gray-300 bg-gray-50 px-3 py-2 shadow-sm sm:text-sm"
                placeholder="Auto-filled after selecting Patient ID"
              />
            </div>

            {/* Surgeon Field */}
            <div>
              <label htmlFor="surgeon" className="block text-sm font-medium text-gray-700 mb-2">
                Surgeon *
              </label>
              <select
                id="surgeon"
                value={formData.surgeon}
                onChange={(e) => setFormData(prev => ({ ...prev, surgeon: e.target.value }))}
                className="block w-full max-w-md rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
                required
              >
                <option value="">Select Surgeon</option>
                {availableSurgeons.map((surgeon) => (
                  <option key={surgeon} value={surgeon}>
                    {surgeon}
                  </option>
                ))}
              </select>
            </div>
            {/* Continue Button */}
            <div className="pt-4">
              <button
                type="button"
                onClick={handleSubmit}
                className="w-full max-w-md rounded-md bg-primary py-3 px-4 text-base font-medium text-white shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
                disabled={!formData.email || !formData.site || !formData.patientId || !formData.surgeon}
              >
                Continue
              </button>
            </div>
          </form>
        </div>

        {/* Information Panel */}
        <div className="rounded-lg border bg-gray-50 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Information</h3>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• Fields marked with * are required</li>
            <li>• Patient data is loaded from Priority ORDERS table</li>
            <li>• Seed quantity (SBD_SEEDQTY) and activity (SBD_PREFACTIV) auto-filled</li>
            <li>• Date format: DD.MMM.YYYY (e.g., 04.Jun.2025)</li>
            <li>• Sites shown based on your Priority access level (POSITIONCODE)</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
};

export default TreatmentSelection;