import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import applicatorService from '../services/applicatorService';
import treatmentService from '../services/treatmentService';

// @desc    Validate an applicator barcode
// @route   POST /api/applicators/validate
// @access  Private
export const validateApplicator = asyncHandler(async (req: Request, res: Response) => {
  const { serialNumber, treatmentId, patientId, scannedApplicators = [] } = req.body;
  
  if (!serialNumber || !treatmentId || !patientId) {
    res.status(400);
    throw new Error('Serial number, treatmentId, and patientId are required');
  }
  
  const validation = await applicatorService.validateApplicator(
    serialNumber, 
    treatmentId, 
    patientId, 
    scannedApplicators
  );
  
  res.status(200).json(validation);
});

// @desc    Add an applicator to a treatment
// @route   POST /api/treatments/:treatmentId/applicators
// @access  Private
export const addApplicator = asyncHandler(async (req: Request, res: Response) => {
  const { treatmentId } = req.params;
  
  // Verify the treatment exists and user has access
  const treatment = await treatmentService.getTreatmentById(treatmentId);
  
  if (req.user.role !== 'admin' && treatment.userId !== req.user.id) {
    res.status(403);
    throw new Error('Not authorized to modify this treatment');
  }
  
  const applicator = await applicatorService.addApplicator(treatmentId, req.body, req.user.id);
  
  res.status(201).json(applicator);
});

// @desc    Get applicator data by serial number
// @route   GET /api/applicators/:serialNumber
// @access  Private
export const getApplicatorBySerialNumber = asyncHandler(async (req: Request, res: Response) => {
  const { serialNumber } = req.params;
  
  const applicatorData = await applicatorService.getApplicatorFromPriority(serialNumber);
  
  if (!applicatorData.found) {
    res.status(404);
    throw new Error('Applicator not found in Priority system');
  }
  
  res.status(200).json(applicatorData.data);
});

// @desc    Update treatment status
// @route   PATCH /api/treatments/:treatmentId/status
// @access  Private
export const updateTreatmentStatus = asyncHandler(async (req: Request, res: Response) => {
  const { treatmentId } = req.params;
  const { status } = req.body;
  
  if (!['Performed', 'Removed'].includes(status)) {
    res.status(400);
    throw new Error('Status must be either "Performed" or "Removed"');
  }
  
  // Verify the treatment exists and user has access
  const treatment = await treatmentService.getTreatmentById(treatmentId);
  
  if (req.user.role !== 'admin' && treatment.userId !== req.user.id) {
    res.status(403);
    throw new Error('Not authorized to modify this treatment');
  }
  
  const result = await applicatorService.updateTreatmentStatusInPriority(treatmentId, status);
  
  if (!result.success) {
    res.status(500);
    throw new Error(result.message || 'Failed to update treatment status');
  }
  
  res.status(200).json(result);
});

// @desc    Get an applicator by ID
// @route   GET /api/applicators/:id
// @access  Private
export const getApplicatorById = asyncHandler(async (req: Request, res: Response) => {
  const applicator = await applicatorService.getApplicatorById(req.params.id);
  
  // Get associated treatment to check permissions
  const treatment = await treatmentService.getTreatmentById(applicator.treatmentId);
  
  // Check if user has access to this treatment's applicators
  if (req.user.role !== 'admin' && treatment.userId !== req.user.id) {
    res.status(403);
    throw new Error('Not authorized to access this applicator');
  }
  
  res.status(200).json(applicator);
});

// @desc    Update an applicator
// @route   PATCH /api/treatments/:treatmentId/applicators/:id
// @access  Private
export const updateApplicator = asyncHandler(async (req: Request, res: Response) => {
  const { treatmentId, id } = req.params;
  
  // Verify the treatment exists and user has access
  const treatment = await treatmentService.getTreatmentById(treatmentId);
  
  if (req.user.role !== 'admin' && treatment.userId !== req.user.id) {
    res.status(403);
    throw new Error('Not authorized to modify this treatment');
  }
  
  // Get the applicator to verify it belongs to the specified treatment
  const applicator = await applicatorService.getApplicatorById(id);
  
  if (applicator.treatmentId !== treatmentId) {
    res.status(400);
    throw new Error('Applicator does not belong to the specified treatment');
  }
  
  // Use different update method based on treatment type
  let updatedApplicator;
  
  if (treatment.type === 'removal') {
    updatedApplicator = await applicatorService.updateApplicatorForRemoval(id, req.body, req.user.id);
  } else {
    updatedApplicator = await applicatorService.updateApplicator(id, req.body);
  }
  
  res.status(200).json(updatedApplicator);
});

// @desc    Calculate seed status for a removal treatment
// @route   GET /api/treatments/:treatmentId/seed-status
// @access  Private
export const getSeedStatus = asyncHandler(async (req: Request, res: Response) => {
  const { treatmentId } = req.params;
  
  // Verify the treatment exists and user has access
  const treatment = await treatmentService.getTreatmentById(treatmentId);
  
  if (req.user.role !== 'admin' && treatment.userId !== req.user.id) {
    res.status(403);
    throw new Error('Not authorized to access this treatment');
  }
  
  if (treatment.type !== 'removal') {
    res.status(400);
    throw new Error('Seed status is only relevant for removal treatments');
  }
  
  const seedStatus = await applicatorService.calculateSeedCountStatus(treatmentId);
  
  res.status(200).json(seedStatus);
});