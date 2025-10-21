import express, { Request, Response, NextFunction } from 'express';
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
  getRemovalCandidates,
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

router.get('/removal-candidates', databaseHealthCheck, getRemovalCandidates);

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

// Custom validation middleware for applicator updates that allows numeric IDs for test user
const validateApplicatorUpdate = (req: Request, res: Response, next: NextFunction) => {
  const { treatmentId, id } = req.params;

  // UUID validation regex
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // Always validate treatmentId as UUID
  if (!treatmentId || !UUID_REGEX.test(treatmentId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid treatmentId format'
    });
  }

  // For test user, allow numeric IDs (test data applicators)
  if (req.user?.email === 'test@example.com' && id && /^\d+$/.test(id)) {
    return next(); // Skip UUID validation for numeric test IDs
  }

  // For all other cases, validate as UUID
  if (!id || !UUID_REGEX.test(id)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid applicator ID format'
    });
  }

  next();
};

router.patch('/:treatmentId/applicators/:id', validateApplicatorUpdate, criticalOperationHealthCheck, updateApplicator);

export default router;