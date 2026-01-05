import api from './api';
import { Treatment } from './treatmentService';

// Cache management for Priority data
const CACHE_KEYS = {
  TREATMENTS: 'cached_treatments',
  ORDERS: 'cached_orders',
  PATIENT_DATA: 'cached_patient_data'
} as const;

// Helper function to clear all Priority-related cache
const clearAllCache = () => {
  Object.values(CACHE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
};

// Helper function to get cache with expiration check
const getCachedData = (key: string, maxAgeMs: number = 5 * 60 * 1000): any | null => {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    const age = Date.now() - timestamp;
    
    if (age > maxAgeMs) {
      localStorage.removeItem(key);
      return null;
    }
    
    return data;
  } catch (error) {
    console.warn(`Error reading cache for ${key}:`, error);
    localStorage.removeItem(key);
    return null;
  }
};

// Helper function to set cache with timestamp
const setCachedData = (key: string, data: any) => {
  try {
    const cacheEntry = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(cacheEntry));
  } catch (error) {
    console.warn(`Error setting cache for ${key}:`, error);
  }
};

// We'll use our backend API as a proxy to the Priority system
export const priorityService = {
  // Debug function to test Priority API connectivity
  async debugPriorityConnection(): Promise<any> {
    try {
      // Use our backend as a proxy to Priority
      const response = await api.get('/proxy/priority/debug');
      return response.data;
    } catch (error: any) {
      console.error('Priority API connection test failed:', error);
      return {
        success: false,
        error: error.message,
        details: error.response ? error.response.data : null
      };
    }
  },
  
  // Clear all cached data (called on logout or user switch)
  clearCache: clearAllCache,

  // Get treatments from Priority system
  async getTreatments(params: {
    type?: 'insertion' | 'removal';
    subjectId?: string;
    site?: string;
    date?: string;
  }): Promise<Treatment[]> {
    try {
      // Use our backend as a proxy to Priority
      const response = await api.get('/proxy/priority/treatments', { params });

      // Cache treatments with timestamp for offline use (5 minute expiration)
      setCachedData(CACHE_KEYS.TREATMENTS, response.data);

      return response.data;
    } catch (error) {
      console.error('Error fetching from Priority:', error);

      // Try to get from cache if available and not expired
      const cachedData = getCachedData(CACHE_KEYS.TREATMENTS);
      if (cachedData) {
        return cachedData;
      }

      throw error;
    }
  },

  // Get all contacts from Priority PHONEBOOK
  async getContacts(): Promise<any[]> {
    const response = await api.get('/proxy/priority/contacts');
    return response.data;
  },

  // Get orders for a specific CUSTNAME (site)
  async getOrdersForSite(custName: string): Promise<any[]> {
    const response = await api.get(`/proxy/priority/orders`, {
      params: { custName }
    });
    return response.data;
  },

  // Get allowed sites for user based on POSITIONCODE and CUSTNAME
  async getAllowedSitesForUser(userPositionCode: string, userCustName: string): Promise<any[]> {
    const response = await api.get('/proxy/priority/allowed-sites', {
      params: { userPositionCode, userCustName }
    });
    return response.data;
  },

  // Get orders for a specific site and date (for treatment selection)
  async getOrdersForSiteAndDate(site: string, date: string, procedureType?: string): Promise<any> {
    const cacheKey = `${CACHE_KEYS.ORDERS}_${site}_${date}_${procedureType || 'all'}`;

    try {
      const response = await api.post('/proxy/priority/orders', {
        site,
        date,
        procedureType
      });

      // Cache the response with a shorter expiration (2 minutes for order data)
      setCachedData(cacheKey, response.data);

      return response.data;
    } catch (error: any) {
      console.error(`Error fetching orders for ${site} on ${date}:`, error.message);

      // Try cached data as fallback (2 minute expiration)
      const cachedData = getCachedData(cacheKey, 2 * 60 * 1000);
      if (cachedData) {
        return cachedData;
      }

      throw error;
    }
  },

  // Get order details using SIBD_APPLICATUSELIST_SUBFORM
  async getOrderSubform(orderId: string): Promise<any> {
    const response = await api.get(`/proxy/priority/orders/${orderId}/subform`);
    return response.data;
  },

  // Get detailed order information including seed quantity and activity
  async getOrderDetails(orderId: string): Promise<any> {
    const response = await api.get(`/proxy/priority/orders/${orderId}/details`);
    return response.data;
  },

  // NOTE: validateApplicator() moved to applicatorService.ts
  // Use applicatorService.validateApplicator() for applicator validation

  // Get available applicators for a treatment
  async getAvailableApplicators(site: string, currentDate: string): Promise<any> {
    const response = await api.get('/proxy/priority/applicators/available', {
      params: { site, currentDate }
    });
    return response.data;
  },

  // Search applicators by name with fuzzy matching
  async searchApplicators(query: string, site: string, currentDate: string): Promise<any> {
    const response = await api.post('/proxy/priority/applicators/search', {
      query,
      site,
      currentDate
    });
    return response.data;
  },
};
