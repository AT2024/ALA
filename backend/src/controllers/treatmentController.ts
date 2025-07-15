import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import treatmentService from '../services/treatmentService';
import applicatorService from '../services/applicatorService';
import sequelize from '../config/database';
import { Treatment } from '../models';
import { QueryTypes } from 'sequelize';
import logger from '../utils/logger';

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
  
  // Update treatment status in Priority system first
  const statusResult = await applicatorService.updateTreatmentStatusInPriority(
    req.params.id, 
    treatment.type === 'removal' ? 'Removed' : 'Performed'
  );
  
  if (!statusResult.success) {
    res.status(500);
    throw new Error(statusResult.message || 'Failed to update treatment status in Priority');
  }
  
  // Complete treatment locally
  const completedTreatment = await treatmentService.completeTreatment(req.params.id, req.user.id);
  
  res.status(200).json({
    ...completedTreatment,
    priorityStatus: statusResult.message
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
  
  const applicators = await applicatorService.getApplicators(req.params.id);
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