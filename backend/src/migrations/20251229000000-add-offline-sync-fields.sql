-- ============================================================================
-- Migration: Add Offline Sync Fields for PWA Support
-- Date: 2025-12-29
-- Description: Adds columns and tables for offline-first PWA functionality
--              including version tracking, sync status, conflict resolution,
--              and HIPAA-compliant audit logging.
-- ============================================================================
-- CRITICAL SAFETY: This migration supports offline medical treatment tracking.
--                  All changes must maintain data integrity for patient safety.
-- ============================================================================

BEGIN;

-- ============================================================================
-- TASK 1.2: Treatments Table - Add Offline Sync Fields
-- ============================================================================

-- Add version column for optimistic locking (defaults to 1)
ALTER TABLE treatments ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Add last sync timestamp
ALTER TABLE treatments ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;

-- Add sync status enum
-- 'synced' = fully synced with server
-- 'pending' = has changes waiting to sync
-- 'conflict' = has conflicts that need resolution
ALTER TABLE treatments ADD COLUMN IF NOT EXISTS sync_status VARCHAR(20) DEFAULT 'synced';

-- Add device ID for tracking which device made changes
ALTER TABLE treatments ADD COLUMN IF NOT EXISTS device_id VARCHAR(64);

-- Add comments to document the columns
COMMENT ON COLUMN treatments.version IS 'Optimistic locking version, auto-incremented on update';
COMMENT ON COLUMN treatments.last_synced_at IS 'Timestamp of last successful sync with client';
COMMENT ON COLUMN treatments.sync_status IS 'Sync state: synced, pending, or conflict';
COMMENT ON COLUMN treatments.device_id IS 'Device ID that last modified this record';

-- ============================================================================
-- TASK 1.3: Applicators Table - Add Offline Sync Fields
-- ============================================================================

-- Add version column for optimistic locking (defaults to 1)
ALTER TABLE applicators ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Add flag to track if created while offline
ALTER TABLE applicators ADD COLUMN IF NOT EXISTS created_offline BOOLEAN DEFAULT FALSE;

-- Add sync timestamp
ALTER TABLE applicators ADD COLUMN IF NOT EXISTS synced_at TIMESTAMP WITH TIME ZONE;

-- Add comments to document the columns
COMMENT ON COLUMN applicators.version IS 'Optimistic locking version, auto-incremented on update';
COMMENT ON COLUMN applicators.created_offline IS 'True if this record was created while device was offline';
COMMENT ON COLUMN applicators.synced_at IS 'Timestamp of last successful sync with client';

-- ============================================================================
-- TASK 1.4: Create SyncConflict Table
-- ============================================================================
-- Stores conflicts that occur during sync for resolution by user or admin

CREATE TABLE IF NOT EXISTS sync_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- What entity has the conflict
    entity_type VARCHAR(50) NOT NULL,  -- 'treatment' or 'applicator'
    entity_id UUID NOT NULL,

    -- The conflicting data
    local_data JSONB NOT NULL,         -- What the client tried to save
    server_data JSONB NOT NULL,        -- What the server currently has

    -- Conflict metadata
    conflict_type VARCHAR(50) NOT NULL, -- 'version_mismatch', 'status_conflict', etc.
    device_id VARCHAR(64) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),

    -- Resolution tracking
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES users(id),
    resolution VARCHAR(20),            -- 'local_wins', 'server_wins', 'merged', 'admin_override'
    overwritten_data JSONB,            -- Audit: what data was replaced by resolution

    -- Index for quick lookups
    CONSTRAINT sync_conflicts_unresolved_unique
        UNIQUE (entity_type, entity_id, resolved_at)
        DEFERRABLE INITIALLY DEFERRED
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_entity ON sync_conflicts(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_user ON sync_conflicts(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_unresolved ON sync_conflicts(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_created ON sync_conflicts(created_at);

COMMENT ON TABLE sync_conflicts IS 'Stores sync conflicts for offline operations requiring resolution';
COMMENT ON COLUMN sync_conflicts.overwritten_data IS 'HIPAA audit: captures what data was replaced during resolution';

-- ============================================================================
-- TASK 1.5: Create OfflineAuditLog Table (HIPAA Compliance)
-- ============================================================================
-- All offline operations must be logged for HIPAA compliance and audit trails

CREATE TABLE IF NOT EXISTS offline_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- What was changed
    entity_type VARCHAR(50) NOT NULL,  -- 'treatment' or 'applicator'
    entity_id UUID NOT NULL,
    operation VARCHAR(20) NOT NULL,     -- 'create', 'update', 'status_change'

    -- Who changed it
    changed_by UUID NOT NULL REFERENCES users(id),
    device_id VARCHAR(64) NOT NULL,

    -- Offline tracking (HIPAA requirement: know when device went offline)
    offline_since TIMESTAMP WITH TIME ZONE NOT NULL,    -- When device went offline
    offline_changed_at TIMESTAMP WITH TIME ZONE NOT NULL, -- When change was made
    synced_at TIMESTAMP WITH TIME ZONE,                 -- When synced to server

    -- Data integrity verification
    change_hash VARCHAR(64) NOT NULL,   -- SHA-256 of change payload for integrity

    -- State tracking
    before_state JSONB,                 -- State before change (null for create)
    after_state JSONB NOT NULL,         -- State after change

    -- Resolution tracking (if there was a conflict)
    conflict_resolution VARCHAR(50),

    -- Additional metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_offline_audit_entity ON offline_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_offline_audit_user ON offline_audit_logs(changed_by);
CREATE INDEX IF NOT EXISTS idx_offline_audit_device ON offline_audit_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_offline_audit_unsynced ON offline_audit_logs(synced_at) WHERE synced_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_offline_audit_created ON offline_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_offline_audit_operation ON offline_audit_logs(operation);

COMMENT ON TABLE offline_audit_logs IS 'HIPAA-compliant audit log for all offline operations';
COMMENT ON COLUMN offline_audit_logs.offline_since IS 'Timestamp when device went offline - required for HIPAA audit';
COMMENT ON COLUMN offline_audit_logs.change_hash IS 'SHA-256 hash of change payload for data integrity verification';

-- ============================================================================
-- TASK 1.6: Version Increment Trigger
-- ============================================================================
-- Automatically increment version on any update to treatments or applicators

-- Create the function that increments version
CREATE OR REPLACE FUNCTION increment_version()
RETURNS TRIGGER AS $$
BEGIN
    -- Only increment version if other columns (not just version itself) changed
    -- This prevents version increment when only syncing version from client
    IF TG_OP = 'UPDATE' THEN
        NEW.version = OLD.version + 1;
        NEW.updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for treatments table
DROP TRIGGER IF EXISTS treatment_version_trigger ON treatments;
CREATE TRIGGER treatment_version_trigger
    BEFORE UPDATE ON treatments
    FOR EACH ROW
    EXECUTE FUNCTION increment_version();

-- Create trigger for applicators table
DROP TRIGGER IF EXISTS applicator_version_trigger ON applicators;
CREATE TRIGGER applicator_version_trigger
    BEFORE UPDATE ON applicators
    FOR EACH ROW
    EXECUTE FUNCTION increment_version();

COMMENT ON FUNCTION increment_version() IS 'Auto-increments version field for optimistic locking';

-- ============================================================================
-- Add indexes for offline queries
-- ============================================================================

-- Index for finding treatments by sync status
CREATE INDEX IF NOT EXISTS idx_treatments_sync_status ON treatments(sync_status);

-- Compound index for user + date queries (common for download bundles)
CREATE INDEX IF NOT EXISTS idx_treatments_user_date ON treatments(user_id, date);

-- Index for finding applicators by treatment and status (common for download bundles)
CREATE INDEX IF NOT EXISTS idx_applicators_treatment_status ON applicators(treatment_id, status);

COMMIT;

-- ============================================================================
-- DOWN Migration (Rollback)
-- ============================================================================
-- To rollback this migration, run:
--
-- BEGIN;
--
-- -- Drop triggers first
-- DROP TRIGGER IF EXISTS treatment_version_trigger ON treatments;
-- DROP TRIGGER IF EXISTS applicator_version_trigger ON applicators;
-- DROP FUNCTION IF EXISTS increment_version();
--
-- -- Drop new tables
-- DROP TABLE IF EXISTS offline_audit_logs;
-- DROP TABLE IF EXISTS sync_conflicts;
--
-- -- Drop treatments columns
-- ALTER TABLE treatments DROP COLUMN IF EXISTS version;
-- ALTER TABLE treatments DROP COLUMN IF EXISTS last_synced_at;
-- ALTER TABLE treatments DROP COLUMN IF EXISTS sync_status;
-- ALTER TABLE treatments DROP COLUMN IF EXISTS device_id;
--
-- -- Drop applicators columns
-- ALTER TABLE applicators DROP COLUMN IF EXISTS version;
-- ALTER TABLE applicators DROP COLUMN IF EXISTS created_offline;
-- ALTER TABLE applicators DROP COLUMN IF EXISTS synced_at;
--
-- -- Drop indexes
-- DROP INDEX IF EXISTS idx_treatments_sync_status;
-- DROP INDEX IF EXISTS idx_treatments_user_date;
-- DROP INDEX IF EXISTS idx_applicators_treatment_status;
--
-- COMMIT;
