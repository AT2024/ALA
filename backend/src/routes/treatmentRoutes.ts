import express from 'express';
import {
  getTreatments,
  getTreatmentById,
  createTreatment,
  updateTreatment,
  completeTreatment,
  updateTreatmentStatus,
  getTreatmentApplicators,
  addApplicator,
  exportTreatment,
  debugTreatment,
} from '../controllers/treatmentController';
import { updateApplicator } from '../controllers/applicatorController';
import { protect } from '../middleware/authMiddleware';
import { validateUUID, validateMultipleUUIDs } from '../middleware/uuidValidationMiddleware';
import { treatmentRequestLoggingMiddleware } from '../middleware/requestLoggingMiddleware';
import { databaseHealthCheck, criticalOperationHealthCheck } from '../middleware/databaseHealthMiddleware';

const router = express.Router();

// Protect all routes
router.use(protect);

// Add detailed logging for treatment operations
router.use(treatmentRequestLoggingMiddleware);

// Treatment routes
router.route('/')
  .get(databaseHealthCheck, getTreatments)
  .post(criticalOperationHealthCheck, createTreatment);

router.route('/:id')
  .get(validateUUID('id'), databaseHealthCheck, getTreatmentById)
  .put(validateUUID('id'), criticalOperationHealthCheck, updateTreatment);

router.post('/:id/complete', validateUUID('id'), criticalOperationHealthCheck, completeTreatment);
router.patch('/:id/status', validateUUID('id'), criticalOperationHealthCheck, updateTreatmentStatus);
router.get('/:id/export', validateUUID('id'), databaseHealthCheck, exportTreatment);
router.get('/:id/debug', validateUUID('id'), databaseHealthCheck, debugTreatment);

// Treatment applicator routes
router.route('/:id/applicators')
  .get(validateUUID('id'), databaseHealthCheck, getTreatmentApplicators)
  .post(validateUUID('id'), criticalOperationHealthCheck, addApplicator);

router.patch('/:treatmentId/applicators/:id', validateMultipleUUIDs(['treatmentId', 'id']), criticalOperationHealthCheck, updateApplicator);

export default router;