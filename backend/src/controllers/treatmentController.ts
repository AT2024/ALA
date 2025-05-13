import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import treatmentService from '../services/treatmentService';
import applicatorService from '../services/applicatorService';

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
  
  const completedTreatment = await treatmentService.completeTreatment(req.params.id, req.user.id);
  res.status(200).json(completedTreatment);
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
  const treatment = await treatmentService.getTreatmentById(req.params.id);
  
  // Check if user has access to this treatment
  if (req.user.role !== 'admin' && treatment.userId !== req.user.id) {
    res.status(403);
    throw new Error('Not authorized to modify this treatment');
  }
  
  const applicator = await applicatorService.addApplicator(req.params.id, req.body, req.user.id);
  res.status(201).json(applicator);
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