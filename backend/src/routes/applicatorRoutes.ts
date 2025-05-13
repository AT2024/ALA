import express from 'express';
import {
  validateApplicator,
  getApplicatorById,
  getSeedStatus
} from '../controllers/applicatorController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

// Protect all routes
router.use(protect);

// Applicator routes
router.post('/validate', validateApplicator);
router.get('/:id', getApplicatorById);
router.get('/treatment/:treatmentId/seed-status', getSeedStatus);

export default router;