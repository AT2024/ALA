import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { format, addMinutes, subMinutes } from 'date-fns';
import { WifiOff } from 'lucide-react';
import Layout from '@/components/Layout';
import ConfirmationDialog from '@/components/Dialogs/ConfirmationDialog';
import { OfflineInsertionConfirmDialog } from '@/components/offline/OfflineInsertionConfirmDialog';
import { OfflineDownloadButton } from '@/components/offline/OfflineDownloadButton';
import { isValidOfflineStatusTransition, validateOfflineScan, TreatmentType } from '@/services/offlineValidationService';
import { useTreatment } from '@/context/TreatmentContext';
import { useAuth } from '@/context/AuthContext';
import { useOffline } from '@/context/OfflineContext';
import applicatorService, { ApplicatorValidationResult } from '@/services/applicatorService';
import { priorityService } from '@/services/priorityService';
import { offlineDb, OfflineApplicator } from '@/services/indexedDbService';
import ProgressTracker from '@/components/ProgressTracker';
import { generateUUID } from '@/utils/uuid';
import { getAllowedNextStatuses, getListItemColor, getStatusEmoji, getStatusLabel, requiresComment, TERMINAL_STATUSES, type ApplicatorStatus, type TreatmentContext } from '@/utils/applicatorStatus';

const TreatmentDocumentation = () => {
  const {
    currentTreatment,
    processApplicator,
    processedApplicators,
    progressStats,
    addAvailableApplicator,
    getFilteredAvailableApplicators,
    currentApplicator,
    clearCurrentApplicator,
    setProcessedApplicators,
    processApplicatorOffline,
    loadFromOfflineDb,
  } = useTreatment();
  const { user } = useAuth();
  const { isOnline, isDownloaded } = useOffline();
  const navigate = useNavigate();

  // File upload state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit mode detection
  const isEditMode = !!currentApplicator;
  const editingSerialNumber = currentApplicator?.serialNumber;

  const [scannedApplicators, setScannedApplicators] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingValidation, setPendingValidation] = useState<ApplicatorValidationResult | null>(null);
  const [showApplicatorList, setShowApplicatorList] = useState(true);
  // Offline confirmation dialog state
  const [showOfflineConfirmDialog, setShowOfflineConfirmDialog] = useState(false);
  const [offlinePendingApplicator, setOfflinePendingApplicator] = useState<any>(null);
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [aSuffixQuery, setASuffixQuery] = useState('');
  const [showFinalizeConfirmDialog, setShowFinalizeConfirmDialog] = useState(false);
  // Track the ORIGINAL status when applicator was selected (for Bug #5 fix)
  // This ensures all same-stage options remain visible even after selecting a terminal status
  const [originalApplicatorStatus, setOriginalApplicatorStatus] = useState<string | null>(null);
  // Terminal status warning dialog (Issue 4 fix)
  const [showTerminalWarning, setShowTerminalWarning] = useState(false);
  const [pendingTerminalStatus, setPendingTerminalStatus] = useState<string | null>(null);

  // Store catalog and seedLength from validation response (for display in UseList)
  const [validatedCatalog, setValidatedCatalog] = useState<string | null>(null);
  const [validatedSeedLength, setValidatedSeedLength] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    serialNumber: '',
    applicatorType: '',
    seedsQty: '',
    insertionTime: new Date().toISOString(),
    usingType: '', // Deprecated - keeping for backward compatibility
    status: '', // New 8-state workflow field
    insertedSeedsQty: '',
    comments: ''
  });

  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const scannerDivRef = useRef<HTMLDivElement>(null);

  // Use centralized filtering function - single source of truth
  const patientFilteredApplicators = getFilteredAvailableApplicators();

  // Build treatment context for workflow detection (checks multiple fields)
  const treatmentContext: TreatmentContext = {
    site: currentTreatment?.site,
    priorityId: currentTreatment?.priorityId || currentTreatment?.subjectId,
    patientName: currentTreatment?.patientName,
    subjectId: currentTreatment?.subjectId
  };

  // Helper to determine treatment type for offline validation (SAME rules as online)
  const getTreatmentType = (): TreatmentType => {
    const site = currentTreatment?.site?.toLowerCase() || '';
    const type = currentTreatment?.type?.toLowerCase() || '';

    if (site.includes('pancreas') || site.includes('prostate') ||
        type.includes('pancreas') || type.includes('prostate')) {
      return 'panc_pros';
    }
    if (site.includes('skin') || type.includes('skin')) {
      return 'skin';
    }
    return 'generic';
  };

  // Get allowed statuses based on current applicator status and treatment context
  // Priority order: currentApplicator (UseList edit mode) > originalApplicatorStatus (Choose from List) > null (new)
  // Bug #5 fix: Use originalApplicatorStatus (saved when applicator was selected) instead of formData.status
  // This ensures all same-stage options remain visible even after user selects a terminal status
  const effectiveCurrentStatus = (isEditMode && currentApplicator?.status)
    ? currentApplicator.status as ApplicatorStatus
    : (originalApplicatorStatus as ApplicatorStatus) || null;

  const allowedStatuses = getAllowedNextStatuses(effectiveCurrentStatus, treatmentContext);

  // Helper function to check if a status should be shown in dropdown
  const shouldShowStatus = (status: string): boolean => {
    // Always show the currently selected status (so user can confirm their selection)
    // Plus show all allowed next statuses for transitions
    return status === formData.status || allowedStatuses.includes(status as ApplicatorStatus);
  };

  useEffect(() => {
    if (!currentTreatment) {
      navigate('/treatment/select');
      return;
    }

    // Initialize scanner if not in manual mode
    if (!manualEntry && scannerDivRef.current) {
      scannerRef.current = new Html5QrcodeScanner(
        'qr-reader',
        {
          fps: 10,
          qrbox: 250,
          aspectRatio: 1.0,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.CODE_39,
          ],
        },
        false
      );

      scannerRef.current.render(onScanSuccess, onScanFailure);
    }

    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.clear();
        } catch {
          // Scanner cleanup errors are expected when component unmounts
        }
      }
    };
  }, [currentTreatment, manualEntry]);

  // Load available applicators when treatment is selected
  useEffect(() => {
    if (currentTreatment) {
      loadAvailableApplicators();
    }
  }, [currentTreatment]);

  // CRITICAL: Load from offline storage when offline and treatment is downloaded
  useEffect(() => {
    const loadOfflineDataIfNeeded = async () => {
      // Only load from offline if:
      // 1. We're offline
      // 2. We have a current treatment
      // 3. That treatment is downloaded for offline use
      if (!isOnline && currentTreatment?.id && isDownloaded(currentTreatment.id)) {
        try {
          await loadFromOfflineDb();
          setSuccess('Loaded from offline storage');
        } catch {
          setError('Failed to load offline data. Please reconnect to continue.');
        }
      }
    };

    loadOfflineDataIfNeeded();
  }, [isOnline, currentTreatment?.id, isDownloaded, loadFromOfflineDb]);

  // Pre-populate form when in edit mode
  useEffect(() => {
    if (isEditMode && currentApplicator) {
      const usageTypeLabel = currentApplicator.usageType === 'full' ? 'Full use' :
                             currentApplicator.usageType === 'faulty' ? 'Faulty' :
                             currentApplicator.usageType === 'none' ? 'No Use' : '';

      setFormData({
        serialNumber: currentApplicator.serialNumber,
        applicatorType: currentApplicator.applicatorType || '',
        seedsQty: currentApplicator.seedQuantity?.toString() || '',
        insertionTime: currentApplicator.insertionTime || new Date().toISOString(),
        usingType: usageTypeLabel,
        status: currentApplicator.status || '', // Load existing status if available
        insertedSeedsQty: currentApplicator.insertedSeedsQty?.toString() || '0',
        comments: currentApplicator.comments || ''
      });

      setManualEntry(true); // Disable scanner in edit mode
    }
  }, [isEditMode, currentApplicator]);

  // Helper to add offline applicators to context (eliminates duplicate code)
  const addOfflineApplicatorsToContext = (offlineApplicators: OfflineApplicator[]) => {
    offlineApplicators.forEach((app) => {
      // Only add if status is null, SEALED, OPENED, or LOADED (not yet terminal)
      if (!app.status || app.status === 'SEALED' || app.status === 'OPENED' || app.status === 'LOADED') {
        addAvailableApplicator({
          id: app.id || app.serialNumber || generateUUID(),
          serialNumber: app.serialNumber,
          applicatorType: app.applicatorType || '',
          seedQuantity: app.seedQuantity || 0,
          usageType: 'full' as const,
          insertionTime: app.insertionTime || new Date().toISOString(),
          insertedSeedsQty: 0,
          comments: app.comments || '',
          catalog: app.catalog,
          seedLength: app.seedLength,
        });
      }
    });
  };

  const loadAvailableApplicators = async () => {
    if (!currentTreatment) return;

    // If offline and treatment is downloaded, load from IndexedDB
    if (!isOnline && isDownloaded(currentTreatment.id)) {
      try {
        const offlineApplicators = await offlineDb.getApplicatorsByTreatment(currentTreatment.id);
        addOfflineApplicatorsToContext(offlineApplicators);
        return;
      } catch (error) {
        setError('Failed to load offline applicators');
        return;
      }
    }

    // Online path - existing code
    try {
      const response = await priorityService.getAvailableApplicators(
        currentTreatment.site,
        currentTreatment.date
      );

      if (response.success) {
        const applicators = response.applicators || [];

        // Add each applicator to the context
        applicators.forEach((applicator: any) => {
          addAvailableApplicator({
            id: applicator.serialNumber || generateUUID(),
            serialNumber: applicator.serialNumber,
            applicatorType: applicator.applicatorType || applicator.type || '',
            seedQuantity: applicator.seedQuantity || 0,
            usageType: 'full' as const,
            insertionTime: new Date().toISOString(),
            insertedSeedsQty: 0,
            comments: '',
            patientId: applicator.patientId
          });
        });

      } else {
        setError(response.message || 'Failed to load available applicators');
      }
    } catch (error: any) {
      // If online call fails and we have offline data, try that as fallback
      if (isDownloaded(currentTreatment.id)) {
        try {
          const offlineApplicators = await offlineDb.getApplicatorsByTreatment(currentTreatment.id);
          addOfflineApplicatorsToContext(offlineApplicators);
          setSuccess('Loaded applicators from offline storage');
          return;
        } catch {
          // Fall through to error message
        }
      }
      setError('Unable to load applicators. Please try refreshing the page.');
    }
  };

  // Handle Status change with smart auto-fill (8-state workflow)
  useEffect(() => {
    const seedsQty = parseInt(formData.seedsQty) || 0;

    // Use status field if available, otherwise fall back to usingType for backward compatibility
    const currentStatus = formData.status || formData.usingType;

    switch (currentStatus) {
      // New 8-state workflow
      case 'INSERTED':
        // Auto-fill with full seed quantity
        setFormData(prev => ({ ...prev, insertedSeedsQty: seedsQty.toString() }));
        break;
      case 'FAULTY':
      case 'DEPLOYMENT_FAILURE':
        // Allow manual entry (starts at 0) - some seeds may have been inserted before failure
        setFormData(prev => ({ ...prev, insertedSeedsQty: '0' }));
        break;
      case 'SEALED':
      case 'OPENED':
      case 'LOADED':
        // Not yet inserted
        setFormData(prev => ({ ...prev, insertedSeedsQty: '0' }));
        break;
      case 'DISPOSED':
      case 'DISCHARGED':
        // Terminal states - no seeds inserted
        setFormData(prev => ({ ...prev, insertedSeedsQty: '0' }));
        break;

      // Backward compatibility with old usingType values
      case 'Full use':
        // Auto-fill with full seed quantity from Priority PARTS table
        setFormData(prev => ({ ...prev, insertedSeedsQty: seedsQty.toString() }));
        break;
      case 'Faulty':
        // Allow manual entry (starts at 0)
        setFormData(prev => ({ ...prev, insertedSeedsQty: '0' }));
        break;
      case 'No Use':
        // No seeds inserted
        setFormData(prev => ({ ...prev, insertedSeedsQty: '0' }));
        break;
      default:
        setFormData(prev => ({ ...prev, insertedSeedsQty: '' }));
    }
  }, [formData.status, formData.usingType, formData.seedsQty]);

  const onScanSuccess = async (decodedText: string) => {
    await handleBarcodeScanned(decodedText);
  };

  const onScanFailure = (_error: unknown) => {
    // Scanner errors are expected during continuous scanning, no action needed
  };

  const handleBarcodeScanned = async (serialNumber: string) => {
    if (!currentTreatment) {
      setError('No treatment selected. Please go back and select a treatment.');
      return;
    }
    
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      // OFFLINE PATH: Use local validation when offline and treatment is downloaded
      if (!isOnline && isDownloaded(currentTreatment.id)) {
        const offlineValidation = await validateOfflineScan(serialNumber, currentTreatment.id);

        if (!offlineValidation.allowed) {
          setError(offlineValidation.message);
          setLoading(false);
          return;
        }

        // Get applicator data from IndexedDB
        const offlineApplicator = await offlineDb.getApplicatorBySerial(serialNumber);

        if (offlineApplicator) {
          // Fill form with offline applicator data
          fillFormWithOfflineApplicatorData(offlineApplicator);
          setSuccess(`Applicator ${serialNumber} loaded from offline storage. Status: ${offlineApplicator.status || 'SEALED'}`);
        } else {
          setError('Applicator not found in offline storage. Only pre-downloaded applicators are available offline.');
        }
        setLoading(false);
        return;
      }

      // ONLINE PATH: Validate applicator against Priority system
      const validation = await applicatorService.validateApplicator(
        serialNumber,
        currentTreatment.id,
        currentTreatment.subjectId,
        scannedApplicators
      );

      if (validation.requiresConfirmation) {
        // Show confirmation dialog for scenarios that need user approval
        setPendingValidation(validation);
        setShowConfirmDialog(true);
      } else if (validation.isValid) {
        // Proceed with valid applicator
        await fillFormWithApplicatorData(validation);
      } else {
        // Show error for invalid applicators
        setError(validation.message);
      }
    } catch {
      // If online call fails and we have offline data, try that as fallback
      if (isDownloaded(currentTreatment.id)) {
        try {
          const offlineApplicator = await offlineDb.getApplicatorBySerial(serialNumber);
          if (offlineApplicator) {
            fillFormWithOfflineApplicatorData(offlineApplicator);
            setSuccess(`Applicator ${serialNumber} loaded from offline cache (server unavailable).`);
            setLoading(false);
            return;
          }
        } catch {
          // Fall through to error
        }
      }
      setError('Failed to validate applicator. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fillFormWithApplicatorData = async (validation: ApplicatorValidationResult) => {
    const applicatorData = validation.applicatorData;

    if (!applicatorData) {
      setError('No applicator data received from server.');
      return;
    }

    // Use the correct property names from the interface
    const serialNumber = applicatorData.serialNumber || '';
    const applicatorType = applicatorData.applicatorType || '';
    const seedQuantity = applicatorData.seedQuantity || 0;

    // Extract catalog and seedLength for UseList display
    const catalog = applicatorData.catalog || null;
    const seedLength = applicatorData.seedLength || null;

    if (!serialNumber) {
      setError('Invalid applicator data: missing serial number.');
      return;
    }

    // Store catalog and seedLength for when applicator is created
    setValidatedCatalog(catalog);
    setValidatedSeedLength(seedLength);

    // Bug #5 fix: Set original status for new applicators (SEALED)
    setOriginalApplicatorStatus('SEALED');

    // Fill form with validated applicator data - default to SEALED for new 8-state workflow
    setFormData({
      serialNumber,
      applicatorType,
      seedsQty: seedQuantity.toString(),
      insertionTime: new Date().toISOString(),
      usingType: 'Full use', // Keep for backward compatibility
      status: 'SEALED', // Default to SEALED for 8-state workflow
      insertedSeedsQty: '0', // SEALED means no seeds inserted yet
      comments: ''
    });

    setSuccess(`Applicator ${serialNumber} validated successfully! Status set to SEALED - select appropriate status below.`);
  };

  /**
   * Fill form with offline applicator data from IndexedDB
   * Used when working offline with pre-downloaded applicators
   */
  const fillFormWithOfflineApplicatorData = (applicator: OfflineApplicator) => {
    // Set original status (null means SEALED for new applicators)
    const currentStatus = applicator.status || 'SEALED';
    setOriginalApplicatorStatus(currentStatus);

    // Store catalog and seedLength for UseList display
    setValidatedCatalog(applicator.catalog || null);
    setValidatedSeedLength(applicator.seedLength || null);

    setFormData({
      serialNumber: applicator.serialNumber,
      applicatorType: applicator.applicatorType || '',
      seedsQty: (applicator.seedQuantity || 0).toString(),
      insertionTime: applicator.insertionTime || new Date().toISOString(),
      usingType: 'Full use', // Keep for backward compatibility
      status: currentStatus,
      insertedSeedsQty: '0',
      comments: applicator.comments || ''
    });

    // Add to scanned list to prevent re-scanning
    if (!scannedApplicators.includes(applicator.serialNumber)) {
      setScannedApplicators(prev => [...prev, applicator.serialNumber]);
    }
  };

  const handleConfirmValidation = async () => {
    if (pendingValidation) {
      await fillFormWithApplicatorData(pendingValidation);
      setShowConfirmDialog(false);
      setPendingValidation(null);
    }
  };

  const handleCancelValidation = () => {
    setShowConfirmDialog(false);
    setPendingValidation(null);
    setError('Applicator validation cancelled.');
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.serialNumber.trim()) {
      // First try fuzzy search for suggestions
      await handleSerialNumberSearch(formData.serialNumber.trim());
    } else {
      setError('Please enter a serial number');
    }
  };

  const handleSerialNumberSearch = async (serialNumber: string) => {
    if (!currentTreatment) return;
    
    try {
      setLoading(true);
      const response = await priorityService.searchApplicators(
        serialNumber,
        currentTreatment.site,
        currentTreatment.date
      );
      
      if (response.success) {
        if (response.result.found) {
          // Exact match found, proceed with validation
          await handleBarcodeScanned(serialNumber);
        } else if (response.result.suggestions && response.result.suggestions.length > 0) {
          // Show suggestions
          setSearchSuggestions(response.result.suggestions);
          setShowSuggestions(true);
          setError('Applicator not found. Did you mean one of these?');
        } else {
          // No match, proceed with normal validation
          await handleBarcodeScanned(serialNumber);
        }
      } else {
        await handleBarcodeScanned(serialNumber);
      }
    } catch {
      setError('Error searching applicators. Proceeding with validation...');
      await handleBarcodeScanned(serialNumber);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionSelect = (suggestion: any) => {
    setFormData(prev => ({ ...prev, serialNumber: suggestion.serialNumber }));
    setShowSuggestions(false);
    setSearchSuggestions([]);
    setError(null);

    handleBarcodeScanned(suggestion.serialNumber);
  };


  const handleApplicatorSelect = (applicator: any) => {
    setShowApplicatorList(false);
    setError(null);
    setSuccess(null);

    // Preserve the applicator's actual status - don't reset to SEALED!
    // This is critical for the 8-state workflow where OPENED/LOADED applicators
    // stay in the "Choose from List" and need to show their NEXT valid transitions
    const currentStatus = applicator.status || 'SEALED';

    // Bug #5 fix: Save original status for dropdown options calculation
    // This ensures all same-stage options remain visible even after user selects a terminal status
    setOriginalApplicatorStatus(currentStatus);

    // Fill form with selected applicator data directly (no validation needed since it's from Priority)
    setFormData({
      serialNumber: applicator.serialNumber,
      applicatorType: applicator.applicatorType || '',
      seedsQty: applicator.seedQuantity?.toString() || '',
      insertionTime: new Date().toISOString(),
      usingType: 'Full use', // Keep for backward compatibility
      status: currentStatus, // Preserve existing status from availableApplicators
      insertedSeedsQty: currentStatus === 'SEALED' ? '0' : (applicator.insertedSeedsQty?.toString() || '0'),
      comments: applicator.comments || ''
    });

    if (currentStatus !== 'SEALED') {
      setSuccess(`Applicator ${applicator.serialNumber} selected successfully! Current status: ${currentStatus} - select next status below.`);
    } else {
      setSuccess(`Applicator ${applicator.serialNumber} selected successfully! Status set to SEALED - select appropriate status below.`);
    }
  };

  const adjustTime = (minutes: number) => {
    const currentTime = new Date(formData.insertionTime);
    const newTime = minutes > 0 ? addMinutes(currentTime, minutes) : subMinutes(currentTime, Math.abs(minutes));
    setFormData(prev => ({ 
      ...prev, 
      insertionTime: newTime.toISOString() 
    }));
  };

  // Map form usage type values to interface values
  const mapUsageType = (formUsageType: string): 'full' | 'faulty' | 'none' => {
    switch (formUsageType) {
      case 'Full use':
        return 'full';
      case 'Faulty':
        return 'faulty';
      case 'No Use':
        return 'none';
      default:
        return 'full'; // Default fallback
    }
  };

  const handleNext = async () => {
    // Use status if available, otherwise fall back to usingType for backward compatibility
    const currentStatus = formData.status || formData.usingType;

    if (!formData.serialNumber || !currentStatus || !currentTreatment) {
      setError('Please fill in all required fields');
      return;
    }

    // Validate comment requirement for terminal failure statuses (FAULTY, DISPOSED, DISCHARGED, DEPLOYMENT_FAILURE)
    // Uses shared requiresComment() function for consistency with COMMENT_REQUIRED_STATUSES
    if ((requiresComment(currentStatus) || currentStatus === 'Faulty') &&
        (!formData.comments || formData.comments.trim().length === 0)) {
      setError('Comments are required for this status. Please explain why the applicator was not used successfully.');
      return;
    }

    // OFFLINE MODE HANDLING
    if (!isOnline) {
      // Validate that this status transition is allowed offline
      const previousStatus = originalApplicatorStatus as ApplicatorStatus | null;
      const validation = isValidOfflineStatusTransition(previousStatus, currentStatus as ApplicatorStatus, getTreatmentType());

      if (!validation.allowed) {
        setError(validation.message);
        return;
      }

      // Map status to usageType for offline Applicator object
      const mapStatusToUsageType = (status: string): 'full' | 'faulty' | 'none' => {
        if (status === 'INSERTED') return 'full';
        if (status === 'FAULTY') return 'faulty';
        return 'none';
      };

      const applicatorData = {
        id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        serialNumber: formData.serialNumber,
        applicatorType: formData.applicatorType,
        seedQuantity: parseInt(formData.seedsQty) || 0,
        usageType: mapStatusToUsageType(currentStatus),
        insertionTime: formData.insertionTime,
        status: currentStatus as ApplicatorStatus,
        insertedSeedsQty: parseInt(formData.insertedSeedsQty) || 0,
        comments: formData.comments,
        catalog: validatedCatalog || undefined,
        seedLength: validatedSeedLength || undefined,
      };

      // For INSERTED or FAULTY status, show confirmation dialog (medical-critical)
      if (validation.requiresConfirmation) {
        setOfflinePendingApplicator(applicatorData);
        setShowOfflineConfirmDialog(true);
        return; // Wait for confirmation before processing
      }

      // For other offline statuses (SEALED, OPENED, LOADED, etc.), process directly
      try {
        setLoading(true);
        // Pass originalApplicatorStatus to enable accurate transition validation
        await processApplicatorOffline(applicatorData, false, originalApplicatorStatus as ApplicatorStatus | null);

        // Clear form for next applicator
        setFormData({
          serialNumber: '',
          applicatorType: '',
          seedsQty: '',
          insertionTime: new Date().toISOString(),
          usingType: '',
          status: '',
          insertedSeedsQty: '',
          comments: ''
        });
        setOriginalApplicatorStatus(null);
        setValidatedCatalog(null);
        setValidatedSeedLength(null);
        setSuccess('Applicator status saved offline. Will sync when connection is restored.');
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Failed to save applicator offline');
      } finally {
        setLoading(false);
      }
      return; // Don't continue to online processing
    }

    setLoading(true);

    try {
      const applicatorData = {
        serialNumber: formData.serialNumber,
        applicatorType: formData.applicatorType,
        seedQuantity: parseInt(formData.seedsQty) || 0,
        insertionTime: formData.insertionTime,
        usingType: formData.usingType as 'full' | 'partial' | 'faulty' | 'none',
        status: formData.status || undefined,  // 8-state workflow status
        insertedSeedsQty: parseInt(formData.insertedSeedsQty) || 0,
        comments: formData.comments
      };

      // Save applicator data to Priority system
      const saveResult = await applicatorService.saveApplicatorData(currentTreatment.id, applicatorData);

      if (!saveResult.success) {
        setError(saveResult.message || 'Failed to save applicator data');
        return;
      }

      // Upload files if any selected (do this BEFORE creating local applicator object)
      const savedApplicatorId = saveResult.applicator?.id;

      // Track upload results for local state
      let uploadFileCount = 0;
      let uploadSyncStatus: 'pending' | 'syncing' | 'synced' | 'failed' | null = null;
      let uploadFilename: string | undefined = undefined;

      if (selectedFiles.length > 0 && savedApplicatorId) {
        const uploadResult = await applicatorService.uploadApplicatorFiles(
          currentTreatment.id,
          savedApplicatorId,
          selectedFiles
        );

        if (!uploadResult.success) {
          // Files failed but applicator saved - warn user but continue
          setError(`Applicator saved, but file upload failed: ${uploadResult.message}`);
          uploadSyncStatus = 'failed';
          // Don't return - applicator was saved successfully
        } else {
          // Capture upload metadata for local state
          uploadFileCount = uploadResult.fileCount || selectedFiles.length;
          uploadSyncStatus = (uploadResult.syncStatus as 'synced' | 'failed') || 'synced';
          uploadFilename = uploadResult.filename || undefined;
          // Clear selected files on success
          setSelectedFiles([]);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      }

      // Create applicator object WITH attachment metadata
      // IMPORTANT: Use savedApplicatorId from database first to ensure consistency
      // between local state and database (fixes file upload ID mismatch bug)
      const applicator = {
        id: savedApplicatorId || currentApplicator?.id || generateUUID(),
        serialNumber: formData.serialNumber,
        applicatorType: formData.applicatorType,
        seedQuantity: parseInt(formData.seedsQty) || 0,
        usageType: mapUsageType(formData.usingType),
        status: (formData.status || undefined) as ApplicatorStatus | undefined, // 8-state workflow using shared type
        insertionTime: formData.insertionTime,
        insertedSeedsQty: parseInt(formData.insertedSeedsQty) || 0,
        comments: formData.comments,
        // Use saved applicator data from backend (has correct catalog/seedLength from database)
        catalog: saveResult.applicator?.catalog || validatedCatalog || undefined,
        seedLength: saveResult.applicator?.seedLength || validatedSeedLength || undefined,
        // Attachment metadata for UI display (fixes "No files" bug in UseList)
        attachmentFileCount: uploadFileCount,
        attachmentSyncStatus: uploadSyncStatus,
        attachmentFilename: uploadFilename
      };

      if (isEditMode) {
        // UPDATE existing applicator in processedApplicators array
        const updatedApplicators = processedApplicators.map(app =>
          app.serialNumber === editingSerialNumber ? applicator : app
        );
        setProcessedApplicators(updatedApplicators);
        clearCurrentApplicator();
      } else {
        // ADD new applicator to context
        processApplicator(applicator);
        setScannedApplicators(prev => [...prev, formData.serialNumber]);
      }

      // Clear form for next applicator
      setFormData({
        serialNumber: '',
        applicatorType: '',
        seedsQty: '',
        insertionTime: new Date().toISOString(),
        usingType: '',
        status: '',
        insertedSeedsQty: '',
        comments: ''
      });

      // Reset catalog and seedLength from validation
      setValidatedCatalog(null);
      setValidatedSeedLength(null);

      // Bug #5 fix: Reset original status when form is cleared
      setOriginalApplicatorStatus(null);

      // Enhanced success message with progress information
      const totalSeeds = progressStats.totalSeeds;
      const insertedSeeds = progressStats.insertedSeeds;
      const remainingApplicators = progressStats.applicatorsRemaining;
      const completionPercentage = progressStats.completionPercentage;

      if (isEditMode) {
        setSuccess(`Applicator ${editingSerialNumber} updated successfully!`);
        // Navigate back to Use List after editing
        setTimeout(() => navigate('/treatment/list'), 1500);
      } else {
        setSuccess(
          `Applicator data saved to Priority system! ` +
          `Progress: ${insertedSeeds}/${totalSeeds} seeds (${completionPercentage}%) - ` +
          `${remainingApplicators} applicators remaining.`
        );
      }
      setError(null);
    } catch {
      setError('Failed to save applicator data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizeClick = () => {
    setShowFinalizeConfirmDialog(true);
  };

  const handleConfirmFinished = () => {
    setShowFinalizeConfirmDialog(false);
    navigate('/treatment/list');
  };

  const handleContinueInsertion = () => {
    setShowFinalizeConfirmDialog(false);
  };


  const toggleEntryMode = () => {
    setManualEntry(!manualEntry);
    setError(null);
    setSuccess(null);
  };

  // File upload handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Note: File upload is now integrated into handleNext function
  // Files are uploaded automatically when the user clicks Insert

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return '🖼️';
    if (file.type.startsWith('video/')) return '🎬';
    if (file.type === 'application/pdf') return '📄';
    return '📎';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Layout title="Treatment Documentation" showBackButton backPath="/treatment/select">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Offline mode indicator */}
        {!isOnline && (
          <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4">
            <div className="flex items-center gap-2">
              <WifiOff className="h-5 w-5 text-yellow-600" />
              <div>
                <h3 className="font-medium text-yellow-900">Working Offline</h3>
                <p className="text-sm text-yellow-700">
                  Changes will be saved locally and synced when connection is restored.
                  Medical status changes (INSERTED/FAULTY) require confirmation.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Mobile-first grid: single column on mobile, 2 columns on md, 3 columns on lg */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Left Column - Treatment Information and Progress */}
          <div className="space-y-4 md:space-y-6 md:col-span-1">
            {/* Treatment Information */}
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium">Treatment Information</h2>
                {currentTreatment?.id && isOnline && (
                  <OfflineDownloadButton
                    treatmentId={currentTreatment.id}
                    size="sm"
                    showLabel={false}
                  />
                )}
              </div>

              {/* Ready for offline indicator - Enhanced */}
              {currentTreatment?.id && isDownloaded(currentTreatment.id) && (
                <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-green-500 rounded-full p-2">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <span className="text-green-800 font-semibold block">
                        Ready for offline use
                      </span>
                      <span className="text-green-600 text-sm">
                        Don't close the app while working offline
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {currentTreatment ? (
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-gray-500">Patient ID</p>
                    {currentTreatment.patientName ? (
                      <p className="font-medium">{currentTreatment.patientName}</p>
                    ) : (
                      <p className="font-medium text-amber-600" title="Using order number (patient name not available)">
                        Order: {currentTreatment.subjectId}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-gray-500">Site</p>
                    <p className="font-medium">{(() => {
                      const currentSite = user?.sites?.find(site => 
                        typeof site === 'object' && site.custName === currentTreatment.site
                      );
                      return currentSite && typeof currentSite === 'object' 
                        ? `${currentSite.custDes} (${currentSite.custName})` 
                        : currentTreatment.site;
                    })()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Type</p>
                    <p className="font-medium capitalize">{currentTreatment.type}</p>
                  </div>
                </div>
              ) : (
                <p>No treatment selected</p>
              )}
            </div>

            {/* Progress Tracker */}
            <ProgressTracker />
          </div>

          {/* Right Column - Scanner and Form: Full width on mobile, 2 cols on md, 2 cols on lg */}
          <div className="space-y-4 md:space-y-6 md:col-span-1 lg:col-span-2">

        {/* Edit Mode Banner */}
        {isEditMode && (
          <div className="rounded-lg border-2 border-blue-500 bg-blue-50 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-900">Editing Applicator</p>
                <p className="text-sm text-blue-700 font-mono">{editingSerialNumber}</p>
              </div>
            </div>
          </div>
        )}

        {/* Scanner/Manual Entry Section */}
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">
              {isEditMode ? 'Edit Applicator Details' : manualEntry ? 'Enter Serial Number Manually' : 'Scan Applicator Barcode'}
            </h2>
            {!isEditMode && (
              <button
                onClick={toggleEntryMode}
                className="min-h-[44px] rounded-md px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10"
                disabled={loading}
              >
                {manualEntry ? 'Switch to Scanner' : 'Enter Manually'}
              </button>
            )}
          </div>

          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700 border border-red-200">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 rounded-md bg-green-50 p-4 text-sm text-green-700 border border-green-200">
              {success}
            </div>
          )}

          {loading && (
            <div className="mb-4 rounded-md bg-blue-50 p-4 text-sm text-blue-700 border border-blue-200">
              Validating applicator with Priority system...
            </div>
          )}

          {isEditMode ? (
            <div className="rounded-md bg-gray-50 border border-gray-300 p-4">
              <p className="text-sm text-gray-700 flex items-center gap-2">
                <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Serial number cannot be changed when editing an existing applicator. You can modify other fields below.
              </p>
            </div>
          ) : manualEntry ? (
            <div className="space-y-4">
              {/* Applicator Selection Mode Toggle */}
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {setShowApplicatorList(true); setShowSuggestions(false); setASuffixQuery('');}}
                  className={`min-h-[44px] px-4 py-2 text-sm rounded-md ${showApplicatorList ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'}`}
                  disabled={loading}
                >
                  Choose from List ({patientFilteredApplicators.length})
                </button>
                <button
                  type="button"
                  onClick={() => {setShowApplicatorList(false); setShowSuggestions(false); setASuffixQuery('');}}
                  className={`min-h-[44px] px-4 py-2 text-sm rounded-md ${!showApplicatorList ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'}`}
                  disabled={loading}
                >
                  Manual Entry
                </button>
              </div>

              {showApplicatorList ? (
                /* Applicator List View with A-Suffix Search */
                <div className="space-y-4">
                  {/* A-Suffix Filter */}
                  <div>
                    <label htmlFor="aSuffixFilter" className="block text-sm font-medium text-gray-700 mb-1">
                      Filter by A-Number (optional)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        id="aSuffixFilter"
                        maxLength={10}
                        value={aSuffixQuery}
                        onChange={(e) => setASuffixQuery(e.target.value)}
                        className="flex-1 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary text-base md:text-sm min-h-[44px]"
                        placeholder="Enter number (e.g., 1, 2, 10) to filter by -A suffix"
                        disabled={loading}
                      />
                      {aSuffixQuery && (
                        <button
                          type="button"
                          onClick={() => setASuffixQuery('')}
                          className="min-h-[44px] rounded-md bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    {aSuffixQuery && (
                      <p className="mt-1 text-xs text-blue-600">
                        Showing applicators ending with "-A{aSuffixQuery}"
                      </p>
                    )}
                  </div>

                  {/* Applicator List */}
                  <div className="border rounded-md max-h-60 overflow-y-auto">
                    {(() => {
                      // Use the pre-filtered patient-specific applicators
                      const actuallyAvailableApplicators = patientFilteredApplicators;
                      
                      // Then filter by A-suffix if query is provided
                      const filteredApplicators = aSuffixQuery.trim() 
                        ? actuallyAvailableApplicators.filter(app => 
                            app.serialNumber?.toUpperCase().endsWith(`-A${aSuffixQuery.trim().toUpperCase()}`)
                          )
                        : actuallyAvailableApplicators;

                      return filteredApplicators.length > 0 ? (
                        <div className="space-y-1 p-2">
                          {aSuffixQuery && (
                            <div className="p-2 border-b bg-blue-50 text-sm font-medium text-blue-800">
                              {filteredApplicators.length} applicator(s) {aSuffixQuery ? `ending with "-A${aSuffixQuery}"` : 'available'}
                            </div>
                          )}
                          {filteredApplicators
                            .sort((a, b) => {
                              // Status priority: LOADED (0) > OPENED (1) > SEALED (2)
                              // Applicators with status move to top, ordered by workflow progress
                              const statusPriority: Record<string, number> = {
                                'LOADED': 0,
                                'OPENED': 1,
                                'SEALED': 2,
                              };

                              const statusA = a.status || 'SEALED';
                              const statusB = b.status || 'SEALED';

                              const priorityA = statusPriority[statusA] ?? 2;
                              const priorityB = statusPriority[statusB] ?? 2;

                              // Primary sort: by status priority (lower = higher priority)
                              if (priorityA !== priorityB) {
                                return priorityA - priorityB;
                              }

                              // Secondary sort: by seed quantity descending (higher first)
                              return b.seedQuantity - a.seedQuantity;
                            })
                            .map((applicator, index) => {
                            const applicatorStatus = applicator.status || 'SEALED';
                            const statusColor = getListItemColor(applicatorStatus);
                            const statusEmoji = getStatusEmoji(applicatorStatus);
                            const statusLabel = getStatusLabel(applicatorStatus);

                            return (
                              <button
                                key={index}
                                onClick={() => handleApplicatorSelect(applicator)}
                                className={`w-full text-left p-2 rounded hover:opacity-80 border ${statusColor}`}
                                disabled={loading}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="font-medium">
                                    <span className="mr-2">{statusEmoji}</span>
                                    {applicator.serialNumber}
                                  </div>
                                  {applicatorStatus !== 'SEALED' && (
                                    <span className={`text-xs px-2 py-0.5 rounded ${
                                      applicatorStatus === 'OPENED' ? 'bg-red-200 text-red-800' :
                                      applicatorStatus === 'LOADED' ? 'bg-yellow-200 text-yellow-800' :
                                      'bg-gray-200 text-gray-800'
                                    }`}>
                                      {statusLabel}
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {applicator.applicatorType} • {applicator.seedQuantity} sources
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-4 text-center text-gray-500">
                          {aSuffixQuery 
                            ? `No applicators found ending with "-A${aSuffixQuery}"` 
                            : 'No applicators found for this treatment'
                          }
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                /* Manual Entry Form */
                <form onSubmit={handleManualSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="serialNumber" className="block text-sm font-medium text-gray-700 mb-1">
                      Serial Number *
                    </label>
                    <input
                      type="text"
                      id="serialNumber"
                      maxLength={32}
                      value={formData.serialNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, serialNumber: e.target.value }))}
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary text-base md:text-sm min-h-[44px]"
                      placeholder="Enter applicator serial number"
                      autoFocus
                      disabled={loading}
                    />
                  </div>
                  
                  {/* Search Suggestions */}
                  {showSuggestions && searchSuggestions.length > 0 && (
                    <div className="border rounded-md bg-yellow-50">
                      <div className="p-2 border-b bg-yellow-100 text-sm font-medium">
                        Did you mean:
                      </div>
                      <div className="space-y-1 p-2">
                        {searchSuggestions.map((suggestion, index) => {
                          const suggestionStatus = suggestion.status || 'SEALED';
                          const statusEmoji = getStatusEmoji(suggestionStatus);
                          const statusLabel = getStatusLabel(suggestionStatus);

                          return (
                            <button
                              key={index}
                              onClick={() => handleSuggestionSelect(suggestion)}
                              className={`w-full text-left p-2 rounded text-sm ${getListItemColor(suggestionStatus)}`}
                              disabled={loading}
                            >
                              <div className="flex items-center justify-between">
                                <div className="font-medium">
                                  <span className="mr-2">{statusEmoji}</span>
                                  {suggestion.serialNumber}
                                </div>
                                {suggestionStatus !== 'SEALED' && (
                                  <span className={`text-xs px-2 py-0.5 rounded ${
                                    suggestionStatus === 'OPENED' ? 'bg-red-200 text-red-800' :
                                    suggestionStatus === 'LOADED' ? 'bg-yellow-200 text-yellow-800' :
                                    'bg-gray-200 text-gray-800'
                                  }`}>
                                    {statusLabel}
                                  </span>
                                )}
                              </div>
                              <div className="text-gray-600">
                                {suggestion.applicatorType} • {suggestion.seedQuantity} sources
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  <button
                    type="submit"
                    disabled={loading || !formData.serialNumber}
                    className="w-full min-h-[44px] rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
                  >
                    {loading ? 'Validating...' : 'Validate Serial Number'}
                  </button>
                </form>
              )}
            </div>
          ) : (
            <div>
              {/* Scanner: Full viewport width on mobile for better QR scanning, constrained on desktop */}
              <div id="qr-reader" ref={scannerDivRef} className="mx-auto w-full sm:max-w-sm"></div>
              <p className="mt-4 text-center text-sm text-gray-500">
                Position the barcode inside the scan area
              </p>
            </div>
          )}
        </div>

        {/* Confirmation Dialog */}
        <ConfirmationDialog
          isOpen={showConfirmDialog}
          onClose={handleCancelValidation}
          onConfirm={handleConfirmValidation}
          title="Confirmation Required"
          message={pendingValidation?.message || ''}
          confirmText="Continue"
          cancelText="Cancel"
          type="warning"
          loading={loading}
        />

        {/* Finalize Confirmation Dialog */}
        <ConfirmationDialog
          isOpen={showFinalizeConfirmDialog}
          onClose={handleContinueInsertion}
          onConfirm={handleConfirmFinished}
          title="Did you finish the insertion?"
          message="Please confirm if you have finished inserting all applicators."
          confirmText="Yes"
          cancelText="No"
          type="info"
          loading={false}
        />

        {/* Terminal Status Warning Dialog (Issue 4 fix) */}
        <ConfirmationDialog
          isOpen={showTerminalWarning}
          onClose={() => {
            setShowTerminalWarning(false);
            setPendingTerminalStatus(null);
          }}
          onConfirm={() => {
            setShowTerminalWarning(false);
            if (pendingTerminalStatus) {
              setFormData(prev => ({ ...prev, status: pendingTerminalStatus }));
            }
            setPendingTerminalStatus(null);
          }}
          title={`${pendingTerminalStatus} is a Permanent Status`}
          message="This is a terminal status. Once saved, this applicator will be removed from the available list and you cannot change its status again. Are you sure you want to continue?"
          confirmText={`Yes, Mark as ${pendingTerminalStatus}`}
          cancelText="Cancel"
          type="warning"
          loading={false}
        />

        {/* Applicator Details Form */}
        {formData.serialNumber && (
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="text-base md:text-lg font-medium mb-4">Applicator Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {/* Serial Number (Read-only) */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Serial Number
                </label>
                <input
                  type="text"
                  value={formData.serialNumber}
                  readOnly
                  className="block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 shadow-sm text-base md:text-sm min-h-[44px]"
                />
              </div>

              {/* Applicator Type (Read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Applicator Type
                </label>
                <input
                  type="text"
                  value={formData.applicatorType}
                  readOnly
                  className="block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 shadow-sm text-base md:text-sm min-h-[44px]"
                />
              </div>

              {/* Sources Qty (Read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sources Qty.
                </label>
                <input
                  type="text"
                  value={formData.seedsQty}
                  readOnly
                  className="block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 shadow-sm text-base md:text-sm min-h-[44px]"
                />
              </div>

              {/* Insertion Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Insertion Time *
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => adjustTime(-1)}
                    className="min-h-[44px] min-w-[44px] rounded-md bg-gray-100 px-3 py-2 text-sm hover:bg-gray-200"
                    disabled={loading}
                  >
                    -1m
                  </button>
                  <input
                    type="text"
                    value={format(new Date(formData.insertionTime), 'dd.MM.yyyy HH:mm')}
                    readOnly
                    className="flex-1 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-base md:text-sm min-h-[44px]"
                  />
                  <button
                    type="button"
                    onClick={() => adjustTime(1)}
                    className="min-h-[44px] min-w-[44px] rounded-md bg-gray-100 px-3 py-2 text-sm hover:bg-gray-200"
                    disabled={loading}
                  >
                    +1m
                  </button>
                </div>
              </div>

              {/* Status (8-state workflow) */}
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                  Status *
                </label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) => {
                    const newStatus = e.target.value;
                    // Terminal statuses get a warning dialog
                    if (TERMINAL_STATUSES.includes(newStatus as ApplicatorStatus)) {
                      setPendingTerminalStatus(newStatus);
                      setShowTerminalWarning(true);
                      return;
                    }
                    setFormData(prev => ({ ...prev, status: newStatus }));
                  }}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary text-base md:text-sm min-h-[44px]"
                  required
                  disabled={loading}
                >
                  <option value="">Select Status</option>
                  {shouldShowStatus('SEALED') && <option value="SEALED" className="text-gray-800">Sealed (unopened)</option>}
                  {shouldShowStatus('OPENED') && <option value="OPENED" className="text-red-600">Opened (package opened)</option>}
                  {shouldShowStatus('LOADED') && <option value="LOADED" className="text-yellow-600">Loaded (ready for insertion)</option>}
                  {shouldShowStatus('INSERTED') && <option value="INSERTED" className="text-green-600">Inserted (successfully deployed)</option>}
                  {shouldShowStatus('FAULTY') && <option value="FAULTY" className="text-gray-800">Faulty (defective equipment)</option>}
                  {shouldShowStatus('DISPOSED') && <option value="DISPOSED" className="text-gray-800">Disposed (discarded)</option>}
                  {shouldShowStatus('DISCHARGED') && <option value="DISCHARGED" className="text-gray-800">Discharged (sources expelled)</option>}
                  {shouldShowStatus('DEPLOYMENT_FAILURE') && <option value="DEPLOYMENT_FAILURE" className="text-gray-800">Deployment Failure</option>}
                </select>
              </div>

              {/* Inserted Sources Qty */}
              <div>
                <label htmlFor="insertedSeedsQty" className="block text-sm font-medium text-gray-700 mb-1">
                  Inserted Sources Qty.
                </label>
                {(requiresComment(formData.status) || formData.usingType === 'Faulty') ? (
                  <input
                    type="number"
                    id="insertedSeedsQty"
                    min="0"
                    max={formData.seedsQty}
                    value={formData.insertedSeedsQty}
                    onChange={(e) => setFormData(prev => ({ ...prev, insertedSeedsQty: e.target.value }))}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary text-base md:text-sm min-h-[44px]"
                    disabled={loading}
                  />
                ) : (
                  <input
                    type="text"
                    value={formData.insertedSeedsQty}
                    readOnly
                    className="block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 shadow-sm text-base md:text-sm min-h-[44px]"
                  />
                )}
              </div>

              {/* Comments */}
              <div className="md:col-span-2">
                <label htmlFor="comments" className="block text-sm font-medium text-gray-700 mb-1">
                  Comments {(requiresComment(formData.status) || formData.usingType === 'Faulty') && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  id="comments"
                  maxLength={48}
                  rows={2}
                  value={formData.comments}
                  onChange={(e) => setFormData(prev => ({ ...prev, comments: e.target.value }))}
                  className={`block w-full rounded-md border px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary text-base md:text-sm min-h-[44px] ${
                    (requiresComment(formData.status) || formData.usingType === 'Faulty') ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder={
                    (requiresComment(formData.status) || formData.usingType === 'Faulty')
                      ? 'Required: Explain why the applicator was not used successfully...'
                      : 'Optional comments...'
                  }
                  disabled={loading}
                  required={requiresComment(formData.status) || formData.usingType === 'Faulty'}
                />
                {(requiresComment(formData.status) || formData.usingType === 'Faulty') && (
                  <p className="mt-1 text-sm text-red-600">
                    Comments are required for this status to continue.
                  </p>
                )}
              </div>

              {/* File Attachments */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Attachments
                </label>

                {/* Note: Upload errors are shown via the main error state when Insert fails */}

                {/* File Input Area */}
                <div
                  className="border-2 border-dashed border-gray-300 rounded-md p-4 text-center hover:border-primary cursor-pointer transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,video/*,.pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={loading}
                  />
                  <div className="text-gray-500">
                    <span className="text-2xl">📎</span>
                    <p className="mt-1 text-sm">Click to add files</p>
                    <p className="text-xs text-gray-400">Images, Videos, or PDFs (max 50MB each)</p>
                  </div>
                </div>

                {/* Selected Files Preview */}
                {selectedFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-sm font-medium text-gray-700">
                      Selected files ({selectedFiles.length}):
                    </p>
                    <div className="space-y-1">
                      {selectedFiles.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between bg-gray-50 rounded-md p-2 text-sm"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span>{getFileIcon(file)}</span>
                            <span className="truncate">{file.name}</span>
                            <span className="text-gray-400 text-xs">({formatFileSize(file.size)})</span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFile(index);
                            }}
                            className="text-red-500 hover:text-red-700 p-1"
                            disabled={loading}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Info: Files will upload on Insert */}
                    <p className="text-xs text-gray-500 italic">
                      📤 Files will be uploaded when you click Insert
                    </p>
                  </div>
                )}

                {/* Existing Attachments Info */}
                {currentApplicator?.attachmentFileCount && currentApplicator.attachmentFileCount > 0 && (
                  <div className="mt-2 text-sm text-gray-600 flex items-center gap-1">
                    <span>📁</span>
                    <span>{currentApplicator.attachmentFileCount} file(s) already attached</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 mt-6">
              <button
                onClick={handleNext}
                disabled={
                  loading ||
                  !formData.serialNumber ||
                  !(formData.status || formData.usingType) ||
                  ((requiresComment(formData.status) || formData.usingType === 'Faulty') &&
                   (!formData.comments || formData.comments.trim().length === 0))
                }
                className="flex-1 min-h-[44px] rounded-md bg-blue-600 px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {loading ? 'Saving...' : isEditMode ? 'Update Applicator' : 'Insert'}
              </button>
            </div>
          </div>
        )}

        {/* Finalize / Use List Button - Show Only After At Least One Applicator */}
        {processedApplicators.length > 0 && (
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex justify-center">
              <button
                onClick={handleFinalizeClick}
                disabled={loading}
                className="w-full min-h-[44px] rounded-md bg-primary px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 sm:w-auto"
              >
                {loading ? 'Processing...' : 'Finalize / Use List'}
              </button>
            </div>
          </div>
        )}

            {/* Instructions */}
            <div className="rounded-lg border bg-gray-50 p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Instructions</h3>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>• Scan or enter the applicator serial number</li>
                <li>• System validates applicator against Priority database in real-time</li>
                <li>• Insertion time is automatically set when scanning</li>
                <li>• For 'Faulty' usage type, specify actual inserted sources quantity</li>
                <li>• Use 'Next' to add another applicator or 'Finalize' to complete treatment</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Offline Insertion Confirmation Dialog */}
      <OfflineInsertionConfirmDialog
        isOpen={showOfflineConfirmDialog}
        onClose={() => {
          setShowOfflineConfirmDialog(false);
          setOfflinePendingApplicator(null);
        }}
        onConfirm={async () => {
          if (offlinePendingApplicator) {
            // Pass originalApplicatorStatus for accurate transition validation
            await processApplicatorOffline(offlinePendingApplicator, true, originalApplicatorStatus as ApplicatorStatus | null);
            setShowOfflineConfirmDialog(false);
            setOfflinePendingApplicator(null);
            setOriginalApplicatorStatus(null);
            setSuccess('Applicator processed offline. Will sync when connection is restored.');
          }
        }}
        applicatorSerial={offlinePendingApplicator?.serialNumber || ''}
        status={offlinePendingApplicator?.status === 'FAULTY' ? 'FAULTY' : 'INSERTED'}
      />
    </Layout>
  );
};

export default TreatmentDocumentation;