import express from 'express';
import {
  validateUserEmail,
  debugPriorityConnection,
  getTreatments,
  getContacts,
  getOrdersForSite,
  getAllowedSitesForUser,
  getOrdersForSiteAndDate,
  getOrderSubform,
  getOrderDetails,
  validateApplicator,
  getAvailableApplicators,
  searchApplicators
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
router.get('/orders/:orderId/subform', protect, getOrderSubform);
router.get('/orders/:orderId/details', protect, getOrderDetails);
router.post('/validate-applicator', protect, validateApplicator);
router.get('/allowed-sites', protect, getAllowedSitesForUser);
router.get('/applicators/available', protect, getAvailableApplicators);
router.post('/applicators/search', protect, searchApplicators);

export default router;