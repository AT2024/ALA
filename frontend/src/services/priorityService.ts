import api from './api';
import { Treatment } from './treatmentService';

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

      // Cache treatments for offline use
      localStorage.setItem('cached_treatments', JSON.stringify(response.data));

      return response.data;
    } catch (error) {
      console.error('Error fetching from Priority:', error);
      // Try to get from cache if available
      const cachedData = localStorage.getItem('cached_treatments');
      if (cachedData) {
        return JSON.parse(cachedData);
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
    const response = await api.post('/proxy/priority/orders', {
      site,
      date,
      procedureType
    });
    return response.data;
  },

  // Get order details using SIBD_APPLICATUSELIST_SUBFORM
  async getOrderSubform(orderId: string): Promise<any> {
    const response = await api.get(`/proxy/priority/orders/${orderId}/subform`);
    return response.data;
  },
};
