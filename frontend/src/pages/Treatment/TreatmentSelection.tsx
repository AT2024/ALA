import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, addDays, subDays } from 'date-fns';
import Layout from '@/components/Layout';
import { useTreatment } from '@/context/TreatmentContext';
import { useAuth } from '@/context/AuthContext';
import { priorityService } from '@/services/priorityService';
import { treatmentService } from '@/services/treatmentService';

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
  const [isLoading, setIsLoading] = useState(false);
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
          const userSites: PrioritySite[] = user.sites.map(site => {
            // Handle both old format (string) and new format (site object)
            if (typeof site === 'string') {
              return {
                custName: site,
                custDes: site // Fallback for old format
              };
            } else {
              return {
                custName: site.custName,
                custDes: site.custDes
              };
            }
          });
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

  // Auto-select patient when only one exists
  useEffect(() => {
    if (availablePatients.length === 1 && !formData.patientId) {
      handlePatientSelection(availablePatients[0].id);
    }
  }, [availablePatients, formData.patientId]);

  const fetchPatientsForSiteAndDate = async () => {
    setLoading(true);
    setError(null);
    
    // Clear previous patient data to prevent accumulation
    setAvailablePatients([]);
    
    try {
      console.log(`Fetching patients for site: ${formData.site}, date: ${formData.date}`);
      
      // Convert date format from DD.MMM.YYYY to YYYY-MM-DD for Priority API
      const dateForApi = convertDateForPriority(formData.date);
      
      // Call Priority service to get orders for the site and date
      const data = await priorityService.getOrdersForSiteAndDate(
        formData.site, 
        dateForApi, 
        procedureType || undefined
      );
      
      // Filter orders by date as a frontend validation backup
      const filteredOrders = data.orders?.filter((order: any) => {
        if (!order.SIBD_TREATDAY && !order.CURDATE) {
          console.warn(`Order ${order.ORDNAME} has no date field`);
          return false;
        }
        
        const treatmentDate = order.SIBD_TREATDAY || order.CURDATE;
        const orderDate = new Date(treatmentDate).toISOString().split('T')[0];
        const isMatchingDate = orderDate === dateForApi;
        
        if (!isMatchingDate) {
          console.warn(`Frontend filtering: Order ${order.ORDNAME} date ${orderDate} does not match requested ${dateForApi}`);
        }
        
        return isMatchingDate;
      }) || [];
      
      console.log(`Backend returned ${data.orders?.length || 0} orders, frontend filtered to ${filteredOrders.length} orders for date ${dateForApi}`);
      
      // Transform Priority data to our patient format
      const patients: PriorityPatient[] = filteredOrders.map((order: any) => ({
        id: order.ORDNAME,
        seedQty: parseInt(order.SBD_SEEDQTY) || 0,
        activityPerSeed: parseFloat(order.SBD_PREFACTIV) || 0,
        ordName: order.ORDNAME,
        reference: order.REFERENCE
      }));
      
      // Deduplicate patients by REFERENCE (actual patient ID) to prevent duplicate patients
      // Keep the most recent order for each patient (by ORDNAME)
      const patientMap = new Map<string, PriorityPatient>();
      
      patients.forEach(patient => {
        const key = patient.reference || patient.ordName || patient.id; // Use reference as key, fallback to ordName or id
        
        if (!key) {
          console.warn('Patient has no valid key for deduplication:', patient);
          return;
        }
        
        if (!patientMap.has(key)) {
          patientMap.set(key, patient);
        } else {
          // If we already have this patient, keep the one with the higher ORDNAME (more recent)
          const existing = patientMap.get(key)!;
          const currentOrderName = patient.ordName || '';
          const existingOrderName = existing.ordName || '';
          
          if (currentOrderName > existingOrderName) {
            patientMap.set(key, patient);
          }
        }
      });
      
      const uniquePatients = Array.from(patientMap.values());
      
      console.log(`Found ${patients.length} total orders, ${uniquePatients.length} unique patients for site ${formData.site}`);
      if (patients.length !== uniquePatients.length) {
        console.warn(`Deduplication: Removed ${patients.length - uniquePatients.length} duplicate patient entries`);
        
        // Log details of what was kept vs removed
        const keptPatients = uniquePatients.map(up => ({ reference: up.reference, ordName: up.ordName }));
        const removedPatients = patients.filter(p => !keptPatients.find(kp => kp.reference === p.reference && kp.ordName === p.ordName));
        
        console.group('Deduplication Details:');
        console.log('Kept patients:', keptPatients);
        console.log('Removed patients:', removedPatients.map(r => ({ reference: r.reference, ordName: r.ordName })));
        
        // Show which patients had duplicates
        const duplicateReferences = [...new Set(removedPatients.map(p => p.reference))];
        duplicateReferences.forEach(ref => {
          const allOrdersForPatient = patients.filter(p => p.reference === ref);
          const keptOrder = keptPatients.find(kp => kp.reference === ref);
          console.log(`Patient ${ref}: Had ${allOrdersForPatient.length} orders, kept ${keptOrder?.ordName}`);
        });
        console.groupEnd();
      }
      
      setAvailablePatients(uniquePatients);
      
      // If no patients found, show helpful message
      if (uniquePatients.length === 0) {
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

  // Helper function to check if selected date matches a specific day
  const isDateActive = (direction: 'yesterday' | 'today' | 'tomorrow') => {
    const today = new Date();
    const compareDate = direction === 'yesterday' ? subDays(today, 1) : 
                       direction === 'tomorrow' ? addDays(today, 1) : today;
    return formData.date === format(compareDate, 'dd.MMM.yyyy');
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

  const handleSubmit = async () => {
    // Validation
    if (!formData.email || !formData.site || !formData.patientId || !formData.surgeon) {
      setError('Please fill in all required fields (Email, Site, Patient ID, Surgeon)');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Create treatment in backend database
      const treatmentData = {
        type: procedureType as 'insertion' | 'removal',
        subjectId: formData.patientId,
        site: formData.site,
        date: formData.date,
        email: formData.email,
        seedQuantity: parseInt(formData.seedQty) || 0,
        activityPerSeed: parseFloat(formData.activityPerSeed) || 0,
        surgeon: formData.surgeon
      };

      console.log('Creating treatment with data:', treatmentData);
      
      // Call backend API to create treatment
      const treatment = await treatmentService.createTreatment(treatmentData);
      
      console.log('Treatment created successfully:', treatment);
      
      // Set treatment in context with backend-generated ID
      setTreatment(treatment);
      
      // Navigate to Treatment Documentation screen
      navigate('/treatment/scan');
    } catch (error: any) {
      console.error('Error creating treatment:', error);
      setError(error.response?.data?.message || 'Failed to create treatment. Please try again.');
    } finally {
      setIsLoading(false);
    }
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
                  className={`rounded-md px-3 py-2 text-sm ${isDateActive('yesterday') ? 'bg-primary text-white hover:bg-primary/90' : 'bg-gray-100 hover:bg-gray-200'}`}
                >
                  Yesterday
                </button>
                <button
                  type="button"
                  onClick={() => handleDateChange('today')}
                  className={`rounded-md px-3 py-2 text-sm ${isDateActive('today') ? 'bg-primary text-white hover:bg-primary/90' : 'bg-gray-100 hover:bg-gray-200'}`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => handleDateChange('tomorrow')}
                  className={`rounded-md px-3 py-2 text-sm ${isDateActive('tomorrow') ? 'bg-primary text-white hover:bg-primary/90' : 'bg-gray-100 hover:bg-gray-200'}`}
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
                  {availablePatients.map((patient, index) => (
                    <option key={patient.id || `patient-${index}`} value={patient.id}>
                      {patient.id}
                    </option>
                  ))}
                </select>
              ) : availablePatients.length === 1 ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={availablePatients[0].id}
                    readOnly
                    className="block w-full max-w-md rounded-md border border-green-300 bg-green-50 px-3 py-2 shadow-sm sm:text-sm"
                  />
                  <p className="text-sm text-green-600">
                    ✓ Patient automatically selected (only one available)
                  </p>
                </div>
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
                className="w-full max-w-md rounded-md bg-primary py-3 px-4 text-base font-medium text-white shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading || !formData.email || !formData.site || !formData.patientId || !formData.surgeon}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    Creating Treatment...
                  </div>
                ) : (
                  'Continue'
                )}
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