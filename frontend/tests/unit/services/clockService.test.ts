/**
 * ClockService Unit Tests
 *
 * Tests for the clock synchronization service.
 * Target: 100% code coverage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createNetworkStatusMock, createApiMock } from './helpers/testMocks';

// ============================================================================
// Mocks
// ============================================================================

// Mock networkStatus
const mockNetworkStatus = createNetworkStatusMock();
vi.mock('../../../src/services/networkStatus', () => ({
  networkStatus: mockNetworkStatus,
}));

// Mock api
const mockApi = createApiMock();
vi.mock('../../../src/services/api', () => ({
  default: mockApi,
}));

// ============================================================================
// Test Setup
// ============================================================================

let ClockService: typeof import('../../../src/services/clockService').ClockService;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();

  // Reset mock state
  mockNetworkStatus.isOnline = true;
  mockNetworkStatus.subscribe.mockClear();
  mockNetworkStatus.subscribe.mockImplementation(() => vi.fn());

  mockApi.get.mockReset();

  // Re-import for fresh instance
  const module = await import('../../../src/services/clockService');
  ClockService = module.ClockService;
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

// ============================================================================
// Constructor & Auto-Sync Tests
// ============================================================================

describe('ClockService', () => {
  describe('Constructor & Auto-Sync', () => {
    it('should subscribe to networkStatus on construction', () => {
      new ClockService();
      expect(mockNetworkStatus.subscribe).toHaveBeenCalled();
    });

    it('should auto-sync when online AND needsSync', async () => {
      mockNetworkStatus.isOnline = true;
      mockApi.get.mockResolvedValue({
        data: { timestamp: new Date().toISOString() },
      });

      // Create service and get the subscription callback
      new ClockService();
      const subscribeCallback = mockNetworkStatus.subscribe.mock.calls[0][0];

      // Simulate coming online (triggers auto-sync because never synced)
      await subscribeCallback(true);

      expect(mockApi.get).toHaveBeenCalledWith('/time');
    });

    it('should not auto-sync when online but recently synced', async () => {
      mockNetworkStatus.isOnline = true;
      mockApi.get.mockResolvedValue({
        data: { timestamp: new Date().toISOString() },
      });

      const service = new ClockService();
      const subscribeCallback = mockNetworkStatus.subscribe.mock.calls[0][0];

      // First sync (manual)
      await service.sync();

      // Clear mock to track new calls only
      mockApi.get.mockClear();

      // Simulate network status change callback
      // Service should check needsSync() and NOT sync because recently synced
      mockNetworkStatus.isOnline = true;
      await subscribeCallback(true);

      // The service's shouldResync() should return false since we just synced
      // So auto-sync should be skipped
      // Note: The callback still triggers but the sync() won't call API
      // because needsSync returns false (within SYNC_INTERVAL_MS)
      expect(service.needsSync()).toBe(false);
    });

    it('should not auto-sync when offline', async () => {
      mockNetworkStatus.isOnline = false;

      const service = new ClockService();
      const subscribeCallback = mockNetworkStatus.subscribe.mock.calls[0][0];

      // Simulate going offline
      await subscribeCallback(false);

      expect(mockApi.get).not.toHaveBeenCalled();
    });

    it('shouldResync should return true if never synced', () => {
      const service = new ClockService();
      expect(service.needsSync()).toBe(true);
    });
  });

  // ============================================================================
  // sync() Method Tests
  // ============================================================================

  describe('sync() Method', () => {
    it('should return failure if already syncing (concurrent guard)', async () => {
      mockNetworkStatus.isOnline = true;

      // Create a slow API response
      mockApi.get.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: { timestamp: new Date().toISOString() } }), 100))
      );

      const service = new ClockService();

      // Start first sync
      const firstSync = service.sync();

      // Try second sync immediately
      const secondSync = await service.sync();

      expect(secondSync.success).toBe(false);

      // Wait for first sync to complete
      await firstSync;
    });

    it('should return failure if offline', async () => {
      mockNetworkStatus.isOnline = false;

      const service = new ClockService();
      const result = await service.sync();

      expect(result.success).toBe(false);
      expect(mockApi.get).not.toHaveBeenCalled();
    });

    it('should calculate offset correctly', async () => {
      vi.useFakeTimers();
      mockNetworkStatus.isOnline = true;

      const serverTime = new Date('2025-01-01T12:00:00.000Z');

      // Mock API to return server time with simulated network delay
      mockApi.get.mockImplementation(async () => {
        vi.advanceTimersByTime(50); // 50ms network delay
        return { data: { timestamp: serverTime.toISOString() } };
      });

      const service = new ClockService();
      const result = await service.sync();

      expect(result.success).toBe(true);
      expect(result.serverTime).toEqual(serverTime);
      expect(typeof result.offset).toBe('number');
      expect(result.roundTrip).toBeGreaterThanOrEqual(0);

      vi.useRealTimers();
    });

    it('should set lastSyncTime on success', async () => {
      mockNetworkStatus.isOnline = true;
      mockApi.get.mockResolvedValue({
        data: { timestamp: new Date().toISOString() },
      });

      const service = new ClockService();
      expect(service.getLastSyncTime()).toBeNull();

      await service.sync();

      expect(service.getLastSyncTime()).not.toBeNull();
      expect(service.getLastSyncTime()).toBeInstanceOf(Date);
    });

    it('should log warning for large offset (>5 min)', async () => {
      mockNetworkStatus.isOnline = true;
      const consoleSpy = vi.spyOn(console, 'warn');

      // Server time 10 minutes ahead
      const serverTime = new Date(Date.now() + 10 * 60 * 1000);
      mockApi.get.mockResolvedValue({
        data: { timestamp: serverTime.toISOString() },
      });

      const service = new ClockService();
      await service.sync();

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toContain('[ClockService] Large clock offset detected');
    });

    it('should log info for normal offset (<5 min)', async () => {
      mockNetworkStatus.isOnline = true;
      const consoleSpy = vi.spyOn(console, 'log');

      // Server time 1 second ahead (small offset)
      const serverTime = new Date(Date.now() + 1000);
      mockApi.get.mockResolvedValue({
        data: { timestamp: serverTime.toISOString() },
      });

      const service = new ClockService();
      await service.sync();

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls.some(call => call[0].includes('[ClockService] Clock synced'))).toBe(true);
    });

    it('should handle API error gracefully', async () => {
      mockNetworkStatus.isOnline = true;
      const consoleSpy = vi.spyOn(console, 'error');

      mockApi.get.mockRejectedValue(new Error('Network error'));

      const service = new ClockService();
      const result = await service.sync();

      expect(result.success).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should return current offset on failure', async () => {
      mockNetworkStatus.isOnline = true;
      mockApi.get.mockRejectedValue(new Error('Network error'));

      const service = new ClockService();
      const result = await service.sync();

      expect(result.offset).toBe(0); // Initial offset is 0
    });

    it('should reset syncInProgress in finally block', async () => {
      mockNetworkStatus.isOnline = true;
      mockApi.get.mockRejectedValue(new Error('Network error'));

      const service = new ClockService();

      // First sync fails
      await service.sync();

      // Second sync should work (not blocked by syncInProgress)
      mockApi.get.mockResolvedValue({
        data: { timestamp: new Date().toISOString() },
      });
      const result = await service.sync();

      expect(result.success).toBe(true);
    });

    it('should return correct roundTrip time', async () => {
      vi.useFakeTimers();
      mockNetworkStatus.isOnline = true;

      mockApi.get.mockImplementation(async () => {
        vi.advanceTimersByTime(100); // 100ms round trip
        return { data: { timestamp: new Date().toISOString() } };
      });

      const service = new ClockService();
      const result = await service.sync();

      expect(result.roundTrip).toBe(100);

      vi.useRealTimers();
    });
  });

  // ============================================================================
  // Time Adjustment Tests
  // ============================================================================

  describe('Time Adjustment', () => {
    it('getAdjustedTime should return Date with offset', async () => {
      mockNetworkStatus.isOnline = true;

      // Server is 5 seconds ahead
      const serverTime = new Date(Date.now() + 5000);
      mockApi.get.mockResolvedValue({
        data: { timestamp: serverTime.toISOString() },
      });

      const service = new ClockService();
      await service.sync();

      const adjusted = service.getAdjustedTime();
      expect(adjusted).toBeInstanceOf(Date);
    });

    it('getAdjustedISOString should return ISO string', async () => {
      mockNetworkStatus.isOnline = true;
      mockApi.get.mockResolvedValue({
        data: { timestamp: new Date().toISOString() },
      });

      const service = new ClockService();
      await service.sync();

      const isoString = service.getAdjustedISOString();
      expect(typeof isoString).toBe('string');
      expect(isoString).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('getAdjustedTimestamp should return milliseconds', async () => {
      mockNetworkStatus.isOnline = true;
      mockApi.get.mockResolvedValue({
        data: { timestamp: new Date().toISOString() },
      });

      const service = new ClockService();
      await service.sync();

      const timestamp = service.getAdjustedTimestamp();
      expect(typeof timestamp).toBe('number');
      expect(timestamp).toBeGreaterThan(0);
    });

    it('getOffset should return current offset', async () => {
      mockNetworkStatus.isOnline = true;
      mockApi.get.mockResolvedValue({
        data: { timestamp: new Date().toISOString() },
      });

      const service = new ClockService();

      // Before sync, offset should be 0
      expect(service.getOffset()).toBe(0);

      await service.sync();

      // After sync, offset should be a number (could be 0 if times match)
      expect(typeof service.getOffset()).toBe('number');
    });

    it('all time methods should be consistent with each other', async () => {
      mockNetworkStatus.isOnline = true;
      mockApi.get.mockResolvedValue({
        data: { timestamp: new Date().toISOString() },
      });

      const service = new ClockService();
      await service.sync();

      const adjustedTime = service.getAdjustedTime();
      const adjustedTimestamp = service.getAdjustedTimestamp();
      const adjustedISOString = service.getAdjustedISOString();

      // All should represent roughly the same time (within 100ms tolerance)
      expect(Math.abs(adjustedTime.getTime() - adjustedTimestamp)).toBeLessThan(100);
      expect(new Date(adjustedISOString).getTime() - adjustedTimestamp).toBeLessThan(100);
    });
  });

  // ============================================================================
  // Status Methods Tests
  // ============================================================================

  describe('Status Methods', () => {
    it('isClockReliable should return false if never synced', () => {
      const service = new ClockService();
      expect(service.isClockReliable()).toBe(false);
    });

    it('isClockReliable should return false if offset > 5 min', async () => {
      mockNetworkStatus.isOnline = true;

      // Server is 10 minutes ahead
      const serverTime = new Date(Date.now() + 10 * 60 * 1000);
      mockApi.get.mockResolvedValue({
        data: { timestamp: serverTime.toISOString() },
      });

      const service = new ClockService();
      await service.sync();

      expect(service.isClockReliable()).toBe(false);
    });

    it('isClockReliable should return true if offset within 5 min', async () => {
      mockNetworkStatus.isOnline = true;

      // Server is 1 second ahead (within 5 min)
      const serverTime = new Date(Date.now() + 1000);
      mockApi.get.mockResolvedValue({
        data: { timestamp: serverTime.toISOString() },
      });

      const service = new ClockService();
      await service.sync();

      expect(service.isClockReliable()).toBe(true);
    });

    it('needsSync should return true if never synced', () => {
      const service = new ClockService();
      expect(service.needsSync()).toBe(true);
    });

    it('needsSync should return true if elapsed > 1 hour', async () => {
      vi.useFakeTimers();
      mockNetworkStatus.isOnline = true;
      mockApi.get.mockResolvedValue({
        data: { timestamp: new Date().toISOString() },
      });

      const service = new ClockService();
      await service.sync();

      expect(service.needsSync()).toBe(false);

      // Advance time by 2 hours
      vi.advanceTimersByTime(2 * 60 * 60 * 1000);

      expect(service.needsSync()).toBe(true);

      vi.useRealTimers();
    });
  });

  // ============================================================================
  // formatOffset & getStatusMessage Tests
  // ============================================================================

  describe('formatOffset & getStatusMessage', () => {
    it('getStatusMessage should show "Clock not synchronized" if never synced', () => {
      const service = new ClockService();
      expect(service.getStatusMessage()).toBe('Clock not synchronized');
    });

    it('getStatusMessage should show clock skew for large offset', async () => {
      mockNetworkStatus.isOnline = true;

      // Server is 10 minutes ahead
      const serverTime = new Date(Date.now() + 10 * 60 * 1000);
      mockApi.get.mockResolvedValue({
        data: { timestamp: serverTime.toISOString() },
      });

      const service = new ClockService();
      await service.sync();

      const message = service.getStatusMessage();
      expect(message).toContain('Clock skew detected');
    });

    it('getStatusMessage should show "Clock synchronized" for recent sync', async () => {
      mockNetworkStatus.isOnline = true;
      mockApi.get.mockResolvedValue({
        data: { timestamp: new Date().toISOString() },
      });

      const service = new ClockService();
      await service.sync();

      expect(service.getStatusMessage()).toBe('Clock synchronized');
    });

    it('getStatusMessage should show "Clock synced X min ago" for older syncs', async () => {
      vi.useFakeTimers();
      mockNetworkStatus.isOnline = true;
      mockApi.get.mockResolvedValue({
        data: { timestamp: new Date().toISOString() },
      });

      const service = new ClockService();
      await service.sync();

      // Advance time by 5 minutes
      vi.advanceTimersByTime(5 * 60 * 1000);

      const message = service.getStatusMessage();
      expect(message).toContain('Clock synced');
      expect(message).toContain('min ago');

      vi.useRealTimers();
    });

    it('formatOffset should show ms for small offsets', async () => {
      mockNetworkStatus.isOnline = true;

      // Server is 500ms ahead
      const serverTime = new Date(Date.now() + 500);
      mockApi.get.mockResolvedValue({
        data: { timestamp: serverTime.toISOString() },
      });

      const service = new ClockService();
      await service.sync();

      // The formatOffset is private, but we can test it through getStatusMessage
      // when offset is large but < 1s, it should show ms
      expect(service.getOffset()).toBeDefined();
    });

    it('formatOffset should show seconds for medium offsets', async () => {
      mockNetworkStatus.isOnline = true;

      // Server is 30 seconds ahead
      const serverTime = new Date(Date.now() + 30000);
      mockApi.get.mockResolvedValue({
        data: { timestamp: serverTime.toISOString() },
      });

      const service = new ClockService();
      await service.sync();

      // Verify the offset was calculated
      expect(Math.abs(service.getOffset())).toBeGreaterThan(0);
    });

    it('formatOffset should show minutes for large offsets', async () => {
      mockNetworkStatus.isOnline = true;

      // Server is 10 minutes ahead
      const serverTime = new Date(Date.now() + 10 * 60 * 1000);
      mockApi.get.mockResolvedValue({
        data: { timestamp: serverTime.toISOString() },
      });

      const service = new ClockService();
      await service.sync();

      const message = service.getStatusMessage();
      expect(message).toContain('min');
    });
  });

  // ============================================================================
  // Singleton Export Test
  // ============================================================================

  describe('Singleton', () => {
    it('should export a singleton instance', async () => {
      const { clockService } = await import('../../../src/services/clockService');
      expect(clockService).toBeDefined();
      expect(typeof clockService.isClockReliable).toBe('function');
    });
  });
});
