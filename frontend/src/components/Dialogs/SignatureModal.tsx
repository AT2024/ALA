import { Fragment, useState, useEffect, useCallback } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, EnvelopeIcon, CheckCircleIcon, ExclamationTriangleIcon, CheckIcon } from '@heroicons/react/24/outline';
import { treatmentService } from '@/services/treatmentService';
import { useTreatment } from '@/context/TreatmentContext';

interface SiteUser {
  email: string;
  name: string;
  position: string;
}

interface UserData {
  name: string;
  email: string;
  position?: string;
  site?: string;
}

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  treatmentId: string;
  treatmentSite: string;
  onSuccess: () => void;
  flowType?: 'hospital_auto' | 'alphatau_verification';
  userData?: UserData;
  isContinuation?: boolean; // True if this treatment is a continuation of another
}

type Step = 'email_selection' | 'code_entry' | 'signature_details' | 'hospital_confirmation';

const SignatureModal = ({
  isOpen,
  onClose,
  treatmentId,
  treatmentSite: _treatmentSite, // Reserved for potential future site-specific logic
  onSuccess,
  flowType = 'alphatau_verification',
  userData,
  isContinuation = false,
}: SignatureModalProps) => {
  // Note: treatmentSite is available via _treatmentSite if needed for site-specific features

  // Get applicators from treatment context to include in PDF
  // For removal treatments, use `applicators` (the removal tracking list)
  // For insertion treatments, use `availableApplicators` (the scanned applicators list)
  const { availableApplicators, applicators, currentTreatment } = useTreatment();

  // Map isRemoved → usageType for removal PDF generation
  const applicatorsForPdf = currentTreatment?.type === 'removal'
    ? applicators.map(app => ({ ...app, usageType: app.isRemoved ? 'full' as const : 'none' as const }))
    : availableApplicators;

  // Step management - hospital flow starts at confirmation, alphatau at email selection
  const [currentStep, setCurrentStep] = useState<Step>(
    flowType === 'hospital_auto' ? 'hospital_confirmation' : 'email_selection'
  );

  // Email selection state
  const [siteUsers, setSiteUsers] = useState<SiteUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmail, setSelectedEmail] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Code entry state
  const [verificationCode, setVerificationCode] = useState('');
  const [attemptsRemaining, setAttemptsRemaining] = useState(3);
  const [canResend, setCanResend] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(60);

  // Signature details state
  const [signerName, setSignerName] = useState('');
  const [signerPosition, setSignerPosition] = useState('physicist');

  // General state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hospital confirmation state
  const [confirmed, setConfirmed] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      // Set initial step based on flow type
      setCurrentStep(flowType === 'hospital_auto' ? 'hospital_confirmation' : 'email_selection');
      setSearchQuery('');
      setSelectedEmail('');
      setManualEmail('');
      setVerificationCode('');
      setAttemptsRemaining(3);
      setCanResend(false);
      setResendCountdown(60);
      setConfirmed(false);
      setError(null);

      // Pre-fill user data if provided (for hospital flow)
      if (flowType === 'hospital_auto' && userData) {
        setSignerName(userData.name || '');
        setSignerPosition(userData.position || 'physicist');
      } else {
        setSignerName('');
        setSignerPosition('physicist');
        loadSiteUsers();
      }
    }
  }, [isOpen, treatmentId, flowType, userData]);

  // Countdown timer for resend
  useEffect(() => {
    if (currentStep === 'code_entry' && !canResend && resendCountdown > 0) {
      const timer = setTimeout(() => {
        setResendCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (resendCountdown === 0) {
      setCanResend(true);
    }
  }, [currentStep, canResend, resendCountdown]);

  const loadSiteUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const response = await treatmentService.getSiteUsersForFinalization(treatmentId);
      setSiteUsers(response.users || []);
    } catch (err: any) {
      console.error('Failed to load site users:', err);
      // Don't show error - user can still enter email manually
    } finally {
      setLoadingUsers(false);
    }
  }, [treatmentId]);

  const getEffectiveEmail = (): string => {
    return selectedEmail || manualEmail;
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const filteredUsers = siteUsers.filter(user => {
    const query = searchQuery.toLowerCase();
    return (
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      user.position.toLowerCase().includes(query)
    );
  });

  const handleSendCode = async () => {
    const email = getEffectiveEmail();

    if (!email) {
      setError('Please select or enter an email address');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await treatmentService.sendFinalizationCode(treatmentId, email);
      setCurrentStep('code_entry');
      setCanResend(false);
      setResendCountdown(60);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setCanResend(false);
    setResendCountdown(60);
    await handleSendCode();
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow numeric input, max 6 digits
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setVerificationCode(value);

    // Auto-advance when 6 digits entered
    if (value.length === 6) {
      setCurrentStep('signature_details');
    }
  };

  const handleVerifyAndFinalize = async () => {
    if (!signerName.trim()) {
      setError('Please enter your full name');
      return;
    }

    if (verificationCode.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await treatmentService.verifyAndFinalize(
        treatmentId,
        verificationCode,
        signerName.trim(),
        signerPosition,
        applicatorsForPdf
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      const errorData = err.response?.data;

      if (errorData?.attemptsRemaining !== undefined) {
        setAttemptsRemaining(errorData.attemptsRemaining);
      }

      if (errorData?.attemptsRemaining === 0) {
        setError('Too many failed attempts. Please request a new code.');
        setCurrentStep('email_selection');
      } else {
        setError(errorData?.error || err.message || 'Verification failed. Please try again.');
        // Go back to code entry to try again
        setCurrentStep('code_entry');
        setVerificationCode('');
      }
    } finally {
      setLoading(false);
    }
  };

  // Hospital staff auto-finalize (no code verification needed)
  const handleHospitalAutoFinalize = async () => {
    if (!confirmed) {
      setError('Please confirm the checkbox to proceed');
      return;
    }

    if (!signerName.trim()) {
      setError('Signer name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await treatmentService.autoFinalize(treatmentId, signerName.trim(), signerPosition, applicatorsForPdf);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to finalize treatment');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setError(null);
    if (currentStep === 'code_entry') {
      setCurrentStep('email_selection');
      setVerificationCode('');
    } else if (currentStep === 'signature_details') {
      setCurrentStep('code_entry');
    }
  };

  const renderStepIndicator = () => {
    const steps = [
      { key: 'email_selection', label: '1. Select Email' },
      { key: 'code_entry', label: '2. Enter Code' },
      { key: 'signature_details', label: '3. Sign' },
    ];

    return (
      <div className="flex items-center justify-center space-x-2 mb-6">
        {steps.map((step, index) => (
          <Fragment key={step.key}>
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                step.key === currentStep
                  ? 'bg-primary text-white'
                  : steps.findIndex(s => s.key === currentStep) > index
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {steps.findIndex(s => s.key === currentStep) > index ? (
                <CheckCircleIcon className="w-5 h-5" />
              ) : (
                index + 1
              )}
            </div>
            {index < steps.length - 1 && (
              <div
                className={`w-12 h-1 ${
                  steps.findIndex(s => s.key === currentStep) > index
                    ? 'bg-green-500'
                    : 'bg-gray-200'
                }`}
              />
            )}
          </Fragment>
        ))}
      </div>
    );
  };

  const renderEmailSelection = () => (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Select a site user or enter an email address to receive the verification code.
      </p>

      {/* Search/Filter */}
      <div>
        <label htmlFor="search-users" className="block text-sm font-medium text-gray-700 mb-1">
          Search Users
        </label>
        <input
          id="search-users"
          type="text"
          placeholder="Search by name, email, or position..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* User List */}
      <div className="max-h-48 overflow-y-auto border rounded-md">
        {loadingUsers ? (
          <div className="p-4 text-center text-gray-500">Loading users...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            {searchQuery ? 'No users match your search' : 'No site users found'}
          </div>
        ) : (
          <div className="divide-y">
            {filteredUsers.map((user) => (
              <button
                key={user.email}
                type="button"
                onClick={() => {
                  setSelectedEmail(user.email);
                  setManualEmail('');
                  setSignerName(user.name);
                  setSignerPosition(user.position || 'physicist');
                }}
                className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                  selectedEmail === user.email ? 'bg-primary/10 border-l-4 border-primary' : ''
                }`}
              >
                <div className="font-medium text-gray-900">{user.name}</div>
                <div className="text-sm text-gray-500">{user.email}</div>
                <div className="text-xs text-gray-400 capitalize">{user.position}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Manual Email Entry */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white px-2 text-gray-500">Or enter manually</span>
        </div>
      </div>

      <div>
        <label htmlFor="manual-email" className="block text-sm font-medium text-gray-700 mb-1">
          Email Address
        </label>
        <input
          id="manual-email"
          type="email"
          placeholder="Enter email manually..."
          value={manualEmail}
          onChange={(e) => {
            setManualEmail(e.target.value);
            setSelectedEmail('');
          }}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Selected Email Display */}
      {getEffectiveEmail() && (
        <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-md">
          <EnvelopeIcon className="w-5 h-5 text-primary" />
          <span className="text-sm text-primary">
            Code will be sent to: <strong>{getEffectiveEmail()}</strong>
          </span>
        </div>
      )}

      <button
        onClick={handleSendCode}
        disabled={loading || !getEffectiveEmail()}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
      >
        {loading ? 'Sending...' : 'Send Verification Code'}
      </button>
    </div>
  );

  const renderCodeEntry = () => (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        A 6-digit verification code has been sent to <strong>{getEffectiveEmail()}</strong>
      </p>

      <div>
        <label htmlFor="verification-code" className="block text-sm font-medium text-gray-700 mb-1">
          Verification Code
        </label>
        <input
          id="verification-code"
          type="text"
          inputMode="numeric"
          placeholder="Enter 6-digit code..."
          value={verificationCode}
          onChange={handleCodeChange}
          maxLength={6}
          className="w-full rounded-md border border-gray-300 px-3 py-3 text-center text-2xl tracking-widest font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          autoFocus
        />
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className={`${attemptsRemaining <= 1 ? 'text-red-600' : 'text-gray-500'}`}>
          {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining
        </span>
        {canResend ? (
          <button
            onClick={handleResendCode}
            disabled={loading}
            className="text-primary hover:text-primary/80 font-medium"
          >
            Resend Code
          </button>
        ) : (
          <span className="text-gray-400">
            Resend in {resendCountdown}s
          </span>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleBack}
          disabled={loading}
          className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
        >
          Back
        </button>
        <button
          onClick={() => setCurrentStep('signature_details')}
          disabled={loading || verificationCode.length !== 6}
          className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    </div>
  );

  // Render continuation notice for treatments that continue from a previous session
  const renderContinuationNotice = () => {
    if (!isContinuation) return null;

    return (
      <div className="mb-4 p-4 bg-amber-50 rounded-lg border-2 border-amber-300">
        <div className="flex items-start gap-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold">Continuation Treatment</p>
            <p className="mt-1">
              This is a continuation of a previously finalized treatment. The PDF will include a notice
              referencing the original treatment record.
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderSignatureDetails = () => (
    <div className="space-y-4">
      {renderContinuationNotice()}

      <p className="text-sm text-gray-600">
        Please confirm your signature details to finalize the treatment.
      </p>

      <div>
        <label htmlFor="signer-name" className="block text-sm font-medium text-gray-700 mb-1">
          Full Name <span className="text-red-500">*</span>
        </label>
        <input
          id="signer-name"
          type="text"
          placeholder="Enter your full name..."
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div>
        <label htmlFor="signer-position" className="block text-sm font-medium text-gray-700 mb-1">
          Position <span className="text-red-500">*</span>
        </label>
        <select
          id="signer-position"
          value={signerPosition}
          onChange={(e) => setSignerPosition(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="physicist">Physicist</option>
          <option value="doctor">Doctor</option>
          <option value="admin">Administrator</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Signature Date
        </label>
        <div className="px-3 py-2 bg-gray-50 rounded-md text-sm text-gray-600">
          {new Date().toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>

      <div className="p-4 bg-amber-50 rounded-md border border-amber-200">
        <div className="flex items-start gap-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-medium">Important</p>
            <p>By clicking "Approve & Finalize", you are digitally signing this treatment report. This action cannot be undone.</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleBack}
          disabled={loading}
          className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
        >
          Back
        </button>
        <button
          onClick={handleVerifyAndFinalize}
          disabled={loading || !signerName.trim()}
          className="flex-1 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Approve & Finalize'}
        </button>
      </div>
    </div>
  );

  const renderHospitalConfirmation = () => (
    <div className="space-y-4">
      {renderContinuationNotice()}

      <p className="text-sm text-gray-600">
        Please confirm your signature details to finalize the treatment record.
      </p>

      {/* User Info Display */}
      <div className="p-4 bg-gray-50 rounded-lg space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Name</span>
          <span className="text-sm font-medium text-gray-900">{signerName || userData?.name || 'Not available'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Position</span>
          <span className="text-sm font-medium text-gray-900 capitalize">{signerPosition || userData?.position || 'Not specified'}</span>
        </div>
        {userData?.site && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Site</span>
            <span className="text-sm font-medium text-gray-900">{userData.site}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Date</span>
          <span className="text-sm font-medium text-gray-900">
            {new Date().toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      </div>

      {/* Editable Name field (in case user wants to change it) */}
      <div>
        <label htmlFor="hospital-signer-name" className="block text-sm font-medium text-gray-700 mb-1">
          Full Name <span className="text-red-500">*</span>
        </label>
        <input
          id="hospital-signer-name"
          type="text"
          placeholder="Enter your full name..."
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Position Dropdown */}
      <div>
        <label htmlFor="hospital-signer-position" className="block text-sm font-medium text-gray-700 mb-1">
          Position <span className="text-red-500">*</span>
        </label>
        <select
          id="hospital-signer-position"
          value={signerPosition}
          onChange={(e) => setSignerPosition(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="physicist">Physicist</option>
          <option value="physician">Physician</option>
          <option value="doctor">Doctor</option>
          <option value="nurse">Nurse</option>
          <option value="technician">Technician</option>
          <option value="admin">Administrator</option>
        </select>
      </div>

      {/* Confirmation Checkbox */}
      <div className="flex items-start gap-3 p-4 bg-primary/10 rounded-lg border border-primary/20">
        <input
          id="hospital-confirm"
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
        />
        <label htmlFor="hospital-confirm" className="text-sm text-primary cursor-pointer">
          <span className="font-medium">I confirm</span> that this treatment record is complete and accurate.
          By clicking "Sign & Finalize", I am digitally signing this record.
        </label>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onClose}
          disabled={loading}
          className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleHospitalAutoFinalize}
          disabled={loading || !confirmed || !signerName.trim()}
          className="flex-1 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            'Processing...'
          ) : (
            <>
              <CheckIcon className="w-4 h-4" />
              Sign & Finalize
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900"
                  >
                    {flowType === 'hospital_auto' ? 'Sign Treatment Record' : 'Digital Signature Verification'}
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="rounded-full p-1 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary"
                    aria-label="Close"
                  >
                    <XMarkIcon className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                {/* Step Indicator - only shown for alphatau verification flow */}
                {flowType === 'alphatau_verification' && renderStepIndicator()}

                {/* Error Message */}
                {error && (
                  <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                {/* Step Content */}
                {currentStep === 'email_selection' && renderEmailSelection()}
                {currentStep === 'code_entry' && renderCodeEntry()}
                {currentStep === 'signature_details' && renderSignatureDetails()}
                {currentStep === 'hospital_confirmation' && renderHospitalConfirmation()}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default SignatureModal;
