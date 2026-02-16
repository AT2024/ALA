import { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/services/authService';
import { priorityService } from '@/services/priorityService';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';
import { encryptionKeyService } from '@/services/encryptionKeyService';
import api from '@/services/api';

interface User {
  id: string;
  email: string;
  phoneNumber: string;
  role: 'hospital' | 'alphatau' | 'admin';
  name: string;
  positionCode?: string;
  custName?: string;
  sites?: Array<{ custName: string; custDes: string }> | string[];
  fullAccess?: boolean;
  testModeEnabled?: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (identifier: string) => Promise<{success: boolean; message?: string} | undefined>;
  verify: (code: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  // Idle timeout state for UI
  isIdleWarningShown: boolean;
  idleSecondsRemaining: number;
  dismissIdleWarning: () => void;
  // Test mode support
  setTestModeEnabled: (enabled: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [loginIdentifier, setLoginIdentifier] = useState<string>('');
  const navigate = useNavigate();

  useEffect(() => {
    // Check for user in local storage on initial load
    // Token is now in HttpOnly cookie (handled automatically by browser)
    const checkAuth = async () => {
      try {
        const storedUser = localStorage.getItem('user');

        if (storedUser) {
          // Validate session with backend (cookie is sent automatically)
          // We pass empty string since token is in HttpOnly cookie now
          const valid = await authService.validateToken('');

          if (valid) {
            setUser(JSON.parse(storedUser));
          } else {
            // Session invalid, clear local storage and cache
            localStorage.removeItem('user');
            try {
              priorityService.clearCache();
            } catch (error) {
              console.warn('Error clearing Priority cache on invalid session:', error);
            }
          }
        }
      } catch (err) {
        console.error('Auth check error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (identifier: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await authService.requestVerificationCode(identifier);
      
      if (!result.success) {
        setError(result.message || 'Login failed. Please try again.');
        return { success: false, message: result.message };
      }
      
      // Store the identifier for verification
      setLoginIdentifier(identifier);
      sessionStorage.setItem('loginIdentifier', identifier);
      
      // Store Priority user data if provided (for session persistence)
      if (result.userData) {
        sessionStorage.setItem('priorityUserData', JSON.stringify(result.userData));
      }
      
      return { 
        success: true, 
        message: result.message || 'Verification code sent successfully' 
      };
    } catch (err: any) {
      const errorMessage = err.message || 'Login failed. Please try again.';
      setError(errorMessage);
      return { success: false, message: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const verify = async (code: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Get stored identifier if not in state
      const identifier = loginIdentifier || sessionStorage.getItem('loginIdentifier') || '';
      
      if (!identifier) {
        throw new Error('No login identifier found. Please start the login process again.');
      }
      
      const result = await authService.verifyCode(identifier, code);

      setUser(result.user);

      // Store user info in localStorage for UI purposes only
      // Token is now stored in HttpOnly cookie by backend (OWASP security best practice)
      // The cookie is automatically managed by browser - not accessible via JavaScript
      localStorage.setItem('user', JSON.stringify(result.user));

      // Store encryption key material for offline PHI encryption
      // This allows the app to derive the same encryption key on page refresh
      await encryptionKeyService.storeCredentialMaterial(
        result.user.id,
        identifier,
        code
      );

      // Clear session storage
      sessionStorage.removeItem('loginIdentifier');
      sessionStorage.removeItem('priorityUserData');

      // Navigate based on user role
      // Admin users (positionCode=99) go to mode selection first
      if (result.user.positionCode === '99') {
        navigate('/mode-select');
      } else {
        navigate('/procedure-type');
      }
    } catch (err: any) {
      console.error('Verification error:', err);
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    // Call logout API to clear HttpOnly auth cookie on server
    try {
      await authService.logout();
    } catch (error) {
      console.warn('Logout API call failed, continuing with local cleanup:', error);
    }

    setUser(null);
    setLoginIdentifier('');

    // Clear all stored data
    localStorage.removeItem('user');
    sessionStorage.removeItem('loginIdentifier');
    sessionStorage.removeItem('priorityUserData');

    // Clear Priority service cache to prevent data leakage between users
    try {
      priorityService.clearCache();
    } catch (error) {
      console.warn('Error clearing Priority cache:', error);
    }

    // Clear encryption key material to prevent access to previous user's offline data
    encryptionKeyService.clearMaterial();

    navigate('/login');
  };

  const clearError = () => {
    setError(null);
  };

  // HIPAA-compliant idle session timeout (15 minutes)
  // Only active when user is authenticated
  const handleIdleTimeout = useCallback(async () => {
    if (user) {
      console.warn('Session expired due to inactivity (HIPAA compliance)');
      // Log session timeout for HIPAA audit trail
      try {
        await api.post('/auth/session-timeout');
      } catch (error) {
        console.warn('Failed to log session timeout:', error);
      }
      logout();
    }
  }, [user]);

  const handleIdleWarning = useCallback(() => {
    // Warning is shown via the isIdleWarningShown state
    console.info('Session expiring in 1 minute due to inactivity');
  }, []);

  const { isWarningShown, secondsRemaining, resetTimer } = useIdleTimeout({
    onTimeout: handleIdleTimeout,
    onWarning: handleIdleWarning,
    enabled: !!user // Only enable when user is logged in
  });

  const dismissIdleWarning = useCallback(() => {
    // Reset the timer when user dismisses warning (user activity)
    resetTimer();
  }, [resetTimer]);

  // Update user's test mode state (called from Admin Dashboard)
  const setTestModeEnabled = useCallback((enabled: boolean) => {
    if (user) {
      const updatedUser = { ...user, testModeEnabled: enabled };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        isAuthenticated: !!user,
        login,
        verify,
        logout,
        clearError,
        isIdleWarningShown: isWarningShown,
        idleSecondsRemaining: secondsRemaining,
        dismissIdleWarning,
        setTestModeEnabled
      }}
    >
      {children}
      {/* Idle timeout warning modal */}
      {isWarningShown && user && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Session Expiring Soon
            </h2>
            <p className="text-gray-600 mb-4">
              For your security, your session will expire in{' '}
              <span className="font-bold text-red-600">{secondsRemaining}</span>{' '}
              seconds due to inactivity.
            </p>
            <p className="text-sm text-gray-500 mb-4">
              This is required for HIPAA compliance to protect patient data.
            </p>
            <button
              onClick={dismissIdleWarning}
              className="w-full bg-primary text-white py-2 px-4 rounded-lg hover:bg-primary/90 transition-colors"
            >
              Stay Logged In
            </button>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
