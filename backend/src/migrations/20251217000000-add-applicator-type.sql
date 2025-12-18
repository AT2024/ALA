-- Migration: Add applicator_type column to applicators table
-- Date: 2025-12-17
-- Description: Stores the applicator type (PARTDES from Priority) in local database
--              for PDF generation and offline access

-- ============================================================================
-- UP Migration
-- ============================================================================

BEGIN;

-- Add applicator_type column (nullable for backward compatibility)
ALTER TABLE applicators ADD COLUMN IF NOT EXISTS applicator_type VARCHAR(255) NULL;

-- Add comment to document the column
COMMENT ON COLUMN applicators.applicator_type IS 'Applicator type description from Priority PARTS.PARTDES field';

COMMIT;

-- ============================================================================
-- DOWN Migration (Rollback)
-- ============================================================================

-- To rollback this migration, run:
-- BEGIN;
-- ALTER TABLE applicators DROP COLUMN IF EXISTS applicator_type;
-- COMMIT;

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Check column was added:
-- SELECT column_name, data_type, is_nullable, character_maximum_length
-- FROM information_schema.columns
-- WHERE table_name = 'applicators' AND column_name = 'applicator_type';

-- Check existing applicators have NULL (expected):
-- SELECT COUNT(*) as null_count FROM applicators WHERE applicator_type IS NULL;
