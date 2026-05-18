import express from "express";
import asyncHandler from "express-async-handler";
import { protect, restrict } from "../middleware/authMiddleware";
import logger from "../utils/logger";
import { getClientIp } from "../utils/requestUtils";

// Constants for admin access validation
const ADMIN_POSITION_CODE = 99;

const router = express.Router();

// Protect all routes and restrict to admin role
router.use(protect, restrict("admin"));

// Dashboard statistics
router.get("/dashboard/stats", (req, res) => {
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
router.get("/logs", (req, res) => {
  // Mock implementation - in a real app, this would fetch actual logs
  res.status(200).json({
    logs: [
      {
        timestamp: "2025-05-10T09:45:21Z",
        level: "INFO",
        message: "User logged in successfully",
        user: "john.doe@example.com",
      },
      {
        timestamp: "2025-05-10T08:32:15Z",
        level: "WARNING",
        message: "Multiple verification attempts detected",
        user: "sarah.smith@example.com",
      },
      {
        timestamp: "2025-05-09T17:12:53Z",
        level: "ERROR",
        message: "Failed to connect to Priority system",
        user: "System",
      },
    ],
  });
});

// User management
router.get("/users", (req, res) => {
  // Mock implementation - in a real app, this would fetch actual users
  res.status(200).json({
    users: [
      {
        id: "1",
        name: "John Doe",
        email: "john.doe@example.com",
        role: "hospital",
        lastLogin: "2025-05-10T09:45:21Z",
      },
      {
        id: "2",
        name: "Sarah Smith",
        email: "sarah.smith@example.com",
        role: "alphatau",
        lastLogin: "2025-05-10T08:32:15Z",
      },
    ],
  });
});

// System configuration
router.get("/config", (req, res) => {
  res.status(200).json({
    priorityUrl: process.env.PRIORITY_API_URL,
    verificationCodeExpiry: 600, // 10 minutes
    maxFailedAttempts: 3,
    minDaysForRemoval: 14,
    maxDaysForRemoval: 20,
  });
});

router.put("/config", (req, res) => {
  // Mock implementation - in a real app, this would update system configuration
  res.status(200).json({
    message: "Configuration updated successfully",
    config: req.body,
  });
});

// Test Mode Management
//
// Test Mode is a deliberate, per-session, admin-only choice. It is NEVER
// persisted: the active signal is the `X-Test-Mode` request header sent by the
// client for the current session only (see authorizationUtils.deriveSessionTestMode).
// These endpoints therefore hold NO server state — GET always reports the
// non-persisted default, and PUT only records an audit-trail entry.

// GET /api/admin/test-mode - No persisted state; always reports the default.
router.get("/test-mode", (req, res) => {
  res.status(200).json({
    testModeEnabled: false,
    userId: req.user?.id,
    email: req.user?.email,
  });
});

// PUT /api/admin/test-mode - Audit-only acknowledgement of a per-session mode
// choice. Does NOT persist anything; the client carries the choice in memory
// and signals each request via the X-Test-Mode header.
router.put(
  "/test-mode",
  asyncHandler(async (req, res) => {
    const { enabled } = req.body;

    if (typeof enabled !== "boolean") {
      res.status(400).json({ error: "enabled must be a boolean" });
      return;
    }

    // Verify admin permission. Must match deriveSessionTestMode exactly
    // (POSITIONCODE 99 only) so the audit trail can never record a test-mode
    // choice that the enforcement gate would not actually honor.
    const positionCode = Number(req.user?.metadata?.positionCode);
    if (positionCode !== ADMIN_POSITION_CODE) {
      res
        .status(403)
        .json({ error: "Only admin users (Position 99) can toggle test mode" });
      return;
    }

    // Audit log for medical compliance / security tracking (no persistence).
    // Structured WHO/WHAT/WHEN/WHERE payload for SIEM export.
    logger.info(
      `TEST MODE ${enabled ? "ENABLED" : "DISABLED"} for this session by ${req.user?.email}`,
      {
        event: "TEST_MODE_SESSION_CHOICE",
        enabled,
        userId: req.user?.id,
        email: req.user?.email,
        positionCode,
        clientIp: getClientIp(req),
        timestamp: new Date().toISOString(),
      },
    );

    res.status(200).json({
      success: true,
      testModeEnabled: enabled,
      message: `Test mode ${enabled ? "enabled" : "disabled"} for this session`,
    });
  }),
);

export default router;
