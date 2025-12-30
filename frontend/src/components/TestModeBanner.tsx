import { useAuth } from '@/context/AuthContext';

/**
 * Test Mode Banner Component
 *
 * Displays a persistent orange banner at the top of the page when test mode is active.
 * This provides unmistakable visual indication that the user is viewing test data.
 *
 * Features:
 * - Orange banner for test mode (impossible to miss)
 * - Only visible when testModeEnabled is true for the current user
 * - Always visible in test mode, cannot be dismissed
 * - Works alongside the EnvironmentBanner (staging indicator)
 */
export function TestModeBanner() {
  const { user } = useAuth();

  if (!user?.testModeEnabled) {
    return null;
  }

  return (
    <div className="bg-orange-500 text-white px-4 py-2 text-center font-bold fixed top-0 left-0 right-0 z-50 shadow-lg">
      <div className="flex items-center justify-center gap-2">
        <span className="text-lg">🧪</span>
        <span>TEST MODE ACTIVE - Using simulated data</span>
        <span className="text-lg">🧪</span>
      </div>
    </div>
  );
}

/**
 * Hook to check if test mode is active
 * Useful for components that need to adjust padding when the banner is visible
 */
export function useIsTestMode(): boolean {
  const { user } = useAuth();
  return user?.testModeEnabled || false;
}
