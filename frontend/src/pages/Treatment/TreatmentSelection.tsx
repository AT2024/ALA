import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, addDays, subDays } from 'date-fns';
import { Combobox } from '@headlessui/react';
import Layout from '@/components/Layout';
import { useTreatment } from '@/context/TreatmentContext';
import { useAuth } from '@/context/AuthContext';
import { priorityService } from '@/services/priorityService';
import { treatmentService } from '@/services/treatmentService';
import api from '@/services/api';

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
  patientName?: string;
  details?: string;
}

interface RemovalCandidate {
  id: string;
  subjectId: string;
  site: string;
  date: string;
  surgeon: string;
  seedQuantity: number;
  activityPerSeed: number;
  daysSinceInsertion: number;
  status: string;
  activity: number;
  isEligible: boolean;
  reason?: string;
  patientName?: string;
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
    surgeon: '',
    treatmentNumber: '' // For removal workflow
  });

  const [availablePatients, setAvailablePatients] = useState<PriorityPatient[]>([]);
  const [availableSites, setAvailableSites] = useState<PrioritySite[]>([]);
  const [siteQuery, setSiteQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [sitesLoading, setSitesLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Removal workflow state
  const [removalCandidate, setRemovalCandidate] = useState<RemovalCandidate | null>(null);
  const [searchingTreatment, setSearchingTreatment] = useState(false);
  const [treatmentSearched, setTreatmentSearched] = useState(false);

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
        
      } catch (err) {
        console.error('Error loading user sites:', err);
        setError('Failed to load available sites');
      } finally {
        setSitesLoading(false);
      }
    };
    
    loadUserSites();
  }, [user]);

  // Fetch patients when site and date change (insertion only)
  useEffect(() => {
    // Only fetch patients for insertion workflow
    if (procedureType !== 'insertion') return;

    // Create AbortController for this request
    const abortController = new AbortController();

    if (formData.site && formData.date) {
      fetchPatientsForSiteAndDate(abortController.signal);
    }

    // Cleanup function to abort request if component unmounts or dependencies change
    return () => {
      abortController.abort();
    };
  }, [formData.site, formData.date, procedureType]);

  // Auto-select patient when only one exists (insertion only)
  useEffect(() => {
    if (procedureType === 'insertion' && availablePatients.length === 1 && !formData.patientId) {
      handlePatientSelection(availablePatients[0].id);
    }
  }, [availablePatients, formData.patientId, procedureType]);

  // Cleanup effect to clear state when component unmounts
  useEffect(() => {
    return () => {
      console.log('TreatmentSelection component unmounting - clearing patient data');
      setAvailablePatients([]);
      setRemovalCandidate(null);
      setError(null);
    };
  }, []);

  // Clear state when procedure type changes
  useEffect(() => {
    setError(null);
    setAvailablePatients([]);
    setRemovalCandidate(null);
    setTreatmentSearched(false);
    setFormData(prev => ({
      ...prev,
      patientId: '',
      seedQty: '',
      activityPerSeed: '',
      surgeon: '',
      treatmentNumber: ''
    }));
  }, [procedureType]);

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
          reference: order.REFERENCE || null,
          patientName: order.DETAILS || null,
          details: order.DETAILS || null
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

  // Removal workflow: Search for treatment by number
  const searchTreatmentForRemoval = async () => {
    if (!formData.site || !formData.treatmentNumber.trim()) {
      setError('Please select a site and enter a treatment number');
      return;
    }

    setSearchingTreatment(true);
    setError(null);
    setRemovalCandidate(null);

    try {
      console.log(`Searching for treatment ${formData.treatmentNumber} at site ${formData.site}`);

      // Call new API endpoint for removal candidates
      const response = await api.get('/treatments/removal-candidates', {
        params: {
          site: formData.site,
          treatmentNumber: formData.treatmentNumber.trim()
        }
      });

      const candidate = response.data;

      console.log('Removal candidate found:', candidate);
      setRemovalCandidate(candidate);
      setTreatmentSearched(true);

      if (candidate.isEligible) {
        // Auto-populate form fields with treatment data
        setFormData(prev => ({
          ...prev,
          patientId: candidate.subjectId,
          seedQty: candidate.seedQuantity.toString(),
          activityPerSeed: candidate.activityPerSeed.toString(),
          surgeon: candidate.surgeon
        }));
      } else {
        setError(`Treatment not eligible for removal: ${candidate.reason}`);
      }
    } catch (err: any) {
      console.error('Error searching treatment:', err);
      setTreatmentSearched(true);

      if (err.response?.status === 404) {
        setError(`Treatment ${formData.treatmentNumber} not found at site ${formData.site}`);
      } else {
        setError(err.response?.data?.message || 'Failed to search for treatment. Please try again.');
      }
    } finally {
      setSearchingTreatment(false);
    }
  };

  const handleSubmit = async () => {
    // Validation for insertion
    if (procedureType === 'insertion') {
      if (!formData.email || !formData.site || !formData.patientId || !formData.surgeon) {
        setError('Please fill in all required fields (Email, Site, Patient ID, Surgeon)');
        return;
      }
    }

    // Validation for removal
    if (procedureType === 'removal') {
      if (!formData.email || !formData.site || !formData.treatmentNumber || !removalCandidate?.isEligible) {
        setError('Please fill in all required fields and ensure treatment is eligible for removal');
        return;
      }
    }

    setIsLoading(true);
    setError('');

    try {
      let treatmentData;

      if (procedureType === 'insertion') {
        // Get patientName from selected patient
        const selectedPatient = availablePatients.find(p => p.id === formData.patientId);

        // Create new insertion treatment
        treatmentData = {
          type: 'insertion' as const,
          subjectId: formData.patientId,
          site: formData.site,
          date: formData.date,
          email: formData.email,
          seedQuantity: parseInt(formData.seedQty) || 0,
          activityPerSeed: parseFloat(formData.activityPerSeed) || 0,
          surgeon: formData.surgeon,
          patientName: selectedPatient?.patientName || selectedPatient?.details
        };
      } else {
        // Create removal treatment linked to original insertion
        if (!removalCandidate) {
          setError('Removal candidate not found');
          setIsLoading(false);
          return;
        }

        treatmentData = {
          type: 'removal' as const,
          subjectId: removalCandidate.subjectId,
          site: formData.site,
          date: formData.date,
          email: formData.email,
          seedQuantity: removalCandidate.seedQuantity,
          activityPerSeed: removalCandidate.activityPerSeed,
          surgeon: removalCandidate.surgeon,
          originalTreatmentId: removalCandidate.id,
          patientName: removalCandidate.patientName
        };
      }

      console.log('Creating treatment with data:', treatmentData);

      // Call backend API to create treatment
      const treatment = await treatmentService.createTreatment(treatmentData);

      console.log('Treatment created successfully:', treatment);

      // Set treatment in context with backend-generated ID
      setTreatment(treatment);

      // Navigate based on procedure type
      if (procedureType === 'insertion') {
        navigate('/treatment/scan');
      } else {
        navigate('/treatment/removal');
      }
    } catch (error: any) {
      console.error('Error creating treatment:', error);
      setError(error.response?.data?.message || 'Failed to create treatment. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter sites based on search query (search by name or code)
  const filteredSites = siteQuery === ''
    ? availableSites
    : availableSites.filter((site) =>
        site.custDes.toLowerCase().includes(siteQuery.toLowerCase()) ||
        site.custName.toLowerCase().includes(siteQuery.toLowerCase())
      );

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
                className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary text-base md:max-w-md md:text-sm min-h-[44px]"
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
                // ATM users: searchable combobox for all sites
                <Combobox
                  value={formData.site}
                  onChange={(value) => {
                    setFormData(prev => ({ ...prev, site: value || '' }));
                    setSiteQuery('');
                  }}
                >
                  <div className="relative">
                    <Combobox.Input
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary text-base md:max-w-md md:text-sm min-h-[44px]"
                      onChange={(event) => setSiteQuery(event.target.value)}
                      displayValue={(custName: string) => {
                        const site = availableSites.find(s => s.custName === custName);
                        return site ? `${site.custDes} (${site.custName})` : '';
                      }}
                      placeholder="Search sites..."
                    />
                    <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 shadow-lg border border-gray-300 focus:outline-none text-base md:text-sm">
                      {filteredSites.length === 0 && siteQuery !== '' ? (
                        <div className="relative cursor-default select-none px-4 py-2 text-gray-700">
                          No sites found.
                        </div>
                      ) : (
                        filteredSites.map((site) => (
                          <Combobox.Option
                            key={site.custName}
                            value={site.custName}
                            className={({ active }) =>
                              `relative cursor-pointer select-none py-2 px-3 ${
                                active ? 'bg-primary text-white' : 'text-gray-900'
                              }`
                            }
                          >
                            {({ selected }) => (
                              <span className={selected ? 'font-semibold' : 'font-normal'}>
                                {site.custDes} ({site.custName})
                              </span>
                            )}
                          </Combobox.Option>
                        ))
                      )}
                    </Combobox.Options>
                  </div>
                </Combobox>
              ) : (
                // Site users: filled automatically from their assigned site (read-only)
                <input
                  type="text"
                  id="site"
                  value={formData.site}
                  readOnly
                  className="block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 shadow-sm text-base md:max-w-md md:text-sm min-h-[44px]"
                />
              )}
            </div>

            {/* Date Field - Only show for insertion */}
            {procedureType === 'insertion' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date
                </label>
                {/* Mobile-first: Stack vertically on mobile, horizontal on sm+ */}
                <div className="flex flex-col gap-4 sm:flex-row sm:gap-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleDateChange('yesterday')}
                      className={`min-h-[44px] flex-1 rounded-md px-4 py-2 text-sm sm:flex-initial sm:px-3 ${isDateActive('yesterday') ? 'bg-primary text-white hover:bg-primary/90' : 'bg-gray-100 hover:bg-gray-200'}`}
                    >
                      Yesterday
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDateChange('today')}
                      className={`min-h-[44px] flex-1 rounded-md px-4 py-2 text-sm sm:flex-initial sm:px-3 ${isDateActive('today') ? 'bg-primary text-white hover:bg-primary/90' : 'bg-gray-100 hover:bg-gray-200'}`}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDateChange('tomorrow')}
                      className={`min-h-[44px] flex-1 rounded-md px-4 py-2 text-sm sm:flex-initial sm:px-3 ${isDateActive('tomorrow') ? 'bg-primary text-white hover:bg-primary/90' : 'bg-gray-100 hover:bg-gray-200'}`}
                    >
                      Tomorrow
                    </button>
                  </div>
                  <input
                    type="text"
                    value={formData.date}
                    readOnly
                    className="block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm sm:w-auto"
                  />
                </div>
              </div>
            )}
            {/* Treatment Number Field - Only for removal */}
            {procedureType === 'removal' && (
              <div>
                <label htmlFor="treatmentNumber" className="block text-sm font-medium text-gray-700 mb-2">
                  Treatment Number *
                </label>
                <div className="flex flex-col gap-4 sm:flex-row sm:gap-2">
                  <input
                    type="text"
                    id="treatmentNumber"
                    value={formData.treatmentNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, treatmentNumber: e.target.value }))}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary text-base md:max-w-md md:text-sm min-h-[44px]"
                    placeholder="Enter treatment number"
                    required
                  />
                  <button
                    type="button"
                    onClick={searchTreatmentForRemoval}
                    disabled={searchingTreatment || !formData.site || !formData.treatmentNumber.trim()}
                    className="min-h-[44px] whitespace-nowrap rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto"
                  >
                    {searchingTreatment ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                        Searching...
                      </div>
                    ) : (
                      'Search'
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Treatment Search Results - Only for removal */}
            {procedureType === 'removal' && treatmentSearched && removalCandidate && (
              <div className={`rounded-lg border p-4 ${
                removalCandidate.isEligible
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <h4 className={`text-sm font-medium mb-2 ${
                  removalCandidate.isEligible ? 'text-green-900' : 'text-red-900'
                }`}>
                  {removalCandidate.isEligible ? '✓ Treatment Found' : '❌ Treatment Not Eligible'}
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Patient ID:</span> {removalCandidate.patientName ? (
                      <span>{removalCandidate.patientName}</span>
                    ) : (
                      <span className="text-amber-600" title="Using order number (patient name not available)">
                        Order: {removalCandidate.subjectId}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="font-medium">Insertion Date:</span> {new Date(removalCandidate.date).toLocaleDateString()}
                  </div>
                  <div>
                    <span className="font-medium">Surgeon:</span> {removalCandidate.surgeon}
                  </div>
                  <div>
                    <span className="font-medium">Seeds:</span> {removalCandidate.seedQuantity}
                  </div>
                  <div>
                    <span className="font-medium">Activity:</span> {removalCandidate.activity} µCi
                  </div>
                  <div className={`font-medium ${
                    removalCandidate.daysSinceInsertion >= 13 && removalCandidate.daysSinceInsertion <= 21
                      ? 'text-green-600'
                      : 'text-orange-600'
                  }`}>
                    Days since insertion: {removalCandidate.daysSinceInsertion} days
                  </div>
                </div>
                {!removalCandidate.isEligible && removalCandidate.reason && (
                  <p className="text-sm text-red-700 mt-2 font-medium">
                    Reason: {removalCandidate.reason}
                  </p>
                )}
              </div>
            )}

            {/* Patient ID Field - Only for insertion */}
            {procedureType === 'insertion' && (
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
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary text-base md:max-w-md md:text-sm min-h-[44px]"
                    required
                  >
                    <option value="">Select Patient ID</option>
                    {availablePatients.map((patient, index) => (
                      <option key={patient.id || `patient-${index}`} value={patient.id}>
                        {patient.patientName ? patient.patientName : `Order: ${patient.id}`}
                      </option>
                    ))}
                  </select>
                ) : availablePatients.length === 1 ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={availablePatients[0].patientName ? availablePatients[0].patientName : `Order: ${availablePatients[0].id}`}
                      readOnly
                      className={`block w-full rounded-md border px-3 py-2 shadow-sm text-base md:max-w-md md:text-sm min-h-[44px] ${
                        availablePatients[0].patientName
                          ? 'border-green-300 bg-green-50'
                          : 'border-amber-300 bg-amber-50'
                      }`}
                    />
                    <p className={`text-sm ${availablePatients[0].patientName ? 'text-green-600' : 'text-amber-600'}`}>
                      {availablePatients[0].patientName
                        ? '✓ Patient automatically selected (only one available)'
                        : '⚠ Using order number (patient name not available)'}
                    </p>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">
                    No patients scheduled for selected site and date
                  </div>
                )}
              </div>
            )}

            {/* Patient ID Field - Read-only for removal */}
            {procedureType === 'removal' && removalCandidate?.isEligible && (
              <div>
                <label htmlFor="patientId" className="block text-sm font-medium text-gray-700 mb-2">
                  Patient ID
                </label>
                <input
                  type="text"
                  id="patientId"
                  value={formData.patientId}
                  readOnly
                  className="block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 shadow-sm text-base md:max-w-md md:text-sm min-h-[44px]"
                />
              </div>
            )}
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
                className="block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 shadow-sm text-base md:max-w-md md:text-sm min-h-[44px]"
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
                className="block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 shadow-sm text-base md:max-w-md md:text-sm min-h-[44px]"
                placeholder="Auto-filled after selecting Patient ID"
              />
            </div>

            {/* Surgeon Field */}
            {procedureType === 'insertion' && (
              <div>
                <label htmlFor="surgeon" className="block text-sm font-medium text-gray-700 mb-2">
                  Surgeon *
                </label>
                <input
                  type="text"
                  id="surgeon"
                  maxLength={100}
                  value={formData.surgeon}
                  onChange={(e) => setFormData(prev => ({ ...prev, surgeon: e.target.value }))}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary text-base md:max-w-md md:text-sm min-h-[44px]"
                  placeholder="Enter surgeon name"
                  required
                />
              </div>
            )}

            {/* Surgeon Field - Read-only for removal */}
            {procedureType === 'removal' && removalCandidate?.isEligible && (
              <div>
                <label htmlFor="surgeon" className="block text-sm font-medium text-gray-700 mb-2">
                  Surgeon
                </label>
                <input
                  type="text"
                  id="surgeon"
                  value={formData.surgeon}
                  readOnly
                  className="block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 shadow-sm text-base md:max-w-md md:text-sm min-h-[44px]"
                />
              </div>
            )}
            {/* Continue Button */}
            <div className="pt-4">
              <button
                type="button"
                onClick={handleSubmit}
                className="w-full rounded-md bg-primary py-3 px-4 text-base font-medium text-white shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] md:max-w-md"
                disabled={
                  isLoading ||
                  !formData.email ||
                  !formData.site ||
                  (procedureType === 'insertion' && (!formData.patientId || !formData.surgeon)) ||
                  (procedureType === 'removal' && (!formData.treatmentNumber || !removalCandidate?.isEligible))
                }
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
            {procedureType === 'insertion' && (
              <>
                <li>• Patient data is loaded from Priority ORDERS table</li>
                <li>• Seed quantity (SBD_SEEDQTY) and activity (SBD_PREFACTIV) auto-filled</li>
                <li>• Date format: DD.MMM.YYYY (e.g., 04.Jun.2025)</li>
              </>
            )}
            {procedureType === 'removal' && (
              <>
                <li>• Enter treatment number from original insertion</li>
                <li>• Treatment must be 13-21 days post-insertion for removal eligibility</li>
                <li>• System validates treatment status with Priority API</li>
                <li>• Only completed insertion treatments can be selected for removal</li>
              </>
            )}
            <li>• Sites shown based on your Priority access level (POSITIONCODE)</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
};

export default TreatmentSelection;