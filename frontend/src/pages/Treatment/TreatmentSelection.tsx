import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, addDays, subDays } from 'date-fns';
import Layout from '@/components/Layout';
import { useTreatment } from '@/context/TreatmentContext';
import { useAuth } from '@/context/AuthContext';
import { priorityService } from '@/services/priorityService';
import { treatmentService } from '@/services/treatmentService';

// Development debugging utility
const debugPatientData = (context: string, data: any) => {
  if (process.env.NODE_ENV === 'development') {
    console.group(`🔍 Patient Data Debug - ${context}`);
    console.log('Timestamp:', new Date().toISOString());
    console.log('Data:', data);
    console.groupEnd();
  }
};

// Development state monitor
const debugComponentState = (formData: any, availablePatients: any[], loading: boolean, error: string | null) => {
  if (process.env.NODE_ENV === 'development') {
    console.group('📊 Component State Monitor');
    console.log('Form Data:', formData);
    console.log('Available Patients:', availablePatients);
    console.log('Loading:', loading);
    console.log('Error:', error);
    console.log('Cache Keys in localStorage:', 
      Object.keys(localStorage).filter(key => key.includes('cached'))
    );
    console.groupEnd();
  }
};

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
    // Create AbortController for this request
    const abortController = new AbortController();
    
    if (formData.site && formData.date) {
      fetchPatientsForSiteAndDate(abortController.signal);
    }
    
    // Cleanup function to abort request if component unmounts or dependencies change
    return () => {
      abortController.abort();
    };
  }, [formData.site, formData.date]);

  // Auto-select patient when only one exists
  useEffect(() => {
    if (availablePatients.length === 1 && !formData.patientId) {
      handlePatientSelection(availablePatients[0].id);
    }
  }, [availablePatients, formData.patientId]);

  // Cleanup effect to clear state when component unmounts
  useEffect(() => {
    return () => {
      console.log('TreatmentSelection component unmounting - clearing patient data');
      setAvailablePatients([]);
      setError(null);
    };
  }, []);

  const fetchPatientsForSiteAndDate = async (signal?: AbortSignal) => {
    // Early return if request was cancelled
    if (signal?.aborted) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    // Clear previous patient data and form selections to prevent accumulation
    setAvailablePatients([]);
    setFormData(prev => ({ 
      ...prev, 
      patientId: '',
      seedQty: '',
      activityPerSeed: ''
    }));
    
    try {
      console.log(`Fetching patients for site: ${formData.site}, date: ${formData.date}`);
      debugPatientData('Fetch Start', { site: formData.site, date: formData.date, procedureType });
      
      // Convert date format from DD.MMM.YYYY to YYYY-MM-DD for Priority API
      const dateForApi = convertDateForPriority(formData.date);
      
      // Early return if request was cancelled before API call
      if (signal?.aborted) {
        return;
      }
      
      // Call Priority service to get orders for the site and date
      const data = await priorityService.getOrdersForSiteAndDate(
        formData.site, 
        dateForApi, 
        procedureType || undefined
      );
      
      debugPatientData('API Response', data);
      
      // Check if request was cancelled after API call
      if (signal?.aborted) {
        return;
      }
      
      // Backend now handles all date filtering for consistency
      // No frontend filtering needed to prevent duplicate filtering issues
      const filteredOrders = data.orders || [];
      
      console.log(`Backend returned ${filteredOrders.length} orders for site ${formData.site} on date ${dateForApi}`);
      
      // Transform Priority data to our patient format with validation
      const patients: PriorityPatient[] = filteredOrders
        .filter((order: any) => {
          // Validate required fields
          if (!order.ORDNAME) {
            console.warn('Skipping order with missing ORDNAME:', order);
            return false;
          }
          return true;
        })
        .map((order: any) => ({
          id: order.ORDNAME,
          seedQty: parseInt(order.SBD_SEEDQTY) || 0,
          activityPerSeed: parseFloat(order.SBD_PREFACTIV) || 0,
          ordName: order.ORDNAME,
          reference: order.REFERENCE || null
        }));
      
      // Helper function to follow reference chain and find root order
      const findRootOrder = (orderName: string, visited = new Set<string>()): PriorityPatient | null => {
        // Prevent infinite loops with circular references
        if (visited.has(orderName)) {
          console.warn(`🔄 Circular reference detected for order: ${orderName}`);
          return null;
        }
        visited.add(orderName);
        
        // Find the current order
        const currentOrder = patients.find(p => p.ordName === orderName);
        if (!currentOrder) {
          console.warn(`❌ Order not found in dataset: ${orderName}`);
          return null;
        }
        
        console.log(`🔍 Checking order: ${orderName} | Seeds: ${currentOrder.seedQty} | Reference: ${currentOrder.reference || 'None'}`);
        
        // If this order has no reference, it's a root order
        if (!currentOrder.reference) {
          console.log(`🌳 Root order found: ${orderName} | Seeds: ${currentOrder.seedQty}`);
          return currentOrder;
        }
        
        // Follow the reference chain
        console.log(`⬆️ Following reference: ${orderName} -> ${currentOrder.reference}`);
        return findRootOrder(currentOrder.reference, visited);
      };
      
      // Reference chain validation: only include orders with valid root orders
      const validPatients: PriorityPatient[] = [];
      const seenOrderNames = new Set<string>();
      
      console.group(`🔗 Reference Chain Validation for ${patients.length} orders`);
      
      patients.forEach(patient => {
        const orderName = patient.ordName || patient.id;
        
        console.group(`🔍 Processing order: ${orderName}`);
        
        // Skip if we've already processed this exact ORDNAME
        if (seenOrderNames.has(orderName)) {
          console.warn(`⚠️ Duplicate ORDNAME skipped: ${orderName}`);
          console.groupEnd();
          return;
        }
        seenOrderNames.add(orderName);
        
        // Skip patient reference records (PAT-*) - these are just reference data, not selectable patients
        if (orderName.startsWith('PAT-')) {
          console.log(`⚠️ Skipping patient reference record: ${orderName}`);
          console.groupEnd();
          return;
        }
        
        // Follow reference chain to find root order
        const rootOrder = findRootOrder(orderName);
        
        if (!rootOrder) {
          console.log(`❌ FILTERED OUT: ${orderName} - No valid root order found`);
          console.groupEnd();
          return;
        }
        
        // Per CLAUDE.md rules: "Only show root orders (no reference OR seedQty > 0)"
        // This means: show orders that either have no reference OR have seeds > 0
        // The current order should be evaluated, not what it references
        
        if (patient.reference && patient.seedQty <= 0) {
          // Filter out only orders that BOTH have a reference AND have 0 seeds
          console.log(`❌ FILTERED OUT: ${orderName} - Order has reference AND 0 seeds (${patient.seedQty})`);
          console.groupEnd();
          return;
        }
        
        // If order has seeds > 0, it's valid regardless of having a reference
        if (patient.seedQty > 0) {
          console.log(`✅ VALID: ${orderName} - Order has seeds (${patient.seedQty}) - valid regardless of reference`);
        } else if (!patient.reference) {
          console.log(`✅ VALID: ${orderName} - Order has no reference (root order)`);
        }
        
        validPatients.push(patient);
        console.groupEnd();
      });
      
      console.groupEnd();
      
      // Sort patients by ORDNAME for consistent ordering
      const uniquePatients = validPatients.sort((a, b) => (a.ordName || '').localeCompare(b.ordName || ''));
      
      console.log(`🔗 Reference Chain Validation Summary for site ${formData.site}:`);
      console.log(`- Total orders processed: ${patients.length}`);
      console.log(`- Valid patients (with valid root orders): ${uniquePatients.length}`);
      console.log(`- Invalid orders filtered out: ${patients.length - uniquePatients.length}`);
      
      // Log final patient list for debugging
      console.group('✅ Final Valid Patient List:');
      uniquePatients.forEach((patient, index) => {
        console.log(`${index + 1}. Patient ID: ${patient.ordName} | Reference: ${patient.reference || 'ROOT'} | Seeds: ${patient.seedQty} | Activity: ${patient.activityPerSeed}`);
      });
      console.groupEnd();
      
      // Final check for cancelled request before setting state
      if (signal?.aborted) {
        return;
      }
      
      setAvailablePatients(uniquePatients);
      
      debugPatientData('Final Patient List Set', uniquePatients);
      
      // If no patients found, show helpful message
      if (uniquePatients.length === 0) {
        setError(`No scheduled procedures found for ${formData.site} on ${formData.date}`);
      } else {
        console.log(`Successfully loaded ${uniquePatients.length} unique patients for ${formData.site} on ${formData.date}`);
      }
      
      // Debug component state in development
      debugComponentState(formData, uniquePatients, false, null);
    } catch (err: any) {
      // Don't show error if request was cancelled
      if (signal?.aborted) {
        console.log('Patient fetch request was cancelled');
        return;
      }
      
      console.error('Error fetching patients:', err);
      setError(err.message || 'Failed to fetch patients for selected site and date');
      setAvailablePatients([]);
      
      // Clear form data on error
      setFormData(prev => ({ 
        ...prev, 
        patientId: '',
        seedQty: '',
        activityPerSeed: ''
      }));
    } finally {
      // Only update loading state if request wasn't cancelled
      if (!signal?.aborted) {
        setLoading(false);
      }
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
    
    console.log(`Date changed to: ${direction} (${format(newDate, 'dd.MMM.yyyy')})`);
    
    // Clear all patient-related state when date changes to prevent stale data
    setAvailablePatients([]);
    setError(null);
    setFormData(prev => ({ 
      ...prev, 
      date: format(newDate, 'dd.MMM.yyyy'),
      patientId: '',
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
      debugPatientData('Patient Selection', selectedPatient);
      
      setFormData(prev => ({
        ...prev,
        patientId: selectedPatient.id,
        seedQty: selectedPatient.seedQty.toString(),
        activityPerSeed: selectedPatient.activityPerSeed.toString()
      }));
    } else {
      console.warn('Patient not found in availablePatients:', patientId);
      debugPatientData('Patient Selection Failed', { patientId, availablePatients });
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