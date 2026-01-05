import { expect, afterEach, vi, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// ============================================================================
// 1. IndexedDB Mock (fake-indexeddb)
// ============================================================================
import 'fake-indexeddb/auto';

// ============================================================================
// 2. Web Crypto API (Node.js webcrypto)
// ============================================================================
import { webcrypto } from 'crypto';

Object.defineProperty(globalThis, 'crypto', {
  value: webcrypto,
  writable: true,
  configurable: true,
});

// ============================================================================
// 3. Extend Vitest's expect with jest-dom matchers
// ============================================================================
expect.extend(matchers);

// ============================================================================
// 4. Network Event Simulation Helper
// ============================================================================
const networkEventListeners: Record<string, Set<EventListener>> = {
  online: new Set(),
  offline: new Set(),
};

// Store original methods
const originalAddEventListener = window.addEventListener.bind(window);
const originalRemoveEventListener = window.removeEventListener.bind(window);

// Override addEventListener for network events
vi.spyOn(window, 'addEventListener').mockImplementation((type: string, listener: EventListenerOrEventListenerObject) => {
  if (type === 'online' || type === 'offline') {
    networkEventListeners[type].add(listener as EventListener);
    return;
  }
  originalAddEventListener(type, listener as EventListener);
});

// Override removeEventListener for network events
vi.spyOn(window, 'removeEventListener').mockImplementation((type: string, listener: EventListenerOrEventListenerObject) => {
  if (type === 'online' || type === 'offline') {
    networkEventListeners[type].delete(listener as EventListener);
    return;
  }
  originalRemoveEventListener(type, listener as EventListener);
});

/**
 * Simulate a network status change event
 * @param online - true for online, false for offline
 */
export const simulateNetworkEvent = (online: boolean): void => {
  Object.defineProperty(navigator, 'onLine', {
    value: online,
    writable: true,
    configurable: true,
  });
  const eventType = online ? 'online' : 'offline';
  networkEventListeners[eventType].forEach(listener => {
    listener(new Event(eventType));
  });
};

/**
 * Reset network event listeners (for test isolation)
 */
export const resetNetworkListeners = (): void => {
  networkEventListeners.online.clear();
  networkEventListeners.offline.clear();
};

// ============================================================================
// 5. Mock window.matchMedia
// ============================================================================
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ============================================================================
// 6. Mock IntersectionObserver
// ============================================================================
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as unknown as typeof IntersectionObserver;

// ============================================================================
// 7. Mock navigator.onLine (configurable per test)
// ============================================================================
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  configurable: true,
  value: true,
});

// ============================================================================
// 8. Mock btoa/atob for encryption tests (jsdom compatible)
// ============================================================================
if (typeof globalThis.btoa === 'undefined') {
  globalThis.btoa = (str: string) => Buffer.from(str, 'binary').toString('base64');
  globalThis.atob = (str: string) => Buffer.from(str, 'base64').toString('binary');
}

// ============================================================================
// 9. Console Mocks (reduce noise in tests, but keep available for verification)
// ============================================================================
const originalConsole = { ...console };

beforeAll(() => {
  global.console = {
    ...originalConsole,
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  };
});

// ============================================================================
// 10. Cleanup after each test
// ============================================================================
afterEach(async () => {
  // React Testing Library cleanup
  cleanup();

  // Storage cleanup
  localStorage.clear();
  sessionStorage.clear();

  // Reset network listeners
  resetNetworkListeners();

  // Reset navigator.onLine to default
  Object.defineProperty(navigator, 'onLine', {
    value: true,
    writable: true,
    configurable: true,
  });

  // Clear all IndexedDB databases
  try {
    const databases = await indexedDB.databases();
    for (const db of databases) {
      if (db.name) {
        indexedDB.deleteDatabase(db.name);
      }
    }
  } catch {
    // IndexedDB cleanup might fail in some environments
  }

  // Clear all mocks
  vi.clearAllMocks();
});
