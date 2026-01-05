/**
 * Clock Synchronization Service
 *
 * Synchronizes client clock with server to ensure accurate timestamps
 * for offline operations. Handles clock skew between device and server.
 *
 * Usage:
 *   import { clockService } from './clockService';
 *   await clockService.sync();
 *   const adjustedTime = clockService.getAdjustedTime();
 */

import api from './api';
import { networkStatus } from './networkStatus';

// ============================================================================
// Types
// ============================================================================

export interface ClockSyncResult {
  success: boolean;
  offset: number;        // Milliseconds offset from server
  roundTrip: number;     // Round trip time in ms
  serverTime: Date;      // Server time at sync
}

// ============================================================================
// Constants
// ============================================================================

// Maximum acceptable clock offset (5 minutes)
const MAX_ACCEPTABLE_OFFSET_MS = 5 * 60 * 1000;

// How often to re-sync (every hour)
const SYNC_INTERVAL_MS = 60 * 60 * 1000;

// ============================================================================
// Clock Service Class
// ============================================================================

class ClockService {
  private clockOffset = 0;
  private lastSyncTime: Date | null = null;
  private syncInProgress = false;

  constructor() {
    // Auto-sync when network is restored
    networkStatus.subscribe((isOnline) => {
      if (isOnline && this.shouldResync()) {
        this.sync();
      }
    });
  }

  /**
   * Check if clock should be re-synced
   */
  private shouldResync(): boolean {
    if (!this.lastSyncTime) return true;

    const elapsed = Date.now() - this.lastSyncTime.getTime();
    return elapsed > SYNC_INTERVAL_MS;
  }

  /**
   * Synchronize clock with server
   */
  async sync(): Promise<ClockSyncResult> {
    if (this.syncInProgress) {
      return {
        success: false,
        offset: this.clockOffset,
        roundTrip: 0,
        serverTime: new Date(),
      };
    }

    if (!networkStatus.isOnline) {
      return {
        success: false,
        offset: this.clockOffset,
        roundTrip: 0,
        serverTime: new Date(),
      };
    }

    this.syncInProgress = true;

    try {
      const beforeRequest = Date.now();

      const response = await api.get('/time');

      const afterRequest = Date.now();
      const roundTrip = afterRequest - beforeRequest;

      const serverTime = new Date(response.data.timestamp);
      const serverTimeMs = serverTime.getTime();

      // Calculate offset accounting for network latency
      // Assume latency is symmetric (half round trip each way)
      this.clockOffset = serverTimeMs + (roundTrip / 2) - Date.now();

      this.lastSyncTime = new Date();

      // Log if offset is significant
      if (Math.abs(this.clockOffset) > MAX_ACCEPTABLE_OFFSET_MS) {
        console.warn(
          `[ClockService] Large clock offset detected: ${this.clockOffset}ms (${this.formatOffset(this.clockOffset)})`
        );
      } else {
        console.log(
          `[ClockService] Clock synced. Offset: ${this.clockOffset}ms, RTT: ${roundTrip}ms`
        );
      }

      return {
        success: true,
        offset: this.clockOffset,
        roundTrip,
        serverTime,
      };
    } catch (error) {
      console.error('[ClockService] Sync failed:', error);
      return {
        success: false,
        offset: this.clockOffset,
        roundTrip: 0,
        serverTime: new Date(),
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Get current time adjusted for server clock
   */
  getAdjustedTime(): Date {
    return new Date(Date.now() + this.clockOffset);
  }

  /**
   * Get adjusted timestamp in ISO format
   */
  getAdjustedISOString(): string {
    return this.getAdjustedTime().toISOString();
  }

  /**
   * Get adjusted timestamp in milliseconds
   */
  getAdjustedTimestamp(): number {
    return Date.now() + this.clockOffset;
  }

  /**
   * Get the current clock offset in milliseconds
   */
  getOffset(): number {
    return this.clockOffset;
  }

  /**
   * Check if clock offset is within acceptable range
   */
  isClockReliable(): boolean {
    if (!this.lastSyncTime) return false;
    return Math.abs(this.clockOffset) <= MAX_ACCEPTABLE_OFFSET_MS;
  }

  /**
   * Check if clock needs to be synced
   */
  needsSync(): boolean {
    return !this.lastSyncTime || this.shouldResync();
  }

  /**
   * Get last sync time
   */
  getLastSyncTime(): Date | null {
    return this.lastSyncTime;
  }

  /**
   * Format offset for display
   */
  private formatOffset(offsetMs: number): string {
    const absOffset = Math.abs(offsetMs);
    const direction = offsetMs >= 0 ? 'ahead' : 'behind';

    if (absOffset < 1000) {
      return `${absOffset}ms ${direction}`;
    }

    if (absOffset < 60000) {
      return `${(absOffset / 1000).toFixed(1)}s ${direction}`;
    }

    return `${(absOffset / 60000).toFixed(1)}min ${direction}`;
  }

  /**
   * Get human-readable clock status
   */
  getStatusMessage(): string {
    if (!this.lastSyncTime) {
      return 'Clock not synchronized';
    }

    if (!this.isClockReliable()) {
      return `Clock skew detected: ${this.formatOffset(this.clockOffset)}`;
    }

    const sinceSync = Date.now() - this.lastSyncTime.getTime();
    const minutesAgo = Math.floor(sinceSync / 60000);

    if (minutesAgo < 1) {
      return 'Clock synchronized';
    }

    return `Clock synced ${minutesAgo} min ago`;
  }
}

// Singleton instance
export const clockService = new ClockService();

// Export class for testing
export { ClockService };
