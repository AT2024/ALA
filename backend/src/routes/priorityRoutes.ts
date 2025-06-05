import express from 'express';
import {
  validateUserEmail,
  debugPriorityConnection,
  getTreatments,
  getContacts,
  getOrdersForSite,
  getAllowedSitesForUser,
  getOrdersForSiteAndDate
} from '../controllers/priorityController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

// Public routes (no auth required)
router.post('/validate-email', validateUserEmail);

// Protected routes (auth required)
router.get('/debug', protect, debugPriorityConnection);
router.get('/treatments', protect, getTreatments);
router.get('/contacts', protect, getContacts);
router.get('/orders', protect, getOrdersForSite);
router.post('/orders', protect, getOrdersForSiteAndDate);
router.get('/allowed-sites', protect, getAllowedSitesForUser);

export default router;