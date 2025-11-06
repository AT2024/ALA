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
 * - Uses explicit VITE_ENVIRONMENT variable for reliable detection
 * - Provides isStaging flag for conditional padding in parent components
 *
 * Environment Detection:
 * - Staging: VITE_ENVIRONMENT === 'staging'
 * - Production: VITE_ENVIRONMENT === 'production' (or unset)
 * - Development/Local: VITE_ENVIRONMENT === 'development' (or unset)
 */

// Export helper function to detect staging environment
export function useIsStaging(): boolean {
  // Use explicit environment variable for reliable detection
  // Defaults to 'production' if not set for safety
  const environment = import.meta.env.VITE_ENVIRONMENT || 'production';
  return environment === 'staging';
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
