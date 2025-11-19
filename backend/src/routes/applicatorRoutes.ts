import express from 'express';
import {
  validateApplicator,
  addApplicator,
  getApplicatorById,
  getApplicatorBySerialNumber,
  updateApplicator,
  updateTreatmentStatus,
  getSeedStatus,
  createPackage,
  getPackages
} from '../controllers/applicatorController';
import { protect } from '../middleware/authMiddleware';
import { validateUUID, validateMultipleUUIDs } from '../middleware/uuidValidationMiddleware';
import { requestLoggingMiddleware } from '../middleware/requestLoggingMiddleware';
import { databaseHealthCheck, criticalOperationHealthCheck } from '../middleware/databaseHealthMiddleware';

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
router.post('/treatments/:treatmentId/applicators', validateUUID('treatmentId'), criticalOperationHealthCheck, addApplicator);
router.patch('/treatments/:treatmentId/applicators/:id', validateMultipleUUIDs(['treatmentId', 'id']), criticalOperationHealthCheck, updateApplicator);
router.patch('/treatments/:treatmentId/status', validateUUID('treatmentId'), criticalOperationHealthCheck, updateTreatmentStatus);

// Packaging routes (for pancreas/prostate combined treatments)
router.post('/treatments/:treatmentId/package', validateUUID('treatmentId'), criticalOperationHealthCheck, createPackage);
router.get('/treatments/:treatmentId/packages', validateUUID('treatmentId'), databaseHealthCheck, getPackages);

export default router;