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
  patientName?: string;
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
  // File attachment tracking fields (files stored in Priority ERP)
  attachmentFileCount?: number;
  attachmentSyncStatus?: 'pending' | 'syncing' | 'synced' | 'failed' | null;
  attachmentFilename?: string;
  attachmentSizeBytes?: number;
  // Catalog number from Priority PARTNAME field
  catalog?: string;
  // Seed length from Priority SIBD_SEEDLEN field
  seedLength?: number;
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
    patientName?: string; // Patient identifier from Priority DETAILS field
    priorityId?: string; // Priority order ID (e.g., "PANC-HEAD-001") for workflow detection
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

    // Transform data to ensure all fields are properly set
    if (response.data && Array.isArray(response.data)) {
      return response.data.map((app: any) => ({
        id: app.id || `temp-${Math.random().toString(36).substr(2, 9)}`,
        serialNumber: app.serialNumber,
        seedQuantity: app.seedQuantity || app.INTDATA2 || 0,
        usageType: app.usageType || 'full',
        insertionTime: app.insertionTime || new Date().toISOString(),
        comments: app.comments || '',
        image: app.image || null,
        isRemoved: app.isRemoved === true,
        removalComments: app.removalComments || '',
        removalImage: app.removalImage || null,
        removalTime: app.removalTime || null,
        applicatorType: app.applicatorType || 'Unknown Applicator',
        insertedSeedsQty: app.insertedSeedsQty || app.seedQuantity || 0,
        // File attachment tracking fields (files stored in Priority ERP)
        attachmentFileCount: app.attachmentFileCount || 0,
        attachmentSyncStatus: app.attachmentSyncStatus || null,
        attachmentFilename: app.attachmentFilename || null,
        attachmentSizeBytes: app.attachmentSizeBytes || 0,
        // Catalog and seed length from Priority
        catalog: app.catalog || app.PARTNAME || null,
        seedLength: app.seedLength || app.SIBD_SEEDLEN || null
      }));
    }

    return response.data || [];
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

  // Update removal procedure data for a treatment
  async updateRemovalProcedure(
    treatmentId: string,
    data: {
      removalDate: string;
      allSourcesSameDate: boolean;
      additionalRemovalDate?: string;
      reasonNotSameDate?: string;
      discrepancyClarification?: {
        lost: { checked: boolean; amount: number; comment: string };
        retrievedToSite: { checked: boolean; amount: number; comment: string };
        removalFailure: { checked: boolean; amount: number; comment: string };
        other: { checked: boolean; amount: number; comment: string; description: string };
      };
      individualSeedsRemoved: number;
      individualSeedNotes: Array<{ reason: string; timestamp: string; count: number }>;
      removalGeneralComments?: string;
    }
  ): Promise<{ success: boolean; treatment: Treatment }> {
    const response = await api.put(`/treatments/${treatmentId}/removal-procedure`, data);
    return response.data;
  },

  // Export treatment data as CSV or PDF
  async exportTreatment(treatmentId: string, format: 'csv' | 'pdf'): Promise<Blob> {
    const response = await api.get(`/treatments/${treatmentId}/export`, {
      params: { format },
      responseType: 'blob'
    });
    return response.data;
  },

  // ===== Treatment Finalization Methods =====

  // Initialize finalization - determines user flow (hospital_auto vs alphatau_verification)
  async initializeFinalization(treatmentId: string): Promise<{
    flow: 'hospital_auto' | 'alphatau_verification';
    signerName?: string;
    signerEmail?: string;
    signerPosition?: string;
    requiresEmailSelection?: boolean;
  }> {
    const response = await api.post(`/treatments/${treatmentId}/finalize/initiate`);
    return response.data;
  },

  // Get site users for finalization (Position 99 users only)
  async getSiteUsersForFinalization(treatmentId: string): Promise<{
    users: Array<{ email: string; name: string; position: string }>;
  }> {
    const response = await api.get(`/treatments/${treatmentId}/finalize/site-users`);
    return response.data;
  },

  // Send verification code to target email (Position 99 flow)
  async sendFinalizationCode(treatmentId: string, targetEmail: string): Promise<{
    success: boolean;
    message?: string;
  }> {
    const response = await api.post(`/treatments/${treatmentId}/finalize/send-code`, {
      targetEmail
    });
    return response.data;
  },

  // Verify code and finalize treatment with signature (Position 99 flow)
  async verifyAndFinalize(
    treatmentId: string,
    code: string,
    signerName: string,
    signerPosition: string,
    availableApplicators?: Array<{
      id: string;
      serialNumber: string;
      applicatorType?: string;
      seedQuantity: number;
    }>
  ): Promise<{
    success: boolean;
    message?: string;
  }> {
    const response = await api.post(`/treatments/${treatmentId}/finalize/verify`, {
      code,
      signerName,
      signerPosition,
      availableApplicators
    });
    return response.data;
  },

  // Auto-finalize for hospital users (non-Position 99)
  async autoFinalize(
    treatmentId: string,
    signerName?: string,
    signerPosition?: string,
    availableApplicators?: Array<{
      id: string;
      serialNumber: string;
      applicatorType?: string;
      seedQuantity: number;
    }>
  ): Promise<{
    success: boolean;
    message?: string;
  }> {
    const response = await api.post(`/treatments/${treatmentId}/finalize/auto`, {
      signerName,
      signerPosition,
      availableApplicators
    });
    return response.data;
  }
};
