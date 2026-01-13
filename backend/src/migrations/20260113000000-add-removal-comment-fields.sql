-- ============================================================================
-- Migration: Add Removal Comment Fields
-- Date: 2026-01-13
-- Description: Adds comment columns for removal procedure tracking
--              (top_general_comments, group_comments, individual_seed_comment)
-- ============================================================================
-- CRITICAL: These columns were missing in production after PR #25.
--           Model changes MUST always have corresponding migration files.
-- ============================================================================

BEGIN;

-- ============================================================================
-- Add top_general_comments column
-- ============================================================================
-- General comments shown at top of removal procedure form

ALTER TABLE treatments
ADD COLUMN IF NOT EXISTS top_general_comments TEXT;

COMMENT ON COLUMN treatments.top_general_comments IS 'General comments shown at top of removal procedure form';

-- ============================================================================
-- Add group_comments column
-- ============================================================================
-- JSON-serialized comments per seed group during removal

ALTER TABLE treatments
ADD COLUMN IF NOT EXISTS group_comments TEXT;

COMMENT ON COLUMN treatments.group_comments IS 'JSON-serialized comments per seed group during removal';

-- ============================================================================
-- Add individual_seed_comment column
-- ============================================================================
-- Comments for individual seed removal tracking

ALTER TABLE treatments
ADD COLUMN IF NOT EXISTS individual_seed_comment TEXT;

COMMENT ON COLUMN treatments.individual_seed_comment IS 'Comments for individual seed removal tracking';

COMMIT;

-- ============================================================================
-- Verification Query
-- ============================================================================
-- Run this to verify the migration was applied:
--
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'treatments'
-- AND column_name IN ('top_general_comments', 'group_comments', 'individual_seed_comment')
-- ORDER BY column_name;

-- ============================================================================
-- DOWN Migration (Rollback)
-- ============================================================================
-- To rollback this migration, run:
--
-- BEGIN;
-- ALTER TABLE treatments DROP COLUMN IF EXISTS individual_seed_comment;
-- ALTER TABLE treatments DROP COLUMN IF EXISTS group_comments;
-- ALTER TABLE treatments DROP COLUMN IF EXISTS top_general_comments;
-- COMMIT;
