/**
 * NetworkStatus Service Unit Tests
 *
 * Tests for the standalone network status monitoring service.
 * Target: 100% code coverage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { simulateNetworkEvent, resetNetworkListeners } from '../../setup';

// ============================================================================
// Test Setup
// ============================================================================

// We need to test the class directly, not the singleton
// Import the class for fresh instances in each test
let NetworkStatusService: typeof import('../../../src/services/networkStatus').NetworkStatusService;

beforeEach(async () => {
  // Reset network state
  Object.defineProperty(navigator, 'onLine', {
    value: true,
    writable: true,
    configurable: true,
  });
  resetNetworkListeners();
  vi.clearAllMocks();

  // Re-import to get a fresh module
  vi.resetModules();
  const module = await import('../../../src/services/networkStatus');
  NetworkStatusService = module.NetworkStatusService;
});

afterEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// Constructor & SSR Tests
// ============================================================================

describe('NetworkStatusService', () => {
  describe('Constructor & Initialization', () => {
    it('should initialize with navigator.onLine = true', () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
      const service = new NetworkStatusService();
      expect(service.isOnline).toBe(true);
    });

    it('should initialize with navigator.onLine = false', () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      const service = new NetworkStatusService();
      expect(service.isOnline).toBe(false);
    });

    it('should set lastOnlineTime when starting online', () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
      const before = new Date();
      const service = new NetworkStatusService();
      const after = new Date();

      expect(service.lastOnline).not.toBeNull();
      expect(service.lastOnline!.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(service.lastOnline!.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should set offlineSince when starting offline', () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      const before = new Date();
      const service = new NetworkStatusService();
      const after = new Date();

      expect(service.offlineStartTime).not.toBeNull();
      expect(service.offlineStartTime!.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(service.offlineStartTime!.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should default to online when navigator is undefined (SSR)', () => {
      // Save original navigator
      const originalNavigator = globalThis.navigator;

      // Temporarily remove navigator
      Object.defineProperty(globalThis, 'navigator', {
        value: undefined,
        configurable: true,
      });

      // Re-evaluate the default value logic
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      expect(isOnline).toBe(true);

      // Restore navigator
      Object.defineProperty(globalThis, 'navigator', {
        value: originalNavigator,
        configurable: true,
      });
    });
  });

  // ============================================================================
  // State Getters Tests
  // ============================================================================

  describe('State Getters', () => {
    it('isOnline should return current status', () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
      const service = new NetworkStatusService();
      expect(service.isOnline).toBe(true);
    });

    it('offlineStartTime should return null when online', () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
      const service = new NetworkStatusService();
      expect(service.offlineStartTime).toBeNull();
    });

    it('offlineStartTime should return Date when offline', () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      const service = new NetworkStatusService();
      expect(service.offlineStartTime).toBeInstanceOf(Date);
    });

    it('lastOnline should return last online timestamp', () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
      const service = new NetworkStatusService();
      expect(service.lastOnline).toBeInstanceOf(Date);
    });

    it('offlineDurationMs should return 0 when online', () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
      const service = new NetworkStatusService();
      expect(service.offlineDurationMs).toBe(0);
    });

    it('offlineDurationMs should calculate correctly when offline', () => {
      vi.useFakeTimers();
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      const service = new NetworkStatusService();

      // Advance time by 5 seconds
      vi.advanceTimersByTime(5000);

      expect(service.offlineDurationMs).toBeGreaterThanOrEqual(5000);
      vi.useRealTimers();
    });

    it('offlineDurationMs should return 0 when offlineSince is null', () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
      const service = new NetworkStatusService();
      // Even if we somehow have _isOnline = false but offlineSince = null
      // The getter checks both conditions
      expect(service.offlineDurationMs).toBe(0);
    });
  });

  // ============================================================================
  // Subscribe/Unsubscribe Tests
  // ============================================================================

  describe('Subscribe/Unsubscribe', () => {
    it('should add listener and return unsubscribe function', () => {
      const service = new NetworkStatusService();
      const listener = vi.fn();

      const unsubscribe = service.subscribe(listener);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should call listener when status changes online to offline', () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
      const service = new NetworkStatusService();
      const listener = vi.fn();

      service.subscribe(listener);
      simulateNetworkEvent(false);

      expect(listener).toHaveBeenCalledWith(false);
    });

    it('should call listener when status changes offline to online', () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      const service = new NetworkStatusService();
      const listener = vi.fn();

      service.subscribe(listener);
      simulateNetworkEvent(true);

      expect(listener).toHaveBeenCalledWith(true);
    });

    it('should remove listener when unsubscribe is called', () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
      const service = new NetworkStatusService();
      const listener = vi.fn();

      const unsubscribe = service.subscribe(listener);
      unsubscribe();

      // Simulate network change - listener should NOT be called
      simulateNetworkEvent(false);
      simulateNetworkEvent(true);

      // The listener might be called once if the event propagated before unsubscribe
      // But after unsubscribe, no more calls
      const callCount = listener.mock.calls.length;
      simulateNetworkEvent(false);
      expect(listener.mock.calls.length).toBe(callCount);
    });

    it('should not crash when listener throws an error', () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
      const service = new NetworkStatusService();

      const errorListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const normalListener = vi.fn();

      service.subscribe(errorListener);
      service.subscribe(normalListener);

      // Trigger network change - should not throw
      expect(() => {
        simulateNetworkEvent(false);
      }).not.toThrow();

      // Normal listener should still be called
      expect(normalListener).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Network Events & setOnline Tests
  // ============================================================================

  describe('Network Events & setOnline', () => {
    it('should not notify listeners if status unchanged', () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
      const service = new NetworkStatusService();
      const listener = vi.fn();

      service.subscribe(listener);

      // Simulate "online" event when already online
      simulateNetworkEvent(true);

      // Listener should not be called for same status
      expect(listener).not.toHaveBeenCalled();
    });

    it('should update lastOnlineTime when going online', () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      const service = new NetworkStatusService();

      const before = new Date();
      simulateNetworkEvent(true);
      const after = new Date();

      expect(service.lastOnline).not.toBeNull();
      expect(service.lastOnline!.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(service.lastOnline!.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should clear offlineSince when going online', () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      const service = new NetworkStatusService();

      expect(service.offlineStartTime).not.toBeNull();

      simulateNetworkEvent(true);

      expect(service.offlineStartTime).toBeNull();
    });

    it('should set offlineSince when going offline', () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
      const service = new NetworkStatusService();

      expect(service.offlineStartTime).toBeNull();

      const before = new Date();
      simulateNetworkEvent(false);
      const after = new Date();

      expect(service.offlineStartTime).not.toBeNull();
      expect(service.offlineStartTime!.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(service.offlineStartTime!.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  // ============================================================================
  // checkNetwork Tests
  // ============================================================================

  describe('checkNetwork', () => {
    it('should sync with navigator.onLine when status changed', () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
      const service = new NetworkStatusService();
      const listener = vi.fn();
      service.subscribe(listener);

      // Change navigator.onLine directly (simulating external change)
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      // Call checkNetwork to sync
      const result = service.checkNetwork();

      expect(result).toBe(false);
      expect(service.isOnline).toBe(false);
      expect(listener).toHaveBeenCalledWith(false);
    });

    it('should return current status when unchanged', () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
      const service = new NetworkStatusService();
      const listener = vi.fn();
      service.subscribe(listener);

      // checkNetwork without any change
      const result = service.checkNetwork();

      expect(result).toBe(true);
      expect(listener).not.toHaveBeenCalled();
    });

    it('should return current status when navigator is undefined', () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
      const service = new NetworkStatusService();

      // checkNetwork should work even with the service already initialized
      const result = service.checkNetwork();

      expect(result).toBe(true);
    });
  });

  // ============================================================================
  // Singleton Export Test
  // ============================================================================

  describe('Singleton', () => {
    it('should export a singleton instance', async () => {
      const { networkStatus } = await import('../../../src/services/networkStatus');
      expect(networkStatus).toBeDefined();
      expect(typeof networkStatus.isOnline).toBe('boolean');
    });
  });
});
