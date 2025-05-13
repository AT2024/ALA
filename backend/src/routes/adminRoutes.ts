import express from 'express';
import { protect, restrict } from '../middleware/authMiddleware';

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
    priorityUrl: process.env.PRIORITY_URL,
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

export default router;