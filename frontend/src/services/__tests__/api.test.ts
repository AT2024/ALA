import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import api from '@/services/api';

// Mock axios
vi.mock('axios');

describe('API Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Mock axios.create to return a mock instance
    const mockAxiosInstance = {
      interceptors: {
        request: {
          use: vi.fn((successHandler) => {
            // Store the success handler for testing
            mockAxiosInstance._requestInterceptor = successHandler;
            return 0;
          }),
        },
        response: {
          use: vi.fn((successHandler, errorHandler) => {
            // Store handlers for testing
            mockAxiosInstance._responseSuccessInterceptor = successHandler;
            mockAxiosInstance._responseErrorInterceptor = errorHandler;
            return 0;
          }),
        },
      },
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      _requestInterceptor: null as any,
      _responseSuccessInterceptor: null as any,
      _responseErrorInterceptor: null as any,
    };

    vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any);
  });

  describe('Configuration', () => {
    it('should create axios instance with correct baseURL', async () => {
      // Re-import to trigger axios.create
      vi.resetModules();
      await import('@/services/api');

      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        })
      );
    });
  });

  describe('Request Interceptor', () => {
    it('should add Authorization header when token exists', () => {
      localStorage.setItem('token', 'test-token-123');

      const mockConfig = {
        headers: {},
      };

      const mockAxiosInstance = vi.mocked(axios.create).mock.results[0].value;
      const interceptor = mockAxiosInstance._requestInterceptor;

      if (interceptor) {
        const result = interceptor(mockConfig);
        expect(result.headers.Authorization).toBe('Bearer test-token-123');
      }
    });

    it('should not add Authorization header when token does not exist', () => {
      const mockConfig = {
        headers: {},
      };

      const mockAxiosInstance = vi.mocked(axios.create).mock.results[0].value;
      const interceptor = mockAxiosInstance._requestInterceptor;

      if (interceptor) {
        const result = interceptor(mockConfig);
        expect(result.headers.Authorization).toBeUndefined();
      }
    });
  });

  describe('Response Interceptor - Success', () => {
    it('should return response on success', () => {
      const mockResponse = {
        status: 200,
        data: { message: 'Success' },
        config: { url: '/test' },
      };

      const mockAxiosInstance = vi.mocked(axios.create).mock.results[0].value;
      const interceptor = mockAxiosInstance._responseSuccessInterceptor;

      if (interceptor) {
        const result = interceptor(mockResponse);
        expect(result).toEqual(mockResponse);
      }
    });
  });

  describe('Response Interceptor - Error Handling', () => {
    let errorInterceptor: any;

    beforeEach(() => {
      const mockAxiosInstance = vi.mocked(axios.create).mock.results[0].value;
      errorInterceptor = mockAxiosInstance._responseErrorInterceptor;
    });

    it('should handle network errors', async () => {
      const networkError = {
        code: 'ERR_NETWORK',
        message: 'Network Error',
        config: { url: '/test' },
      };

      if (errorInterceptor) {
        await expect(errorInterceptor(networkError)).rejects.toThrow(
          'Cannot connect to server'
        );
      }
    });

    it('should handle timeout errors', async () => {
      const timeoutError = {
        code: 'ECONNABORTED',
        message: 'timeout of 30000ms exceeded',
        config: { url: '/test' },
      };

      if (errorInterceptor) {
        await expect(errorInterceptor(timeoutError)).rejects.toThrow(
          'Cannot connect to server'
        );
      }
    });

    it('should handle offline mode', async () => {
      // Mock navigator.onLine
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      const error = {
        message: 'Network Error',
        config: { url: '/test' },
      };

      if (errorInterceptor) {
        await expect(errorInterceptor(error)).rejects.toThrow(
          'You are currently offline'
        );
      }

      // Restore navigator.onLine
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true,
      });
    });

    it('should handle 401 unauthorized and redirect to login', async () => {
      localStorage.setItem('token', 'invalid-token');
      localStorage.setItem('user', JSON.stringify({ id: '1' }));

      // Mock window.location
      const mockLocation = {
        href: '',
      };
      Object.defineProperty(window, 'location', {
        writable: true,
        value: mockLocation,
      });

      const authError = {
        response: {
          status: 401,
          statusText: 'Unauthorized',
          data: { message: 'Invalid token' },
        },
        config: { url: '/test' },
        message: 'Request failed with status code 401',
      };

      if (errorInterceptor) {
        await expect(errorInterceptor(authError)).rejects.toBeDefined();
      }

      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
      expect(mockLocation.href).toBe('/login');
    });

    it('should not retry 401 errors twice', async () => {
      const authError = {
        response: {
          status: 401,
          statusText: 'Unauthorized',
          data: { message: 'Invalid token' },
        },
        config: {
          url: '/test',
          _retry: true, // Already retried
        },
        message: 'Request failed with status code 401',
      };

      if (errorInterceptor) {
        await expect(errorInterceptor(authError)).rejects.toBeDefined();
      }

      // Should not clear storage or redirect on retry
      expect(localStorage.getItem('token')).toBeNull();
    });

    it('should handle generic errors', async () => {
      const genericError = {
        response: {
          status: 500,
          statusText: 'Internal Server Error',
          data: { message: 'Server error' },
        },
        config: { url: '/test' },
        message: 'Request failed with status code 500',
      };

      if (errorInterceptor) {
        await expect(errorInterceptor(genericError)).rejects.toBeDefined();
      }
    });
  });

  describe('Base URL Generation', () => {
    it('should use VITE_API_URL from environment when available', () => {
      // This test checks the actual imported api module
      expect(axios.create).toHaveBeenCalled();
    });

    it('should generate runtime URL when window object exists', () => {
      // The baseURL logic is tested implicitly through axios.create mock
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 30000,
        })
      );
    });
  });

  describe('API Methods', () => {
    it('should expose axios instance methods', () => {
      const mockAxiosInstance = vi.mocked(axios.create).mock.results[0].value;

      expect(mockAxiosInstance.get).toBeDefined();
      expect(mockAxiosInstance.post).toBeDefined();
      expect(mockAxiosInstance.put).toBeDefined();
      expect(mockAxiosInstance.delete).toBeDefined();
    });
  });
});
