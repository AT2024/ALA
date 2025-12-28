import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import treatmentService from '../services/treatmentService';
import applicatorService from '../services/applicatorService';
import priorityService from '../services/priorityService';
import sequelize from '../config/database';
import { Treatment, TreatmentPdf, SignatureVerification } from '../models';
import { QueryTypes } from 'sequelize';
import logger from '../utils/logger';
import { generateTreatmentPdf, calculateSummary } from '../services/pdfGenerationService';
import { sendSignedPdf, sendVerificationCode, getPdfRecipientEmail } from '../services/emailService';
import { config } from '../config/appConfig';

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
  
  res.status(200).json(treatments);
});

// @desc    Get a single treatment by ID
// @route   GET /api/treatments/:id
// @access  Private
export const getTreatmentById = asyncHandler(async (req: Request, res: Response) => {
  const treatment = await treatmentService.getTreatmentById(req.params.id);
  
  // Check if user has access to this treatment
  if (req.user.role !== 'admin' && treatment.userId !== req.user.id) {
    res.status(403);
    throw new Error('Not authorized to access this treatment');
  }
  
  res.status(200).json(treatment);
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
  if (req.user.role !== 'admin' && treatment.userId !== req.user.id) {
    res.status(403);
    throw new Error('Not authorized to update this treatment');
  }
  
  const updatedTreatment = await treatmentService.updateTreatment(req.params.id, req.body);
  res.status(200).json(updatedTreatment);
});

// @desc    Complete a treatment
// @route   POST /api/treatments/:id/complete
// @access  Private
export const completeTreatment = asyncHandler(async (req: Request, res: Response) => {
  const treatment = await treatmentService.getTreatmentById(req.params.id);

  // Check if user has access to complete this treatment
  if (req.user.role !== 'admin' && treatment.userId !== req.user.id) {
    res.status(403);
    throw new Error('Not authorized to complete this treatment');
  }

  let priorityUpdateStatus = null;

  // Parse priorityId - it could be a single ID or a JSON array for combined pancreas treatments
  let orderIds: string[] = [];
  if (treatment.priorityId) {
    try {
      const parsed = JSON.parse(treatment.priorityId);
      orderIds = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      // Not JSON, treat as single ID
      orderIds = [treatment.priorityId];
    }
  }

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
  if (req.user.role !== 'admin' && treatment.userId !== req.user.id) {
    res.status(403);
    throw new Error('Not authorized to update this treatment');
  }
  
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
  if (req.user.role !== 'admin' && treatment.userId !== req.user.id) {
    res.status(403);
    throw new Error('Not authorized to access this treatment');
  }

  logger.info(`Getting applicators for treatment ${req.params.id}, type: ${treatment.type}, user: ${req.user.email}`);

  // Parse priorityId - it could be a single ID or a JSON array for combined pancreas treatments
  let orderIds: string[] = [];
  if (treatment.priorityId) {
    try {
      const parsed = JSON.parse(treatment.priorityId);
      orderIds = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      // Not JSON, treat as single ID
      orderIds = [treatment.priorityId];
    }
  }

  logger.info(`Treatment has ${orderIds.length} Priority order(s): ${orderIds.join(', ')}`);

  // For combined treatments (pancreas), fetch applicators from Priority API for ALL orders
  if (orderIds.length > 1) {
    try {
      const allApplicators = [];
      for (const orderId of orderIds) {
        const orderApplicators = await priorityService.getOrderSubform(
          orderId,
          req.user.email,
          treatment.type
        );

        if (orderApplicators && orderApplicators.length > 0) {
          allApplicators.push(...orderApplicators);
        }
      }

      if (allApplicators.length > 0) {
        logger.info(`Total applicators from combined treatment: ${allApplicators.length}`);

        // Transform Priority data to match our applicator format
        const formattedApplicators = allApplicators.map((app: any) => ({
          id: app.SIBD_REPPRODPAL || `${treatment.priorityId}-${app.SERNUM}`,
          serialNumber: app.SERNUM,
          treatmentId: req.params.id,
          seedQuantity: app.INTDATA2 || 0,
          usageType: app.USINGTYPE || 'full',
          insertionTime: app.INSERTIONDATE || new Date().toISOString(),
          comments: app.INSERTIONCOMMENTS || '',
          image: app.EXTFILENAME || null,
          addedBy: app.INSERTEDREPORTEDBY || req.user.id,
          isRemoved: false,
          removalComments: null,
          removalImage: null,
          removedBy: null,
          removalTime: null,
          applicatorType: app.PARTDES || app.PARTNAME || 'Unknown Applicator',
          insertedSeedsQty: app.INSERTEDSEEDSQTY || app.INTDATA2 || 0
        }));

        res.status(200).json(formattedApplicators);
        return;
      }
    } catch (error) {
      logger.error(`Error fetching applicators for combined treatment: ${error}`);
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
          req.user.email,
          treatment.type
        );

        if (testApplicators && testApplicators.length > 0) {
          allApplicators.push(...testApplicators);
        }
      }

      if (allApplicators.length > 0) {
        logger.info(`Found ${allApplicators.length} applicators from test data (${orderIds.length} order(s))`);

        // Transform test data to match our applicator format
        const formattedApplicators = allApplicators.map((app: any) => ({
          id: app.SIBD_REPPRODPAL || `${treatmentNumber}-${app.SERNUM}`,
          serialNumber: app.SERNUM,
          treatmentId: req.params.id,
          seedQuantity: app.INTDATA2 || 0,
          usageType: app.USINGTYPE || 'full',
          insertionTime: app.INSERTIONDATE || new Date().toISOString(),
          comments: app.INSERTIONCOMMENTS || '',
          image: app.EXTFILENAME || null,
          addedBy: app.INSERTEDREPORTEDBY || req.user.id,
          isRemoved: false,
          removalComments: null,
          removalImage: null,
          removedBy: null,
          removalTime: null,
          applicatorType: app.PARTDES || app.PARTNAME || 'Unknown Applicator',
          insertedSeedsQty: app.INSERTEDSEEDSQTY || app.INTDATA2 || 0
        }));

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
  const requestId = `addApplicator_${Math.random().toString(36).substr(2, 9)}`;
  
  logger.info(`[TREATMENT_CONTROLLER] Starting addApplicator process`, {
    requestId,
    treatmentId,
    userId: req.user?.id,
    userRole: req.user?.role,
    requestBody: req.body,
    requestHeaders: {
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent']
    },
    timestamp: new Date().toISOString()
  });

  // STEP 1: Validate request parameters
  logger.debug(`[TREATMENT_CONTROLLER] [${requestId}] Step 1: Validating request parameters`);
  if (!treatmentId) {
    logger.error(`[TREATMENT_CONTROLLER] [${requestId}] Missing treatment ID in request`, {
      params: req.params,
      url: req.originalUrl
    });
    res.status(400);
    throw new Error('Treatment ID is required');
  }

  if (!req.user?.id) {
    logger.error(`[TREATMENT_CONTROLLER] [${requestId}] Missing user information`, {
      user: req.user,
      headers: req.headers.authorization ? '[PRESENT]' : '[MISSING]'
    });
    res.status(401);
    throw new Error('User authentication required');
  }

  // STEP 2: Start database transaction
  logger.debug(`[TREATMENT_CONTROLLER] [${requestId}] Step 2: Starting database transaction`);
  const transaction = await sequelize.transaction();
  
  try {
    // STEP 3: Get treatment within the transaction
    logger.debug(`[TREATMENT_CONTROLLER] [${requestId}] Step 3: Fetching treatment from database`);
    logger.info(`[TREATMENT_CONTROLLER] [${requestId}] Attempting to fetch treatment`, {
      treatmentId,
      hasTransaction: !!transaction,
      userId: req.user.id
    });

    const treatment = await treatmentService.getTreatmentById(treatmentId, transaction);
    
    logger.info(`[TREATMENT_CONTROLLER] [${requestId}] Treatment lookup result`, {
      treatmentId,
      treatmentFound: !!treatment,
      treatmentData: treatment ? {
        id: treatment.id,
        type: treatment.type,
        userId: treatment.userId,
        isComplete: treatment.isComplete,
        subjectId: treatment.subjectId,
        site: treatment.site
      } : null,
      hasTransaction: !!transaction
    });
    
    // STEP 4: Check user authorization
    logger.debug(`[TREATMENT_CONTROLLER] [${requestId}] Step 4: Checking user authorization`);
    if (req.user.role !== 'admin' && treatment.userId !== req.user.id) {
      logger.warn(`[TREATMENT_CONTROLLER] [${requestId}] Unauthorized access attempt`, {
        treatmentId,
        requestingUserId: req.user.id,
        treatmentOwnerId: treatment.userId,
        userRole: req.user.role,
        isAdmin: req.user.role === 'admin'
      });
      await transaction.rollback();
      res.status(403);
      throw new Error('Not authorized to modify this treatment');
    }

    // STEP 5: Validate treatment state
    logger.debug(`[TREATMENT_CONTROLLER] [${requestId}] Step 5: Validating treatment state`);
    if (treatment.isComplete) {
      logger.warn(`[TREATMENT_CONTROLLER] [${requestId}] Attempt to modify completed treatment`, {
        treatmentId,
        isComplete: treatment.isComplete,
        userId: req.user.id
      });
      await transaction.rollback();
      res.status(400);
      throw new Error('Cannot add applicator to a completed treatment');
    }

    // STEP 6: Call applicator service
    logger.debug(`[TREATMENT_CONTROLLER] [${requestId}] Step 6: Calling applicator service`);
    logger.info(`[TREATMENT_CONTROLLER] [${requestId}] Calling addApplicatorWithTransaction`, {
      treatmentId,
      treatmentType: treatment.type,
      requestData: req.body,
      userId: req.user.id,
      transactionActive: !!transaction
    });
    
    const applicator = await applicatorService.addApplicatorWithTransaction(
      treatment, 
      req.body, 
      req.user.id, 
      transaction
    );
    
    // STEP 7: Commit transaction
    logger.debug(`[TREATMENT_CONTROLLER] [${requestId}] Step 7: Committing transaction`);
    await transaction.commit();
    
    logger.info(`[TREATMENT_CONTROLLER] [${requestId}] Successfully added applicator`, {
      treatmentId,
      applicatorId: applicator.id,
      serialNumber: applicator.serialNumber,
      usageType: applicator.usageType,
      userId: req.user.id,
      processingTime: new Date().toISOString()
    });
    
    res.status(201).json(applicator);
  } catch (error: any) {
    // Rollback the transaction in case of error
    await transaction.rollback();
    
    logger.error(`[TREATMENT_CONTROLLER] [${requestId}] Error in addApplicator process`, {
      requestId,
      treatmentId,
      userId: req.user?.id,
      step: 'unknown', // This could be enhanced to track which step failed
      requestBody: req.body,
      error: {
        message: error.message,
        name: error.name,
        code: error.code,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        sqlMessage: error.original?.message,
        sqlCode: error.original?.code,
        constraint: error.original?.constraint
      },
      transactionRolledBack: true,
      timestamp: new Date().toISOString()
    });
    
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

// @desc    Debug treatment existence
// @route   GET /api/treatments/:id/debug
// @access  Private
export const debugTreatment = asyncHandler(async (req: Request, res: Response) => {
  const treatmentId = req.params.id;
  const debugId = `debug_${Math.random().toString(36).substr(2, 9)}`;
  
  logger.info(`[TREATMENT_DEBUG] Starting treatment debug`, {
    debugId,
    treatmentId,
    userId: req.user?.id
  });

  try {
    // Check if treatment exists without transaction
    const treatmentDirect = await Treatment.findByPk(treatmentId);
    
    // Check if treatment exists with transaction
    const transaction = await sequelize.transaction();
    let treatmentWithTransaction;
    try {
      treatmentWithTransaction = await Treatment.findByPk(treatmentId, { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    
    // Get all treatments for this user to see what exists
    const userTreatments = await Treatment.findAll({
      where: { userId: req.user.id },
      attributes: ['id', 'type', 'subjectId', 'site', 'isComplete', 'createdAt'],
      limit: 10,
      order: [['createdAt', 'DESC']]
    });
    
    // Check database table directly
    const [treatmentExists] = await sequelize.query(
      'SELECT id, type, "subjectId", site, "isComplete", "userId", "createdAt" FROM treatments WHERE id = :treatmentId',
      {
        replacements: { treatmentId },
        type: QueryTypes.SELECT
      }
    );
    
    const debugInfo = {
      treatmentId,
      checks: {
        existsDirectQuery: !!treatmentDirect,
        existsWithTransaction: !!treatmentWithTransaction,
        existsRawQuery: !!treatmentExists
      },
      treatmentData: {
        direct: treatmentDirect ? {
          id: treatmentDirect.id,
          type: treatmentDirect.type,
          userId: treatmentDirect.userId,
          isComplete: treatmentDirect.isComplete,
          createdAt: treatmentDirect.createdAt
        } : null,
        withTransaction: treatmentWithTransaction ? {
          id: treatmentWithTransaction.id,
          type: treatmentWithTransaction.type,
          userId: treatmentWithTransaction.userId,
          isComplete: treatmentWithTransaction.isComplete,
          createdAt: treatmentWithTransaction.createdAt
        } : null,
        rawQuery: treatmentExists || null
      },
      userTreatments: userTreatments.map((t: any) => ({
        id: t.id,
        type: t.type,
        subjectId: t.subjectId,
        site: t.site,
        isComplete: t.isComplete,
        createdAt: t.createdAt
      })),
      requestInfo: {
        userId: req.user.id,
        userRole: req.user.role,
        treatmentIdFormat: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(treatmentId)
      }
    };
    
    logger.info(`[TREATMENT_DEBUG] Debug information collected`, {
      debugId,
      treatmentId,
      found: debugInfo.checks,
      userTreatmentsCount: userTreatments.length
    });
    
    res.status(200).json({
      success: true,
      debug: debugInfo,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    logger.error(`[TREATMENT_DEBUG] Error in debug endpoint`, {
      debugId,
      treatmentId,
      error: {
        message: error.message,
        name: error.name,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
    
    res.status(500).json({
      success: false,
      error: error.message,
      debugId,
      timestamp: new Date().toISOString()
    });
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

  // Check for test user FIRST (existing pattern from priorityService)
  if (req.user?.email === config.testUserEmail) {
    try {
      // Reuse existing method that already handles test data properly
      const orders = await priorityService.getOrdersForSiteWithFilter(
        site as string,
        req.user.email
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

      res.status(200).json({
        success: true,
        treatment: {
          ...treatment,
          daysSinceInsertion,
          isEligible: isEligible && isInsertion && isCompleted,
          eligibilityReasons: {
            daysSinceInsertion,
            validDayRange: daysSinceInsertion >= 13 && daysSinceInsertion <= 21,
            isInsertion,
            isCompleted
          }
        },
        applicators
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
  if (req.user.role !== 'admin' && treatment.userId !== req.user.id) {
    res.status(403);
    throw new Error('Not authorized to access this treatment');
  }
  
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
    // For PDF, in a real application, you would use a PDF generation library
    // For now, we'll just send a response indicating PDF generation
    res.status(200).send('PDF generation would happen here');
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
  if (req.user.role !== 'admin' && treatment.userId !== req.user.id) {
    res.status(403);
    throw new Error('Not authorized to finalize this treatment');
  }

  // Check if treatment is already finalized (has a PDF)
  const existingPdf = await TreatmentPdf.findOne({ where: { treatmentId: treatment.id } });
  if (existingPdf) {
    res.status(400).json({
      success: false,
      error: 'Treatment has already been finalized',
      existingSignature: {
        signerName: existingPdf.signerName,
        signedAt: existingPdf.signedAt,
        signatureType: existingPdf.signatureType
      }
    });
    return;
  }

  // Determine user flow based on position code
  // Use Number() to handle both string and number types from JSON storage
  const positionCode = req.user.metadata?.positionCode;
  const isAlphaTau = Number(positionCode) === 99;

  logger.info(`Finalization initiated for treatment ${treatment.id}`, {
    userId: req.user.id,
    positionCode,
    flow: isAlphaTau ? 'alphatau_verification' : 'hospital_auto'
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
  // Use Number() to handle both string and number types from JSON storage
  const positionCode = req.user.metadata?.positionCode;
  if (Number(positionCode) !== 99) {
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
  // Use Number() to handle both string and number types from JSON storage
  const positionCode = req.user.metadata?.positionCode;
  if (Number(positionCode) !== 99) {
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
    targetEmail: verification.targetEmail
  });

  // Get applicators for the treatment
  const processedApplicators = await applicatorService.getApplicators(treatment.id, treatment.type);

  // Merge unused applicators from availableApplicators list
  const processedSerials = new Set(processedApplicators.map((a: any) => a.serialNumber));
  const unusedApplicators = (availableApplicators || [])
    .filter((a: any) => !processedSerials.has(a.serialNumber))
    .map((a: any) => ({
      id: a.id,
      serialNumber: a.serialNumber,
      applicatorType: a.applicatorType,
      seedQuantity: a.seedQuantity,
      usageType: 'sealed',
      insertionTime: '',
      insertedSeedsQty: 0,
      comments: 'Not used'
    }));

  const allApplicators = [
    ...processedApplicators.map((app: any) => ({
      id: app.id,
      serialNumber: app.serialNumber,
      applicatorType: app.applicatorType,
      seedQuantity: app.seedQuantity,
      usageType: app.usageType,
      insertionTime: app.insertionTime,
      insertedSeedsQty: app.insertedSeedsQty,
      comments: app.comments
    })),
    ...unusedApplicators
  ];

  // Generate PDF with signature
  const signatureDetails = {
    type: 'alphatau_verified' as const,
    signerName,
    signerEmail: verification.targetEmail,
    signerPosition,
    signedAt: new Date()
  };

  const pdfBuffer = await generateTreatmentPdf(
    {
      id: treatment.id,
      type: treatment.type,
      subjectId: treatment.subjectId,
      site: treatment.site,
      date: treatment.date instanceof Date ? treatment.date.toISOString() : String(treatment.date),
      surgeon: treatment.surgeon,
      activityPerSeed: treatment.activityPerSeed,
      patientName: treatment.patientName
    },
    allApplicators,
    signatureDetails
  );

  // Store PDF in database
  const treatmentPdf = await TreatmentPdf.create({
    treatmentId: treatment.id,
    pdfData: pdfBuffer,
    pdfSizeBytes: pdfBuffer.length,
    signatureType: 'alphatau_verified',
    signerName,
    signerEmail: verification.targetEmail,
    signerPosition,
    signedAt: new Date(),
    emailStatus: 'pending'
  });

  // Send PDF to clinic email
  const recipientEmail = getPdfRecipientEmail();
  try {
    await sendSignedPdf(recipientEmail, pdfBuffer, treatment.id, signatureDetails);
    treatmentPdf.emailSentAt = new Date();
    treatmentPdf.emailSentTo = recipientEmail;
    treatmentPdf.emailStatus = 'sent';
    await treatmentPdf.save();
    logger.info(`PDF sent to ${recipientEmail} for treatment ${treatment.id}`);
  } catch (emailError: any) {
    logger.error(`Failed to send PDF email: ${emailError.message}`);
    treatmentPdf.emailStatus = 'failed';
    await treatmentPdf.save();
    // Don't fail the whole operation - PDF is stored
  }

  // Mark treatment as complete
  await treatmentService.completeTreatment(treatment.id, req.user.id);

  res.status(200).json({
    success: true,
    message: 'Treatment finalized successfully',
    pdfId: treatmentPdf.id,
    signatureDetails: {
      signerName,
      signerPosition,
      signedAt: treatmentPdf.signedAt,
      type: 'alphatau_verified'
    },
    emailStatus: treatmentPdf.emailStatus
  });
});

// @desc    Auto-finalize treatment (Hospital user flow)
// @route   POST /api/treatments/:id/finalize/auto
// @access  Private (Non-Position 99 users)
export const autoFinalize = asyncHandler(async (req: Request, res: Response) => {
  // Only non-Position 99 users can auto-finalize
  // Use Number() to handle both string and number types from JSON storage
  const positionCode = req.user.metadata?.positionCode;
  if (Number(positionCode) === 99) {
    res.status(403);
    throw new Error('Alpha Tau administrators must use verification flow');
  }

  const treatment = await treatmentService.getTreatmentById(req.params.id);

  // Check if user has access to this treatment
  if (req.user.role !== 'admin' && treatment.userId !== req.user.id) {
    res.status(403);
    throw new Error('Not authorized to finalize this treatment');
  }

  // Check if treatment is already finalized
  const existingPdf = await TreatmentPdf.findOne({ where: { treatmentId: treatment.id } });
  if (existingPdf) {
    res.status(400).json({
      success: false,
      error: 'Treatment has already been finalized',
      existingSignature: {
        signerName: existingPdf.signerName,
        signedAt: existingPdf.signedAt,
        signatureType: existingPdf.signatureType
      }
    });
    return;
  }

  // Extract optional signer details from request body (from hospital confirmation modal)
  const { signerName: requestSignerName, signerPosition: requestSignerPosition, availableApplicators } = req.body;

  // Use provided values or fall back to user data
  const signerName = requestSignerName?.trim() || req.user.name;
  const signerPosition = requestSignerPosition || positionCode?.toString() || 'hospital_staff';

  logger.info(`Auto-finalizing treatment ${treatment.id}`, {
    userId: req.user.id,
    userName: req.user.name,
    userEmail: req.user.email,
    providedSignerName: requestSignerName,
    providedSignerPosition: requestSignerPosition,
    effectiveSignerName: signerName,
    effectiveSignerPosition: signerPosition
  });

  // Get applicators for the treatment
  const processedApplicators = await applicatorService.getApplicators(treatment.id, treatment.type);

  // Merge unused applicators from availableApplicators list
  const processedSerials = new Set(processedApplicators.map((a: any) => a.serialNumber));
  const unusedApplicators = (availableApplicators || [])
    .filter((a: any) => !processedSerials.has(a.serialNumber))
    .map((a: any) => ({
      id: a.id,
      serialNumber: a.serialNumber,
      applicatorType: a.applicatorType,
      seedQuantity: a.seedQuantity,
      usageType: 'sealed',
      insertionTime: '',
      insertedSeedsQty: 0,
      comments: 'Not used'
    }));

  const allApplicators = [
    ...processedApplicators.map((app: any) => ({
      id: app.id,
      serialNumber: app.serialNumber,
      applicatorType: app.applicatorType,
      seedQuantity: app.seedQuantity,
      usageType: app.usageType,
      insertionTime: app.insertionTime,
      insertedSeedsQty: app.insertedSeedsQty,
      comments: app.comments
    })),
    ...unusedApplicators
  ];

  // Generate PDF with auto-signature
  const signatureDetails = {
    type: 'hospital_auto' as const,
    signerName,
    signerEmail: req.user.email,
    signerPosition,
    signedAt: new Date()
  };

  const pdfBuffer = await generateTreatmentPdf(
    {
      id: treatment.id,
      type: treatment.type,
      subjectId: treatment.subjectId,
      site: treatment.site,
      date: treatment.date instanceof Date ? treatment.date.toISOString() : String(treatment.date),
      surgeon: treatment.surgeon,
      activityPerSeed: treatment.activityPerSeed,
      patientName: treatment.patientName
    },
    allApplicators,
    signatureDetails
  );

  // Store PDF in database
  const treatmentPdf = await TreatmentPdf.create({
    treatmentId: treatment.id,
    pdfData: pdfBuffer,
    pdfSizeBytes: pdfBuffer.length,
    signatureType: 'hospital_auto',
    signerName,
    signerEmail: req.user.email,
    signerPosition,
    signedAt: new Date(),
    emailStatus: 'pending'
  });

  // Send PDF to clinic email
  const recipientEmail = getPdfRecipientEmail();
  try {
    await sendSignedPdf(recipientEmail, pdfBuffer, treatment.id, signatureDetails);
    treatmentPdf.emailSentAt = new Date();
    treatmentPdf.emailSentTo = recipientEmail;
    treatmentPdf.emailStatus = 'sent';
    await treatmentPdf.save();
    logger.info(`PDF sent to ${recipientEmail} for treatment ${treatment.id}`);
  } catch (emailError: any) {
    logger.error(`Failed to send PDF email: ${emailError.message}`);
    treatmentPdf.emailStatus = 'failed';
    await treatmentPdf.save();
    // Don't fail the whole operation - PDF is stored
  }

  // Mark treatment as complete
  await treatmentService.completeTreatment(treatment.id, req.user.id);

  res.status(200).json({
    success: true,
    message: 'Treatment finalized successfully',
    pdfId: treatmentPdf.id,
    signatureDetails: {
      signerName: req.user.name,
      signerPosition,
      signedAt: treatmentPdf.signedAt,
      type: 'hospital_auto'
    },
    emailStatus: treatmentPdf.emailStatus
  });
});

// Default export for test compatibility
export default {
  getTreatments,
  getTreatmentById,
  createTreatment,
  updateTreatment,
  completeTreatment,
  updateTreatmentStatus,
  getTreatmentApplicators,
  addApplicator,
  debugTreatment,
  getRemovalCandidates,
  exportTreatment,
  initializeFinalization,
  getSiteUsersForFinalization,
  sendFinalizationCode,
  verifyAndFinalize,
  autoFinalize
};