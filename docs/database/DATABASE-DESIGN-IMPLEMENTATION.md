# ALA Medical Application - Complete Database Design & Implementation Guide
## For database-specialist Sub-Agent

---

## Table of Contents
1. [Overview & Architecture](#overview--architecture)
2. [Core Database Schema](#core-database-schema)
3. [Offline Support Extensions](#offline-support-extensions)
4. [Field Mapping Strategy](#field-mapping-strategy)
5. [Migration Scripts](#migration-scripts)
6. [Sequelize Model Updates](#sequelize-model-updates)
7. [Test Data Structure](#test-data-structure)
8. [Verification & Testing](#verification--testing)
9. [Azure VM Deployment](#azure-vm-deployment)
10. [Troubleshooting Guide](#troubleshooting-guide)

---

## Overview & Architecture

### Database Requirements
The ALA medical application requires a PostgreSQL database that supports:
1. **Core Medical Data**: Users, treatments, applicators
2. **Priority API Integration**: Syncing with external medical system
3. **Offline Capabilities**: Local data storage with sync queue
4. **Test Mode**: Isolated test data for development/testing
5. **Audit Trail**: Complete tracking of all medical operations

### Technology Stack
- **Database**: PostgreSQL 16.6
- **ORM**: Sequelize 6.32.0
- **Node.js Backend**: Express with TypeScript
- **Deployment**: Docker containers on Azure VM

### Database Naming Conventions
- **Tables**: Plural, snake_case (e.g., `treatments`, `sync_queue`)
- **Columns**: Snake_case (e.g., `serial_number`, `is_complete`)
- **Indexes**: `idx_[table]_[column]` (e.g., `idx_treatments_sync`)
- **Foreign Keys**: `fk_[table]_[referenced_table]`
- **Constraints**: `chk_[table]_[constraint_name]`

---

## Core Database Schema

### 1. Users Table
Stores all system users (medical staff, administrators, test users).

```sql
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone_number VARCHAR(50) UNIQUE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'hospital', 'alphatau', 'test')),
    metadata JSONB DEFAULT '{}',

    -- Authentication
    verification_code VARCHAR(6),
    verification_code_expires_at TIMESTAMP,
    last_login TIMESTAMP,

    -- Audit fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Offline support (to be added)
    sync_status VARCHAR(20) DEFAULT 'synced',
    last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    device_id VARCHAR(50),
    version INTEGER DEFAULT 1,
    local_id UUID
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_sync ON users(sync_status, last_modified);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    NEW.last_modified = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

**Metadata Structure**:
```json
{
  "sites": ["100078", "100040"],  // Hospital codes user can access
  "positionCode": 99,              // 99 = admin access to all sites
  "priorityUserId": "USR123",      // ID in Priority system
  "preferences": {
    "language": "en",
    "notifications": true
  }
}
```

### 2. Treatments Table
Core treatment records for insertion and removal procedures.

```sql
CREATE TABLE IF NOT EXISTS treatments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(20) NOT NULL CHECK (type IN ('insertion', 'removal')),
    subject_id VARCHAR(100) NOT NULL,  -- Patient ID from Priority
    site VARCHAR(100) NOT NULL,        -- Hospital/clinic code
    date TIMESTAMP NOT NULL,

    -- Medical data
    seed_quantity INTEGER,
    activity_per_seed FLOAT,
    surgeon VARCHAR(255),
    room VARCHAR(50),
    procedure_notes TEXT,

    -- Status tracking
    is_complete BOOLEAN DEFAULT false,
    completed_at TIMESTAMP,
    completed_by UUID REFERENCES users(id),

    -- Priority integration
    priority_id VARCHAR(100),           -- Order ID in Priority system
    priority_data JSONB,                -- Full Priority order data

    -- User tracking
    user_id UUID NOT NULL REFERENCES users(id),
    email VARCHAR(255),

    -- Audit fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Offline support (to be added)
    sync_status VARCHAR(20) DEFAULT 'synced',
    last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    device_id VARCHAR(50),
    version INTEGER DEFAULT 1,
    local_id UUID,

    CONSTRAINT fk_treatments_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_treatments_completed_by FOREIGN KEY (completed_by) REFERENCES users(id)
);

-- Indexes for query performance
CREATE INDEX idx_treatments_subject ON treatments(subject_id);
CREATE INDEX idx_treatments_date ON treatments(date);
CREATE INDEX idx_treatments_type ON treatments(type);
CREATE INDEX idx_treatments_site ON treatments(site);
CREATE INDEX idx_treatments_status ON treatments(is_complete);
CREATE INDEX idx_treatments_priority ON treatments(priority_id);
CREATE INDEX idx_treatments_sync ON treatments(sync_status, last_modified);

-- Composite indexes for common queries
CREATE INDEX idx_treatments_site_date ON treatments(site, date);
CREATE INDEX idx_treatments_user_status ON treatments(user_id, is_complete);

-- Trigger for updated_at
CREATE TRIGGER update_treatments_updated_at BEFORE UPDATE ON treatments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 3. Applicators Table
Detailed tracking of medical applicators (seed delivery devices).

```sql
CREATE TABLE IF NOT EXISTS applicators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Core applicator data
    serial_number VARCHAR(100) NOT NULL,
    part_name VARCHAR(100),              -- Product code (e.g., FLEX-00101-FG)
    part_description TEXT,                -- Full product description
    seed_quantity INTEGER NOT NULL DEFAULT 0,
    usage_type VARCHAR(20) NOT NULL CHECK (usage_type IN ('full', 'faulty', 'none')),

    -- Insertion tracking
    insertion_time TIMESTAMP NOT NULL,
    insertion_method VARCHAR(20) CHECK (insertion_method IN ('scan', 'manual')),
    comments TEXT,
    image_path VARCHAR(500),

    -- Removal tracking
    is_removed BOOLEAN DEFAULT false,
    removal_time TIMESTAMP,
    removal_comments TEXT,
    removal_image_path VARCHAR(500),

    -- Priority integration
    priority_serial VARCHAR(100),        -- SERNUM from Priority
    priority_data JSONB,                 -- Full applicator data from Priority
    sibd_repprodpal INTEGER,             -- Priority tracking number

    -- Relationships
    treatment_id UUID NOT NULL REFERENCES treatments(id) ON DELETE CASCADE,
    added_by UUID NOT NULL REFERENCES users(id),
    removed_by UUID REFERENCES users(id),

    -- Validation data
    validation_status VARCHAR(50),       -- valid, already_scanned, wrong_treatment, etc.
    validation_message TEXT,
    validated_at TIMESTAMP,

    -- Audit fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Offline support (to be added)
    sync_status VARCHAR(20) DEFAULT 'synced',
    last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    device_id VARCHAR(50),
    version INTEGER DEFAULT 1,
    local_id UUID,

    CONSTRAINT fk_applicators_treatment FOREIGN KEY (treatment_id) REFERENCES treatments(id) ON DELETE CASCADE,
    CONSTRAINT fk_applicators_added_by FOREIGN KEY (added_by) REFERENCES users(id),
    CONSTRAINT fk_applicators_removed_by FOREIGN KEY (removed_by) REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX idx_applicators_serial ON applicators(serial_number);
CREATE INDEX idx_applicators_treatment ON applicators(treatment_id);
CREATE INDEX idx_applicators_usage ON applicators(usage_type);
CREATE INDEX idx_applicators_removed ON applicators(is_removed);
CREATE INDEX idx_applicators_sync ON applicators(sync_status, last_modified);

-- Composite indexes
CREATE INDEX idx_applicators_treatment_serial ON applicators(treatment_id, serial_number);
CREATE UNIQUE INDEX idx_applicators_unique_per_treatment ON applicators(treatment_id, serial_number)
    WHERE is_removed = false;

-- Trigger for updated_at
CREATE TRIGGER update_applicators_updated_at BEFORE UPDATE ON applicators
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## Offline Support Extensions

### 4. Sync Queue Table
Manages all pending operations when offline.

```sql
CREATE TABLE IF NOT EXISTS sync_queue (
    id SERIAL PRIMARY KEY,

    -- Operation details
    operation_type VARCHAR(20) NOT NULL CHECK (operation_type IN ('CREATE', 'UPDATE', 'DELETE', 'PATCH')),
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('user', 'treatment', 'applicator')),
    entity_id UUID,                      -- Server ID if exists
    local_id UUID NOT NULL,               -- Local ID always present

    -- Payload and metadata
    payload JSONB NOT NULL,               -- Complete entity data
    previous_payload JSONB,               -- For UPDATE operations
    operation_metadata JSONB,             -- Additional context

    -- Status tracking
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'syncing', 'completed', 'failed', 'cancelled')),
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,

    -- Error handling
    error_message TEXT,
    error_code VARCHAR(50),
    error_details JSONB,

    -- Timing
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    next_retry_at TIMESTAMP,

    -- Device tracking
    device_id VARCHAR(50) NOT NULL,
    user_id UUID REFERENCES users(id),

    -- Priority and ordering
    priority INTEGER DEFAULT 5,          -- 1-10, 1 is highest
    sequence_number BIGSERIAL,           -- For maintaining order

    CONSTRAINT fk_sync_queue_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes for queue processing
CREATE INDEX idx_sync_queue_status ON sync_queue(status);
CREATE INDEX idx_sync_queue_device ON sync_queue(device_id);
CREATE INDEX idx_sync_queue_priority ON sync_queue(priority DESC, sequence_number ASC);
CREATE INDEX idx_sync_queue_retry ON sync_queue(next_retry_at) WHERE status = 'failed';
CREATE INDEX idx_sync_queue_entity ON sync_queue(entity_type, local_id);
```

### 5. Sync Conflicts Table
Tracks and resolves data conflicts during synchronization.

```sql
CREATE TABLE IF NOT EXISTS sync_conflicts (
    id SERIAL PRIMARY KEY,

    -- Conflict identification
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    local_id UUID NOT NULL,

    -- Versions in conflict
    local_version JSONB NOT NULL,
    server_version JSONB NOT NULL,
    base_version JSONB,                  -- Common ancestor if available

    -- Conflict details
    conflict_type VARCHAR(50),           -- update-update, delete-update, etc.
    conflicting_fields TEXT[],           -- Array of field names

    -- Resolution
    resolution_status VARCHAR(20) DEFAULT 'pending'
        CHECK (resolution_status IN ('pending', 'auto_resolved', 'manual_resolved', 'ignored')),
    resolution_strategy VARCHAR(50),      -- last_write_wins, merge, manual, etc.
    resolved_version JSONB,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    detected_by VARCHAR(50),             -- sync process that detected it
    resolved_at TIMESTAMP,
    resolved_by UUID REFERENCES users(id),
    resolution_notes TEXT,

    -- Device tracking
    local_device_id VARCHAR(50),
    server_device_id VARCHAR(50),

    CONSTRAINT fk_conflicts_resolved_by FOREIGN KEY (resolved_by) REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_conflicts_status ON sync_conflicts(resolution_status);
CREATE INDEX idx_conflicts_entity ON sync_conflicts(entity_type, local_id);
CREATE INDEX idx_conflicts_created ON sync_conflicts(created_at DESC);
```

### 6. Sync Log Table
Audit trail for all synchronization operations.

```sql
CREATE TABLE IF NOT EXISTS sync_log (
    id BIGSERIAL PRIMARY KEY,

    -- Operation details
    sync_id UUID DEFAULT gen_random_uuid(),
    operation VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,

    -- Status
    status VARCHAR(20) NOT NULL,

    -- Timing
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    duration_ms INTEGER,

    -- Metrics
    records_sent INTEGER DEFAULT 0,
    records_received INTEGER DEFAULT 0,
    conflicts_detected INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,

    -- Device and user
    device_id VARCHAR(50),
    user_id UUID REFERENCES users(id),

    -- Details
    request_payload JSONB,
    response_payload JSONB,
    error_details JSONB,

    CONSTRAINT fk_sync_log_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_sync_log_device ON sync_log(device_id);
CREATE INDEX idx_sync_log_status ON sync_log(status);
CREATE INDEX idx_sync_log_started ON sync_log(started_at DESC);
```

---

## Field Mapping Strategy

### Naming Convention Mappings
The application uses camelCase in JavaScript/TypeScript but snake_case in PostgreSQL.

| JavaScript (camelCase) | Database (snake_case) | Description |
|------------------------|----------------------|-------------|
| `serialNumber` | `serial_number` | Applicator serial |
| `isComplete` | `is_complete` | Treatment status |
| `treatmentId` | `treatment_id` | Foreign key |
| `seedQuantity` | `seed_quantity` | Number of seeds |
| `activityPerSeed` | `activity_per_seed` | Radiation activity |
| `insertionTime` | `insertion_time` | When applicator inserted |
| `isRemoved` | `is_removed` | Removal status |
| `removalComments` | `removal_comments` | Removal notes |
| `imagePath` | `image_path` | Photo location |
| `addedBy` | `added_by` | User foreign key |
| `removedBy` | `removed_by` | User foreign key |
| `completedAt` | `completed_at` | Completion timestamp |
| `completedBy` | `completed_by` | User who completed |
| `subjectId` | `subject_id` | Patient identifier |
| `priorityId` | `priority_id` | External system ID |
| `usageType` | `usage_type` | Applicator usage |
| `phoneNumber` | `phone_number` | User contact |
| `verificationCode` | `verification_code` | Auth code |
| `lastLogin` | `last_login` | Login tracking |
| `syncStatus` | `sync_status` | Offline sync state |
| `lastModified` | `last_modified` | Sync timestamp |
| `deviceId` | `device_id` | Device identifier |
| `localId` | `local_id` | Offline UUID |

---

## Migration Scripts

### Initial Setup Migration
**File**: `backend/src/migrations/001_initial_setup.sql`

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create all core tables
\i 002_create_users.sql
\i 003_create_treatments.sql
\i 004_create_applicators.sql
\i 005_create_sync_tables.sql

-- Add initial data
\i 006_seed_data.sql

-- Verify setup
SELECT
    schemaname,
    tablename,
    hasindexes,
    hastriggers
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

### Add Offline Support Migration
**File**: `backend/src/migrations/007_add_offline_support.sql`

```sql
-- Add offline columns to existing tables
ALTER TABLE users
ADD COLUMN IF NOT EXISTS sync_status VARCHAR(20) DEFAULT 'synced',
ADD COLUMN IF NOT EXISTS last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS device_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS local_id UUID;

ALTER TABLE treatments
ADD COLUMN IF NOT EXISTS sync_status VARCHAR(20) DEFAULT 'synced',
ADD COLUMN IF NOT EXISTS last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS device_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS local_id UUID;

ALTER TABLE applicators
ADD COLUMN IF NOT EXISTS sync_status VARCHAR(20) DEFAULT 'synced',
ADD COLUMN IF NOT EXISTS last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS device_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS local_id UUID;

-- Create sync indexes
CREATE INDEX IF NOT EXISTS idx_users_sync ON users(sync_status, last_modified);
CREATE INDEX IF NOT EXISTS idx_treatments_sync ON treatments(sync_status, last_modified);
CREATE INDEX IF NOT EXISTS idx_applicators_sync ON applicators(sync_status, last_modified);

-- Update triggers to handle last_modified
CREATE OR REPLACE FUNCTION update_last_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_modified = CURRENT_TIMESTAMP;
    NEW.version = COALESCE(OLD.version, 0) + 1;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all tables
DROP TRIGGER IF EXISTS update_users_last_modified ON users;
CREATE TRIGGER update_users_last_modified
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_last_modified_column();

DROP TRIGGER IF EXISTS update_treatments_last_modified ON treatments;
CREATE TRIGGER update_treatments_last_modified
    BEFORE UPDATE ON treatments
    FOR EACH ROW EXECUTE FUNCTION update_last_modified_column();

DROP TRIGGER IF EXISTS update_applicators_last_modified ON applicators;
CREATE TRIGGER update_applicators_last_modified
    BEFORE UPDATE ON applicators
    FOR EACH ROW EXECUTE FUNCTION update_last_modified_column();
```

---

## Sequelize Model Updates

### Update Treatment Model for Offline
**File**: `backend/src/models/Treatment.ts` (additions)

```typescript
// Add to TreatmentAttributes interface
syncStatus: 'pending' | 'synced' | 'conflict';
lastModified: Date;
deviceId: string | null;
version: number;
localId: string | null;

// Add to Treatment.init
syncStatus: {
  type: DataTypes.ENUM('pending', 'synced', 'conflict'),
  allowNull: false,
  defaultValue: 'synced',
  field: 'sync_status',
},
lastModified: {
  type: DataTypes.DATE,
  allowNull: false,
  defaultValue: DataTypes.NOW,
  field: 'last_modified',
},
deviceId: {
  type: DataTypes.STRING(50),
  allowNull: true,
  field: 'device_id',
},
version: {
  type: DataTypes.INTEGER,
  allowNull: false,
  defaultValue: 1,
},
localId: {
  type: DataTypes.UUID,
  allowNull: true,
  field: 'local_id',
},
```

---

## Test Data Structure

### Test Users Setup
```sql
-- Test user with bypass code (always 123456)
INSERT INTO users (id, name, email, phone_number, role, metadata) VALUES
(
    '11111111-1111-1111-1111-111111111111',
    'Test User',
    'test@example.com',
    '+1234567890',
    'test',
    '{
        "sites": ["100078", "100040", "100030", "100045", "100055", "100065"],
        "positionCode": 99,
        "testMode": true,
        "bypassCode": "123456"
    }'::jsonb
);

-- AlphaTau employee with all sites access
INSERT INTO users (id, name, email, phone_number, role, metadata) VALUES
(
    '22222222-2222-2222-2222-222222222222',
    'Alex Smith',
    'alexs@alphatau.com',
    '+972501234567',
    'alphatau',
    '{
        "sites": [],
        "positionCode": 99,
        "priorityUserId": "ALEX001"
    }'::jsonb
);

-- Hospital user with limited access
INSERT INTO users (id, name, email, phone_number, role, metadata) VALUES
(
    '33333333-3333-3333-3333-333333333333',
    'Hospital Staff',
    'staff@hospital.com',
    '+1234567891',
    'hospital',
    '{
        "sites": ["100078"],
        "positionCode": 50,
        "priorityUserId": "HOSP001"
    }'::jsonb
);
```

### Test Treatments Setup
```sql
-- Create test treatments that match test-data.json
INSERT INTO treatments (
    id, type, subject_id, site, date,
    seed_quantity, activity_per_seed,
    priority_id, user_id, is_complete
) VALUES
(
    '44444444-4444-4444-4444-444444444444',
    'insertion',
    'PAT-2025-015',
    '100078',
    CURRENT_DATE,
    20,
    2.8,
    'SO25000015',
    '11111111-1111-1111-1111-111111111111',
    false
),
(
    '55555555-5555-5555-5555-555555555555',
    'insertion',
    'PAT-2025-001',
    '100030',
    CURRENT_DATE,
    15,
    2.5,
    'SO25000010',
    '11111111-1111-1111-1111-111111111111',
    false
);
```

---

## Verification & Testing

### Database Health Check Script
**File**: `backend/scripts/check-database.sql`

```sql
-- Check all tables exist
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('users', 'treatments', 'applicators', 'sync_queue', 'sync_conflicts', 'sync_log')
ORDER BY tablename;

-- Check row counts
SELECT
    'users' as table_name, COUNT(*) as row_count FROM users
UNION ALL
SELECT 'treatments', COUNT(*) FROM treatments
UNION ALL
SELECT 'applicators', COUNT(*) FROM applicators
UNION ALL
SELECT 'sync_queue', COUNT(*) FROM sync_queue
ORDER BY table_name;

-- Check indexes
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Check foreign key constraints
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name;

-- Check triggers
SELECT
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public';
```

### Test Offline Functionality
```sql
-- Simulate offline operation
INSERT INTO sync_queue (
    operation_type, entity_type, local_id,
    payload, device_id, user_id
) VALUES (
    'CREATE',
    'treatment',
    gen_random_uuid(),
    '{"type": "insertion", "subjectId": "TEST-001", "site": "100078"}'::jsonb,
    'test-device-001',
    '11111111-1111-1111-1111-111111111111'
);

-- Check pending operations
SELECT * FROM sync_queue WHERE status = 'pending';

-- Simulate conflict
INSERT INTO sync_conflicts (
    entity_type, local_id,
    local_version, server_version,
    conflict_type, local_device_id
) VALUES (
    'applicator',
    gen_random_uuid(),
    '{"serialNumber": "TEST-123", "seedQuantity": 2}'::jsonb,
    '{"serialNumber": "TEST-123", "seedQuantity": 3}'::jsonb,
    'update-update',
    'test-device-001'
);

-- Check conflicts
SELECT * FROM sync_conflicts WHERE resolution_status = 'pending';
```

---

## Azure VM Deployment

### Step 1: Connect to Azure VM
```bash
ssh azureuser@20.217.84.100
cd ala-improved
```

### Step 2: Run Database Migrations
```bash
# Connect to database container
docker exec -it ala-db-azure psql -U ala_user -d ala_production

# Run migration scripts
\i /migrations/001_initial_setup.sql
\i /migrations/007_add_offline_support.sql

# Verify
\dt
\d+ treatments
\d+ sync_queue
```

### Step 3: Seed Test Data
```bash
# For production with test mode
docker exec -it ala-db-azure psql -U ala_user -d ala_production <<EOF
-- Insert test@example.com user
INSERT INTO users (id, name, email, role, metadata) VALUES
(
    '11111111-1111-1111-1111-111111111111',
    'Test User',
    'test@example.com',
    'test',
    '{"sites": ["100078", "100040"], "positionCode": 99, "testMode": true}'::jsonb
) ON CONFLICT (email) DO UPDATE
SET metadata = '{"sites": ["100078", "100040"], "positionCode": 99, "testMode": true}'::jsonb;
EOF
```

### Step 4: Verify Database
```bash
# Check tables
docker exec -it ala-db-azure psql -U ala_user -d ala_production -c "\dt"

# Check test user
docker exec -it ala-db-azure psql -U ala_user -d ala_production -c "SELECT email, role, metadata FROM users WHERE email = 'test@example.com'"

# Check sync tables
docker exec -it ala-db-azure psql -U ala_user -d ala_production -c "SELECT COUNT(*) FROM sync_queue"
```

### Step 5: Update Backend Environment
```bash
# Add offline support flag
echo "ENABLE_OFFLINE_MODE=true" >> azure/.env.azure
echo "SYNC_INTERVAL_MS=30000" >> azure/.env.azure

# Restart backend
docker-compose -f azure/docker-compose.azure.yml --env-file azure/.env.azure restart ala-api-azure

# Check logs
docker logs ala-api-azure --tail=50
```

---

## Troubleshooting Guide

### Common Issues

#### 1. Migration Fails
```sql
-- Check current schema version
SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;

-- Rollback if needed
BEGIN;
-- Run rollback commands
ROLLBACK;

-- Retry migration
BEGIN;
-- Run migration
COMMIT;
```

#### 2. Foreign Key Violations
```sql
-- Find orphaned records
SELECT a.* FROM applicators a
LEFT JOIN treatments t ON a.treatment_id = t.id
WHERE t.id IS NULL;

-- Clean up
DELETE FROM applicators WHERE treatment_id NOT IN (SELECT id FROM treatments);
```

#### 3. Sync Queue Stuck
```sql
-- Reset failed items
UPDATE sync_queue
SET status = 'pending', retry_count = 0, error_message = NULL
WHERE status = 'failed' AND retry_count >= max_retries;

-- Clear old completed items
DELETE FROM sync_queue
WHERE status = 'completed'
AND completed_at < CURRENT_TIMESTAMP - INTERVAL '7 days';
```

#### 4. Duplicate Key Errors
```sql
-- Find duplicates
SELECT serial_number, COUNT(*)
FROM applicators
GROUP BY serial_number
HAVING COUNT(*) > 1;

-- Add unique constraint safely
CREATE UNIQUE INDEX CONCURRENTLY idx_applicators_serial_unique
ON applicators(serial_number)
WHERE is_removed = false;
```

#### 5. Performance Issues
```sql
-- Analyze tables
ANALYZE users;
ANALYZE treatments;
ANALYZE applicators;

-- Check slow queries
SELECT query, calls, mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Add missing indexes
CREATE INDEX CONCURRENTLY idx_treatments_date_site
ON treatments(date, site)
WHERE is_complete = false;
```

### Database Monitoring Queries
```sql
-- Active connections
SELECT pid, usename, application_name, client_addr, state
FROM pg_stat_activity
WHERE datname = 'ala_production';

-- Table sizes
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Lock monitoring
SELECT
    pid,
    usename,
    pg_blocking_pids(pid) as blocked_by,
    query
FROM pg_stat_activity
WHERE pg_blocking_pids(pid)::text != '{}';
```

---

## Implementation Checklist for database-specialist

### Phase 1: Core Schema (Day 1-2)
- [ ] Create users table with all fields
- [ ] Create treatments table with relationships
- [ ] Create applicators table with constraints
- [ ] Add all indexes for performance
- [ ] Set up triggers for timestamps
- [ ] Verify foreign key constraints

### Phase 2: Offline Support (Day 3)
- [ ] Add sync columns to existing tables
- [ ] Create sync_queue table
- [ ] Create sync_conflicts table
- [ ] Create sync_log table
- [ ] Add sync-related indexes
- [ ] Update triggers for version control

### Phase 3: Test Data (Day 4)
- [ ] Insert test@example.com user
- [ ] Create test treatments
- [ ] Add test applicators
- [ ] Verify test data relationships
- [ ] Test offline queue operations

### Phase 4: Azure Deployment (Day 5)
- [ ] SSH to Azure VM
- [ ] Run all migrations
- [ ] Seed production test data
- [ ] Verify database health
- [ ] Update environment variables
- [ ] Restart backend container

### Phase 5: Verification (Day 6)
- [ ] Run health check queries
- [ ] Test all CRUD operations
- [ ] Verify sync queue works
- [ ] Check performance metrics
- [ ] Document any issues

---

## Notes for Sub-Agent Implementation

1. **ALWAYS** use transactions for schema changes
2. **NEVER** drop tables in production without backup
3. **TEST** migrations on local database first
4. **VERIFY** each step before proceeding to next
5. **DOCUMENT** any deviations from this guide
6. **BACKUP** database before major changes
7. **CHECK** application logs after schema changes

This guide provides everything needed to implement the complete database design for both core functionality and offline support. Follow the phases in order and verify each step before proceeding.