import express from 'express';
import {
  validateApplicator,
  getApplicatorById,
  getApplicatorBySerialNumber,
  updateApplicator,
  getSeedStatus,
  createPackage,
  getPackages,
  uploadApplicatorFiles
} from '../controllers/applicatorController';
// NOTE: addApplicator and updateTreatmentStatus removed - handled by treatmentRoutes
import { protect } from '../middleware/authMiddleware';
import { validateUUID, validateMultipleUUIDs } from '../middleware/uuidValidationMiddleware';
import { requestLoggingMiddleware } from '../middleware/requestLoggingMiddleware';
import { databaseHealthCheck, criticalOperationHealthCheck } from '../middleware/databaseHealthMiddleware';
import { uploadMiddleware } from '../middleware/upload';

const router = express.Router();

// Protect all routes
router.use(protect);

// Add detailed logging for applicator operations
router.use(requestLoggingMiddleware);

// Applicator routes
router.post('/validate', databaseHealthCheck, validateApplicator);
router.get('/serial/:serialNumber', databaseHealthCheck, getApplicatorBySerialNumber);
router.get('/:id', validateUUID('id'), databaseHealthCheck, getApplicatorById);
router.get('/treatment/:treatmentId/seed-status', validateUUID('treatmentId'), databaseHealthCheck, getSeedStatus);

// Treatment routes (for applicator management)
// NOTE: POST /treatments/:treatmentId/applicators is handled by treatmentRoutes (uses transaction)
// NOTE: PATCH /treatments/:treatmentId/status is handled by treatmentRoutes (treatment-level operation)
router.patch('/treatments/:treatmentId/applicators/:id', validateMultipleUUIDs(['treatmentId', 'id']), criticalOperationHealthCheck, updateApplicator);

// Packaging routes (for pancreas/prostate combined treatments)
router.post('/treatments/:treatmentId/package', validateUUID('treatmentId'), criticalOperationHealthCheck, createPackage);
router.get('/treatments/:treatmentId/packages', validateUUID('treatmentId'), databaseHealthCheck, getPackages);

// File upload routes
router.post(
  '/treatments/:treatmentId/applicators/:applicatorId/upload',
  validateMultipleUUIDs(['treatmentId', 'applicatorId']),
  criticalOperationHealthCheck,
  uploadMiddleware.array('files', 10),
  uploadApplicatorFiles
);

export default router;