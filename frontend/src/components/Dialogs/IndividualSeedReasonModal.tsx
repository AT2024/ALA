import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface IndividualSeedReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string, customText?: string) => void;
}

const PREDEFINED_REASONS = [
  { value: 'applicator_rupture', label: 'Applicator rupture' },
  { value: 'patient_arrived_from_home', label: 'Patient arrived from home' },
  { value: 'other', label: 'Other' },
];

const IndividualSeedReasonModal = ({
  isOpen,
  onClose,
  onConfirm,
}: IndividualSeedReasonModalProps) => {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customText, setCustomText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    if (!selectedReason) {
      setError('Please select a reason');
      return;
    }
    if (selectedReason === 'other' && !customText.trim()) {
      setError('Please enter a reason');
      return;
    }

    const reason = selectedReason === 'other'
      ? customText.trim()
      : PREDEFINED_REASONS.find(r => r.value === selectedReason)?.label || selectedReason;

    onConfirm(reason, selectedReason === 'other' ? customText.trim() : undefined);

    // Reset state
    setSelectedReason('');
    setCustomText('');
    setError(null);
  };

  const handleClose = () => {
    setSelectedReason('');
    setCustomText('');
    setError(null);
    onClose();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
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
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title className="text-lg font-medium text-gray-900">
                    Add Individual Source Removal
                  </Dialog.Title>
                  <button
                    onClick={handleClose}
                    className="rounded-full p-1 hover:bg-gray-100"
                  >
                    <XMarkIcon className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                <p className="text-sm text-gray-600 mb-4">
                  Please select a reason for removing this individual source.
                </p>

                {error && (
                  <div className="mb-4 p-3 rounded-md bg-red-50 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div className="space-y-3 mb-4">
                  {PREDEFINED_REASONS.map((reason) => (
                    <label
                      key={reason.value}
                      className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedReason === reason.value
                          ? 'border-primary bg-primary/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="reason"
                        value={reason.value}
                        checked={selectedReason === reason.value}
                        onChange={(e) => setSelectedReason(e.target.value)}
                        className="h-4 w-4 text-primary focus:ring-primary"
                      />
                      <span className="ml-3 text-sm font-medium text-gray-900">
                        {reason.label}
                      </span>
                    </label>
                  ))}
                </div>

                {selectedReason === 'other' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Please specify <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      rows={2}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="Enter reason for source removal..."
                    />
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleClose}
                    className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={!selectedReason || (selectedReason === 'other' && !customText.trim())}
                    className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                  >
                    Confirm Removal
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default IndividualSeedReasonModal;
