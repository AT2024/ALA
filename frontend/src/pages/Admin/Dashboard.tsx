import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';

const Dashboard = () => {
  const { user, setTestModeEnabled } = useAuth();
  const [activeTab, setActiveTab] = useState<'stats' | 'logs' | 'config'>('stats');
  const [testModeEnabled, setLocalTestModeEnabled] = useState(user?.testModeEnabled || false);
  const [isTogglingTestMode, setIsTogglingTestMode] = useState(false);

  // In a real app, we would fetch these stats from an API
  const stats = {
    totalTreatments: 156,
    completedTreatments: 142,
    pendingTreatments: 14,
    totalApplicators: 843,
    users: 27,
  };

  // Sync local state with user state
  useEffect(() => {
    setLocalTestModeEnabled(user?.testModeEnabled || false);
  }, [user?.testModeEnabled]);

  // Handle test mode toggle
  const handleTestModeToggle = async () => {
    setIsTogglingTestMode(true);
    try {
      const newState = !testModeEnabled;
      const response = await api.put('/admin/test-mode', { enabled: newState });
      if (response.data.success) {
        setLocalTestModeEnabled(response.data.testModeEnabled);
        setTestModeEnabled(response.data.testModeEnabled);
      }
    } catch (error) {
      console.error('Failed to toggle test mode:', error);
      alert('Failed to toggle test mode. Please try again.');
    } finally {
      setIsTogglingTestMode(false);
    }
  };
  
  useEffect(() => {
    if (user?.role !== 'admin') {
      // Redirect non-admin users
      window.location.href = '/treatment/select';
    }
  }, [user]);

  if (user?.role !== 'admin') {
    return (
      <Layout title="Admin Dashboard">
        <div className="flex items-center justify-center py-10">
          <p>You do not have permission to access this page.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Admin Dashboard">
      <div className="space-y-6">
        <div className="mb-4 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('stats')}
              className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium ${
                activeTab === 'stats'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              Statistics
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium ${
                activeTab === 'logs'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              System Logs
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium ${
                activeTab === 'config'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              Configuration
            </button>
          </nav>
        </div>

        {activeTab === 'stats' && (
          <div>
            <h2 className="mb-6 text-xl font-medium">System Statistics</h2>
            
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <div className="overflow-hidden rounded-lg bg-white shadow">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="truncate text-sm font-medium text-gray-500">Total Treatments</dt>
                        <dd>
                          <div className="text-lg font-medium text-gray-900">{stats.totalTreatments}</div>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-5 py-3">
                  <div className="text-sm">
                    <span className="font-medium text-green-600">{stats.completedTreatments} completed</span>
                    <span className="mx-2 text-gray-500">•</span>
                    <span className="font-medium text-yellow-600">{stats.pendingTreatments} pending</span>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg bg-white shadow">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="truncate text-sm font-medium text-gray-500">Total Applicators</dt>
                        <dd>
                          <div className="text-lg font-medium text-gray-900">{stats.totalApplicators}</div>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-5 py-3">
                  <div className="text-sm">
                    <span className="font-medium text-gray-600">Used in treatments</span>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg bg-white shadow">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="truncate text-sm font-medium text-gray-500">Registered Users</dt>
                        <dd>
                          <div className="text-lg font-medium text-gray-900">{stats.users}</div>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-5 py-3">
                  <div className="text-sm">
                    <span className="font-medium text-gray-600">Active in system</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-lg border bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-medium">Recent Activity</h3>
              <p className="text-gray-500">Activity chart would go here...</p>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div>
            <h2 className="mb-6 text-xl font-medium">System Logs</h2>
            
            <div className="rounded-lg border bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">Event Log</h3>
                  <p className="text-sm text-gray-500">System events and notifications</p>
                </div>
                <div>
                  <select className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-primary">
                    <option value="all">All Events</option>
                    <option value="error">Errors</option>
                    <option value="warning">Warnings</option>
                    <option value="info">Info</option>
                  </select>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Timestamp
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Level
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Message
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        User
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {/* Sample log entries */}
                    <tr>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        2025-05-10 09:45:21
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <span className="inline-flex rounded-full bg-green-100 px-2 text-xs font-semibold leading-5 text-green-800">
                          INFO
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        User logged in successfully
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        john.doe@example.com
                      </td>
                    </tr>
                    <tr>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        2025-05-10 08:32:15
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <span className="inline-flex rounded-full bg-yellow-100 px-2 text-xs font-semibold leading-5 text-yellow-800">
                          WARNING
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        Multiple verification attempts detected
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        sarah.smith@example.com
                      </td>
                    </tr>
                    <tr>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        2025-05-09 17:12:53
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <span className="inline-flex rounded-full bg-red-100 px-2 text-xs font-semibold leading-5 text-red-800">
                          ERROR
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        Failed to connect to Priority system
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        System
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'config' && (
          <div>
            <h2 className="mb-6 text-xl font-medium">System Configuration</h2>
            
            <div className="rounded-lg border bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-medium">Application Settings</h3>

              <div className="space-y-6">
                <div>
                  <h4 className="mb-2 text-sm font-medium text-gray-700">Priority System Integration</h4>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="priority-url" className="block text-xs font-medium text-gray-500">API URL</label>
                      <input
                        id="priority-url"
                        type="text"
                        value="https://t.eu.priority-connect.online/odata/Priority/tabbtbc6.ini/test24/"
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="priority-timeout" className="block text-xs font-medium text-gray-500">Request Timeout (ms)</label>
                      <input
                        id="priority-timeout"
                        type="number"
                        value={30000}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="mb-2 text-sm font-medium text-gray-700">Verification Settings</h4>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="code-expiry" className="block text-xs font-medium text-gray-500">Code Expiry (seconds)</label>
                      <input
                        id="code-expiry"
                        type="number"
                        value={600}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="max-attempts" className="block text-xs font-medium text-gray-500">Max Failed Attempts</label>
                      <input
                        id="max-attempts"
                        type="number"
                        value={3}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="mb-2 text-sm font-medium text-gray-700">Treatment Configuration</h4>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="removal-min-days" className="block text-xs font-medium text-gray-500">Min Days for Removal</label>
                      <input
                        id="removal-min-days"
                        type="number"
                        value={14}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="removal-max-days" className="block text-xs font-medium text-gray-500">Max Days for Removal</label>
                      <input
                        id="removal-max-days"
                        type="number"
                        value={20}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="button"
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  >
                    Save Configuration
                  </button>
                </div>
              </div>
            </div>

            {/* Test Mode Section - Development Tools */}
            <div className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-medium">Development Tools</h3>
              <div className="flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50 p-4">
                <div>
                  <label htmlFor="test-mode-toggle" className="text-sm font-medium text-gray-900">
                    Test Mode
                  </label>
                  <p className="text-xs text-gray-600 mt-1">
                    Enable to use test data instead of Priority API data.
                    This is useful for testing without affecting real data.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {testModeEnabled && (
                    <span className="rounded-full bg-orange-200 px-2 py-0.5 text-xs font-medium text-orange-800">
                      ACTIVE
                    </span>
                  )}
                  <button
                    id="test-mode-toggle"
                    onClick={handleTestModeToggle}
                    disabled={isTogglingTestMode}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
                      testModeEnabled ? 'bg-orange-500' : 'bg-gray-300'
                    } ${isTogglingTestMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                    role="switch"
                    aria-checked={testModeEnabled}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        testModeEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
              {testModeEnabled && (
                <p className="mt-3 text-xs text-orange-700">
                  Test mode is active. All Priority data fetches will return simulated test data.
                  Disable when you want to use real Priority API data.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Dashboard;
