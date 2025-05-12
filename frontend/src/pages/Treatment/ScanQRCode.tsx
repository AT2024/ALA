import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import Layout from '@/components/Layout';
import { useTreatment } from '@/context/TreatmentContext';
import { treatmentService } from '@/services/treatmentService';

const ScanQRCode = () => {
  const { currentTreatment, setCurrentApplicator } = useTreatment();
  const navigate = useNavigate();

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const [barcodeValue, setBarcodeValue] = useState('');

  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const scannerDivRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentTreatment) {
      navigate('/treatment/select');
      return;
    }

    if (!manualEntry && scannerDivRef.current) {
      // Initialize the scanner
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

  const onScanSuccess = async (decodedText: string) => {
    await handleBarcodeSubmit(decodedText);
  };

  const onScanFailure = (error: any) => {
    console.error('Scan failure:', error);
  };

  const handleBarcodeSubmit = async (code: string = barcodeValue) => {
    if (!code) {
      setError('Please enter a barcode');
      return;
    }

    if (!currentTreatment?.id) {
      setError('No treatment selected');
      navigate('/treatment/select');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Validate the barcode with the backend
      const validation = await treatmentService.validateApplicator(code, currentTreatment.id);

      if (!validation.valid && validation.requiresAdminApproval) {
        setError(`${validation.message} Admin approval required.`);
      } else if (!validation.valid) {
        setError(validation.message);
      } else if (validation.applicator) {
        // If validation returns an applicator object, use it
        setCurrentApplicator(validation.applicator);
        navigate('/treatment/applicator');
      } else {
        // If validation is successful but no applicator is returned,
        // create a new applicator with default values
        setCurrentApplicator({
          id: '', // Will be assigned by backend
          serialNumber: code,
          seedQuantity: 0, // Will be updated based on barcode
          usageType: 'full',
          insertionTime: new Date().toISOString(),
        });
        navigate('/treatment/applicator');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to validate barcode');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleBarcodeSubmit();
  };

  const toggleEntryMode = () => {
    setManualEntry(!manualEntry);
    setError(null);
  };

  return (
    <Layout title='Scan Applicator Barcode' showBackButton backPath='/treatment/select'>
      <div className='mx-auto max-w-2xl space-y-6'>
        <div className='rounded-lg border bg-white p-4 shadow-sm'>
          <h2 className='mb-4 text-lg font-medium'>Treatment Information</h2>
          {currentTreatment ? (
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
                <p className='font-medium'>
                  {new Date(currentTreatment.date).toLocaleDateString()}
                </p>
              </div>
            </div>
          ) : (
            <p>No treatment selected</p>
          )}
        </div>

        <div className='rounded-lg border bg-white p-4 shadow-sm'>
          <div className='flex items-center justify-between'>
            <h2 className='text-lg font-medium'>
              {manualEntry ? 'Enter Barcode Manually' : 'Scan Applicator Barcode'}
            </h2>
            <button
              onClick={toggleEntryMode}
              className='text-sm font-medium text-primary hover:text-primary/80'>
              {manualEntry ? 'Switch to Scanner' : 'Enter Manually'}
            </button>
          </div>

          {error && (
            <div className='mt-4 rounded-md bg-red-50 p-4 text-sm text-red-700'>{error}</div>
          )}

          {manualEntry ? (
            <form onSubmit={handleManualSubmit} className='mt-4 space-y-4'>
              <div>
                <label htmlFor='barcode' className='block text-sm font-medium text-gray-700'>
                  Barcode
                </label>
                <input
                  type='text'
                  id='barcode'
                  value={barcodeValue}
                  onChange={(e) => setBarcodeValue(e.target.value)}
                  className='mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm'
                  placeholder='Enter barcode number'
                  autoFocus
                />
              </div>
              <div className='flex justify-end'>
                <button
                  type='submit'
                  disabled={loading || !barcodeValue}
                  className='rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50'>
                  {loading ? 'Processing...' : 'Submit'}
                </button>
              </div>
            </form>
          ) : (
            <div className='mt-4'>
              <div id='qr-reader' ref={scannerDivRef} className='mx-auto max-w-sm'></div>
              <p className='mt-4 text-center text-sm text-gray-500'>
                Position the barcode inside the scan area
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ScanQRCode;
