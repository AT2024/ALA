import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { format, addMinutes, subMinutes } from 'date-fns';
import Layout from '@/components/Layout';
import ConfirmationDialog from '@/components/Dialogs/ConfirmationDialog';
import { useTreatment } from '@/context/TreatmentContext';
import applicatorService, { ApplicatorValidationResult } from '@/services/applicatorService';

const TreatmentDocumentation = () => {
  const { currentTreatment, addApplicator, applicators } = useTreatment();
  const navigate = useNavigate();

  const [scannedApplicators, setScannedApplicators] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingValidation, setPendingValidation] = useState<ApplicatorValidationResult | null>(null);

  const [formData, setFormData] = useState({
    serialNumber: '',
    applicatorType: '',
    seedsQty: '',
    insertionTime: format(new Date(), 'dd.MM.yyyy HH:mm'),
    usingType: '',
    insertedSeedsQty: '',
    comments: ''
  });

  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const scannerDivRef = useRef<HTMLDivElement>(null);

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
        } catch (err) {
          console.error('Error clearing scanner:', err);
        }
      }
    };
  }, [currentTreatment, manualEntry]);

  // Handle Using Type change
  useEffect(() => {
    const seedsQty = parseInt(formData.seedsQty) || 0;
    
    switch (formData.usingType) {
      case 'Full use':
        setFormData(prev => ({ ...prev, insertedSeedsQty: seedsQty.toString() }));
        break;
      case 'Faulty':
      case 'No Use':
        setFormData(prev => ({ ...prev, insertedSeedsQty: '0' }));
        break;
      default:
        setFormData(prev => ({ ...prev, insertedSeedsQty: '' }));
    }
  }, [formData.usingType, formData.seedsQty]);

  const onScanSuccess = async (decodedText: string) => {
    await handleBarcodeScanned(decodedText);
  };

  const onScanFailure = (error: any) => {
    console.error('Scan failure:', error);
  };

  const handleBarcodeScanned = async (serialNumber: string) => {
    if (!currentTreatment) {
      console.error('No current treatment available');
      setError('No treatment selected. Please go back and select a treatment.');
      return;
    }
    
    console.log(`Starting barcode validation process for: ${serialNumber}`);
    console.log(`Current treatment:`, {
      id: currentTreatment.id,
      subjectId: currentTreatment.subjectId,
      site: currentTreatment.site,
      type: currentTreatment.type
    });
    console.log(`Already scanned applicators:`, scannedApplicators);
    
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      // Validate applicator against Priority system
      console.log('Calling applicatorService.validateApplicator...');
      const validation = await applicatorService.validateApplicator(
        serialNumber,
        currentTreatment.id,
        currentTreatment.subjectId,
        scannedApplicators
      );
      
      console.log('Validation result:', validation);

      if (validation.requiresConfirmation) {
        console.log('Validation requires user confirmation');
        // Show confirmation dialog for scenarios that need user approval
        setPendingValidation(validation);
        setShowConfirmDialog(true);
      } else if (validation.isValid) {
        console.log('Validation successful, filling form with applicator data');
        // Proceed with valid applicator
        await fillFormWithApplicatorData(validation);
      } else {
        console.log('Validation failed:', validation.message);
        // Show error for invalid applicators
        setError(validation.message);
      }
    } catch (error: any) {
      console.error('Error validating applicator:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
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

    // Fill form with validated applicator data
    setFormData({
      serialNumber: applicatorData.serialNumber,
      applicatorType: applicatorData.applicatorType,
      seedsQty: applicatorData.seedQuantity.toString(),
      insertionTime: format(new Date(), 'dd.MM.yyyy HH:mm'),
      usingType: 'Full use', // Default selection
      insertedSeedsQty: applicatorData.seedQuantity.toString(), // Auto-filled for Full use
      comments: ''
    });

    setSuccess(`Applicator ${applicatorData.serialNumber} validated successfully!`);
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

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.serialNumber) {
      handleBarcodeScanned(formData.serialNumber);
    }
  };

  const adjustTime = (minutes: number) => {
    const currentTime = new Date(formData.insertionTime);
    const newTime = minutes > 0 ? addMinutes(currentTime, minutes) : subMinutes(currentTime, Math.abs(minutes));
    setFormData(prev => ({ 
      ...prev, 
      insertionTime: format(newTime, 'dd.MM.yyyy HH:mm') 
    }));
  };

  const handleNext = async () => {
    if (!formData.serialNumber || !formData.usingType || !currentTreatment) {
      setError('Please fill in all required fields');
      return;
    }

    console.log('Starting applicator save process...');
    console.log('Form data:', formData);
    console.log('Current treatment:', currentTreatment.id);

    setLoading(true);

    try {
      const applicatorData = {
        serialNumber: formData.serialNumber,
        applicatorType: formData.applicatorType,
        seedQuantity: parseInt(formData.seedsQty) || 0,
        insertionTime: formData.insertionTime,
        usingType: formData.usingType as 'full' | 'partial' | 'faulty' | 'none',
        insertedSeedsQty: parseInt(formData.insertedSeedsQty) || 0,
        comments: formData.comments
      };
      
      console.log('Saving applicator data to Priority:', applicatorData);
      
      // Save applicator data to Priority system
      const saveResult = await applicatorService.saveApplicatorData(currentTreatment.id, applicatorData);
      
      console.log('Save result:', saveResult);

      if (!saveResult.success) {
        console.error('Failed to save applicator data:', saveResult.message);
        setError(saveResult.message || 'Failed to save applicator data');
        return;
      }

      // Add applicator to local treatment context
      const applicator = {
        id: `app-${Date.now()}`,
        serialNumber: formData.serialNumber,
        applicatorType: formData.applicatorType,
        seedQuantity: parseInt(formData.seedsQty) || 0,
        usageType: formData.usingType as 'full' | 'faulty' | 'none',
        insertionTime: formData.insertionTime,
        insertedSeedsQty: parseInt(formData.insertedSeedsQty) || 0,
        comments: formData.comments
      };

      console.log('Adding applicator to local context:', applicator);
      addApplicator(applicator);
      setScannedApplicators(prev => [...prev, formData.serialNumber]);

      // Clear form for next applicator
      setFormData({
        serialNumber: '',
        applicatorType: '',
        seedsQty: '',
        insertionTime: format(new Date(), 'dd.MM.yyyy HH:mm'),
        usingType: '',
        insertedSeedsQty: '',
        comments: ''
      });

      setSuccess('Applicator data saved to Priority system! Ready for next applicator.');
      setError(null);
      console.log('Applicator successfully added and form cleared');
    } catch (error: any) {
      console.error('Error saving applicator:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      setError('Failed to save applicator data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = async () => {
    if (applicators.length === 0) {
      setError('Please add at least one applicator before finalizing');
      return;
    }

    if (!currentTreatment) {
      setError('No treatment selected');
      return;
    }

    setLoading(true);

    try {
      // Update treatment status to "Performed" in Priority
      const statusResult = await applicatorService.updateTreatmentStatus(
        currentTreatment.id, 
        'Performed'
      );

      if (!statusResult.success) {
        setError(statusResult.message || 'Failed to update treatment status');
        return;
      }

      setSuccess('Treatment completed and status updated in Priority system!');
      
      // Navigate to Use List screen after a brief delay
      setTimeout(() => {
        navigate('/treatment/list');
      }, 1500);
    } catch (error: any) {
      console.error('Error finalizing treatment:', error);
      setError('Failed to finalize treatment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleEntryMode = () => {
    setManualEntry(!manualEntry);
    setError(null);
    setSuccess(null);
  };

  return (
    <Layout title="Treatment Documentation" showBackButton backPath="/treatment/select">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Treatment Information */}
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-lg font-medium">Treatment Information</h2>
          {currentTreatment ? (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Patient ID</p>
                <p className="font-medium">{currentTreatment.subjectId}</p>
              </div>
              <div>
                <p className="text-gray-500">Site</p>
                <p className="font-medium">{currentTreatment.site}</p>
              </div>
              <div>
                <p className="text-gray-500">Type</p>
                <p className="font-medium capitalize">{currentTreatment.type}</p>
              </div>
              <div>
                <p className="text-gray-500">Applicators Added</p>
                <p className="font-medium">{applicators.length}</p>
              </div>
            </div>
          ) : (
            <p>No treatment selected</p>
          )}
        </div>

        {/* Scanner/Manual Entry Section */}
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">
              {manualEntry ? 'Enter Serial Number Manually' : 'Scan Applicator Barcode'}
            </h2>
            <button
              onClick={toggleEntryMode}
              className="text-sm font-medium text-primary hover:text-primary/80"
              disabled={loading}
            >
              {manualEntry ? 'Switch to Scanner' : 'Enter Manually'}
            </button>
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

          {manualEntry ? (
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
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
                  placeholder="Enter applicator serial number"
                  autoFocus
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !formData.serialNumber}
                className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
              >
                {loading ? 'Validating...' : 'Validate Serial Number'}
              </button>
            </form>
          ) : (
            <div>
              <div id="qr-reader" ref={scannerDivRef} className="mx-auto max-w-sm"></div>
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

        {/* Applicator Details Form */}
        {formData.serialNumber && (
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="text-lg font-medium mb-4">Applicator Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Serial Number (Read-only) */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Serial Number
                </label>
                <input
                  type="text"
                  value={formData.serialNumber}
                  readOnly
                  className="block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 shadow-sm sm:text-sm"
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
                  className="block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 shadow-sm sm:text-sm"
                />
              </div>

              {/* Seeds Qty (Read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Seeds Qty.
                </label>
                <input
                  type="text"
                  value={formData.seedsQty}
                  readOnly
                  className="block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 shadow-sm sm:text-sm"
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
                    className="rounded-md bg-gray-100 px-2 py-1 text-sm hover:bg-gray-200"
                    disabled={loading}
                  >
                    -1m
                  </button>
                  <input
                    type="text"
                    value={formData.insertionTime}
                    readOnly
                    className="flex-1 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => adjustTime(1)}
                    className="rounded-md bg-gray-100 px-2 py-1 text-sm hover:bg-gray-200"
                    disabled={loading}
                  >
                    +1m
                  </button>
                </div>
              </div>

              {/* Using Type */}
              <div>
                <label htmlFor="usingType" className="block text-sm font-medium text-gray-700 mb-1">
                  Using Type *
                </label>
                <select
                  id="usingType"
                  value={formData.usingType}
                  onChange={(e) => setFormData(prev => ({ ...prev, usingType: e.target.value }))}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
                  required
                  disabled={loading}
                >
                  <option value="">Select Using Type</option>
                  <option value="Full use">Full use</option>
                  <option value="Faulty">Faulty</option>
                  <option value="No Use">No Use</option>
                </select>
              </div>

              {/* Inserted Seeds Qty */}
              <div>
                <label htmlFor="insertedSeedsQty" className="block text-sm font-medium text-gray-700 mb-1">
                  Inserted Seeds Qty.
                </label>
                {formData.usingType === 'Faulty' ? (
                  <input
                    type="number"
                    id="insertedSeedsQty"
                    min="0"
                    max={formData.seedsQty}
                    value={formData.insertedSeedsQty}
                    onChange={(e) => setFormData(prev => ({ ...prev, insertedSeedsQty: e.target.value }))}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
                    disabled={loading}
                  />
                ) : (
                  <input
                    type="text"
                    value={formData.insertedSeedsQty}
                    readOnly
                    className="block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 shadow-sm sm:text-sm"
                  />
                )}
              </div>

              {/* Comments */}
              <div className="md:col-span-2">
                <label htmlFor="comments" className="block text-sm font-medium text-gray-700 mb-1">
                  Comments
                </label>
                <textarea
                  id="comments"
                  maxLength={48}
                  rows={2}
                  value={formData.comments}
                  onChange={(e) => setFormData(prev => ({ ...prev, comments: e.target.value }))}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
                  placeholder="Optional comments..."
                  disabled={loading}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 mt-6">
              <button
                onClick={handleNext}
                disabled={loading || !formData.serialNumber || !formData.usingType}
                className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Next'}
              </button>
              <button
                onClick={handleFinalize}
                disabled={loading || applicators.length === 0}
                className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
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
            <li>• For 'Faulty' usage type, specify actual inserted seeds quantity</li>
            <li>• Use 'Next' to add another applicator or 'Finalize' to complete treatment</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
};

export default TreatmentDocumentation;