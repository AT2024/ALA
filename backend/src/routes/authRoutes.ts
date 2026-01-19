import express from 'express';
import {
  requestVerificationCode,
  verifyCode,
  resendVerificationCode,
  validateToken,
  debugUserSiteAccess,
  logout,
} from '../controllers/authController';
import { protect } from '../middleware/authMiddleware';
import {
  codeRequestRateLimit,
  verifyRateLimit,
  tokenValidateRateLimit,
} from '../middleware/securityMiddleware';

const router = express.Router();

// Public routes with specific rate limiting
router.post('/request-code', codeRequestRateLimit, requestVerificationCode);
router.post('/verify', verifyRateLimit, verifyCode);
router.post('/resend-code', codeRequestRateLimit, resendVerificationCode);
router.post('/logout', logout); // Logout clears HttpOnly auth cookie

// Debug route (for testing multi-site access)
router.get('/debug-sites/:identifier', debugUserSiteAccess);

// Protected routes with token validation rate limiting
router.post('/validate-token', tokenValidateRateLimit, protect, validateToken);

export default router;
