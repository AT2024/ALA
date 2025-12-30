import express from 'express';
import asyncHandler from 'express-async-handler';
import { protect, restrict } from '../middleware/authMiddleware';
import { User } from '../models';
import logger from '../utils/logger';

// Constants for admin access validation
const ADMIN_POSITION_CODE = 99;

const router = express.Router();

// Protect all routes and restrict to admin role
router.use(protect, restrict('admin'));

// Dashboard statistics
router.get('/dashboard/stats', (req, res) => {
  // Mock implementation - in a real app, this would fetch actual statistics
  res.status(200).json({
    totalTreatments: 156,
    completedTreatments: 142,
    pendingTreatments: 14,
    totalApplicators: 843,
    users: 27,
  });
});

// System logs
router.get('/logs', (req, res) => {
  // Mock implementation - in a real app, this would fetch actual logs
  res.status(200).json({
    logs: [
      {
        timestamp: '2025-05-10T09:45:21Z',
        level: 'INFO',
        message: 'User logged in successfully',
        user: 'john.doe@example.com',
      },
      {
        timestamp: '2025-05-10T08:32:15Z',
        level: 'WARNING',
        message: 'Multiple verification attempts detected',
        user: 'sarah.smith@example.com',
      },
      {
        timestamp: '2025-05-09T17:12:53Z',
        level: 'ERROR',
        message: 'Failed to connect to Priority system',
        user: 'System',
      },
    ],
  });
});

// User management
router.get('/users', (req, res) => {
  // Mock implementation - in a real app, this would fetch actual users
  res.status(200).json({
    users: [
      {
        id: '1',
        name: 'John Doe',
        email: 'john.doe@example.com',
        role: 'hospital',
        lastLogin: '2025-05-10T09:45:21Z',
      },
      {
        id: '2',
        name: 'Sarah Smith',
        email: 'sarah.smith@example.com',
        role: 'alphatau',
        lastLogin: '2025-05-10T08:32:15Z',
      },
    ],
  });
});

// System configuration
router.get('/config', (req, res) => {
  res.status(200).json({
    priorityUrl: process.env.PRIORITY_API_URL,
    verificationCodeExpiry: 600, // 10 minutes
    maxFailedAttempts: 3,
    minDaysForRemoval: 14,
    maxDaysForRemoval: 20,
  });
});

router.put('/config', (req, res) => {
  // Mock implementation - in a real app, this would update system configuration
  res.status(200).json({
    message: 'Configuration updated successfully',
    config: req.body,
  });
});

// Test Mode Management
// GET /api/admin/test-mode - Get current test mode status for the authenticated user
router.get('/test-mode', (req, res) => {
  const testModeEnabled = req.user?.metadata?.testModeEnabled || false;
  res.status(200).json({
    testModeEnabled,
    userId: req.user?.id,
    email: req.user?.email,
  });
});

// PUT /api/admin/test-mode - Toggle test mode for the authenticated user
router.put('/test-mode', asyncHandler(async (req, res) => {
  const { enabled } = req.body;

  if (typeof enabled !== 'boolean') {
    res.status(400).json({ error: 'enabled must be a boolean' });
    return;
  }

  // Verify admin permission (POSITIONCODE=99)
  const positionCode = Number(req.user?.metadata?.positionCode);
  if (positionCode !== ADMIN_POSITION_CODE && req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Only admin users (Position 99) can toggle test mode' });
    return;
  }

  // Update user metadata in database
  const user = await User.findByPk(req.user?.id);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  user.metadata = {
    ...user.metadata,
    testModeEnabled: enabled,
  };
  await user.save();

  // Audit log for security tracking
  logger.info(`TEST MODE ${enabled ? 'ENABLED' : 'DISABLED'} by ${req.user?.email} (user ID: ${req.user?.id})`);

  res.status(200).json({
    success: true,
    testModeEnabled: enabled,
    message: `Test mode ${enabled ? 'enabled' : 'disabled'}`,
  });
}));

export default router;