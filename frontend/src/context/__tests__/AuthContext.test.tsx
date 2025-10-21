import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '../AuthContext';
import { authService } from '@/services/authService';
import { priorityService } from '@/services/priorityService';

// Mock the services
vi.mock('@/services/authService');
vi.mock('@/services/priorityService');

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      <AuthProvider>{children}</AuthProvider>
    </BrowserRouter>
  );

  describe('useAuth hook', () => {
    it('should throw error when used outside AuthProvider', () => {
      // Suppress console error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleSpy.mockRestore();
    });

    it('should provide auth context when used within AuthProvider', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current).toHaveProperty('user');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('isAuthenticated');
      expect(result.current).toHaveProperty('login');
      expect(result.current).toHaveProperty('verify');
      expect(result.current).toHaveProperty('logout');
      expect(result.current).toHaveProperty('clearError');
    });
  });

  describe('Initial state', () => {
    it('should start with null user and loading state', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.user).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should validate stored token on mount', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        phoneNumber: '+1234567890',
        role: 'hospital' as const,
        name: 'Test User',
      };

      localStorage.setItem('user', JSON.stringify(mockUser));
      localStorage.setItem('token', 'valid-token');

      vi.mocked(authService.validateToken).mockResolvedValue(true);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should clear invalid token on mount', async () => {
      localStorage.setItem('user', JSON.stringify({ id: '1', email: 'test@example.com' }));
      localStorage.setItem('token', 'invalid-token');

      vi.mocked(authService.validateToken).mockResolvedValue(false);
      vi.mocked(priorityService.clearCache).mockImplementation(() => {});

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
      expect(priorityService.clearCache).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should successfully request verification code', async () => {
      vi.mocked(authService.requestVerificationCode).mockResolvedValue({
        success: true,
        message: 'Code sent',
        userData: {
          name: 'Test User',
          email: 'test@example.com',
          phoneNumber: '+1234567890',
          positionCode: '10',
          custName: 'Test Hospital',
        },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const response = await result.current.login('test@example.com');

      expect(response?.success).toBe(true);
      expect(authService.requestVerificationCode).toHaveBeenCalledWith('test@example.com');
      expect(sessionStorage.getItem('loginIdentifier')).toBe('test@example.com');
    });

    it('should handle login failure', async () => {
      vi.mocked(authService.requestVerificationCode).mockResolvedValue({
        success: false,
        message: 'User not found',
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const response = await result.current.login('invalid@example.com');

      expect(response?.success).toBe(false);
      expect(result.current.error).toBe('User not found');
    });

    it('should store Priority user data in session', async () => {
      const mockUserData = {
        name: 'Test User',
        email: 'test@example.com',
        phoneNumber: '+1234567890',
        positionCode: '10',
        custName: 'Test Hospital',
      };

      vi.mocked(authService.requestVerificationCode).mockResolvedValue({
        success: true,
        userData: mockUserData,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.login('test@example.com');

      expect(sessionStorage.getItem('priorityUserData')).toBe(JSON.stringify(mockUserData));
    });
  });

  describe('verify', () => {
    it('should successfully verify code and authenticate user', async () => {
      const mockAuthResponse = {
        user: {
          id: '1',
          email: 'test@example.com',
          phoneNumber: '+1234567890',
          role: 'hospital' as const,
          name: 'Test User',
          positionCode: '10',
        },
        token: 'auth-token-123',
      };

      sessionStorage.setItem('loginIdentifier', 'test@example.com');
      vi.mocked(authService.verifyCode).mockResolvedValue(mockAuthResponse);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.verify('123456');

      await waitFor(() => {
        expect(result.current.user).toEqual(mockAuthResponse.user);
      });

      expect(localStorage.getItem('user')).toBe(JSON.stringify(mockAuthResponse.user));
      expect(localStorage.getItem('token')).toBe('auth-token-123');
      expect(mockNavigate).toHaveBeenCalledWith('/procedure-type');
      expect(sessionStorage.getItem('loginIdentifier')).toBeNull();
    });

    it('should handle verification failure', async () => {
      sessionStorage.setItem('loginIdentifier', 'test@example.com');
      vi.mocked(authService.verifyCode).mockRejectedValue(new Error('Invalid code'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.verify('000000');

      await waitFor(() => {
        expect(result.current.error).toBe('Invalid code');
      });

      expect(result.current.user).toBeNull();
    });

    it('should throw error if no login identifier found', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.verify('123456');

      await waitFor(() => {
        expect(result.current.error).toContain('No login identifier found');
      });
    });
  });

  describe('logout', () => {
    it('should clear all user data and navigate to login', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        phoneNumber: '+1234567890',
        role: 'hospital' as const,
        name: 'Test User',
      };

      localStorage.setItem('user', JSON.stringify(mockUser));
      localStorage.setItem('token', 'auth-token');
      sessionStorage.setItem('loginIdentifier', 'test@example.com');
      vi.mocked(priorityService.clearCache).mockImplementation(() => {});

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).not.toBeNull();
      });

      result.current.logout();

      expect(result.current.user).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
      expect(localStorage.getItem('token')).toBeNull();
      expect(sessionStorage.getItem('loginIdentifier')).toBeNull();
      expect(priorityService.clearCache).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  describe('clearError', () => {
    it('should clear error state', async () => {
      vi.mocked(authService.requestVerificationCode).mockResolvedValue({
        success: false,
        message: 'Test error',
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.login('test@example.com');

      await waitFor(() => {
        expect(result.current.error).toBe('Test error');
      });

      result.current.clearError();

      expect(result.current.error).toBeNull();
    });
  });
});
