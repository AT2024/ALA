import api from './api';
import { priorityService } from './priorityService';

export interface Treatment {
  id: string;
  type: 'insertion' | 'removal';
  subjectId: string;
  site: string;
  date: string;
  isComplete: boolean;
  email?: string;
  seedQuantity?: number;
  activityPerSeed?: number;
  surgeon?: string;
  userId?: string;
  priorityId?: string;
  originalTreatmentId?: string; // For removal treatments - links to original insertion
  createdAt?: string;
  updatedAt?: string;
}

export interface Applicator {
  id: string;
  serialNumber: string;
  seedQuantity: number;
  usageType: 'full' | 'faulty' | 'none';
  insertionTime: string;
  comments?: string;
  image?: string;
  isRemoved?: boolean;
  removalComments?: string;
  removalImage?: string;
}

export const treatmentService = {
  // Get available treatments for selection
  async getTreatments(params: {
    type?: 'insertion' | 'removal';
    subjectId?: string;
    site?: string;
    date?: string;
  }): Promise<Treatment[]> {
    try {
      // First try to get from backend
      const response = await api.get('/treatments', { params });
      return response.data;
    } catch (error) {
      // If offline or backend fails, try to get from Priority directly
      if (navigator.onLine) {
        return await priorityService.getTreatments(params);
      }
      
      // If offline, get from local storage
      const cachedTreatments = localStorage.getItem('cached_treatments');
      if (cachedTreatments) {
        const treatments = JSON.parse(cachedTreatments) as Treatment[];
        
        // Apply filters if any
        return treatments.filter(treatment => {
          let include = true;
          if (params.type && treatment.type !== params.type) include = false;
          if (params.subjectId && treatment.subjectId !== params.subjectId) include = false;
          if (params.site && treatment.site !== params.site) include = false;
          if (params.date && treatment.date.slice(0, 10) !== params.date) include = false;
          return include;
        });
      }
      
      return [];
    }
  },

  // Create a new treatment
  async createTreatment(treatmentData: {
    type: 'insertion' | 'removal';
    subjectId: string;
    site: string;
    date: string;
    email?: string;
    seedQuantity?: number;
    activityPerSeed?: number;
    surgeon?: string;
    originalTreatmentId?: string; // For removal treatments
  }): Promise<Treatment> {
    const response = await api.post('/treatments', treatmentData);
    return response.data;
  },

  // Get removal candidates for a specific treatment number and site
  async getRemovalCandidates(site: string, treatmentNumber: string): Promise<{
    id: string;
    subjectId: string;
    site: string;
    date: string;
    surgeon: string;
    seedQuantity: number;
    activityPerSeed: number;
    daysSinceInsertion: number;
    status: string;
    activity: number;
    isEligible: boolean;
    reason?: string;
  }> {
    const response = await api.get('/treatments/removal-candidates', {
      params: { site, treatmentNumber }
    });
    return response.data;
  },

  // Get details for a specific treatment
  async getTreatment(id: string): Promise<Treatment> {
    const response = await api.get(`/treatments/${id}`);
    return response.data;
  },

  // Get applicators for a treatment
  async getApplicators(treatmentId: string): Promise<Applicator[]> {
    const response = await api.get(`/treatments/${treatmentId}/applicators`);
    return response.data;
  },

  // Validate applicator barcode
  async validateApplicator(barcode: string, treatmentId: string): Promise<{
    valid: boolean;
    message: string;
    requiresAdminApproval: boolean;
    applicator?: Applicator;
  }> {
    const response = await api.post(`/applicators/validate`, {
      barcode,
      treatmentId,
    });
    return response.data;
  },

  // Add an applicator to a treatment
  async addApplicator(treatmentId: string, applicator: Omit<Applicator, 'id'>): Promise<Applicator> {
    const response = await api.post(`/treatments/${treatmentId}/applicators`, applicator);
    return response.data;
  },

  // Update an applicator
  async updateApplicator(treatmentId: string, applicatorId: string, data: Partial<Applicator>): Promise<Applicator> {
    const response = await api.patch(`/treatments/${treatmentId}/applicators/${applicatorId}`, data);
    return response.data;
  },

  // Complete a treatment
  async completeTreatment(treatmentId: string): Promise<Treatment> {
    const response = await api.post(`/treatments/${treatmentId}/complete`);
    return response.data;
  },

  // Export treatment data as CSV or PDF
  async exportTreatment(treatmentId: string, format: 'csv' | 'pdf'): Promise<Blob> {
    const response = await api.get(`/treatments/${treatmentId}/export`, {
      params: { format },
      responseType: 'blob'
    });
    return response.data;
  }
};
