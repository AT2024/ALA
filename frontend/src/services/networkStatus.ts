/**
 * Network Status Service
 *
 * Standalone online/offline detection service to avoid circular dependencies.
 * This service provides reactive network state monitoring without React dependencies.
 *
 * Usage:
 *   import { networkStatus } from './networkStatus';
 *   const unsubscribe = networkStatus.subscribe((isOnline) => console.log(isOnline));
 *   console.log(networkStatus.isOnline);
 */

export interface NetworkStatusListener {
  (isOnline: boolean): void;
}

class NetworkStatusService {
  private _isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private listeners: Set<NetworkStatusListener> = new Set();
  private lastOnlineTime: Date | null = null;
  private offlineSince: Date | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.setOnline(true));
      window.addEventListener('offline', () => this.setOnline(false));

      // Track initial online time
      if (this._isOnline) {
        this.lastOnlineTime = new Date();
      } else {
        this.offlineSince = new Date();
      }
    }
  }

  /**
   * Current online status
   */
  get isOnline(): boolean {
    return this._isOnline;
  }

  /**
   * When the device last went offline (null if currently online)
   */
  get offlineStartTime(): Date | null {
    return this.offlineSince;
  }

  /**
   * When the device was last online (null if never online in this session)
   */
  get lastOnline(): Date | null {
    return this.lastOnlineTime;
  }

  /**
   * Duration offline in milliseconds (0 if online)
   */
  get offlineDurationMs(): number {
    if (this._isOnline || !this.offlineSince) {
      return 0;
    }
    return Date.now() - this.offlineSince.getTime();
  }

  /**
   * Subscribe to network status changes
   * @param listener Callback function called with true (online) or false (offline)
   * @returns Unsubscribe function
   */
  subscribe(listener: NetworkStatusListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Internal method to update online status
   */
  private setOnline(online: boolean): void {
    if (this._isOnline === online) return;

    this._isOnline = online;

    if (online) {
      this.lastOnlineTime = new Date();
      this.offlineSince = null;
    } else {
      this.offlineSince = new Date();
    }

    // Notify all listeners
    this.listeners.forEach(listener => {
      try {
        listener(online);
      } catch (error) {
        console.error('[NetworkStatus] Listener error:', error);
      }
    });
  }

  /**
   * Force a network check (useful for testing or manual refresh)
   */
  checkNetwork(): boolean {
    if (typeof navigator !== 'undefined') {
      const actualStatus = navigator.onLine;
      if (actualStatus !== this._isOnline) {
        this.setOnline(actualStatus);
      }
    }
    return this._isOnline;
  }
}

// Singleton instance
export const networkStatus = new NetworkStatusService();

// Export class for testing
export { NetworkStatusService };
