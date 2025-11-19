-- Migration: Add status and package_label columns to applicators table
-- Date: 2025-11-19
-- Description: Implements 9-state applicator workflow (Step 1: Database Schema)
--              Adds status field for workflow state tracking and package_label for package identification
--              Backfills status from existing usageType for backward compatibility

-- ============================================================================
-- UP Migration
-- ============================================================================

BEGIN;

-- Add status column (nullable for backward compatibility)
ALTER TABLE applicators
ADD COLUMN IF NOT EXISTS status VARCHAR(50) NULL;

-- Add package_label column
ALTER TABLE applicators
ADD COLUMN IF NOT EXISTS package_label VARCHAR(10) NULL;

-- Add comment to document the columns
COMMENT ON COLUMN applicators.status IS 'Applicator workflow state: SEALED, SCANNED, INSERTED, REMOVED, DISPOSED, FAULTY';
COMMENT ON COLUMN applicators.package_label IS 'Package label identifier (A-Z) for tracking applicators from the same package';

-- Backfill status from existing usageType field
-- usageType='full' -> status='INSERTED'
-- usageType='faulty' -> status='FAULTY'
-- usageType='none' -> status='DISPOSED'
-- NULL or unknown -> status='SEALED' (default)
UPDATE applicators
SET status = CASE
  WHEN usage_type = 'full' THEN 'INSERTED'
  WHEN usage_type = 'faulty' THEN 'FAULTY'
  WHEN usage_type = 'none' THEN 'DISPOSED'
  ELSE 'SEALED'
END
WHERE status IS NULL;

-- Add index on status column for performance (workflow state queries)
CREATE INDEX IF NOT EXISTS idx_applicators_status ON applicators(status);

-- Add index on package_label for package-level queries
CREATE INDEX IF NOT EXISTS idx_applicators_package_label ON applicators(package_label);

COMMIT;

-- ============================================================================
-- DOWN Migration (Rollback)
-- ============================================================================

-- To rollback this migration, run:
-- BEGIN;
-- DROP INDEX IF EXISTS idx_applicators_package_label;
-- DROP INDEX IF EXISTS idx_applicators_status;
-- ALTER TABLE applicators DROP COLUMN IF EXISTS package_label;
-- ALTER TABLE applicators DROP COLUMN IF EXISTS status;
-- COMMIT;

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- After running migration, verify with:

-- Check columns were added
-- SELECT column_name, data_type, is_nullable, character_maximum_length
-- FROM information_schema.columns
-- WHERE table_name = 'applicators' AND column_name IN ('status', 'package_label')
-- ORDER BY column_name;

-- Check indexes were created
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'applicators' AND indexname IN ('idx_applicators_status', 'idx_applicators_package_label');

-- Verify status backfill from usageType
-- SELECT usage_type, status, COUNT(*) as count
-- FROM applicators
-- GROUP BY usage_type, status
-- ORDER BY usage_type, status;

-- Check for any NULL status values (should be none after backfill)
-- SELECT COUNT(*) as null_status_count
-- FROM applicators
-- WHERE status IS NULL;
