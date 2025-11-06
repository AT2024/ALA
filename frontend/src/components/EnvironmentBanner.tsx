import { useEffect } from 'react';

/**
 * Environment Banner Component
 *
 * Displays a persistent banner at the top of the page indicating the current environment.
 * This provides unmistakable visual differentiation between staging and production.
 *
 * Features:
 * - Yellow/orange banner for staging (impossible to miss)
 * - No banner for production/local (clean UI)
 * - Always visible in staging, cannot be dismissed
 * - Updates browser tab title to match environment
 * - Detects environment based on API URL port
 * - Provides isStaging flag for conditional padding in parent components
 *
 * Environment Detection:
 * - Staging: API URL contains ":5010" (staging backend port) or window location port 9443/9080 (staging HTTPS/HTTP)
 * - Production/Local: All other URLs (standard ports 443/5000 or localhost)
 */

// Export helper function to detect staging environment
export function useIsStaging(): boolean {
  const apiUrl = import.meta.env.VITE_API_URL || '';
  const currentPort = window.location.port;
  return apiUrl.includes(':5010') || currentPort === '9443' || currentPort === '9080';
}

export function EnvironmentBanner() {
  const isStaging = useIsStaging();

  useEffect(() => {
    // Update browser tab title to match environment
    if (isStaging) {
      document.title = '🧪 [STAGING] ALA Medical';
    } else {
      document.title = 'ALA Medical System';
    }
  }, [isStaging]);

  if (isStaging) {
    return (
      <div className="bg-yellow-500 text-black px-4 py-2 text-center font-bold fixed top-0 left-0 right-0 z-50 shadow-lg">
        <div className="flex items-center justify-center gap-2">
          <span className="text-2xl">🧪</span>
          <span className="text-lg">STAGING ENVIRONMENT - TEST DATA ONLY - NOT PRODUCTION</span>
          <span className="text-2xl">🧪</span>
        </div>
        <div className="text-sm mt-1">
          This is a testing environment. Changes here do not affect production.
        </div>
      </div>
    );
  }

  // Production environment - no banner needed
  return null;
}
