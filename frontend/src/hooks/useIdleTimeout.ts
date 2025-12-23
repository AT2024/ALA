import { useEffect, useCallback, useRef, useState } from 'react';

/**
 * HIPAA-compliant idle session timeout hook
 *
 * HIPAA requires automatic logoff after inactivity to protect patient data.
 * Recommended timeout for healthcare web applications: 10-30 minutes
 *
 * @see https://www.censinet.com/perspectives/hipaa-compliance-session-timeout-rules
 */

// 15 minutes idle timeout (HIPAA compliant for healthcare web apps)
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

// Show warning 1 minute before timeout
const WARNING_BEFORE_MS = 60 * 1000;

// Events that indicate user activity
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];

interface UseIdleTimeoutOptions {
  onTimeout: () => void;
  onWarning?: () => void;
  enabled?: boolean;
  timeoutMs?: number;
  warningMs?: number;
}

interface UseIdleTimeoutReturn {
  isWarningShown: boolean;
  secondsRemaining: number;
  resetTimer: () => void;
}

export function useIdleTimeout({
  onTimeout,
  onWarning,
  enabled = true,
  timeoutMs = IDLE_TIMEOUT_MS,
  warningMs = WARNING_BEFORE_MS
}: UseIdleTimeoutOptions): UseIdleTimeoutReturn {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const [isWarningShown, setIsWarningShown] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(Math.floor(warningMs / 1000));

  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
      warningRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const startCountdown = useCallback(() => {
    setSecondsRemaining(Math.floor(warningMs / 1000));

    countdownRef.current = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [warningMs]);

  const resetTimer = useCallback(() => {
    if (!enabled) return;

    clearAllTimers();
    setIsWarningShown(false);
    setSecondsRemaining(Math.floor(warningMs / 1000));

    // Set warning timer (fires 1 minute before timeout)
    if (onWarning) {
      warningRef.current = setTimeout(() => {
        setIsWarningShown(true);
        startCountdown();
        onWarning();
      }, timeoutMs - warningMs);
    }

    // Set timeout timer
    timeoutRef.current = setTimeout(() => {
      setIsWarningShown(false);
      onTimeout();
    }, timeoutMs);
  }, [enabled, onTimeout, onWarning, timeoutMs, warningMs, clearAllTimers, startCountdown]);

  useEffect(() => {
    if (!enabled) {
      clearAllTimers();
      return;
    }

    // Add event listeners for activity detection
    const handleActivity = () => {
      resetTimer();
    };

    ACTIVITY_EVENTS.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Start the initial timer
    resetTimer();

    // Cleanup
    return () => {
      ACTIVITY_EVENTS.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      clearAllTimers();
    };
  }, [enabled, resetTimer, clearAllTimers]);

  return {
    isWarningShown,
    secondsRemaining,
    resetTimer
  };
}

export default useIdleTimeout;
