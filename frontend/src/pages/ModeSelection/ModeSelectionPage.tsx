import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import Layout from '@/components/Layout';
import api from '@/services/api';

type ModeType = 'normal' | 'test';

const ModeSelectionPage = () => {
  const navigate = useNavigate();
  const { user, setTestModeEnabled } = useAuth();
  const [selectedMode, setSelectedMode] = useState<ModeType | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Redirect non-admin users
  if (user?.positionCode !== '99') {
    navigate('/procedure-type');
    return null;
  }

  const handleProceedClick = async () => {
    if (!selectedMode) return;

    setIsLoading(true);
    try {
      const isTestMode = selectedMode === 'test';

      // Save mode selection to backend
      const response = await api.put('/admin/test-mode', { enabled: isTestMode });

      if (response.data.success) {
        // Update local state
        setTestModeEnabled(isTestMode);
      }

      // Navigate to procedure selection
      navigate('/procedure-type');
    } catch (error) {
      console.error('Failed to set mode:', error);
      // Still navigate even if API fails - mode defaults to normal
      navigate('/procedure-type');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout title="Select Mode" showBackButton={false}>
      <div className="mx-auto max-w-md space-y-6">
        <div className="rounded-lg border bg-white p-6 shadow-md">
          <h2 className="mb-2 text-xl font-medium text-center">Welcome, {user?.name || 'Admin'}</h2>
          <p className="mb-6 text-sm text-gray-500 text-center">
            Choose how you want to work today
          </p>

          <div className="flex flex-col gap-4">
            {/* Normal Mode Button */}
            <button
              onClick={() => setSelectedMode('normal')}
              className={`flex items-center justify-between rounded-lg border p-4 transition-all ${
                selectedMode === 'normal'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 hover:border-green-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`rounded-full p-2 ${
                  selectedMode === 'normal' ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={selectedMode === 'normal' ? 'text-green-600' : 'text-gray-500'}>
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                </div>
                <div className="text-left">
                  <h3 className="font-medium">Normal Mode</h3>
                  <p className="text-sm text-gray-500">Use real Priority API data</p>
                </div>
              </div>
              {selectedMode === 'normal' && (
                <div className="rounded-full bg-green-500 p-1 text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5"></path>
                  </svg>
                </div>
              )}
            </button>

            {/* Test Mode Button */}
            <button
              onClick={() => setSelectedMode('test')}
              className={`flex items-center justify-between rounded-lg border p-4 transition-all ${
                selectedMode === 'test'
                  ? 'border-orange-500 bg-orange-50 text-orange-700'
                  : 'border-gray-200 hover:border-orange-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`rounded-full p-2 ${
                  selectedMode === 'test' ? 'bg-orange-100' : 'bg-gray-100'
                }`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={selectedMode === 'test' ? 'text-orange-600' : 'text-gray-500'}>
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="12" y1="18" x2="12" y2="12"></line>
                    <line x1="9" y1="15" x2="15" y2="15"></line>
                  </svg>
                </div>
                <div className="text-left">
                  <h3 className="font-medium">Test Mode</h3>
                  <p className="text-sm text-gray-500">Use simulated test data</p>
                </div>
              </div>
              {selectedMode === 'test' && (
                <div className="rounded-full bg-orange-500 p-1 text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5"></path>
                  </svg>
                </div>
              )}
            </button>
          </div>

          {selectedMode === 'test' && (
            <div className="mt-4 rounded-md bg-orange-100 p-3 text-sm text-orange-800">
              <strong>Test Mode:</strong> All data will be simulated. No real Priority API calls will be made.
              An orange banner will be visible at all times.
            </div>
          )}

          <div className="mt-8">
            <button
              onClick={handleProceedClick}
              disabled={!selectedMode || isLoading}
              className={`w-full rounded-md py-2 px-4 font-medium text-white shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${
                selectedMode === 'test'
                  ? 'bg-orange-500 hover:bg-orange-600 focus:ring-orange-500'
                  : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
              }`}
            >
              {isLoading ? 'Setting up...' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ModeSelectionPage;
