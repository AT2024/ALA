import { AuthAuditLog } from '../models';
import logger from '../utils/logger';
import { AuthEventType } from '../models/AuthAuditLog';

/**
 * HIPAA 2025 Compliant Authentication Audit Service
 *
 * Logs all authentication events for compliance requirements:
 * - LOGIN_SUCCESS: Successful user authentication
 * - LOGIN_FAILURE: Failed login attempts (brute force detection)
 * - LOGOUT: User-initiated logout
 * - SESSION_TIMEOUT: Automatic logout due to inactivity
 * - OTP_REQUEST: Verification code requests
 *
 * Important: This service catches all errors internally and never throws.
 * Audit logging must never break the authentication flow.
 */
export const authAuditService = {
  /**
   * Mask identifier (email/phone) for privacy in audit logs
   * Example: "user@example.com" -> "us***@example.com"
   * Example: "555-123-4567" -> "555-***-4567"
   */
  maskIdentifier(identifier: string | null | undefined): string | null {
    if (!identifier) return null;

    if (identifier.includes('@')) {
      // Email: mask middle of local part
      const [local, domain] = identifier.split('@');
      if (local.length <= 2) {
        return `${local[0]}***@${domain}`;
      }
      return `${local.slice(0, 2)}***@${domain}`;
    }

    // Phone: mask middle digits
    const digits = identifier.replace(/\D/g, '');
    if (digits.length >= 7) {
      const first3 = digits.slice(0, 3);
      const last4 = digits.slice(-4);
      return `${first3}-***-${last4}`;
    }

    // Fallback: mask middle portion
    if (identifier.length <= 4) {
      return `${identifier[0]}***`;
    }
    return `${identifier.slice(0, 2)}***${identifier.slice(-2)}`;
  },

  /**
   * Log successful login
   */
  async logLoginSuccess(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
    requestId?: string
  ): Promise<void> {
    try {
      await AuthAuditLog.create({
        userId,
        eventType: 'LOGIN_SUCCESS' as AuthEventType,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        requestId: requestId || null,
      });
      logger.info(`[AuthAudit] LOGIN_SUCCESS for user ${userId}`);
    } catch (error) {
      // Never throw - audit must not break auth flow
      logger.error('[AuthAudit] Failed to log LOGIN_SUCCESS:', error);
    }
  },

  /**
   * Log failed login attempt
   */
  async logLoginFailure(
    identifier: string,
    reason: string,
    ipAddress?: string,
    userAgent?: string,
    requestId?: string
  ): Promise<void> {
    try {
      await AuthAuditLog.create({
        eventType: 'LOGIN_FAILURE' as AuthEventType,
        identifier: this.maskIdentifier(identifier),
        failureReason: reason,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        requestId: requestId || null,
      });
      logger.warn(`[AuthAudit] LOGIN_FAILURE for ${this.maskIdentifier(identifier)}: ${reason}`);
    } catch (error) {
      logger.error('[AuthAudit] Failed to log LOGIN_FAILURE:', error);
    }
  },

  /**
   * Log user logout
   */
  async logLogout(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
    requestId?: string
  ): Promise<void> {
    try {
      await AuthAuditLog.create({
        userId,
        eventType: 'LOGOUT' as AuthEventType,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        requestId: requestId || null,
      });
      logger.info(`[AuthAudit] LOGOUT for user ${userId}`);
    } catch (error) {
      logger.error('[AuthAudit] Failed to log LOGOUT:', error);
    }
  },

  /**
   * Log session timeout (automatic logout due to inactivity)
   */
  async logSessionTimeout(
    userId: string,
    requestId?: string
  ): Promise<void> {
    try {
      await AuthAuditLog.create({
        userId,
        eventType: 'SESSION_TIMEOUT' as AuthEventType,
        requestId: requestId || null,
      });
      logger.info(`[AuthAudit] SESSION_TIMEOUT for user ${userId}`);
    } catch (error) {
      logger.error('[AuthAudit] Failed to log SESSION_TIMEOUT:', error);
    }
  },

  /**
   * Log OTP/verification code request
   */
  async logOtpRequest(
    identifier: string,
    ipAddress?: string,
    userAgent?: string,
    requestId?: string
  ): Promise<void> {
    try {
      await AuthAuditLog.create({
        eventType: 'OTP_REQUEST' as AuthEventType,
        identifier: this.maskIdentifier(identifier),
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        requestId: requestId || null,
      });
      logger.info(`[AuthAudit] OTP_REQUEST for ${this.maskIdentifier(identifier)}`);
    } catch (error) {
      logger.error('[AuthAudit] Failed to log OTP_REQUEST:', error);
    }
  },
};

export default authAuditService;
