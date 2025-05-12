import express from 'express';
import {
  requestVerificationCode,
  verifyCode,
  resendVerificationCode,
  validateToken,
} from '../controllers/authController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

// Public routes
router.post('/request-code', requestVerificationCode);
router.post('/verify', verifyCode);
router.post('/resend-code', resendVerificationCode);

// Protected routes
router.post('/validate-token', protect, validateToken);

export default router;
