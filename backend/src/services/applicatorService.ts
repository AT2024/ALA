import { Applicator, Treatment, ApplicatorAuditLog } from '../models';
import { Op, Transaction } from 'sequelize';
import sequelize from '../config/database';
import logger from '../utils/logger';
import priorityService from './priorityService';
import {
  transformPriorityApplicatorData,
  validatePriorityDataStructure,
  transformToPriorityFormat,
  PriorityApplicatorData
} from '../utils/priorityDataTransformer';
import {
  ApplicatorStatus,
  GENERIC_TRANSITIONS,
  PANC_PROS_TRANSITIONS,
  SKIN_TRANSITIONS,
  ALL_STATUSES
} from '../../../shared/applicatorStatuses';
import { getFirstOrderId } from '../utils/priorityIdParser';

export interface ApplicatorValidationResult {
  isValid: boolean;
  scenario: 'valid' | 'already_scanned' | 'wrong_treatment' | 'previously_no_use' | 'not_allowed' | 'error';
  message: string;
  requiresConfirmation: boolean;
  applicatorData?: {
    serialNumber: string;
    applicatorType: string; // PARTDES from Priority
    seedQuantity: number;   // INTDATA2 from Priority
    catalog?: string;       // PARTNAME from Priority (catalog number)
    seedLength?: number;    // SIBD_SEEDLEN from Priority order
    intendedPatientId?: string;
    previousTreatmentId?: string;
  };
}

/**
 * Log status change to audit trail
 * CRITICAL: Required for regulatory compliance and data integrity
 *
 * @param applicatorId - Applicator ID
 * @param oldStatus - Previous status (null for initial creation)
 * @param newStatus - New status
 * @param changedBy - User email who made the change
 * @param reason - Optional reason for change
 * @param requestId - Optional request ID for tracing
 * @param transaction - Optional transaction to use
 */
async function logStatusChange(
  applicatorId: string,
  oldStatus: ApplicatorStatus | null,
  newStatus: ApplicatorStatus,
  changedBy: string,
  reason?: string,
  requestId?: string,
  transaction?: Transaction
): Promise<void> {
  try {
    await ApplicatorAuditLog.create(
      {
        applicatorId,
        oldStatus,
        newStatus,
        changedBy,
        changedAt: new Date(),
        reason: reason || null,
        requestId: requestId || null,
      },
      { transaction }
    );

    logger.info(`Audit log: Applicator ${applicatorId} status change`, {
      applicatorId,
      oldStatus,
      newStatus,
      changedBy,
      requestId,
    });
  } catch (error: any) {
    logger.error(`Failed to log status change for applicator ${applicatorId}`, {
      applicatorId,
      oldStatus,
      newStatus,
      changedBy,
      requestId,
      error: {
        message: error.message,
        code: error.code,
        name: error.name,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        sqlMessage: error.original?.message,
        sqlCode: error.original?.code,
      }
    });
    // Don't throw - audit logging failure shouldn't block the operation
    // But log it for investigation
  }
}

export const applicatorService = {
  // Get applicators for a treatment
  async getApplicators(treatmentId: string, treatmentType?: string) {
    try {
      logger.info(`Getting applicators for treatment ${treatmentId}, type: ${treatmentType || 'unknown'}`);

      // Get the treatment to check its type
      const treatment = await Treatment.findByPk(treatmentId);
      if (!treatment) {
        logger.warn(`Treatment not found: ${treatmentId}`);
        return [];
      }

      // For removal treatments, we need to get applicators from the original insertion
      // For test data, the applicators are stored with the same order ID
      if (treatment.type === 'removal') {
        logger.info(`Treatment ${treatmentId} is a removal, looking for insertion applicators`);

        // Try to find a matching insertion treatment
        // The treatment number could be in either priorityId or subjectId field
        const treatmentNumber = treatment.priorityId || treatment.subjectId;

        const insertionTreatment = await Treatment.findOne({
          where: {
            type: 'insertion',
            site: treatment.site,
            // Look for insertion treatment with matching treatment number in either field
            [Op.or]: [
              { priorityId: treatmentNumber },
              { subjectId: treatmentNumber }
            ]
          }
        });

        if (insertionTreatment) {
          logger.info(`Found related insertion treatment: ${insertionTreatment.id}`);
          const applicators = await Applicator.findAll({
            where: { treatmentId: insertionTreatment.id },
            order: [['insertionTime', 'ASC']],
          });
          return applicators;
        }

        // If no insertion treatment found, return empty array
        // The controller will handle loading from test data for test users
        logger.info(`No insertion treatment found for removal ${treatmentId}`);
      }

      // Standard flow for insertion treatments or if no special handling needed
      const applicators = await Applicator.findAll({
        where: { treatmentId },
        order: [['insertionTime', 'ASC']],
      });

      // Enrich applicators with seedLength and catalog from Priority if not already set
      if (applicators.length > 0 && treatment) {
        try {
          // Get order details for seedLength
          let orderSeedLength: number | null = null;
          if (treatment.priorityId) {
            try {
              const orderDetails = await priorityService.getOrderDetails(treatment.priorityId);
              orderSeedLength = orderDetails?.SIBD_SEEDLEN || null;
              if (orderSeedLength) {
                logger.info(`Enrichment: Found seedLength ${orderSeedLength} from order ${treatment.priorityId}`);
              }
            } catch (e) {
              logger.warn(`Could not fetch order seedLength: ${e}`);
            }
          }

          // Enrich each applicator
          const enrichedApplicators = await Promise.all(applicators.map(async (app) => {
            const appData = app.toJSON() as any;

            // Enrich seedLength if missing
            if (!appData.seedLength && orderSeedLength) {
              appData.seedLength = orderSeedLength;
            }

            return appData;
          }));

          return enrichedApplicators;
        } catch (enrichError) {
          logger.warn(`Could not enrich applicators: ${enrichError}`);
        }
      }

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
      // Pass treatment.priorityId to also fetch seedLength from order
      const applicatorInPriority = await this.getApplicatorFromPriority(serialNumber, treatment.priorityId || undefined);
      
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
            seedQuantity: priorityApplicator.seedQuantity,
            catalog: priorityApplicator.catalog,  // PARTNAME from Priority
            seedLength: priorityApplicator.seedLength  // SIBD_SEEDLEN from order
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
  async getApplicatorFromPriority(serialNumber: string, treatmentPriorityId?: string): Promise<{
    found: boolean;
    data?: {
      serialNumber: string;
      applicatorType: string; // PARTDES
      seedQuantity: number;   // INTDATA2
      catalog?: string;       // PARTNAME (catalog number)
      seedLength?: number;    // SIBD_SEEDLEN from order
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

      // Get seedLength from order if treatmentPriorityId provided
      let seedLength: number | undefined;
      if (treatmentPriorityId) {
        try {
          const orderDetails = await priorityService.getOrderDetails(treatmentPriorityId);
          seedLength = orderDetails?.SIBD_SEEDLEN || undefined;
        } catch (e) {
          logger.warn(`Could not fetch seedLength for validation: ${e}`);
        }
      }

      // If PARTNAME is missing from SIBD_APPLICATUSELIST, try order subform
      let catalog = applicatorData.data.partName;
      if (!catalog && applicatorData.data.treatmentId) {
        try {
          const orderApplicators = await priorityService.getOrderSubform(applicatorData.data.treatmentId);
          const matchingApp = orderApplicators?.find((a: any) => a.SERNUM === serialNumber);
          if (matchingApp?.PARTNAME) {
            catalog = matchingApp.PARTNAME;
            logger.info(`Fetched catalog ${catalog} from order subform for validation of ${serialNumber}`);
          }
        } catch (e) {
          logger.warn(`Could not fetch catalog from order subform for validation: ${e}`);
        }
      }

      return {
        found: true,
        data: {
          serialNumber: applicatorData.data.serialNumber,
          applicatorType: partDetails.partDes || applicatorData.data.partName,
          seedQuantity: partDetails.seedQuantity || 0,
          catalog: catalog || null,  // PARTNAME with subform fallback
          seedLength,  // SIBD_SEEDLEN from order
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
   *
   * Now supports status-based workflow:
   * - If status is provided, derives usageType from status
   * - If status is null, falls back to usingType (backward compatibility)
   * - Only syncs to Priority when reaching terminal state
   */
  async saveApplicatorToPriority(
    treatmentId: string,
    applicatorData: {
      serialNumber: string;
      insertionTime: string;
      usingType: 'full' | 'partial' | 'faulty' | 'none';
      insertedSeedsQty: number;
      comments?: string;
      status?: string | null; // New: optional status field
    }
  ): Promise<{ success: boolean; message?: string }> {
    try {
      logger.info('Saving applicator data to Priority:', applicatorData);

      // Get treatment details for Priority update
      const treatment = await Treatment.findByPk(treatmentId);
      if (!treatment) {
        throw new Error('Treatment not found');
      }

      // Determine usageType based on status or fall back to usingType
      let usageTypeToSync: 'full' | 'partial' | 'faulty' | 'none' | null;

      if (applicatorData.status) {
        // New workflow: derive usageType from status
        usageTypeToSync = this.mapStatusToUsageType(applicatorData.status);

        // Don't sync to Priority for intermediate states
        if (usageTypeToSync === null) {
          logger.info(`Skipping Priority sync for intermediate status: ${applicatorData.status}`);
          return {
            success: true,
            message: `Applicator status updated to ${applicatorData.status} (not synced to Priority - intermediate state)`
          };
        }
      } else {
        // Backward compatibility: use existing usingType field
        usageTypeToSync = applicatorData.usingType;
      }

      // Map our usage types to Priority expected values
      const priorityUsageType = this.mapUsageTypeToPriority(usageTypeToSync);

      // Update Priority SIBD_APPLICATUSELIST table
      // Note: treatment.subjectId contains the Priority ORDNAME (e.g., "SO25000015") for old treatments
      // where priorityId was not set during creation
      const priorityUpdateData = {
        serialNumber: applicatorData.serialNumber,
        treatmentId: treatment.priorityId || treatment.subjectId || treatmentId,
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
   * @param treatmentId - Local treatment ID
   * @param status - Status to set ('Performed' or 'Removed')
   * @param specificOrderId - Optional specific Priority order ID for combined treatments
   */
  async updateTreatmentStatusInPriority(
    treatmentId: string,
    status: 'Performed' | 'Removed',
    specificOrderId?: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const treatment = await Treatment.findByPk(treatmentId);
      if (!treatment) {
        throw new Error('Treatment not found');
      }

      // Use specific order ID if provided (for pancreas treatments)
      // Otherwise fall back to treatment's priorityId or subjectId (ORDNAME from Priority)
      const priorityOrderId = specificOrderId || treatment.priorityId || treatment.subjectId || treatmentId;

      logger.info(`Updating Priority order ${priorityOrderId} to status ${status}`);
      const result = await priorityService.updateTreatmentStatus(priorityOrderId, status);

      return {
        success: true,
        message: `Treatment status updated to "${status}" in Priority system for order ${priorityOrderId}.`
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

  /**
   * Map internal applicator status to Priority ERP usageType
   * Implements 8-state workflow mapping to Priority values
   *
   * Status mappings:
   * - INSERTED → 'full' (applicator successfully used)
   * - FAULTY, DEPLOYMENT_FAILURE → 'faulty' (applicator has issues)
   * - DISPOSED, DISCHARGED → 'none' (applicator not used)
   * - SEALED, OPENED, LOADED → null (intermediate states, don't sync yet)
   *
   * @param status - Internal applicator status
   * @returns Priority usageType or null for intermediate states
   */
  mapStatusToUsageType(status: string | null): 'full' | 'faulty' | 'none' | null {
    if (!status) {
      return null; // No status = backward compatibility mode
    }

    // Defensive validation: warn if invalid status is passed
    if (!ALL_STATUSES.includes(status as ApplicatorStatus)) {
      logger.warn(`mapStatusToUsageType called with invalid status: ${status}`);
      return null;
    }

    const statusMapping: Record<string, 'full' | 'faulty' | 'none' | null> = {
      // Terminal state - successful insertion
      'INSERTED': 'full',

      // Terminal states - faulty applicator
      'FAULTY': 'faulty',
      'DEPLOYMENT_FAILURE': 'faulty',

      // Terminal states - not used
      'DISPOSED': 'none',
      'DISCHARGED': 'none',

      // Intermediate states - don't sync to Priority yet
      'SEALED': null,
      'OPENED': null,
      'LOADED': null,
    };

    return statusMapping[status] ?? null;
  },

  /**
   * Get the appropriate transition map based on treatment type
   * @param treatmentType - Treatment type string (e.g., 'pancreas_insertion', 'skin_insertion')
   * @returns The transition map for the treatment type
   */
  getTransitionsForTreatment(treatmentType?: string): Record<ApplicatorStatus, ApplicatorStatus[]> {
    if (!treatmentType) {
      return GENERIC_TRANSITIONS;
    }

    const lowerType = treatmentType.toLowerCase();

    // Skin treatments use simplified 2-stage workflow
    if (lowerType.includes('skin')) {
      return SKIN_TRANSITIONS;
    }

    // Pancreas and prostate treatments use 3-stage workflow
    if (lowerType.includes('pancreas') || lowerType.includes('prostate')) {
      return PANC_PROS_TRANSITIONS;
    }

    // Default to generic transitions for unknown treatment types
    return GENERIC_TRANSITIONS;
  },

  /**
   * Validate status transition for applicator state machine
   * Implements 8-state workflow with strict transition rules
   * Uses treatment-specific transitions from @shared/applicatorStatuses:
   * - PANC_PROS_TRANSITIONS for pancreas/prostate workflow (3-stage)
   * - SKIN_TRANSITIONS for skin workflow (2-stage)
   * - GENERIC_TRANSITIONS for fallback/unknown treatment types
   *
   * @param currentStatus - Current applicator status
   * @param newStatus - Requested new status
   * @param treatmentType - Optional treatment type for treatment-specific validation
   * @returns Validation result with error message if invalid
   */
  validateStatusTransition(
    currentStatus: string | null,
    newStatus: string,
    treatmentType?: string
  ): { valid: boolean; error?: string } {
    // If no current status, any initial status is allowed (backward compatibility)
    if (!currentStatus) {
      return { valid: true };
    }

    // Get treatment-specific transition rules
    const transitions = this.getTransitionsForTreatment(treatmentType);

    // Check if current status is valid
    if (!transitions[currentStatus as ApplicatorStatus]) {
      return {
        valid: false,
        error: `Invalid current status: ${currentStatus}`
      };
    }

    // Check if transition is allowed
    const allowedNextStates = transitions[currentStatus as ApplicatorStatus];

    if (allowedNextStates.length === 0) {
      return {
        valid: false,
        error: `Cannot transition from terminal state ${currentStatus}`
      };
    }

    if (!allowedNextStates.includes(newStatus as ApplicatorStatus)) {
      return {
        valid: false,
        error: `Invalid transition from ${currentStatus} to ${newStatus}. Allowed: ${allowedNextStates.join(', ')}`
      };
    }

    return { valid: true };
  },

  // NOTE: Legacy addApplicator() method was removed (160 lines).
  // Use addApplicatorWithTransaction() instead - it's the active code path
  // called by treatmentController.addApplicator via POST /api/treatments/:id/applicators.
  // The legacy method used getPartNameFromDescription() which is less reliable than
  // the order subform lookup used by addApplicatorWithTransaction().

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

      // STEP 2.5: Enrich data with catalog and seedLength from Priority if not provided
      logger.debug(`[APPLICATOR_SERVICE] [${requestId}] Step 2.5: Enriching data with Priority lookup`);
      let enrichedData = { ...data };

      // Get first order ID for lookups (handles combined treatments with JSON array)
      const orderIdForLookup = getFirstOrderId(treatment.priorityId);

      // Fetch catalog from order subform (more reliable than PARTS table substring query)
      if (!enrichedData.catalog && enrichedData.serialNumber && orderIdForLookup) {
        try {
          const orderApplicators = await priorityService.getOrderSubform(orderIdForLookup);
          const matchingApp = orderApplicators?.find((a: any) => a.SERNUM === enrichedData.serialNumber);
          if (matchingApp?.PARTNAME) {
            enrichedData.catalog = matchingApp.PARTNAME;
            logger.info(`[APPLICATOR_SERVICE] [${requestId}] Fetched catalog ${enrichedData.catalog} from order subform for serial ${enrichedData.serialNumber}`);
          } else {
            logger.warn(`[APPLICATOR_SERVICE] [${requestId}] No matching applicator found in subform for serial ${enrichedData.serialNumber}`);
          }
        } catch (error: any) {
          logger.warn(`[APPLICATOR_SERVICE] [${requestId}] Could not fetch catalog from order subform: ${error.message}`);
        }
      }

      // Fetch seedLength from order if not provided
      if (!enrichedData.seedLength && orderIdForLookup) {
        try {
          const orderDetails = await priorityService.getOrderDetails(orderIdForLookup);
          if (orderDetails?.SIBD_SEEDLEN) {
            enrichedData.seedLength = orderDetails.SIBD_SEEDLEN;
            logger.info(`[APPLICATOR_SERVICE] [${requestId}] Fetched seedLength from Priority order: ${enrichedData.seedLength}`);
          }
        } catch (error: any) {
          logger.warn(`[APPLICATOR_SERVICE] [${requestId}] Could not fetch seedLength from Priority order: ${error.message}`);
        }
      }

      // STEP 3: Transform Priority data to our application format
      logger.debug(`[APPLICATOR_SERVICE] [${requestId}] Step 3: Transforming Priority data`);
      const transformationResult = transformPriorityApplicatorData(enrichedData as PriorityApplicatorData, requestId);
      
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

      // Log Priority result but DON'T THROW ERROR - always continue with local save
      if (!prioritySaveResult.success) {
        logger.warn(`[APPLICATOR_SERVICE] [${requestId}] Priority save failed (continuing with local save): ${prioritySaveResult.message}`, {
          treatmentId: treatment.id,
          priorityData,
          transformedData,
          error: prioritySaveResult.message,
          priorityResult: prioritySaveResult
        });
      } else {
        logger.info(`[APPLICATOR_SERVICE] [${requestId}] Priority save successful`);
      }

      logger.info(`[APPLICATOR_SERVICE] [${requestId}] Creating local record`, {
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
  
  // Regular update function with audit logging
  async updateApplicator(id: string, data: any, userId?: string) {
    try {
      const applicator = await Applicator.findByPk(id);

      if (!applicator) {
        throw new Error('Applicator not found');
      }

      // CRITICAL: Log status transition to audit trail
      if (data.status && data.status !== applicator.status) {
        await logStatusChange(
          id,
          applicator.status,
          data.status,
          userId || 'system',
          data.comments || undefined,
          undefined // No requestId
        );
      }

      await applicator.update(data);

      return applicator;
    } catch (error) {
      logger.error(`Error updating applicator: ${error}`);
      throw error;
    }
  },

  /**
   * Create a package of 4 applicators with P# label
   * ONLY for pancreas and prostate treatments (combined treatments)
   *
   * CRITICAL FIX: Now uses transaction to ensure atomicity
   * If any update fails, all changes are rolled back
   *
   * @param treatmentId - Treatment ID
   * @param applicatorIds - Array of exactly 4 applicator IDs
   * @param userId - User email for audit trail
   * @returns Updated applicators with package_label assigned
   */
  async createPackage(treatmentId: string, applicatorIds: string[], userId?: string) {
    const requestId = `createPackage_${Math.random().toString(36).substr(2, 9)}`;

    // Start transaction for atomic operation
    const transaction = await sequelize.transaction();

    try {
      logger.info(`[${requestId}] Creating package for treatment ${treatmentId}`, { applicatorIds });

      // Validation 1: Exactly 4 applicators required
      if (applicatorIds.length !== 4) {
        throw new Error(`Package must contain exactly 4 applicators (received ${applicatorIds.length})`);
      }

      // Validation 2: Verify treatment exists
      const treatment = await Treatment.findByPk(treatmentId, { transaction });
      if (!treatment) {
        throw new Error(`Treatment not found: ${treatmentId}`);
      }

      // Fetch all 4 applicators within transaction
      const applicators = await Applicator.findAll({
        where: {
          id: applicatorIds
        },
        transaction
      });

      // Validation 3: All 4 applicators must exist
      if (applicators.length !== 4) {
        throw new Error(`Found ${applicators.length} applicators, expected 4`);
      }

      // Validation 4: All applicators must belong to the same treatment
      const invalidTreatment = applicators.find(app => app.treatmentId !== treatmentId);
      if (invalidTreatment) {
        throw new Error(
          `Applicator ${invalidTreatment.serialNumber} belongs to different treatment (${invalidTreatment.treatmentId})`
        );
      }

      // Validation 5: All applicators must be in ready status
      // LOADED is part of the 8-state workflow (not yet fully implemented)
      // For now, we accept OPENED or null (backward compatibility)
      // When 8-state workflow is fully implemented, this should check for 'LOADED' specifically
      const acceptableStatuses = ['OPENED', null]; // null = status not set (backward compatibility)
      const notReadyApplicator = applicators.find(app => !acceptableStatuses.includes(app.status));
      if (notReadyApplicator) {
        throw new Error(
          `All applicators must be in ready status (OPENED or pending). Applicator ${notReadyApplicator.serialNumber} is ${notReadyApplicator.status}`
        );
      }

      // Validation 6: All applicators must have same seed quantity (same type)
      const firstSeedQty = applicators[0].seedQuantity;
      const differentSeedQty = applicators.find(app => app.seedQuantity !== firstSeedQty);
      if (differentSeedQty) {
        throw new Error(
          `All applicators must have same seed quantity. Found ${firstSeedQty} and ${differentSeedQty.seedQuantity}`
        );
      }

      // Get next available package label (P1, P2, P3, etc.)
      const nextLabel = await this.getNextPackageLabel(treatmentId);

      // Validation 7: Check no applicator already has this package label (prevent duplicates)
      const existingLabelApplicator = applicators.find(app => app.packageLabel === nextLabel);
      if (existingLabelApplicator) {
        throw new Error(
          `Applicator ${existingLabelApplicator.serialNumber} already has package label ${nextLabel}`
        );
      }

      // Update all 4 applicators with package label within transaction
      const updatedApplicators: Applicator[] = [];
      for (const applicator of applicators) {
        const oldStatus = applicator.status;

        // Update to LOADED status and assign package label
        await applicator.update(
          {
            packageLabel: nextLabel,
            status: 'LOADED',  // Applicators are now loaded into package
          },
          { transaction }
        );

        // Log status change to audit trail
        if (userId && oldStatus !== 'LOADED') {
          await logStatusChange(
            applicator.id,
            oldStatus,
            'LOADED',
            userId,
            `Loaded into package ${nextLabel}`,
            requestId,
            transaction
          );
        }

        updatedApplicators.push(applicator);
      }

      // Commit transaction - all updates succeed or all fail
      await transaction.commit();

      logger.info(`[${requestId}] Package ${nextLabel} created successfully for treatment ${treatmentId}`, {
        packageLabel: nextLabel,
        applicatorCount: updatedApplicators.length,
        seedQuantity: firstSeedQty,
        requestId
      });

      return updatedApplicators;
    } catch (error: any) {
      // Rollback transaction on any error
      await transaction.rollback();

      logger.error(`[${requestId}] Error creating package (rolled back):`, {
        treatmentId,
        applicatorIds,
        error: error.message,
        requestId
      });
      throw error;
    }
  },

  /**
   * Get next available package label for a treatment
   *
   * @param treatmentId - Treatment ID
   * @returns Next package label (P1, P2, P3, etc.)
   */
  async getNextPackageLabel(treatmentId: string): Promise<string> {
    try {
      // Find all applicators with package labels for this treatment
      const applicatorsWithLabels = await Applicator.findAll({
        where: {
          treatmentId,
          packageLabel: { [Op.ne]: null }
        },
        attributes: ['packageLabel'],
        order: [['packageLabel', 'DESC']],
        limit: 1
      });

      // If no packages exist, start with P1
      if (applicatorsWithLabels.length === 0) {
        return 'P1';
      }

      // Extract highest package number and increment
      const highestLabel = applicatorsWithLabels[0].packageLabel;
      if (!highestLabel) {
        return 'P1';
      }

      // Parse number from label (P1 -> 1, P2 -> 2, etc.)
      const match = highestLabel.match(/^P(\d+)$/);
      if (!match) {
        logger.warn(`Invalid package label format: ${highestLabel}, defaulting to P1`);
        return 'P1';
      }

      const currentNumber = parseInt(match[1], 10);
      const nextNumber = currentNumber + 1;

      return `P${nextNumber}`;
    } catch (error: any) {
      logger.error(`Error getting next package label: ${error.message}`, { treatmentId });
      throw error;
    }
  },

  /**
   * Get all packages for a treatment
   * Groups applicators by package_label
   *
   * @param treatmentId - Treatment ID
   * @returns Array of packages with their applicators
   */
  async getPackages(treatmentId: string) {
    try {
      // Get all applicators with package labels
      const applicators = await Applicator.findAll({
        where: {
          treatmentId,
          packageLabel: { [Op.ne]: null }
        },
        order: [['packageLabel', 'ASC'], ['insertionTime', 'ASC']]
      });

      // Group by package label
      const packagesMap = new Map<string, Applicator[]>();

      for (const applicator of applicators) {
        const label = applicator.packageLabel!;
        if (!packagesMap.has(label)) {
          packagesMap.set(label, []);
        }
        packagesMap.get(label)!.push(applicator);
      }

      // Convert to array format
      const packages = Array.from(packagesMap.entries()).map(([label, applicators]) => ({
        label,
        applicators
      }));

      logger.info(`Retrieved ${packages.length} packages for treatment ${treatmentId}`);

      return packages;
    } catch (error: any) {
      logger.error(`Error getting packages: ${error.message}`, { treatmentId });
      throw error;
    }
  },
};

export default applicatorService;