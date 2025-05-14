import axios from 'axios';
import { Treatment } from './treatmentService';

const priorityBaseURL = (import.meta as any).env.VITE_PRIORITY_API_URL || 'https://t.eu.priority-connect.online/odata/Priority/tabbtbc6.ini/test24/';

const priorityApi = axios.create({
  baseURL: priorityBaseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const priorityService = {
  // Debug function to test Priority API connectivity
  async debugPriorityConnection(): Promise<any> {
    try {
      // Test basic connectivity
      console.log('Testing connection to Priority API at:', priorityBaseURL);
      const phonebookResponse = await axios.get(`${priorityBaseURL}PHONEBOOK`, {
        timeout: 10000, // 10 second timeout
      });
      console.log('Connected to Priority API PHONEBOOK endpoint successfully');
      console.log('Number of contacts:', phonebookResponse.data.value.length);
      
      if (phonebookResponse.data.value.length > 0) {
        console.log('Sample contact data:', phonebookResponse.data.value[0]);
      }
      
      // Test ORDERS endpoint with a sample customer
      const ordersResponse = await axios.get(`${priorityBaseURL}ORDERS?$filter=CUSTNAME eq '100078'`, {
        timeout: 10000,
      });
      console.log('ORDERS endpoint successful');
      console.log('Number of orders:', ordersResponse.data.value.length);
      
      if (ordersResponse.data.value.length > 0) {
        console.log('Sample order data:', ordersResponse.data.value[0]);
      }
      
      return {
        success: true,
        phonebookCount: phonebookResponse.data.value.length,
        phonebookSample: phonebookResponse.data.value.length > 0 ? phonebookResponse.data.value[0] : null,
        ordersCount: ordersResponse.data.value.length,
        ordersSample: ordersResponse.data.value.length > 0 ? ordersResponse.data.value[0] : null
      };
    } catch (error) {
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
      // Try to get treatments from ORDERS endpoint
      const response = await priorityApi.get('/ORDERS', {
        params: {
          $filter: buildPriorityFilter(params),
          $select: 'CUSTDES,CUSTNAME,SIBD_TREATDAY,TYPEDES,ORDNAME,BOOLCLOSED,SBD_APPLICATOR,TOTQUANT',
        },
      });

      // Map Priority data to our treatment interface
      const treatments = response.data.value.map((item: any) =>
        mapPriorityToTreatment(item, params.type)
      );

      // Cache treatments for offline use
      localStorage.setItem('cached_treatments', JSON.stringify(treatments));

      return treatments;
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
    const response = await priorityApi.get('/PHONEBOOK');
    return response.data.value;
  },

  // Get orders for a specific CUSTNAME (site)
  async getOrdersForSite(custName: string): Promise<any[]> {
    const response = await priorityApi.get(`/ORDERS`, {
      params: {
        $filter: `CUSTNAME eq '${custName}'`,
      },
    });
    return response.data.value;
  },

  // Get allowed sites for user based on POSITIONCODE and CUSTNAME
  async getAllowedSitesForUser(userPositionCode: string, userCustName: string): Promise<any[]> {
    const contacts = await this.getContacts();
    if (userPositionCode === '99') {
      // Return all sites - for users with position code 99 (e.g., admins)
      return contacts;
    } else {
      // Return only contacts for user's site
      return contacts.filter((contact) => contact.CUSTNAME === userCustName);
    }
  },
};

// Helper function to build Priority filter
function buildPriorityFilter(params: {
  type?: 'insertion' | 'removal';
  subjectId?: string;
  site?: string;
  date?: string;
}): string {
  const filters = [];

  if (params.subjectId) {
    filters.push(`CUSTNAME eq '${params.subjectId}'`);
  }

  if (params.site) {
    filters.push(`CUSTDES eq '${params.site}'`);
  }

  if (params.date) {
    // Format date for SIBD_TREATDAY (assumes ISO format)
    filters.push(`SIBD_TREATDAY eq ${params.date}`);
  }
  
  // Map treatment types to Priority's TYPEDES field
  if (params.type) {
    if (params.type === 'insertion') {
      filters.push(`TYPEDES eq 'Inert'`);
    } else if (params.type === 'removal') {
      filters.push(`TYPEDES eq 'Active'`);
    }
  }

  return filters.join(' and ');
}

// Helper function to map Priority data to our Treatment interface
function mapPriorityToTreatment(priorityItem: any, type?: 'insertion' | 'removal'): Treatment {
  // Determine treatment type based on Priority's TYPEDES field
  const treatmentType = priorityItem.TYPEDES === 'Inert' ? 'insertion' : 'removal';
  
  return {
    id: priorityItem.ORDNAME || priorityItem.CUSTNAME, // Use order ID if available, otherwise customer ID
    type: type || treatmentType, // Use provided type or determine from TYPEDES
    subjectId: priorityItem.CUSTNAME, // Subject ID is the customer ID
    site: priorityItem.CUSTDES, // Site is the customer description
    date: priorityItem.SIBD_TREATDAY || new Date().toISOString().split('T')[0], // Use treatment date or today
    isComplete: priorityItem.BOOLCLOSED === 'Y', // Consider complete if BOOLCLOSED is Y
  };
}
