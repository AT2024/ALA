import express from 'express';
import {
  requestVerificationCode,
  verifyCode,
  resendVerificationCode,
  validateToken,
  debugUserSiteAccess,
} from '../controllers/authController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

// Public routes
router.post('/request-code', requestVerificationCode);
router.post('/verify', verifyCode);
router.post('/resend-code', resendVerificationCode);

// Debug route (for testing multi-site access)
router.get('/debug-sites/:identifier', debugUserSiteAccess);

// Protected routes
router.post('/validate-token', protect, validateToken);

export default router;
