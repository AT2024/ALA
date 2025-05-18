import { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/services/authService';

interface User {
  id: string;
  email: string;
  phoneNumber: string;
  role: 'hospital' | 'alphatau' | 'admin';
  name: string;
  positionCode?: string;
  custName?: string;
  sites?: string[];
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
    const checkAuth = async () => {
      try {
        const storedUser = localStorage.getItem('user');
        const token = localStorage.getItem('token');
        
        if (storedUser && token) {
          // Validate token with backend
          const valid = await authService.validateToken(token);
          
          if (valid) {
            setUser(JSON.parse(storedUser));
          } else {
            // Token invalid, remove from storage
            localStorage.removeItem('user');
            localStorage.removeItem('token');
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
      
      // Store user data if provided (for session persistence)
      if (result.userData) {
        sessionStorage.setItem('priorityUserData', JSON.stringify(result.userData));
      }
      
      return { success: true, message: 'Verification code sent successfully' };
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
      const result = await authService.verifyCode(loginIdentifier, code);
      setUser(result.user);
      
      // Store auth data in localStorage for persistence
      localStorage.setItem('user', JSON.stringify(result.user));
      localStorage.setItem('token', result.token);
      
      navigate('/treatment/select');
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    sessionStorage.removeItem('priorityUserData');
    navigate('/login');
  };

  const clearError = () => {
    setError(null);
  };

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
        clearError
      }}
    >
      {children}
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
