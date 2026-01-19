-- ============================================================================
-- Migration: Add Treatment Indication Field
-- Date: 2026-01-16
-- Description: Adds indication column for treatment type from Priority SIBD_INDICATION
--              Used to determine applicator workflow (pancreas/prostate = 3-stage, skin = 2-stage)
-- ============================================================================

BEGIN;

-- Add indication column to treatments table
ALTER TABLE treatments
ADD COLUMN IF NOT EXISTS indication VARCHAR(100) NULL;

-- Add comment for documentation
COMMENT ON COLUMN treatments.indication IS 'Treatment indication from Priority SIBD_INDICATION (pancreas, prostate, skin, etc.)';

-- Create index for efficient workflow lookups (only on non-null values)
CREATE INDEX IF NOT EXISTS idx_treatments_indication
ON treatments(indication) WHERE indication IS NOT NULL;

COMMIT;

-- ============================================================================
-- DOWN Migration (for rollback):
-- ============================================================================
-- ALTER TABLE treatments DROP COLUMN IF EXISTS indication;
-- DROP INDEX IF EXISTS idx_treatments_indication;
