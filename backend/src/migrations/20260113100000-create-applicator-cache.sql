-- Migration: Create applicator_cache table for fail-safe ERP validation
-- Purpose: Cache ERP metadata locally to enable offline resilience
-- Pattern: FAIL-CLOSED - block operations when ERP offline and cache stale
-- See: .claude/rules/priority-integration.md

BEGIN;

-- Create applicator_cache table
CREATE TABLE IF NOT EXISTS applicator_cache (
    serial_number VARCHAR(100) PRIMARY KEY,
    sibd_nouse VARCHAR(10),
    sibd_expiry VARCHAR(50),
    sibd_treattype VARCHAR(50),
    sibd_seedqty INTEGER,
    sibd_seedlen DECIMAL(5, 2),
    partdes VARCHAR(255),
    partname VARCHAR(100),
    cached_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Index for finding stale cache entries
CREATE INDEX IF NOT EXISTS idx_applicator_cache_cached_at
ON applicator_cache(cached_at);

-- Add comments for documentation
COMMENT ON TABLE applicator_cache IS 'Cache of Priority ERP applicator metadata for offline resilience';
COMMENT ON COLUMN applicator_cache.serial_number IS 'Applicator serial number (primary key)';
COMMENT ON COLUMN applicator_cache.sibd_nouse IS 'Y if applicator marked NO USE in Priority';
COMMENT ON COLUMN applicator_cache.sibd_expiry IS 'Expiry date from Priority ERP';
COMMENT ON COLUMN applicator_cache.sibd_treattype IS 'Treatment type compatibility';
COMMENT ON COLUMN applicator_cache.sibd_seedqty IS 'Seed quantity from Priority';
COMMENT ON COLUMN applicator_cache.sibd_seedlen IS 'Seed length from Priority';
COMMENT ON COLUMN applicator_cache.partdes IS 'Part description / applicator type from Priority';
COMMENT ON COLUMN applicator_cache.partname IS 'Catalog number from Priority';
COMMENT ON COLUMN applicator_cache.cached_at IS 'Timestamp when cache was last updated - entries older than 24h are considered stale';

COMMIT;

-- Verification query (run after migration)
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'applicator_cache';
