import axios from 'axios';

// Add debug logging
const API_DEBUG = true;

// Get the API URL from environment or use default
// When running inside docker, we need to adjust for browser context
let baseURL = (import.meta as any).env.VITE_API_URL || 'http://localhost:5000/api';

// If using Docker's internal API URL (service name), replace it for browser requests
if (baseURL === 'http://api:5000/api' && typeof window !== 'undefined') {
  baseURL = 'http://localhost:5000/api';
}

if (API_DEBUG) {
  console.log('API Service initialized with baseURL:', baseURL);
}

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Add longer timeout for Priority API calls
  timeout: 30000
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

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
      // Clear invalid auth data
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export default api;
