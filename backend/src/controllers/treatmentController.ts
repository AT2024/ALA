import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import treatmentService from '../services/treatmentService';
import applicatorService from '../services/applicatorService';
import priorityService from '../services/priorityService';
import sequelize from '../config/database';
import { Treatment, TreatmentPdf, SignatureVerification } from '../models';
import logger from '../utils/logger';
import { ContinuationInfo } from '../services/pdfGenerationService';
import { sendVerificationCode } from '../services/emailService';
import { config } from '../config/appConfig';
import { formatAndEnrichApplicators, fetchSeedLength } from '../utils/applicatorFormatter';
import { parseOrderIds } from '../utils/priorityIdParser';
import {
  requireTreatmentAccess,
  isAlphaTauAdmin,
  buildUserContext,
} from '../utils/authorizationUtils';
import {
  mergeApplicatorsForPdf,
  finalizeAndSendPdf,
  SignatureDetails,
} from '../utils/finalizationHelpers';

// Helper function to get continuation info for PDF generation
async function getContinuationInfo(treatment: Treatment): Promise<ContinuationInfo | undefined> {
  if (!treatment.parentTreatmentId) return undefined;

  const parentPdf = await TreatmentPdf.findOne({
    where: { treatmentId: treatment.parentTreatmentId }
  });

  if (!parentPdf) {
    logger.warn(`[CONTINUATION] Parent treatment ${treatment.parentTreatmentId} has no PDF`, {
      treatmentId: treatment.id,
      parentTreatmentId: treatment.parentTreatmentId
    });
    return undefined;
  }

  logger.info(`[CONTINUATION] Found parent PDF created at ${parentPdf.signedAt}`, {
    treatmentId: treatment.id,
    parentTreatmentId: treatment.parentTreatmentId
  });

  return {
    parentTreatmentId: treatment.parentTreatmentId,
    parentPdfCreatedAt: parentPdf.signedAt
  };
}

/**
 * Helper function to load test user applicators for removal PDF generation
 *
 * When test users finalize a removal treatment, there are no applicators in the database
 * (because there was no real insertion). This function loads the applicators from test-data.json
 * via priorityService.getOrderSubform() and marks them as removed for the PDF.
 */
async function loadTestUserRemovalApplicators(
  treatment: Treatment,
  userEmail: string,
  userId: string
): Promise<any[]> {
  const testUserEmail = config.testUserEmail || 'test@example.com';
  if (userEmail !== testUserEmail || treatment.type !== 'removal') {
    return [];
  }

  const treatmentNumber = treatment.priorityId || treatment.subjectId;
  if (!treatmentNumber) {
    logger.warn(`Test user removal but no treatment number found for treatment ${treatment.id}`);
    return [];
  }

  try {
    const testContext = { email: userEmail, identifier: userId };
    const testApplicators = await priorityService.getOrderSubform(treatmentNumber, testContext, 'removal');

    if (testApplicators && testApplicators.length > 0) {
      const formattedApplicators = testApplicators.map((app: any) => ({
        serialNumber: app.SERNUM,
        seedQuantity: app.INTDATA2,
        usageType: 'full',
        applicatorType: app.PARTDES,
        catalog: app.PARTNAME,
        insertionTime: app.INSERTIONDATE,
        insertedSeedsQty: app.INSERTEDSEEDSQTY || app.INTDATA2,
        comments: app.INSERTIONCOMMENTS || '',
      }));

      logger.info(`Test user removal: loaded ${formattedApplicators.length} applicators from test data for treatment ${treatment.id}`);
      return formattedApplicators;
    }
  } catch (error) {
    logger.error(`Error loading test user removal applicators: ${error}`);
  }

  return [];
}

/**
 * Get applicators for removal treatment finalization.
 * Prioritizes frontend applicators (which have correct removal state), falls back to test data.
 */
async function getRemovalApplicators(
  treatment: Treatment,
  availableApplicators: any[] | undefined,
  dbApplicators: any[],
  userEmail: string,
  userId: string
): Promise<any[]> {
  if (availableApplicators && availableApplicators.length > 0) {
    return availableApplicators;
  }
  if (dbApplicators.length === 0) {
    return loadTestUserRemovalApplicators(treatment, userEmail, userId);
  }
  return dbApplicators;
}

// @desc    Get all treatments with optional filtering
// @route   GET /api/treatments
// @access  Private
export const getTreatments = asyncHandler(async (req: Request, res: Response) => {
  const { type, subjectId, site, date } = req.query;
  
  const treatments = await treatmentService.getTreatments({
    type: type as 'insertion' | 'removal' | undefined,
    subjectId: subjectId as string | undefined,
    site: site as string | undefined,
    date: date as string | undefined,
  }, req.user.id);
  
  // Serialize Sequelize models to avoid circular references
  res.status(200).json(treatments.map(t =>
    typeof t.toJSON === 'function' ? t.toJSON() : t
  ));
});

// @desc    Get a single treatment by ID
// @route   GET /api/treatments/:id
// @access  Private
export const getTreatmentById = asyncHandler(async (req: Request, res: Response) => {
  const treatment = await treatmentService.getTreatmentById(req.params.id);

  // Check if user has access to this treatment
  requireTreatmentAccess(treatment, req.user);

  // Serialize to avoid circular references from Sequelize associations
  res.status(200).json(
    typeof treatment.toJSON === 'function' ? treatment.toJSON() : treatment
  );
});

// @desc    Create a new treatment
// @route   POST /api/treatments
// @access  Private
export const createTreatment = asyncHandler(async (req: Request, res: Response) => {
  const treatment = await treatmentService.createTreatment(req.body, req.user.id);

  // AUDIT LOG: Log patient identifier source for safety tracking
  logger.info('Treatment created with patient identifier', {
    treatmentId: treatment.id,
    subjectId: treatment.subjectId,
    patientName: treatment.patientName || 'NULL',
    identifierSource: treatment.patientName ? 'DETAILS' : 'ORDNAME_FALLBACK',
    userId: req.user.id,
    site: treatment.site,
    type: treatment.type
  });

  res.status(201).json(treatment);
});

// @desc    Update a treatment
// @route   PUT /api/treatments/:id
// @access  Private
export const updateTreatment = asyncHandler(async (req: Request, res: Response) => {
  const treatment = await treatmentService.getTreatmentById(req.params.id);

  // Check if user has access to update this treatment
  requireTreatmentAccess(treatment, req.user);

  const updatedTreatment = await treatmentService.updateTreatment(req.params.id, req.body);
  res.status(200).json(updatedTreatment);
});

// @desc    Complete a treatment
// @route   POST /api/treatments/:id/complete
// @access  Private
export const completeTreatment = asyncHandler(async (req: Request, res: Response) => {
  const treatment = await treatmentService.getTreatmentById(req.params.id);

  // Check if user has access to complete this treatment
  requireTreatmentAccess(treatment, req.user);

  let priorityUpdateStatus = null;

  // Parse priorityId - handles both single IDs and JSON arrays for combined treatments
  const orderIds = parseOrderIds(treatment.priorityId);

  logger.info(`Completing treatment with ${orderIds.length} Priority order(s): ${orderIds.join(', ')}`);

  // For removal treatments, only update Priority if we have a valid Priority ID
  // Test data and local removals might not have Priority orders
  if (treatment.type === 'removal' && (!treatment.priorityId || treatment.priorityId === treatment.id)) {
    logger.info(`Skipping Priority update for removal treatment ${req.params.id} - no valid Priority order`);
    priorityUpdateStatus = 'Priority update skipped (local removal)';
  } else {
    // Try to update treatment status in Priority system for ALL orders
    try {
      const status = treatment.type === 'removal' ? 'Removed' : 'Performed';
      const updatedOrders: string[] = [];
      const failedOrders: string[] = [];

      // Update each Priority order
      for (const orderId of orderIds) {
        try {
          logger.info(`Updating Priority order ${orderId} to status ${status}`);
          const statusResult = await applicatorService.updateTreatmentStatusInPriority(
            req.params.id,
            status,
            orderId  // Pass specific order ID for pancreas treatments
          );

          if (statusResult.success) {
            updatedOrders.push(orderId);
            logger.info(`Successfully updated Priority order ${orderId}`);
          } else {
            failedOrders.push(orderId);
            logger.warn(`Failed to update Priority order ${orderId}: ${statusResult.message}`);
          }
        } catch (orderError: any) {
          failedOrders.push(orderId);
          logger.error(`Error updating Priority order ${orderId}:`, orderError);
        }
      }

      // Determine overall success
      if (updatedOrders.length === orderIds.length) {
        priorityUpdateStatus = `All ${orderIds.length} Priority order(s) updated successfully`;
      } else if (updatedOrders.length > 0) {
        priorityUpdateStatus = `Partial update: ${updatedOrders.length}/${orderIds.length} orders updated. Failed: ${failedOrders.join(', ')}`;
        // For insertion treatments with partial failure, this is still an error
        if (treatment.type === 'insertion' && failedOrders.length > 0) {
          res.status(500);
          throw new Error(`Failed to update ${failedOrders.length} Priority order(s): ${failedOrders.join(', ')}`);
        }
      } else {
        // No orders updated successfully
        priorityUpdateStatus = `Failed to update all ${orderIds.length} Priority order(s)`;
        if (treatment.type === 'insertion') {
          res.status(500);
          throw new Error(`Failed to update all Priority orders`);
        }
      }
    } catch (error: any) {
      // For removal treatments, log error and continue
      if (treatment.type === 'removal') {
        logger.error(`Error updating Priority for removal ${req.params.id}:`, error);
        priorityUpdateStatus = 'Priority update failed (continuing with local completion)';
      } else {
        // For insertion treatments, propagate the error
        throw error;
      }
    }
  }

  // Complete treatment locally
  const completedTreatment = await treatmentService.completeTreatment(req.params.id, req.user.id);

  res.status(200).json({
    ...completedTreatment,
    priorityStatus: priorityUpdateStatus
  });
});

// @desc    Update removal procedure data
// @route   PUT /api/treatments/:id/removal-procedure
// @access  Private
export const updateRemovalProcedure = asyncHandler(async (req: Request, res: Response) => {
  const treatment = await treatmentService.getTreatmentById(req.params.id);

  // Check if user has access to this treatment
  requireTreatmentAccess(treatment, req.user);

  // Validate treatment type
  if (treatment.type !== 'removal') {
    res.status(400);
    throw new Error('This endpoint is only for removal treatments');
  }

  const updatedTreatment = await treatmentService.updateRemovalProcedure(req.params.id, req.body);

  res.status(200).json({
    success: true,
    treatment: updatedTreatment,
    message: 'Removal procedure data saved successfully'
  });
});

// @desc    Update treatment status in Priority
// @route   PATCH /api/treatments/:id/status
// @access  Private
export const updateTreatmentStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.body;

  if (!['Performed', 'Removed'].includes(status)) {
    res.status(400);
    throw new Error('Status must be either "Performed" or "Removed"');
  }

  const treatment = await treatmentService.getTreatmentById(req.params.id);

  // Check if user has access to update this treatment
  requireTreatmentAccess(treatment, req.user);

  // Update treatment status in Priority system
  const statusResult = await applicatorService.updateTreatmentStatusInPriority(
    req.params.id, 
    status
  );
  
  if (!statusResult.success) {
    res.status(500);
    throw new Error(statusResult.message || 'Failed to update treatment status in Priority');
  }
  
  res.status(200).json(statusResult);
});

// @desc    Get applicators for a treatment
// @route   GET /api/treatments/:id/applicators
// @access  Private
export const getTreatmentApplicators = asyncHandler(async (req: Request, res: Response) => {
  const treatment = await treatmentService.getTreatmentById(req.params.id);

  // Check if user has access to this treatment
  requireTreatmentAccess(treatment, req.user);

  logger.info(`Getting applicators for treatment ${req.params.id}, type: ${treatment.type}, user: ${req.user.email}`);

  // For completed treatments, use local database which has accurate 8-state status values
  // Priority API only has 3-state USINGTYPE, so status would be lost if we fetch from there
  if (treatment.isComplete) {
    logger.info(`Treatment ${req.params.id} is complete - fetching from local database to preserve status`);
    const applicators = await applicatorService.getApplicators(req.params.id, treatment.type);
    res.status(200).json(applicators);
    return;
  }

  // Parse priorityId - handles both single IDs and JSON arrays for combined treatments
  const orderIds = parseOrderIds(treatment.priorityId);

  logger.info(`Treatment has ${orderIds.length} Priority order(s): ${orderIds.join(', ')}`);

  // Build user context for test mode support
  const userContext = buildUserContext(req);

  // For combined treatments (pancreas), fetch applicators from Priority API for ALL orders
  if (orderIds.length > 1) {
    try {
      const allApplicators = [];
      for (const orderId of orderIds) {
        const orderApplicators = await priorityService.getOrderSubform(
          orderId,
          userContext,
          treatment.type
        );

        if (orderApplicators && orderApplicators.length > 0) {
          allApplicators.push(...orderApplicators);
        }
      }

      if (allApplicators.length > 0) {
        logger.info(`Total applicators from combined treatment: ${allApplicators.length}`);

        // Use shared utility for enrichment and formatting
        const seedLength = orderIds.length > 0 ? await fetchSeedLength(orderIds[0]) : null;
        const formattedApplicators = await formatAndEnrichApplicators(allApplicators, {
          treatmentId: req.params.id,
          priorityIdPrefix: treatment.priorityId,
          defaultUserId: req.user.id,
          seedLength
        });

        res.status(200).json(formattedApplicators);
        return;
      }
    } catch (error) {
      logger.error(`Error fetching applicators for combined treatment: ${error}`);
      // Fall through to database query
    }
  }

  // For single orders with real users, also fetch from Priority API and format properly
  if (orderIds.length === 1 && req.user.email !== config.testUserEmail) {
    try {
      logger.info(`Single order treatment - fetching from Priority API for order ${orderIds[0]}`);

      const orderApplicators = await priorityService.getOrderSubform(
        orderIds[0],
        userContext,
        treatment.type
      );

      if (orderApplicators && orderApplicators.length > 0) {
        logger.info(`Found ${orderApplicators.length} applicators from Priority for single order`);

        // Use shared utility for enrichment and formatting
        const seedLength = await fetchSeedLength(orderIds[0]);
        const formattedApplicators = await formatAndEnrichApplicators(orderApplicators, {
          treatmentId: req.params.id,
          priorityIdPrefix: treatment.priorityId,
          defaultUserId: req.user.id,
          seedLength
        });

        res.status(200).json(formattedApplicators);
        return;
      }
    } catch (error) {
      logger.error(`Error fetching applicators for single order: ${error}`);
      // Fall through to database query
    }
  }

  // For test user removals, load applicators from test data
  // For removal treatments with test user, prioritize subjectId as it contains the original order
  // This handles cases where priorityId might have been auto-generated
  const treatmentNumber = (req.user.email === config.testUserEmail && treatment.type === 'removal')
    ? (treatment.subjectId || treatment.priorityId)
    : (treatment.priorityId || treatment.subjectId);

  if (req.user.email === config.testUserEmail && treatment.type === 'removal' && treatmentNumber) {
    logger.info(`Test user removal treatment - loading from test data for order ${treatmentNumber}`);

    try {
      // For combined treatments, fetch applicators from all orders
      // Use treatmentNumber as fallback when orderIds is empty (removal treatments have NULL priorityId)
      const allApplicators = [];
      const orderIdsToFetch = orderIds.length > 0 ? orderIds : [treatmentNumber];
      for (const orderId of orderIdsToFetch) {
        const testApplicators = await priorityService.getOrderSubform(
          orderId,
          userContext,
          treatment.type
        );

        if (testApplicators && testApplicators.length > 0) {
          allApplicators.push(...testApplicators);
        }
      }

      if (allApplicators.length > 0) {
        logger.info(`Found ${allApplicators.length} applicators from test data (${orderIds.length} order(s))`);

        // Use shared utility for enrichment and formatting
        const seedLength = await fetchSeedLength(treatmentNumber);
        const formattedApplicators = await formatAndEnrichApplicators(allApplicators, {
          treatmentId: req.params.id,
          priorityIdPrefix: treatmentNumber,
          defaultUserId: req.user.id,
          seedLength
        });

        res.status(200).json(formattedApplicators);
        return;
      }
    } catch (error) {
      logger.error(`Error loading test data applicators: ${error}`);
      // Fall back to database query
    }
  }

  // Standard flow - get from database
  const applicators = await applicatorService.getApplicators(req.params.id, treatment.type);
  res.status(200).json(applicators);
});

// @desc    Add an applicator to a treatment
// @route   POST /api/treatments/:id/applicators
// @access  Private
export const addApplicator = asyncHandler(async (req: Request, res: Response) => {
  const treatmentId = req.params.id;

  if (!treatmentId) {
    res.status(400);
    throw new Error('Treatment ID is required');
  }

  if (!req.user?.id) {
    res.status(401);
    throw new Error('User authentication required');
  }

  logger.info(`Adding applicator to treatment ${treatmentId}`, {
    userId: req.user.id,
    serialNumber: req.body.serialNumber
  });

  const transaction = await sequelize.transaction();

  try {
    const treatment = await treatmentService.getTreatmentById(treatmentId, transaction);

    // Check user authorization
    if (req.user.role !== 'admin' && treatment.userId !== req.user.id) {
      await transaction.rollback();
      res.status(403);
      throw new Error('Not authorized to modify this treatment');
    }

    // Validate treatment state
    if (treatment.isComplete) {
      await transaction.rollback();
      res.status(400);
      throw new Error('Cannot add applicator to a completed treatment');
    }

    const applicator = await applicatorService.addApplicatorWithTransaction(
      treatment,
      req.body,
      req.user.id,
      transaction
    );

    await transaction.commit();

    logger.info(`Applicator ${applicator.serialNumber} added to treatment ${treatmentId}`);

    res.status(201).json(applicator);
  } catch (error: any) {
    await transaction.rollback();

    logger.error(`Failed to add applicator to treatment ${treatmentId}: ${error.message}`);

    // Return appropriate HTTP status based on error type
    if (error.message === 'Treatment not found') {
      res.status(404);
    } else if (error.message === 'Not authorized to modify this treatment') {
      res.status(403);
    } else if (error.message === 'Cannot add applicator to a completed treatment') {
      res.status(400);
    } else if (!res.statusCode || res.statusCode === 200) {
      res.status(500);
    }

    throw error;
  }
});

// @desc    Find treatments eligible for removal (13-21 days after insertion)
// @route   GET /api/treatments/removal-candidates
// @access  Private
export const getRemovalCandidates = asyncHandler(async (req: Request, res: Response) => {
  const { site, treatmentNumber } = req.query;

  logger.info('[TREATMENT_CONTROLLER] Getting removal candidates', {
    site,
    treatmentNumber,
    userId: req.user?.id
  });

  if (!site) {
    res.status(400);
    throw new Error('Site parameter is required');
  }

  // Build user context for test mode support
  const userContext = {
    identifier: req.user?.email || req.user?.id || '',
    userMetadata: req.user?.metadata
  };

  // Check for test user FIRST (existing pattern from priorityService)
  const isTestMode = req.user?.email === config.testUserEmail ||
    (req.user?.metadata?.testModeEnabled === true && Number(req.user?.metadata?.positionCode) === 99);

  if (isTestMode) {
    try {
      // Reuse existing method that already handles test data properly
      const orders = await priorityService.getOrdersForSiteWithFilter(
        site as string,
        userContext
      );

      // Filter for removal-ready orders matching test data statuses
      const removalCandidates = orders.filter((order: any) => {
        // Optional treatment number filter - handle base order names (removes _Y, _T, _M suffixes)
        if (treatmentNumber) {
          const baseOrderName = order.ORDNAME.replace(/_(Y|T|M)$/, '');
          if (baseOrderName !== treatmentNumber as string) {
            return false;
          }
        }

        // Check removal status from test data
        const isRemovalReady =
          order.ORDSTATUSDES === 'Waiting for removal' ||
          order.ORDSTATUSDES === 'Performed';

        return isRemovalReady;
      });

      if (removalCandidates.length > 0) {
        let candidate;

        if (treatmentNumber) {
          // Find the exact matching treatment (handle base order names)
          candidate = removalCandidates.find((order: any) => {
            const baseOrderName = order.ORDNAME.replace(/_(Y|T|M)$/, '');
            return baseOrderName === treatmentNumber;
          });
          if (!candidate) {
            res.status(404).json({
              isEligible: false,
              reason: `Treatment ${treatmentNumber} not found or not eligible for removal`
            });
            return;
          }
        } else {
          // No specific treatment requested, return first available
          candidate = removalCandidates[0];
        }
        const treatmentDate = new Date(candidate.SIBD_TREATDAY || candidate.CURDATE);
        const daysSinceInsertion = Math.floor(
          (Date.now() - treatmentDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        const candidateResponse = {
          treatmentId: candidate.ORDNAME.replace(/_(Y|T|M)$/, ''), // Return base order name without suffix
          subjectId: candidate.ORDNAME.replace(/_(Y|T|M)$/, ''), // Add this for frontend compatibility
          patientName: candidate.patientName || candidate.DETAILS || candidate.PNAME || 'Test Patient', // Use patientName from mapping or fallback to DETAILS/PNAME
          insertionDate: candidate.SIBD_TREATDAY || candidate.CURDATE,
          daysSinceInsertion,
          status: candidate.ORDSTATUSDES,
          seedQuantity: candidate.SBD_SEEDQTY || 0, // Use correct field from test data
          activityPerSeed: candidate.SBD_PREFACTIV || 0, // Add this field
          activity: (candidate.SBD_SEEDQTY || 0) * (candidate.SBD_PREFACTIV || 0), // Calculate total activity
          surgeon: candidate.SURGEON || 'Dr. Test', // Add surgeon field
          isEligible: true,
          site: candidate.CUSTNAME
        };

        res.json(candidateResponse);
        return;
      } else {
        if (treatmentNumber) {
          res.status(404).json({
            success: false,
            message: `Treatment ${treatmentNumber} not found at site ${site}`,
            treatmentNumber,
            site
          });
        } else {
          res.status(404).json({
            isEligible: false,
            reason: 'No removal candidates found in test data'
          });
        }
        return;
      }
    } catch (error: any) {
      logger.error(`Error getting test removal candidates: ${error.message}`);
      res.status(500).json({
        isEligible: false,
        reason: 'Error retrieving test removal candidates'
      });
      return;
    }
  }

  // EXISTING LOGIC - Real users use database
  try {
    // If treatmentNumber is provided, search for specific treatment
    if (treatmentNumber) {
      const treatment = await treatmentService.getTreatmentBySubjectId(treatmentNumber as string, site as string);

      if (!treatment) {
        res.status(404).json({
          success: false,
          message: 'Treatment not found',
          treatmentNumber,
          site
        });
        return;
      }

      // Calculate days since insertion
      const treatmentDate = new Date(treatment.date);
      const today = new Date();
      const daysSinceInsertion = Math.floor((today.getTime() - treatmentDate.getTime()) / (1000 * 60 * 60 * 24));

      // Check if treatment is eligible for removal (13-21 days)
      const isEligible = daysSinceInsertion >= 13 && daysSinceInsertion <= 21;
      const isInsertion = treatment.type === 'insertion';
      const isCompleted = treatment.isComplete;

      // Get applicators for this treatment
      const applicators = await applicatorService.getApplicators(treatment.id);

      // Serialize to avoid circular references from Sequelize associations
      const treatmentJson = typeof treatment.toJSON === 'function' ? treatment.toJSON() : treatment;
      const applicatorsJson = applicators.map(a =>
        typeof a.toJSON === 'function' ? a.toJSON() : a
      );

      res.status(200).json({
        success: true,
        treatment: {
          ...treatmentJson,
          daysSinceInsertion,
          isEligible: isEligible && isInsertion && isCompleted,
          eligibilityReasons: {
            daysSinceInsertion,
            validDayRange: daysSinceInsertion >= 13 && daysSinceInsertion <= 21,
            isInsertion,
            isCompleted
          }
        },
        applicators: applicatorsJson
      });
    } else {
      // Find all treatments eligible for removal for this site
      const eligibleTreatments = await treatmentService.getRemovalCandidates(site as string, req.user?.id || '');

      res.status(200).json({
        success: true,
        treatments: eligibleTreatments,
        count: eligibleTreatments.length
      });
    }
  } catch (error: any) {
    logger.error('[TREATMENT_CONTROLLER] Error getting removal candidates', {
      error: error.message,
      site,
      treatmentNumber,
      userId: req.user?.id
    });

    res.status(500);
    throw new Error(error.message || 'Failed to get removal candidates');
  }
});

// @desc    Export treatment data
// @route   GET /api/treatments/:id/export
// @access  Private
export const exportTreatment = asyncHandler(async (req: Request, res: Response) => {
  const { format = 'csv' } = req.query;
  const treatment = await treatmentService.getTreatmentById(req.params.id);

  // Check if user has access to this treatment
  requireTreatmentAccess(treatment, req.user);

  const applicators = await applicatorService.getApplicators(req.params.id);
  
  // Generate export data based on format
  if (format === 'csv') {
    // Generate CSV
    let csv = 'Serial Number,Seed Quantity,Usage Type,Insertion Time,Comments,Is Removed\n';
    
    applicators.forEach(app => {
      csv += `${app.serialNumber},${app.seedQuantity},${app.usageType},${app.insertionTime},${app.comments || ''},${app.isRemoved ? 'Yes' : 'No'}\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=treatment-${treatment.id}.csv`);
    res.send(csv);
  } else if (format === 'pdf') {
    // Return stored PDF from database
    const pdf = await TreatmentPdf.findOne({ where: { treatmentId: treatment.id } });
    if (!pdf) {
      res.status(404);
      throw new Error('PDF not found - treatment may not be finalized');
    }

    logger.info(`PDF downloaded for treatment ${treatment.id} by user ${req.user?.id}`);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=treatment-${treatment.id}.pdf`);
    res.setHeader('Content-Length', pdf.pdfSizeBytes.toString());
    res.send(pdf.pdfData);
  } else {
    res.status(400);
    throw new Error('Unsupported export format');
  }
});

// ========== FINALIZATION ENDPOINTS ==========

// @desc    Initiate finalization - determine user flow (hospital_auto vs alphatau_verification)
// @route   POST /api/treatments/:id/finalize/initiate
// @access  Private
export const initializeFinalization = asyncHandler(async (req: Request, res: Response) => {
  const treatment = await treatmentService.getTreatmentById(req.params.id);

  // Check if user has access to this treatment
  requireTreatmentAccess(treatment, req.user);

  // Check if treatment is already finalized (has a PDF)
  const existingPdf = await TreatmentPdf.findOne({ where: { treatmentId: treatment.id } });
  if (existingPdf) {
    res.status(400).json({
      success: false,
      error: 'Treatment has already been finalized',
      existingSignature: {
        signerName: existingPdf.signerName,
        signedAt: existingPdf.signedAt,
        signatureType: existingPdf.signatureType,
      },
    });
    return;
  }

  // Determine user flow based on position code
  const isAlphaTau = isAlphaTauAdmin(req.user);

  logger.info(`Finalization initiated for treatment ${treatment.id}`, {
    userId: req.user.id,
    positionCode: req.user.metadata?.positionCode,
    flow: isAlphaTau ? 'alphatau_verification' : 'hospital_auto',
  });

  if (isAlphaTau) {
    // Alpha Tau users need to select someone to sign
    res.status(200).json({
      success: true,
      flow: 'alphatau_verification',
      requiresEmailSelection: true,
      treatmentId: treatment.id,
      treatmentSite: treatment.site
    });
  } else {
    // Hospital users can auto-sign with their login credentials
    res.status(200).json({
      success: true,
      flow: 'hospital_auto',
      signerName: req.user.name,
      signerEmail: req.user.email,
      signerPosition: req.user.metadata?.positionCode?.toString() || 'hospital_staff',
      treatmentId: treatment.id
    });
  }
});

// @desc    Get site users for email selection (Position 99 only)
// @route   GET /api/treatments/:id/finalize/site-users
// @access  Private (Position 99 only)
export const getSiteUsersForFinalization = asyncHandler(async (req: Request, res: Response) => {
  // Only Position 99 users can access this
  if (!isAlphaTauAdmin(req.user)) {
    res.status(403);
    throw new Error('Only Alpha Tau administrators can access site users');
  }

  const treatment = await treatmentService.getTreatmentById(req.params.id);

  logger.info(`Getting site users for finalization`, {
    treatmentId: treatment.id,
    site: treatment.site,
    userId: req.user.id
  });

  try {
    // Get users from Priority PHONEBOOK for this site
    const siteUsers = await priorityService.getSiteUsers(treatment.site);

    // Filter and format users for the dropdown
    const formattedUsers = siteUsers.map((user: any) => ({
      email: user.EMAIL || user.email,
      name: user.NAME || user.name || user.EMAIL || user.email,
      position: user.POSITIONDES || user.positionDes || 'Staff'
    })).filter((user: any) => user.email); // Only include users with email

    res.status(200).json({
      success: true,
      users: formattedUsers,
      site: treatment.site
    });
  } catch (error: any) {
    logger.error(`Error getting site users for finalization: ${error.message}`);
    res.status(500);
    throw new Error('Failed to retrieve site users');
  }
});

// @desc    Send verification code to target email (Position 99 only)
// @route   POST /api/treatments/:id/finalize/send-code
// @access  Private (Position 99 only)
export const sendFinalizationCode = asyncHandler(async (req: Request, res: Response) => {
  const { targetEmail } = req.body;

  // Only Position 99 users can send codes
  if (!isAlphaTauAdmin(req.user)) {
    res.status(403);
    throw new Error('Only Alpha Tau administrators can send verification codes');
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!targetEmail || !emailRegex.test(targetEmail)) {
    res.status(400);
    throw new Error('Valid email address is required');
  }

  const treatment = await treatmentService.getTreatmentById(req.params.id);

  logger.info(`Sending finalization code`, {
    treatmentId: treatment.id,
    targetEmail,
    requestedBy: req.user.id
  });

  // Check for existing pending verification
  const existingVerification = await SignatureVerification.findOne({
    where: {
      treatmentId: treatment.id,
      status: 'pending'
    }
  });

  if (existingVerification && existingVerification.isStillValid()) {
    // Update existing verification with new code
    const newCode = await existingVerification.generateCode();
    existingVerification.targetEmail = targetEmail;
    await existingVerification.save();

    // Send the code via email
    try {
      await sendVerificationCode(targetEmail, newCode);
    } catch (emailError: any) {
      logger.warn(`Failed to send verification email: ${emailError.message}`);
      // Continue anyway - code is logged in dev mode
    }

    res.status(200).json({
      success: true,
      message: 'Verification code sent',
      verificationId: existingVerification.id,
      expiresIn: 3600 // 1 hour in seconds
    });
    return;
  }

  // Create new verification record
  const verification = await SignatureVerification.create({
    treatmentId: treatment.id,
    targetEmail,
    verificationCode: 'placeholder', // Will be replaced by generateCode
    verificationExpires: new Date(), // Will be replaced by generateCode
    status: 'pending'
  });

  // Generate and send the actual code
  const code = await verification.generateCode();

  try {
    await sendVerificationCode(targetEmail, code);
    logger.info(`Verification code sent to ${targetEmail} for treatment ${treatment.id}`);
  } catch (emailError: any) {
    logger.warn(`Failed to send verification email: ${emailError.message}`);
    // Continue anyway - code is logged in dev mode
  }

  res.status(200).json({
    success: true,
    message: 'Verification code sent',
    verificationId: verification.id,
    expiresIn: 3600 // 1 hour in seconds
  });
});

// @desc    Verify code and finalize treatment (Position 99 flow)
// @route   POST /api/treatments/:id/finalize/verify
// @access  Private (Position 99 only)
export const verifyAndFinalize = asyncHandler(async (req: Request, res: Response) => {
  const { code, signerName, signerPosition, availableApplicators } = req.body;

  // Only Position 99 users can verify
  // Use Number() to handle both string and number types from JSON storage
  const positionCode = req.user.metadata?.positionCode;
  if (Number(positionCode) !== 99) {
    res.status(403);
    throw new Error('Only Alpha Tau administrators can verify signatures');
  }

  // Validate required fields
  if (!code || !signerName || !signerPosition) {
    res.status(400);
    throw new Error('Code, signer name, and position are required');
  }

  const treatment = await treatmentService.getTreatmentById(req.params.id);

  // Find pending verification for this treatment
  const verification = await SignatureVerification.findOne({
    where: {
      treatmentId: treatment.id,
      status: 'pending'
    },
    order: [['createdAt', 'DESC']]
  });

  if (!verification) {
    res.status(404);
    throw new Error('No pending verification found. Please request a new code.');
  }

  // Verify the code
  const isValid = await verification.verifyCode(code);

  if (!isValid) {
    const remainingAttempts = verification.getRemainingAttempts();

    if (verification.status === 'expired') {
      res.status(401).json({
        success: false,
        error: 'Verification code has expired. Please request a new code.',
        attemptsRemaining: 0
      });
      return;
    }

    if (verification.status === 'failed') {
      res.status(401).json({
        success: false,
        error: 'Too many failed attempts. Please request a new code.',
        attemptsRemaining: 0
      });
      return;
    }

    res.status(401).json({
      success: false,
      error: 'Invalid verification code',
      attemptsRemaining: remainingAttempts
    });
    return;
  }

  // Update verification with signer details
  verification.signerName = signerName;
  verification.signerPosition = signerPosition;
  await verification.save();

  logger.info(`Verification successful for treatment ${treatment.id}`, {
    signerName,
    signerPosition,
    targetEmail: verification.targetEmail,
  });

  // Get applicators and merge with unused available applicators
  let processedApplicators = await applicatorService.getApplicators(treatment.id, treatment.type);

  if (treatment.type === 'removal') {
    processedApplicators = await getRemovalApplicators(
      treatment, availableApplicators, processedApplicators, req.user.email, req.user.id
    );
  }

  const allApplicators = mergeApplicatorsForPdf(processedApplicators, availableApplicators);

  const signatureDetails: SignatureDetails = {
    type: 'alphatau_verified',
    signerName,
    signerEmail: verification.targetEmail,
    signerPosition,
    signedAt: new Date(),
  };

  const continuationInfo = await getContinuationInfo(treatment);
  const { pdfId, emailStatus } = await finalizeAndSendPdf(
    treatment,
    allApplicators,
    signatureDetails,
    continuationInfo
  );

  // Mark treatment as complete
  await treatmentService.completeTreatment(treatment.id, req.user.id);

  res.status(200).json({
    success: true,
    message: treatment.type === 'removal'
      ? 'Removal treatment finalized successfully (no PDF generated)'
      : 'Treatment finalized successfully',
    pdfId,
    signatureDetails: {
      signerName,
      signerPosition,
      signedAt: new Date(),
      type: 'alphatau_verified',
    },
    emailStatus
  });
});

// @desc    Auto-finalize treatment (Hospital user flow)
// @route   POST /api/treatments/:id/finalize/auto
// @access  Private (Non-Position 99 users)
export const autoFinalize = asyncHandler(async (req: Request, res: Response) => {
  // Only non-Position 99 users can auto-finalize
  if (isAlphaTauAdmin(req.user)) {
    res.status(403);
    throw new Error('Alpha Tau administrators must use verification flow');
  }

  const treatment = await treatmentService.getTreatmentById(req.params.id);

  // Check if user has access to this treatment
  requireTreatmentAccess(treatment, req.user);

  // Check if treatment is already finalized
  const existingPdf = await TreatmentPdf.findOne({ where: { treatmentId: treatment.id } });
  if (existingPdf) {
    res.status(400).json({
      success: false,
      error: 'Treatment has already been finalized',
      existingSignature: {
        signerName: existingPdf.signerName,
        signedAt: existingPdf.signedAt,
        signatureType: existingPdf.signatureType,
      },
    });
    return;
  }

  // Extract optional signer details from request body (from hospital confirmation modal)
  const { signerName: requestSignerName, signerPosition: requestSignerPosition, availableApplicators } = req.body;

  // Use provided values or fall back to user data
  const positionCode = req.user.metadata?.positionCode;
  const signerName = requestSignerName?.trim() || req.user.name;
  const signerPosition = requestSignerPosition || positionCode?.toString() || 'hospital_staff';

  logger.info(`Auto-finalizing treatment ${treatment.id}`, {
    userId: req.user.id,
    userName: req.user.name,
    userEmail: req.user.email,
    providedSignerName: requestSignerName,
    providedSignerPosition: requestSignerPosition,
    effectiveSignerName: signerName,
    effectiveSignerPosition: signerPosition,
  });

  // Get applicators and merge with unused available applicators
  let processedApplicators = await applicatorService.getApplicators(treatment.id, treatment.type);

  if (treatment.type === 'removal') {
    processedApplicators = await getRemovalApplicators(
      treatment, availableApplicators, processedApplicators, req.user.email, req.user.id
    );
  }

  const allApplicators = mergeApplicatorsForPdf(processedApplicators, availableApplicators);

  const signatureDetails: SignatureDetails = {
    type: 'hospital_auto',
    signerName,
    signerEmail: req.user.email,
    signerPosition,
    signedAt: new Date(),
  };

  const continuationInfo = await getContinuationInfo(treatment);
  const { pdfId, emailStatus } = await finalizeAndSendPdf(
    treatment,
    allApplicators,
    signatureDetails,
    continuationInfo
  );

  // Mark treatment as complete
  await treatmentService.completeTreatment(treatment.id, req.user.id);

  res.status(200).json({
    success: true,
    message: treatment.type === 'removal'
      ? 'Removal treatment finalized successfully (no PDF generated)'
      : 'Treatment finalized successfully',
    pdfId,
    signatureDetails: {
      signerName,
      signerPosition,
      signedAt: new Date(),
      type: 'hospital_auto',
    },
    emailStatus,
  });
});

// ============================================================================
// TREATMENT CONTINUATION ENDPOINTS
// ============================================================================

/**
 * @desc    Check if treatment can be continued (within 24-hour window)
 * @route   GET /api/treatments/:id/continuable
 * @access  Private
 */
export const checkContinuable = asyncHandler(async (req: Request, res: Response) => {
  const treatmentId = req.params.id;

  logger.info(`[TREATMENT_CONTINUATION] Checking continuability for treatment ${treatmentId}`, {
    userId: req.user?.id,
    treatmentId
  });

  const eligibility = await treatmentService.checkContinuationEligibility(treatmentId);

  res.status(200).json({
    success: true,
    ...eligibility
  });
});

/**
 * @desc    Create a continuation treatment
 * @route   POST /api/treatments/:id/continue
 * @access  Private
 */
export const createContinuation = asyncHandler(async (req: Request, res: Response) => {
  const parentTreatmentId = req.params.id;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401);
    throw new Error('User not authenticated');
  }

  logger.info(`[TREATMENT_CONTINUATION] Creating continuation for treatment ${parentTreatmentId}`, {
    userId,
    parentTreatmentId
  });

  // Check eligibility first
  const eligibility = await treatmentService.checkContinuationEligibility(parentTreatmentId);
  if (!eligibility.canContinue) {
    res.status(400);
    throw new Error(eligibility.reason || 'Treatment cannot be continued');
  }

  // Create the continuation treatment
  const continuation = await treatmentService.createContinuationTreatment(parentTreatmentId, userId);

  logger.info(`[TREATMENT_CONTINUATION] Continuation created successfully`, {
    parentTreatmentId,
    continuationId: continuation.id,
    userId
  });

  res.status(201).json({
    success: true,
    treatment: continuation
  });
});

/**
 * @desc    Get all continuation treatments for a parent
 * @route   GET /api/treatments/:id/continuations
 * @access  Private
 */
export const getContinuations = asyncHandler(async (req: Request, res: Response) => {
  const treatmentId = req.params.id;

  logger.info(`[TREATMENT_CONTINUATION] Getting continuations for treatment ${treatmentId}`, {
    userId: req.user?.id,
    treatmentId
  });

  const continuations = await treatmentService.getContinuations(treatmentId);

  res.status(200).json({
    success: true,
    continuations,
    count: continuations.length
  });
});

/**
 * @desc    Get parent treatment for a continuation
 * @route   GET /api/treatments/:id/parent
 * @access  Private
 */
export const getParentTreatment = asyncHandler(async (req: Request, res: Response) => {
  const treatmentId = req.params.id;

  logger.info(`[TREATMENT_CONTINUATION] Getting parent treatment for ${treatmentId}`, {
    userId: req.user?.id,
    treatmentId
  });

  const parentTreatment = await treatmentService.getParentTreatment(treatmentId);

  if (!parentTreatment) {
    res.status(200).json({
      success: true,
      parentTreatment: null,
      message: 'This treatment is not a continuation'
    });
    return;
  }

  res.status(200).json({
    success: true,
    parentTreatment
  });
});

// Default export for test compatibility
export default {
  getTreatments,
  getTreatmentById,
  createTreatment,
  updateTreatment,
  completeTreatment,
  updateRemovalProcedure,
  updateTreatmentStatus,
  getTreatmentApplicators,
  addApplicator,
  getRemovalCandidates,
  exportTreatment,
  initializeFinalization,
  getSiteUsersForFinalization,
  sendFinalizationCode,
  verifyAndFinalize,
  autoFinalize,
  checkContinuable,
  createContinuation,
  getContinuations,
  getParentTreatment
};