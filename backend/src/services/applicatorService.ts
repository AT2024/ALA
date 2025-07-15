import { Applicator, Treatment } from '../models';
import { Op } from 'sequelize';
import logger from '../utils/logger';
import priorityService from './priorityService';
import { 
  transformPriorityApplicatorData, 
  validatePriorityDataStructure, 
  transformToPriorityFormat,
  PriorityApplicatorData 
} from '../utils/priorityDataTransformer';

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
  };
}

export const applicatorService = {
  // Get applicators for a treatment
  async getApplicators(treatmentId: string) {
    try {
      const applicators = await Applicator.findAll({
        where: { treatmentId },
        order: [['insertionTime', 'ASC']],
      });
      
      return applicators;
    } catch (error) {
      logger.error(`Error fetching applicators: ${error}`);
      throw error;
    }
  },

  // Get a single applicator by ID
  async getApplicatorById(id: string) {
    try {
      const applicator = await Applicator.findByPk(id);
      
      if (!applicator) {
        throw new Error('Applicator not found');
      }
      
      return applicator;
    } catch (error) {
      logger.error(`Error fetching applicator by ID: ${error}`);
      throw error;
    }
  },

  /**
   * Validate an applicator serial number against Priority system
   * Implements all validation scenarios from requirements documents
   */
  async validateApplicator(
    serialNumber: string, 
    treatmentId: string,
    patientId: string,
    scannedApplicators: string[] = []
  ): Promise<ApplicatorValidationResult> {
    try {
      logger.info(`Validating applicator ${serialNumber} for treatment ${treatmentId}, patient ${patientId}`);
      
      // Scenario 1: Check if already scanned for this treatment
      if (scannedApplicators.includes(serialNumber)) {
        return {
          isValid: false,
          scenario: 'already_scanned',
          message: 'This applicator was already scanned for this treatment.',
          requiresConfirmation: false
        };
      }
      
      // Get treatment details to determine site and date
      const treatment = await Treatment.findByPk(treatmentId);
      if (!treatment) {
        throw new Error('Treatment not found');
      }
      
      // Scenario 2: Check if applicator exists in Priority SIBD_APPLICATUSELIST
      const applicatorInPriority = await this.getApplicatorFromPriority(serialNumber);
      
      if (!applicatorInPriority.found) {
        // If not found, import applicator lists from treatments at same site within 24 hours
        const importedApplicators = await this.importApplicatorsFromRecentTreatments(
          treatment.site, 
          typeof treatment.date === 'string' ? treatment.date : treatment.date.toISOString().split('T')[0]
        );
        
        // Check if applicator exists in imported list
        const applicatorInImported = importedApplicators.find(app => app.serialNumber === serialNumber);
        
        if (applicatorInImported) {
          // Check if it was used before
          if (applicatorInImported.usageType === 'none') {
            return {
              isValid: false,
              scenario: 'previously_no_use',
              message: `This applicator was scanned for treatment ${applicatorInImported.treatmentId} with the status: "No Use"\n\nAre you sure you want to continue?`,
              requiresConfirmation: true,
              applicatorData: {
                serialNumber: applicatorInImported.serialNumber,
                applicatorType: applicatorInImported.applicatorType,
                seedQuantity: applicatorInImported.seedQuantity,
                previousTreatmentId: applicatorInImported.treatmentId
              }
            };
          } else {
            // Applicator was used before
            return {
              isValid: false,
              scenario: 'wrong_treatment',
              message: `This applicator is intended for Patient: ${applicatorInImported.patientId}\n\nAre you sure you want to continue?`,
              requiresConfirmation: true,
              applicatorData: {
                serialNumber: applicatorInImported.serialNumber,
                applicatorType: applicatorInImported.applicatorType,
                seedQuantity: applicatorInImported.seedQuantity,
                intendedPatientId: applicatorInImported.patientId
              }
            };
          }
        } else {
          // Not found anywhere
          return {
            isValid: false,
            scenario: 'not_allowed',
            message: 'You are not allowed to use this applicator for this treatment.',
            requiresConfirmation: false
          };
        }
      } else {
        // Scenario 3: Applicator found in Priority, check if intended for this treatment
        if (!applicatorInPriority.data) {
          return {
            isValid: false,
            scenario: 'error',
            message: 'Applicator data is missing from Priority system.',
            requiresConfirmation: false
          };
        }
        
        const priorityApplicator = applicatorInPriority.data;
        
        // Check if it's intended for this patient/treatment
        if (priorityApplicator.intendedPatientId && priorityApplicator.intendedPatientId !== patientId) {
          return {
            isValid: false,
            scenario: 'wrong_treatment',
            message: `This applicator is intended for Patient: ${priorityApplicator.intendedPatientId}\n\nAre you sure you want to continue?`,
            requiresConfirmation: true,
            applicatorData: priorityApplicator
          };
        }
        
        // Check if it was previously marked as "No Use"
        if (priorityApplicator.previousUsageType === 'none') {
          return {
            isValid: false,
            scenario: 'previously_no_use',
            message: `This applicator was scanned for treatment ${priorityApplicator.previousTreatmentId} with the status: "No Use"\n\nAre you sure you want to continue?`,
            requiresConfirmation: true,
            applicatorData: priorityApplicator
          };
        }
        
        // All checks passed - applicator is valid
        return {
          isValid: true,
          scenario: 'valid',
          message: 'Applicator validated successfully.',
          requiresConfirmation: false,
          applicatorData: {
            serialNumber: priorityApplicator.serialNumber,
            applicatorType: priorityApplicator.applicatorType,
            seedQuantity: priorityApplicator.seedQuantity
          }
        };
      }
      
    } catch (error: any) {
      logger.error('Applicator validation error:', error);
      
      return {
        isValid: false,
        scenario: 'error',
        message: error.message || 'Failed to validate applicator. Please try again.',
        requiresConfirmation: false
      };
    }
  },

  /**
   * Get applicator data from Priority SIBD_APPLICATUSELIST table
   */
  async getApplicatorFromPriority(serialNumber: string): Promise<{
    found: boolean;
    data?: {
      serialNumber: string;
      applicatorType: string; // PARTDES
      seedQuantity: number;   // INTDATA2
      intendedPatientId?: string;
      previousTreatmentId?: string;
      previousUsageType?: string;
    };
    error?: string;
  }> {
    try {
      // Query Priority SIBD_APPLICATUSELIST table for the serial number
      const applicatorData = await priorityService.getApplicatorFromPriority(serialNumber);
      
      if (!applicatorData.found || !applicatorData.data) {
        return {
          found: false,
          error: 'Applicator not found in Priority system.'
        };
      }
      
      // Get additional part details from PARTS table
      const partDetails = await priorityService.getPartDetails(applicatorData.data.partName);
      
      return {
        found: true,
        data: {
          serialNumber: applicatorData.data.serialNumber,
          applicatorType: partDetails.partDes || applicatorData.data.partName,
          seedQuantity: partDetails.seedQuantity || 0,
          intendedPatientId: applicatorData.data.intendedPatientId,
          previousTreatmentId: applicatorData.data.treatmentId,
          previousUsageType: applicatorData.data.usageType
        }
      };
      
    } catch (error: any) {
      logger.error('Error fetching applicator from Priority:', error);
      
      return {
        found: false,
        error: 'Failed to fetch applicator data from Priority system.'
      };
    }
  },

  /**
   * Import applicator lists from treatments at the same site within 24 hours
   * Implements the requirement: "Imports Applicators list from treatment in the same site and 24 hr diff from the current date"
   */
  async importApplicatorsFromRecentTreatments(site: string, currentDate: string): Promise<any[]> {
    try {
      // Calculate date range (current date ± 1 day)
      const targetDate = new Date(currentDate);
      const dayBefore = new Date(targetDate);
      dayBefore.setDate(dayBefore.getDate() - 1);
      const dayAfter = new Date(targetDate);
      dayAfter.setDate(dayAfter.getDate() + 1);
      
      // Get treatments from Priority for the same site within the date range
      const recentTreatments = await priorityService.getTreatmentsForSiteAndDateRange(
        site, 
        dayBefore.toISOString().split('T')[0],
        dayAfter.toISOString().split('T')[0]
      );
      
      // For each treatment, get its applicators
      const allApplicators: any[] = [];
      
      for (const treatment of recentTreatments) {
        const treatmentApplicators = await priorityService.getApplicatorsForTreatment(treatment.id);
        allApplicators.push(...treatmentApplicators);
      }
      
      logger.info(`Imported ${allApplicators.length} applicators from ${recentTreatments.length} recent treatments at site ${site}`);
      
      return allApplicators;
      
    } catch (error: any) {
      logger.error('Error importing applicators from recent treatments:', error);
      return [];
    }
  },

  /**
   * Save applicator data to Priority system
   * Updates SIBD_APPLICATUSELIST table with usage information
   */
  async saveApplicatorToPriority(
    treatmentId: string,
    applicatorData: {
      serialNumber: string;
      insertionTime: string;
      usingType: 'full' | 'partial' | 'faulty' | 'none';
      insertedSeedsQty: number;
      comments?: string;
    }
  ): Promise<{ success: boolean; message?: string }> {
    try {
      logger.info('Saving applicator data to Priority:', applicatorData);
      
      // Get treatment details for Priority update
      const treatment = await Treatment.findByPk(treatmentId);
      if (!treatment) {
        throw new Error('Treatment not found');
      }
      
      // Map our usage types to Priority expected values
      const priorityUsageType = this.mapUsageTypeToPriority(applicatorData.usingType);
      
      // Update Priority SIBD_APPLICATUSELIST table
      const priorityUpdateData = {
        serialNumber: applicatorData.serialNumber,
        treatmentId: treatment.priorityId || treatmentId,
        patientId: treatment.subjectId,
        site: treatment.site,
        insertionTime: applicatorData.insertionTime,
        usageType: priorityUsageType,
        insertedSeedsQty: applicatorData.insertedSeedsQty,
        comments: applicatorData.comments || '',
        date: treatment.date
      };
      
      const result = await priorityService.updateApplicatorInPriority(priorityUpdateData);
      
      return {
        success: true,
        message: 'Applicator data saved to Priority system successfully.'
      };
      
    } catch (error: any) {
      logger.error('Error saving applicator to Priority:', error);
      
      return {
        success: false,
        message: error.message || 'Failed to save applicator data to Priority system.'
      };
    }
  },

  /**
   * Update treatment order status in Priority
   * Updates ORDSTATUSDES field in ORDERS table
   */
  async updateTreatmentStatusInPriority(
    treatmentId: string, 
    status: 'Performed' | 'Removed'
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const treatment = await Treatment.findByPk(treatmentId);
      if (!treatment) {
        throw new Error('Treatment not found');
      }
      
      const priorityOrderId = treatment.priorityId || treatmentId;
      
      const result = await priorityService.updateTreatmentStatus(priorityOrderId, status);
      
      return {
        success: true,
        message: `Treatment status updated to "${status}" in Priority system.`
      };
      
    } catch (error: any) {
      logger.error('Error updating treatment status in Priority:', error);
      
      return {
        success: false,
        message: error.message || 'Failed to update treatment status in Priority system.'
      };
    }
  },

  /**
   * Map our usage types to Priority system expected values
   */
  mapUsageTypeToPriority(usageType: string): string {
    const mapping: Record<string, string> = {
      'full': 'Full use',
      'partial': 'Partial Use', 
      'faulty': 'Faulty',
      'none': 'No Use'
    };
    
    return mapping[usageType] || usageType;
  },

  // Add an applicator to a treatment with validation
  async addApplicator(treatmentId: string, data: any, userId: string) {
    logger.info(`[APPLICATOR_SERVICE] Starting addApplicator process`, {
      treatmentId,
      treatmentIdType: typeof treatmentId,
      treatmentIdLength: treatmentId?.length,
      userId,
      requestData: data
    });

    try {
      // Validate input parameters
      if (!treatmentId) {
        logger.error(`[APPLICATOR_SERVICE] Invalid treatmentId: ${treatmentId}`);
        throw new Error('Treatment ID is required');
      }

      if (typeof treatmentId !== 'string') {
        logger.error(`[APPLICATOR_SERVICE] treatmentId is not a string: ${typeof treatmentId}`, { treatmentId });
        throw new Error('Treatment ID must be a string');
      }

      // UUID format validation
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(treatmentId)) {
        logger.error(`[APPLICATOR_SERVICE] Invalid UUID format for treatmentId: ${treatmentId}`);
        throw new Error('Treatment ID must be a valid UUID');
      }

      logger.info(`[APPLICATOR_SERVICE] Searching for treatment in database`, { treatmentId });
      
      const treatment = await Treatment.findByPk(treatmentId);
      
      logger.info(`[APPLICATOR_SERVICE] Database query result`, {
        treatmentId,
        found: !!treatment,
        treatmentData: treatment ? {
          id: treatment.id,
          type: treatment.type,
          subjectId: treatment.subjectId,
          site: treatment.site,
          isComplete: treatment.isComplete,
          userId: treatment.userId
        } : null
      });
      
      if (!treatment) {
        logger.error(`[APPLICATOR_SERVICE] Treatment not found in database`, {
          treatmentId,
          searchedId: treatmentId,
          databaseError: 'No treatment record found with this ID'
        });
        throw new Error(`Treatment not found with ID: ${treatmentId}`);
      }
      
      if (treatment.isComplete) {
        logger.warn(`[APPLICATOR_SERVICE] Attempt to add applicator to completed treatment`, {
          treatmentId,
          isComplete: treatment.isComplete
        });
        throw new Error('Cannot add applicator to a completed treatment');
      }
      
      // Validate required fields
      if (!data.serialNumber) {
        throw new Error('Serial number is required');
      }
      
      if (!data.usageType) {
        throw new Error('Usage type is required');
      }
      
      // Validate usage type
      if (!['full', 'faulty', 'none'].includes(data.usageType)) {
        throw new Error('Invalid usage type. Must be "full", "faulty", or "none"');
      }
      
      // If usage type is "faulty", comments are required
      if (data.usageType === 'faulty' && !data.comments) {
        throw new Error('Comments are required for faulty applicators');
      }
      
      // Save to Priority system first
      const prioritySaveResult = await this.saveApplicatorToPriority(treatmentId, {
        serialNumber: data.serialNumber,
        insertionTime: data.insertionTime || new Date().toISOString(),
        usingType: data.usageType,
        insertedSeedsQty: data.insertedSeedsQty || 0,
        comments: data.comments
      });
      
      if (!prioritySaveResult.success) {
        throw new Error(`Failed to save to Priority: ${prioritySaveResult.message}`);
      }
      
      // Create the applicator in local database
      const applicator = await Applicator.create({
        ...data,
        treatmentId,
        addedBy: userId,
        insertionTime: data.insertionTime || new Date(),
        seedQuantity: data.seedQuantity || 0,
        isRemoved: false,
      });
      
      logger.info(`[APPLICATOR_SERVICE] Successfully added applicator`, {
        treatmentId,
        applicatorId: applicator.id,
        serialNumber: data.serialNumber,
        usageType: data.usageType
      });

      return applicator;
    } catch (error: any) {
      logger.error(`[APPLICATOR_SERVICE] Error adding applicator`, {
        treatmentId,
        userId,
        requestData: data,
        error: {
          message: error.message,
          name: error.name,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        },
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  },

  // Add an applicator to a treatment with transaction support (optimized version)
  async addApplicatorWithTransaction(treatment: any, data: any, userId: string, transaction: any) {
    const requestId = `addApplicator_${Math.random().toString(36).substr(2, 9)}`;
    
    logger.info(`[APPLICATOR_SERVICE] Starting addApplicatorWithTransaction`, {
      requestId,
      treatmentId: treatment?.id,
      treatmentType: treatment?.type,
      userId,
      requestData: data,
      hasTransaction: !!transaction,
      dataStructure: {
        serialNumber: data?.serialNumber,
        usageType: data?.usageType,
        insertionTime: data?.insertionTime,
        seedQuantity: data?.seedQuantity,
        insertedSeedsQty: data?.insertedSeedsQty,
        comments: data?.comments,
        allKeys: Object.keys(data || {}),
        dataTypes: Object.fromEntries(Object.entries(data || {}).map(([k, v]) => [k, typeof v]))
      }
    });

    try {
      // STEP 1: Validate that treatment object is provided
      logger.debug(`[APPLICATOR_SERVICE] [${requestId}] Step 1: Validating treatment object`);
      if (!treatment || !treatment.id) {
        logger.error(`[APPLICATOR_SERVICE] [${requestId}] Invalid treatment object provided`, {
          treatmentObject: treatment,
          hasTreatment: !!treatment,
          treatmentId: treatment?.id
        });
        throw new Error('Invalid treatment object');
      }

      if (treatment.isComplete) {
        logger.warn(`[APPLICATOR_SERVICE] [${requestId}] Attempt to add applicator to completed treatment`, {
          treatmentId: treatment.id,
          isComplete: treatment.isComplete
        });
        throw new Error('Cannot add applicator to a completed treatment');
      }

      // STEP 2: Validate Priority data structure
      logger.debug(`[APPLICATOR_SERVICE] [${requestId}] Step 2: Validating Priority data structure`);
      const dataValidation = validatePriorityDataStructure(data, requestId);
      if (!dataValidation.isValid) {
        logger.error(`[APPLICATOR_SERVICE] [${requestId}] Priority data structure validation failed`, {
          issues: dataValidation.issues,
          rawData: data
        });
        throw new Error(`Data validation failed: ${dataValidation.issues.join(', ')}`);
      }

      // STEP 3: Transform Priority data to our application format
      logger.debug(`[APPLICATOR_SERVICE] [${requestId}] Step 3: Transforming Priority data`);
      const transformationResult = transformPriorityApplicatorData(data as PriorityApplicatorData, requestId);
      
      if (!transformationResult.success) {
        logger.error(`[APPLICATOR_SERVICE] [${requestId}] Priority data transformation failed`, {
          errors: transformationResult.errors,
          warnings: transformationResult.warnings,
          rawData: data
        });
        throw new Error(`Data transformation failed: ${transformationResult.errors?.join(', ')}`);
      }

      const transformedData = transformationResult.data!;
      
      // Log transformation warnings
      if (transformationResult.warnings && transformationResult.warnings.length > 0) {
        logger.warn(`[APPLICATOR_SERVICE] [${requestId}] Data transformation warnings`, {
          warnings: transformationResult.warnings,
          transformedData
        });
      }

      logger.info(`[APPLICATOR_SERVICE] [${requestId}] Data transformation successful`, {
        treatmentId: treatment.id,
        originalData: data,
        transformedData,
        warnings: transformationResult.warnings
      });

      // STEP 4: Save to Priority system first
      logger.debug(`[APPLICATOR_SERVICE] [${requestId}] Step 4: Saving to Priority system`);
      const priorityData = transformToPriorityFormat(transformedData, requestId);

      logger.debug(`[APPLICATOR_SERVICE] [${requestId}] Priority data structure`, {
        priorityData,
        priorityDataTypes: Object.fromEntries(Object.entries(priorityData).map(([k, v]) => [k, typeof v]))
      });

      const prioritySaveResult = await this.saveApplicatorToPriority(treatment.id, priorityData);

      if (!prioritySaveResult.success) {
        logger.error(`[APPLICATOR_SERVICE] [${requestId}] Failed to save to Priority system`, {
          treatmentId: treatment.id,
          priorityData,
          transformedData,
          error: prioritySaveResult.message,
          priorityResult: prioritySaveResult
        });
        throw new Error(`Failed to save to Priority: ${prioritySaveResult.message}`);
      }

      logger.info(`[APPLICATOR_SERVICE] [${requestId}] Priority save successful, creating local record`, {
        treatmentId: treatment.id,
        priorityResult: prioritySaveResult
      });

      // STEP 5: Create the applicator in local database with transaction
      logger.debug(`[APPLICATOR_SERVICE] [${requestId}] Step 5: Creating local database record`);
      const dbData = {
        ...transformedData,
        treatmentId: treatment.id,
        addedBy: userId,
        isRemoved: false,
      };

      logger.debug(`[APPLICATOR_SERVICE] [${requestId}] Database data structure`, {
        dbData,
        dbDataTypes: Object.fromEntries(Object.entries(dbData).map(([k, v]) => [k, typeof v])),
        transactionActive: !!transaction
      });

      const applicator = await Applicator.create(dbData, { transaction });

      logger.info(`[APPLICATOR_SERVICE] [${requestId}] Successfully added applicator with transaction`, {
        treatmentId: treatment.id,
        applicatorId: applicator.id,
        serialNumber: transformedData.serialNumber,
        usageType: transformedData.usageType
      });

      return applicator;
    } catch (error: any) {
      logger.error(`[APPLICATOR_SERVICE] [${requestId}] Error in addApplicatorWithTransaction`, {
        requestId,
        treatmentId: treatment?.id,
        userId,
        requestData: data,
        error: {
          message: error.message,
          name: error.name,
          code: error.code,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
          sqlMessage: error.original?.message,
          sqlCode: error.original?.code,
          constraint: error.original?.constraint,
          detail: error.original?.detail
        },
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  },

  // Update applicator with validation for removal treatment
  async updateApplicatorForRemoval(id: string, data: any, userId: string) {
    try {
      const applicator = await Applicator.findByPk(id);
      
      if (!applicator) {
        throw new Error('Applicator not found');
      }
      
      const treatment = await Treatment.findByPk(applicator.treatmentId);
      
      if (!treatment) {
        throw new Error('Treatment not found');
      }
      
      if (treatment.isComplete) {
        throw new Error('Cannot update applicator in a completed treatment');
      }
      
      if (treatment.type !== 'removal') {
        throw new Error('This method is only for removal treatments');
      }
      
      // Update applicator
      const updateData: any = {
        ...data,
      };
      
      // If marking as removed, set removal time and removed by
      if (data.isRemoved === true && !applicator.isRemoved) {
        updateData.removalTime = new Date();
        updateData.removedBy = userId;
      }
      
      await applicator.update(updateData);
      
      return applicator;
    } catch (error) {
      logger.error(`Error updating applicator for removal: ${error}`);
      throw error;
    }
  },
  
  // Calculate seed count status for a removal treatment
  async calculateSeedCountStatus(treatmentId: string) {
    try {
      const applicators = await Applicator.findAll({
        where: { treatmentId }
      });
      
      const totalSeeds = applicators.reduce((sum, app) => sum + app.seedQuantity, 0);
      const removedSeeds = applicators.reduce((sum, app) => 
        app.isRemoved ? sum + app.seedQuantity : sum, 0
      );
      
      return {
        totalSeeds,
        removedSeeds,
        complete: totalSeeds === removedSeeds,
        status: totalSeeds === removedSeeds ? 'complete' : 'incomplete',
      };
    } catch (error) {
      logger.error(`Error calculating seed count status: ${error}`);
      throw error;
    }
  },
  
  // Regular update function
  async updateApplicator(id: string, data: any) {
    try {
      const applicator = await Applicator.findByPk(id);
      
      if (!applicator) {
        throw new Error('Applicator not found');
      }
      
      await applicator.update(data);
      
      return applicator;
    } catch (error) {
      logger.error(`Error updating applicator: ${error}`);
      throw error;
    }
  },
};

export default applicatorService;