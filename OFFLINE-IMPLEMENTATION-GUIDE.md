# ALA Medical Application - Offline Implementation Guide
## Complete Task Breakdown with Sub-Agent Assignments

---

## Overview
This document provides a comprehensive, step-by-step implementation plan for adding offline capabilities to the ALA medical application. Each task is assigned to the most appropriate sub-agent with specific instructions, verification criteria, and dependencies.

---

## Phase 1: Database Foundation (database-specialist)

### Task 1.1: Create Offline Support Schema
**Sub-agent**: database-specialist
**Priority**: CRITICAL
**Dependencies**: None

**Implementation Instructions**:
```sql
-- Add to all existing tables:
ALTER TABLE treatments ADD COLUMN IF NOT EXISTS sync_status VARCHAR(20) DEFAULT 'synced';
ALTER TABLE treatments ADD COLUMN IF NOT EXISTS last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE treatments ADD COLUMN IF NOT EXISTS device_id VARCHAR(50);
ALTER TABLE treatments ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE treatments ADD COLUMN IF NOT EXISTS local_id UUID;

ALTER TABLE applicators ADD COLUMN IF NOT EXISTS sync_status VARCHAR(20) DEFAULT 'synced';
ALTER TABLE applicators ADD COLUMN IF NOT EXISTS last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE applicators ADD COLUMN IF NOT EXISTS device_id VARCHAR(50);
ALTER TABLE applicators ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE applicators ADD COLUMN IF NOT EXISTS local_id UUID;

-- Create sync tracking table
CREATE TABLE IF NOT EXISTS sync_queue (
    id SERIAL PRIMARY KEY,
    operation_type VARCHAR(20) NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE'
    entity_type VARCHAR(50) NOT NULL,    -- 'treatment', 'applicator'
    entity_id INTEGER,
    local_id UUID NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'syncing', 'completed', 'failed'
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    device_id VARCHAR(50) NOT NULL
);

-- Create conflict resolution table
CREATE TABLE IF NOT EXISTS sync_conflicts (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER,
    local_version JSONB,
    server_version JSONB,
    resolution_status VARCHAR(20) DEFAULT 'pending',
    resolved_at TIMESTAMP,
    resolved_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX idx_sync_queue_status ON sync_queue(status);
CREATE INDEX idx_sync_queue_device ON sync_queue(device_id);
CREATE INDEX idx_treatments_sync ON treatments(sync_status, last_modified);
CREATE INDEX idx_applicators_sync ON applicators(sync_status, last_modified);
```

**Verification Steps**:
1. SSH into Azure VM: `ssh azureuser@20.217.84.100`
2. Connect to database: `docker exec -it ala-db-azure psql -U ala_user -d ala_production`
3. Run `\dt` to verify new tables exist
4. Run `\d treatments` to verify new columns
5. Test insert: `INSERT INTO sync_queue (operation_type, entity_type, local_id, payload, device_id) VALUES ('CREATE', 'treatment', gen_random_uuid(), '{}', 'test-device');`

---

## Phase 2: Frontend PWA Setup (frontend-ui)

### Task 2.1: Create Service Worker
**Sub-agent**: frontend-ui
**Priority**: CRITICAL
**Dependencies**: None

**File**: `frontend/public/service-worker.js`
```javascript
const CACHE_NAME = 'ala-medical-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html'
];

// Install event - cache essential files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', event => {
  if (event.request.url.includes('/api/')) {
    // API calls: network first, cache fallback
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // Static assets: cache first
    event.respondWith(
      caches.match(event.request)
        .then(response => response || fetch(event.request))
    );
  }
});

// Background sync for queued operations
self.addEventListener('sync', event => {
  if (event.tag === 'sync-treatments') {
    event.waitUntil(syncTreatments());
  }
});

async function syncTreatments() {
  // Implementation will be added by backend team
  console.log('Syncing treatments...');
}
```

**File**: `frontend/public/manifest.json`
```json
{
  "name": "ALA Medical Treatment Tracker",
  "short_name": "ALA Medical",
  "description": "Offline-capable medical treatment tracking application",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0066cc",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

**File**: `frontend/public/offline.html`
```html
<!DOCTYPE html>
<html>
<head>
  <title>ALA Medical - Offline</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: #f5f5f5;
    }
    .offline-container {
      text-align: center;
      padding: 2rem;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
  </style>
</head>
<body>
  <div class="offline-container">
    <h1>You're Offline</h1>
    <p>The application is working in offline mode. Your data will sync when connection is restored.</p>
  </div>
</body>
</html>
```

**Verification Steps**:
1. Check service worker registration in Chrome DevTools > Application > Service Workers
2. Verify cache storage in DevTools > Application > Cache Storage
3. Test offline mode: DevTools > Network > Offline checkbox
4. Verify manifest: DevTools > Application > Manifest
5. Test install prompt appears on mobile/desktop

### Task 2.2: Register Service Worker in React
**Sub-agent**: frontend-ui
**Priority**: CRITICAL
**Dependencies**: Task 2.1

**File**: `frontend/src/registerServiceWorker.ts`
```typescript
export function register() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js')
        .then(registration => {
          console.log('SW registered:', registration);

          // Check for updates every 60 seconds
          setInterval(() => {
            registration.update();
          }, 60000);

          // Handle updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New update available
                  if (confirm('New version available! Reload to update?')) {
                    newWorker.postMessage({ type: 'SKIP_WAITING' });
                    window.location.reload();
                  }
                }
              });
            }
          });
        })
        .catch(error => console.error('SW registration failed:', error));
    });
  }
}
```

**Modify**: `frontend/src/main.tsx`
```typescript
import { register } from './registerServiceWorker';
// ... existing imports

// After ReactDOM.createRoot
register();
```

---

## Phase 3: Offline Storage Layer (frontend-ui)

### Task 3.1: Implement IndexedDB Service
**Sub-agent**: frontend-ui
**Priority**: CRITICAL
**Dependencies**: None

**File**: `frontend/src/services/offlineStorage.ts`
```typescript
import Dexie, { Table } from 'dexie';

export interface OfflineTreatment {
  id?: number;
  localId: string;
  patientId: string;
  patientName: string;
  treatmentType: 'insertion' | 'removal';
  seedsPlanned: number;
  seedsUsed: number;
  applicators: OfflineApplicator[];
  syncStatus: 'pending' | 'synced' | 'conflict';
  lastModified: Date;
  deviceId: string;
  version: number;
}

export interface OfflineApplicator {
  id?: number;
  localId: string;
  treatmentLocalId: string;
  serialNumber: string;
  partName: string;
  seedCount: number;
  usageType: string;
  syncStatus: 'pending' | 'synced' | 'conflict';
  lastModified: Date;
}

export interface SyncQueueItem {
  id?: number;
  operationType: 'CREATE' | 'UPDATE' | 'DELETE';
  entityType: 'treatment' | 'applicator';
  entityLocalId: string;
  payload: any;
  retryCount: number;
  status: 'pending' | 'syncing' | 'completed' | 'failed';
  errorMessage?: string;
  createdAt: Date;
}

class OfflineDatabase extends Dexie {
  treatments!: Table<OfflineTreatment>;
  applicators!: Table<OfflineApplicator>;
  syncQueue!: Table<SyncQueueItem>;

  constructor() {
    super('ALAMedicalOffline');

    this.version(1).stores({
      treatments: '++id, localId, patientId, syncStatus, lastModified',
      applicators: '++id, localId, treatmentLocalId, serialNumber, syncStatus',
      syncQueue: '++id, entityLocalId, status, entityType, createdAt'
    });
  }

  async addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'createdAt'>) {
    return this.syncQueue.add({
      ...item,
      createdAt: new Date()
    });
  }

  async getPendingSyncItems() {
    return this.syncQueue.where('status').equals('pending').toArray();
  }

  async clearSyncedItems() {
    return this.syncQueue.where('status').equals('completed').delete();
  }
}

export const offlineDb = new OfflineDatabase();

// Helper functions
export async function saveOfflineTreatment(treatment: Omit<OfflineTreatment, 'id'>) {
  const id = await offlineDb.treatments.add(treatment);
  await offlineDb.addToSyncQueue({
    operationType: 'CREATE',
    entityType: 'treatment',
    entityLocalId: treatment.localId,
    payload: treatment,
    retryCount: 0,
    status: 'pending'
  });
  return id;
}

export async function getOfflineTreatments() {
  return offlineDb.treatments.toArray();
}

export async function syncWithServer() {
  const pendingItems = await offlineDb.getPendingSyncItems();
  // Implementation will be completed by backend integration
  console.log(`Found ${pendingItems.length} items to sync`);
  return pendingItems;
}
```

**NPM Package to Install**:
```bash
npm install dexie
```

**Verification Steps**:
1. Open Chrome DevTools > Application > IndexedDB
2. Verify "ALAMedicalOffline" database exists
3. Test data insertion in console:
   ```javascript
   const db = new Dexie('ALAMedicalOffline');
   db.open().then(() => console.log('DB opened'));
   ```
4. Create test treatment and verify it appears in IndexedDB
5. Check sync queue has pending items

---

## Phase 4: Offline Context Implementation (frontend-ui)

### Task 4.1: Create Offline Context
**Sub-agent**: frontend-ui
**Priority**: HIGH
**Dependencies**: Task 3.1

**File**: `frontend/src/contexts/OfflineContext.tsx`
```typescript
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { offlineDb, syncWithServer } from '../services/offlineStorage';

interface OfflineContextType {
  isOnline: boolean;
  syncStatus: 'idle' | 'syncing' | 'error';
  pendingOperations: number;
  lastSyncTime: Date | null;
  triggerSync: () => Promise<void>;
  queueOperation: (operation: any) => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [pendingOperations, setPendingOperations] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      triggerSync(); // Auto-sync when coming online
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check pending operations
  useEffect(() => {
    const checkPending = async () => {
      const pending = await offlineDb.syncQueue.where('status').equals('pending').count();
      setPendingOperations(pending);
    };

    checkPending();
    const interval = setInterval(checkPending, 5000);
    return () => clearInterval(interval);
  }, []);

  const triggerSync = useCallback(async () => {
    if (!isOnline) {
      console.log('Cannot sync while offline');
      return;
    }

    setSyncStatus('syncing');
    try {
      const items = await syncWithServer();
      // Backend will implement actual sync
      setLastSyncTime(new Date());
      setSyncStatus('idle');

      // Update pending count
      const pending = await offlineDb.syncQueue.where('status').equals('pending').count();
      setPendingOperations(pending);
    } catch (error) {
      console.error('Sync failed:', error);
      setSyncStatus('error');
    }
  }, [isOnline]);

  const queueOperation = useCallback(async (operation: any) => {
    await offlineDb.addToSyncQueue(operation);
    const pending = await offlineDb.syncQueue.where('status').equals('pending').count();
    setPendingOperations(pending);

    if (isOnline) {
      triggerSync();
    }
  }, [isOnline, triggerSync]);

  return (
    <OfflineContext.Provider value={{
      isOnline,
      syncStatus,
      pendingOperations,
      lastSyncTime,
      triggerSync,
      queueOperation
    }}>
      {children}
    </OfflineContext.Provider>
  );
}

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within OfflineProvider');
  }
  return context;
};
```

**Add to**: `frontend/src/App.tsx`
```typescript
import { OfflineProvider } from './contexts/OfflineContext';

// Wrap the app with OfflineProvider
<OfflineProvider>
  {/* existing app content */}
</OfflineProvider>
```

---

## Phase 5: Offline UI Components (frontend-ui)

### Task 5.1: Create Offline Status Indicator
**Sub-agent**: frontend-ui
**Priority**: HIGH
**Dependencies**: Task 4.1

**File**: `frontend/src/components/OfflineIndicator.tsx`
```typescript
import React from 'react';
import { useOffline } from '../contexts/OfflineContext';
import { WifiOff, Sync, AlertCircle, CheckCircle } from 'lucide-react';

export function OfflineIndicator() {
  const { isOnline, syncStatus, pendingOperations, lastSyncTime, triggerSync } = useOffline();

  if (isOnline && syncStatus === 'idle' && pendingOperations === 0) {
    return null; // Don't show when everything is normal
  }

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 px-4 py-2 text-white text-sm
      ${!isOnline ? 'bg-orange-500' :
        syncStatus === 'error' ? 'bg-red-500' :
        syncStatus === 'syncing' ? 'bg-blue-500' :
        'bg-green-500'}`}>
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!isOnline ? (
            <>
              <WifiOff className="w-4 h-4" />
              <span>Offline Mode - Data will sync when connection is restored</span>
            </>
          ) : syncStatus === 'syncing' ? (
            <>
              <Sync className="w-4 h-4 animate-spin" />
              <span>Syncing {pendingOperations} operations...</span>
            </>
          ) : syncStatus === 'error' ? (
            <>
              <AlertCircle className="w-4 h-4" />
              <span>Sync error - {pendingOperations} operations pending</span>
            </>
          ) : pendingOperations > 0 ? (
            <>
              <AlertCircle className="w-4 h-4" />
              <span>{pendingOperations} operations waiting to sync</span>
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4" />
              <span>All data synced</span>
            </>
          )}
        </div>

        {isOnline && syncStatus !== 'syncing' && pendingOperations > 0 && (
          <button
            onClick={triggerSync}
            className="px-3 py-1 bg-white/20 rounded hover:bg-white/30 transition-colors"
          >
            Sync Now
          </button>
        )}

        {lastSyncTime && (
          <span className="text-xs opacity-75">
            Last sync: {lastSyncTime.toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
}
```

**Add to main layout component**

---

## Phase 6: Backend Sync API (general-purpose)

### Task 6.1: Create Sync Controller and Routes
**Sub-agent**: general-purpose
**Priority**: HIGH
**Dependencies**: Task 1.1

**File**: `backend/src/controllers/syncController.ts`
```typescript
import { Request, Response } from 'express';
import { syncService } from '../services/syncService';

export const syncController = {
  // Push local changes to server
  async push(req: Request, res: Response) {
    try {
      const { deviceId, operations } = req.body;
      const results = await syncService.processSync(deviceId, operations);
      res.json({ success: true, results });
    } catch (error) {
      res.status(500).json({ error: 'Sync failed', details: error.message });
    }
  },

  // Pull server changes
  async pull(req: Request, res: Response) {
    try {
      const { deviceId, lastSyncTime } = req.query;
      const updates = await syncService.getUpdates(deviceId as string, lastSyncTime as string);
      res.json({ success: true, updates });
    } catch (error) {
      res.status(500).json({ error: 'Pull failed', details: error.message });
    }
  },

  // Get sync status
  async status(req: Request, res: Response) {
    try {
      const { deviceId } = req.params;
      const status = await syncService.getSyncStatus(deviceId);
      res.json({ success: true, status });
    } catch (error) {
      res.status(500).json({ error: 'Status check failed', details: error.message });
    }
  }
};
```

**File**: `backend/src/routes/syncRoutes.ts`
```typescript
import { Router } from 'express';
import { syncController } from '../controllers/syncController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/push', authenticate, syncController.push);
router.get('/pull', authenticate, syncController.pull);
router.get('/status/:deviceId', authenticate, syncController.status);

export default router;
```

**Add to**: `backend/src/server.ts`
```typescript
import syncRoutes from './routes/syncRoutes';
app.use('/api/sync', syncRoutes);
```

---

## Phase 7: Test Data Integration (general-purpose)

### Task 7.1: Enable Test Data on Azure VM
**Sub-agent**: deployment-azure
**Priority**: HIGH
**Dependencies**: None

**SSH Commands**:
```bash
# Connect to VM
ssh azureuser@20.217.84.100

# Update environment file
cd ala-improved
echo "ENABLE_TEST_DATA=true" >> azure/.env.azure

# Restart backend container
docker-compose -f azure/docker-compose.azure.yml --env-file azure/.env.azure restart ala-api-azure

# Verify test data is enabled
docker logs ala-api-azure --tail=50 | grep "test data"
```

**Verification Steps**:
1. Login as test@example.com (code: 123456)
2. Verify test hospitals appear in site selection
3. Check test patients are visible
4. Confirm applicator data loads

---

## Phase 8: Testing Suite (testing-specialist)

### Task 8.1: Create Offline Tests
**Sub-agent**: testing-specialist
**Priority**: MEDIUM
**Dependencies**: All previous tasks

**File**: `frontend/src/__tests__/offline.test.ts`
```typescript
import { offlineDb } from '../services/offlineStorage';

describe('Offline Functionality', () => {
  beforeEach(async () => {
    await offlineDb.delete();
    await offlineDb.open();
  });

  test('saves treatment offline', async () => {
    const treatment = {
      localId: 'test-123',
      patientId: 'P001',
      patientName: 'Test Patient',
      treatmentType: 'insertion' as const,
      seedsPlanned: 10,
      seedsUsed: 0,
      applicators: [],
      syncStatus: 'pending' as const,
      lastModified: new Date(),
      deviceId: 'test-device',
      version: 1
    };

    const id = await offlineDb.treatments.add(treatment);
    expect(id).toBeDefined();

    const saved = await offlineDb.treatments.get(id);
    expect(saved?.patientName).toBe('Test Patient');
  });

  test('queues operations for sync', async () => {
    await offlineDb.addToSyncQueue({
      operationType: 'CREATE',
      entityType: 'treatment',
      entityLocalId: 'test-123',
      payload: {},
      retryCount: 0,
      status: 'pending'
    });

    const pending = await offlineDb.getPendingSyncItems();
    expect(pending.length).toBe(1);
  });
});
```

**E2E Test**: `frontend/e2e/offline.spec.ts`
```typescript
import { test, expect } from '@playwright/test';

test.describe('Offline Mode', () => {
  test('shows offline indicator when offline', async ({ page, context }) => {
    await page.goto('/');

    // Go offline
    await context.setOffline(true);

    // Check indicator appears
    await expect(page.locator('text=Offline Mode')).toBeVisible();

    // Try to create treatment
    await page.click('text=New Treatment');

    // Should work offline
    await expect(page.locator('text=Treatment saved locally')).toBeVisible();
  });

  test('syncs when coming back online', async ({ page, context }) => {
    // Start offline
    await context.setOffline(true);
    await page.goto('/');

    // Create treatment offline
    // ... treatment creation steps

    // Go back online
    await context.setOffline(false);

    // Should auto-sync
    await expect(page.locator('text=Syncing')).toBeVisible();
    await expect(page.locator('text=All data synced')).toBeVisible({ timeout: 10000 });
  });
});
```

---

## Implementation Order & Timeline

### Week 1 - Foundation
1. **Day 1-2**: Database schema (database-specialist)
   - Run migrations on Azure VM
   - Verify sync tables created

2. **Day 3-4**: Service Worker & PWA (frontend-ui)
   - Deploy service worker
   - Test offline caching

3. **Day 5**: IndexedDB setup (frontend-ui)
   - Implement offline storage
   - Test data persistence

### Week 2 - Integration
1. **Day 1-2**: Offline Context (frontend-ui)
   - Implement context provider
   - Add to app

2. **Day 3-4**: Sync API (general-purpose)
   - Create backend endpoints
   - Test with Postman

3. **Day 5**: Test Data (deployment-azure)
   - Enable on Azure VM
   - Verify test user works

### Week 3 - Polish
1. **Day 1-2**: UI Components (frontend-ui)
   - Add status indicators
   - Implement sync UI

2. **Day 3-4**: Testing (testing-specialist)
   - Unit tests
   - E2E tests

3. **Day 5**: Performance (performance-optimization)
   - Optimize sync
   - Cache tuning

---

## Verification Checklist

### Database
- [ ] Sync tables created
- [ ] Indexes added
- [ ] Test data inserts work
- [ ] Triggers functioning

### Frontend
- [ ] Service Worker registered
- [ ] Cache storage working
- [ ] IndexedDB accessible
- [ ] Offline indicator visible
- [ ] PWA installable

### Backend
- [ ] Sync endpoints responding
- [ ] Queue processing works
- [ ] Conflict detection active
- [ ] Test data loading

### Integration
- [ ] Offline mode works
- [ ] Data persists locally
- [ ] Sync on reconnection
- [ ] No data loss

### Testing
- [ ] Unit tests pass
- [ ] E2E tests pass
- [ ] Manual testing complete
- [ ] Performance acceptable

---

## Deployment Commands

### Local Development
```bash
# Frontend
cd frontend
npm install dexie
npm run dev

# Backend
cd backend
npm run dev

# Database
docker exec -it postgres psql -U admin -d medical_app
```

### Azure VM Production
```bash
# Connect
ssh azureuser@20.217.84.100

# Update code
cd ala-improved
git pull origin main

# Rebuild containers
docker-compose -f azure/docker-compose.azure.yml --env-file azure/.env.azure up -d --build

# Check logs
docker logs ala-api-azure --tail=100 -f
docker logs ala-frontend-azure --tail=100 -f

# Verify offline features
curl http://20.217.84.100:3000/service-worker.js
curl http://20.217.84.100:3000/manifest.json
```

---

## Sub-Agent Assignment Summary

1. **database-specialist**: Schema, migrations, indexes, triggers
2. **frontend-ui**: Service Worker, PWA, IndexedDB, React components, offline UI
3. **general-purpose**: Sync API, backend integration, service implementation
4. **deployment-azure**: VM configuration, environment variables, container deployment
5. **testing-specialist**: Unit tests, E2E tests, test scenarios
6. **performance-optimization**: Cache optimization, sync performance, bundle size

Each sub-agent should follow their specific tasks in order, verify completion, and report any issues before proceeding to the next task.