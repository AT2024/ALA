import axios from 'axios';
import { Treatment } from './treatmentService';

const priorityBaseURL = (import.meta as any).env.VITE_PRIORITY_API_URL;

const priorityApi = axios.create({
  baseURL: priorityBaseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const priorityService = {
  // Get treatments from Priority system
  async getTreatments(params: {
    type?: 'insertion' | 'removal';
    subjectId?: string;
    site?: string;
    date?: string;
  }): Promise<Treatment[]> {
    try {
      // This is a placeholder for the actual Priority API integration
      // In a real implementation, you would connect to the Priority API
      // and map the response to our Treatment interface

      const response = await priorityApi.get('/CUSTOMERS_EXP', {
        params: {
          $filter: buildPriorityFilter(params),
          $select: 'CUSTDES,CUSTNAME,DETAILS,CDES',
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
      throw error;
    }
  },

  // Get all contacts from Priority PHONEBOOK
  async getContacts(): Promise<any[]> {
    const response = await priorityApi.get(''); // baseURL already ends with /PHONEBOOK
    return response.data.value;
  },

  // Get orders for a specific CUSTNAME (site)
  async getOrdersForSite(custName: string): Promise<any[]> {
    const response = await priorityApi.get(`/../ORDERS`, {
      params: {
        $filter: `CUSTNAME eq '${custName}'`,
      },
    });
    return response.data.value;
  },

  // Get allowed sites for user based on POSITIONCODE and CUSTNAME
  async getAllowedSitesForUser(userPositionCode: number, userCustName: string): Promise<any[]> {
    const contacts = await this.getContacts();
    if (userPositionCode === 99) {
      // Return all sites
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
    filters.push(`CDES eq '${params.site}'`);
  }

  if (params.date) {
    filters.push(`DETAILS eq '${params.date}'`);
  }

  return filters.join(' and ');
}

// Helper function to map Priority data to our Treatment interface
function mapPriorityToTreatment(priorityItem: any, type?: 'insertion' | 'removal'): Treatment {
  return {
    id: priorityItem.CUSTNAME, // Using customer number as ID
    type: type || 'insertion', // Default to insertion if not specified
    subjectId: priorityItem.CUSTNAME,
    site: priorityItem.CDES,
    date: priorityItem.DETAILS || new Date().toISOString().split('T')[0],
    isComplete: false,
  };
}
