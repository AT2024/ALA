import api from './api';

export interface ApplicatorValidationResult {
  isValid: boolean;
  scenario: 'valid' | 'already_scanned' | 'wrong_treatment' | 'previously_no_use' | 'not_allowed' | 'error';
  message: string;
  requiresConfirmation: boolean;
  applicatorData?: {
    serialNumber: string;
    applicatorType: string; // PARTDES from Priority
    seedQuantity: number;   // INTDATA2 from Priority
    intendedPatientId?: string;
    previousTreatmentId?: string;
    returnedFromNoUse?: boolean;
  };
}

export interface ApplicatorData {
  serialNumber: string;
  applicatorType: string;
  seedQuantity: number;
  insertionTime: string;
  usingType: 'full' | 'partial' | 'faulty' | 'none';
  insertedSeedsQty: number;
  comments?: string;
}

export const applicatorService = {
  /**
   * Validate an applicator serial number against Priority system
   * Implements all validation scenarios from requirements documents
   */
  async validateApplicator(
    serialNumber: string, 
    currentTreatmentId: string,
    currentPatientId: string,
    scannedApplicators: string[] = []
  ): Promise<ApplicatorValidationResult> {
    try {
      console.log(`Validating applicator ${serialNumber} for treatment ${currentTreatmentId}`);
      
      // Call backend to validate against Priority system
      const response = await api.post('/applicators/validate', {
        serialNumber: serialNumber.trim(),
        treatmentId: currentTreatmentId,
        patientId: currentPatientId,
        scannedApplicators
      });
      
      const validationData = response.data;
      
      // Return the validation result from backend
      return {
        isValid: validationData.isValid,
        scenario: validationData.scenario,
        message: validationData.message,
        requiresConfirmation: validationData.requiresConfirmation,
        applicatorData: validationData.applicatorData
      };
      
    } catch (error: any) {
      console.error('Applicator validation error:', error);
      
      // Handle specific error cases
      if (error.response) {
        const status = error.response.status;
        const errorData = error.response.data;
        
        if (status === 404) {
          return {
            isValid: false,
            scenario: 'not_allowed',
            message: 'This applicator serial number is not found in the system.',
            requiresConfirmation: false
          };
        } else if (status === 403) {
          return {
            isValid: false,
            scenario: 'not_allowed',
            message: errorData?.message || 'You are not allowed to use this applicator for this treatment.',
            requiresConfirmation: false
          };
        }
      }
      
      return {
        isValid: false,
        scenario: 'error',
        message: error.message || 'Failed to validate applicator. Please try again.',
        requiresConfirmation: false
      };
    }
  },
  
  /**
   * Save applicator data to Priority system
   * Updates SIBD_APPLICATUSELIST table with usage information
   */
  async saveApplicatorData(
    treatmentId: string,
    applicatorData: ApplicatorData
  ): Promise<{ success: boolean; message?: string; applicator?: any }> {
    try {
      console.log('Saving applicator data:', applicatorData);

      const response = await api.post(`/treatments/${treatmentId}/applicators`, {
        serialNumber: applicatorData.serialNumber,
        applicatorType: applicatorData.applicatorType,
        seedQuantity: applicatorData.seedQuantity,
        insertionTime: applicatorData.insertionTime,
        usageType: applicatorData.usingType,
        insertedSeedsQty: applicatorData.insertedSeedsQty,
        comments: applicatorData.comments
      });

      return {
        success: true,
        message: 'Applicator data saved successfully.',
        applicator: response.data // Return the complete applicator object from backend
      };

    } catch (error: any) {
      console.error('Error saving applicator data:', error);

      return {
        success: false,
        message: error.response?.data?.message || 'Failed to save applicator data. Please try again.'
      };
    }
  },
  
  /**
   * Get applicator data from Priority based on serial number
   * Fetches data from SIBD_APPLICATUSELIST table
   */
  async getApplicatorData(serialNumber: string): Promise<{
    found: boolean;
    data?: {
      serialNumber: string;
      applicatorType: string; // PARTDES
      seedQuantity: number;   // INTDATA2
    };
    error?: string;
  }> {
    try {
      const response = await api.get(`/applicators/serial/${serialNumber}`);
      
      return {
        found: true,
        data: response.data
      };
      
    } catch (error: any) {
      console.error('Error fetching applicator data:', error);
      
      if (error.response?.status === 404) {
        return {
          found: false,
          error: 'Applicator not found in the system.'
        };
      }
      
      return {
        found: false,
        error: 'Failed to fetch applicator data.'
      };
    }
  },
  
  /**
   * Update treatment order status in Priority
   * Updates ORDSTATUSDES field in ORDERS table
   */
  async updateTreatmentStatus(
    treatmentId: string, 
    status: 'Performed' | 'Removed'
  ): Promise<{ success: boolean; message?: string }> {
    try {
      await api.patch(`/treatments/${treatmentId}/status`, {
        status
      });
      
      return {
        success: true,
        message: `Treatment status updated to "${status}".`
      };
      
    } catch (error: any) {
      console.error('Error updating treatment status:', error);
      
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to update treatment status.'
      };
    }
  }
};

export default applicatorService;