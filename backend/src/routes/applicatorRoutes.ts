import express from 'express';
import {
  validateApplicator,
  addApplicator,
  getApplicatorById,
  getApplicatorBySerialNumber,
  updateApplicator,
  updateTreatmentStatus,
  getSeedStatus
} from '../controllers/applicatorController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

// Protect all routes
router.use(protect);

// Applicator routes
router.post('/validate', validateApplicator);
router.get('/serial/:serialNumber', getApplicatorBySerialNumber);
router.get('/:id', getApplicatorById);
router.get('/treatment/:treatmentId/seed-status', getSeedStatus);

// Treatment routes (for applicator management)
router.post('/treatments/:treatmentId/applicators', addApplicator);
router.patch('/treatments/:treatmentId/applicators/:id', updateApplicator);
router.patch('/treatments/:treatmentId/status', updateTreatmentStatus);

export default router;