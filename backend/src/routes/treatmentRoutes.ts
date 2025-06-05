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
} from '../controllers/treatmentController';
import { updateApplicator } from '../controllers/applicatorController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

// Protect all routes
router.use(protect);

// Treatment routes
router.route('/')
  .get(getTreatments)
  .post(createTreatment);

router.route('/:id')
  .get(getTreatmentById)
  .put(updateTreatment);

router.post('/:id/complete', completeTreatment);
router.patch('/:id/status', updateTreatmentStatus);
router.get('/:id/export', exportTreatment);

// Treatment applicator routes
router.route('/:id/applicators')
  .get(getTreatmentApplicators)
  .post(addApplicator);

router.patch('/:treatmentId/applicators/:id', updateApplicator);

export default router;