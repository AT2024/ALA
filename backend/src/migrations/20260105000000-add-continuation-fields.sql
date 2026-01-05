-- ============================================================================
-- Migration: Add Treatment Continuation Fields
-- Date: 2026-01-05
-- Description: Adds columns for treatment continuation functionality allowing
--              users to create linked treatments within 24 hours of completion.
-- ============================================================================
-- CRITICAL SAFETY: This migration supports treatment continuation workflow.
--                  Maintains parent-child relationship for audit trail.
-- ============================================================================

BEGIN;

-- ============================================================================
-- Add parent_treatment_id for treatment continuation
-- ============================================================================
-- Links continuation treatments to their parent treatment.
-- NULL for original treatments, UUID for continuations.

ALTER TABLE treatments
ADD COLUMN IF NOT EXISTS parent_treatment_id UUID REFERENCES treatments(id) ON DELETE SET NULL;

COMMENT ON COLUMN treatments.parent_treatment_id IS 'Reference to parent treatment for continuation treatments. NULL for original treatments.';

-- ============================================================================
-- Add last_activity_at for 24-hour window tracking
-- ============================================================================
-- Tracks when the last applicator was added/updated.
-- Used to calculate 24-hour continuation eligibility window.

ALTER TABLE treatments
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

COMMENT ON COLUMN treatments.last_activity_at IS 'Timestamp of last applicator activity. Used for 24-hour continuation window calculation.';

-- ============================================================================
-- Add indexes for efficient queries
-- ============================================================================

-- Index for finding child treatments of a parent
CREATE INDEX IF NOT EXISTS idx_treatments_parent_treatment_id
ON treatments(parent_treatment_id)
WHERE parent_treatment_id IS NOT NULL;

-- Index for 24-hour window eligibility queries
CREATE INDEX IF NOT EXISTS idx_treatments_last_activity_at
ON treatments(last_activity_at);

-- Compound index for finding recent completable treatments
CREATE INDEX IF NOT EXISTS idx_treatments_complete_activity
ON treatments(is_complete, last_activity_at)
WHERE is_complete = true;

-- ============================================================================
-- Backfill last_activity_at for existing treatments
-- ============================================================================
-- Set last_activity_at to completed_at for completed treatments,
-- or updated_at for incomplete treatments.

UPDATE treatments
SET last_activity_at = COALESCE(completed_at, updated_at, created_at)
WHERE last_activity_at IS NULL;

COMMIT;

-- ============================================================================
-- DOWN Migration (Rollback)
-- ============================================================================
-- To rollback this migration, run:
--
-- BEGIN;
--
-- DROP INDEX IF EXISTS idx_treatments_complete_activity;
-- DROP INDEX IF EXISTS idx_treatments_last_activity_at;
-- DROP INDEX IF EXISTS idx_treatments_parent_treatment_id;
--
-- ALTER TABLE treatments DROP COLUMN IF EXISTS last_activity_at;
-- ALTER TABLE treatments DROP COLUMN IF EXISTS parent_treatment_id;
--
-- COMMIT;
