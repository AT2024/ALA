import axios from 'axios';

// Debug logging (disabled for production)
const API_DEBUG = false;

// Configuration from environment variables with defaults
const API_PORT = (import.meta as any).env.VITE_API_PORT || '5000';
const API_TIMEOUT = parseInt((import.meta as any).env.VITE_API_TIMEOUT_MS || '30000', 10);
const PRODUCTION_DOMAIN = (import.meta as any).env.VITE_DOMAIN || 'localhost';

// Dynamic URL generation based on HTTPS configuration
const getBaseURL = (): string => {
  // First, try environment variable (build-time configuration)
  let baseURL = (import.meta as any).env.VITE_API_URL;

  if (baseURL) {
    // If using Docker's internal API URL, adjust for browser context
    if (baseURL === `http://api:${API_PORT}/api` && typeof window !== 'undefined') {
      const useHttps = (import.meta as any).env.VITE_USE_HTTPS === 'true';
      const isProduction = (import.meta as any).env.VITE_ENVIRONMENT === 'production';
      const protocol = useHttps && isProduction ? 'https' : 'http';
      baseURL = `${protocol}://${window.location.hostname}:${API_PORT}/api`;
    }
    return baseURL;
  }

  // Runtime URL generation when no build-time URL is provided
  if (typeof window !== 'undefined') {
    const useHttps = (import.meta as any).env.VITE_USE_HTTPS === 'true';
    const isProduction = (import.meta as any).env.VITE_ENVIRONMENT === 'production';

    // Use HTTPS in production if enabled, HTTP otherwise
    const protocol = useHttps && isProduction ? 'https' : 'http';
    const hostname = window.location.hostname;

    return `${protocol}://${hostname}:${API_PORT}/api`;
  }

  // Fallback for server-side rendering or missing window object
  const isProduction = (import.meta as any).env.VITE_ENVIRONMENT === 'production';
  const useHttps = (import.meta as any).env.VITE_USE_HTTPS === 'true';
  const protocol = useHttps && isProduction ? 'https' : 'http';

  return isProduction
    ? `${protocol}://${PRODUCTION_DOMAIN}:${API_PORT}/api`
    : `http://localhost:${API_PORT}/api`;
};

const baseURL = getBaseURL();

if (API_DEBUG) {
  console.log('API Service initialized with baseURL:', baseURL);
}

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Add longer timeout for Priority API calls (configurable via VITE_API_TIMEOUT_MS)
  timeout: API_TIMEOUT,
  // IMPORTANT: withCredentials is required for HttpOnly cookies to be sent automatically
  // This replaces the old localStorage token approach (OWASP security best practice)
  withCredentials: true
});

// Note: No request interceptor needed for auth token
// HttpOnly cookies are automatically sent by the browser with withCredentials: true
// This is more secure than localStorage as the token is not accessible via JavaScript

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    if (API_DEBUG) {
      console.log('API Response:', response.status, response.config.url);
    }
    return response;
  },
  async (error) => {
    // Enhanced error logging
    if (API_DEBUG) {
      console.error('API Error:', error.message);
      if (error.config) {
        console.error('Request details:', {
          url: error.config.url,
          method: error.config.method,
          baseURL: error.config.baseURL,
          timeout: error.config.timeout
        });
      }
      if (error.response) {
        console.error('Response details:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
      }
    }

    const originalRequest = error.config;

    // Handle network errors and server down scenarios
    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      console.error('Network error or server down:', error.message);
      throw new Error('Cannot connect to server. Please check if the server is running.');
    }

    // Handle offline mode
    if (!navigator.onLine) {
      throw new Error('You are currently offline. Please check your connection.');
    }

    // Handle authentication errors
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Clear user data (token is in HttpOnly cookie, cleared by logout endpoint)
      localStorage.removeItem('user');
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export default api;
