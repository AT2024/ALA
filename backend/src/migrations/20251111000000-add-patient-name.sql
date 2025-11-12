-- Migration: Add patient_name column to treatments table
-- Date: 2025-11-11
-- Description: Adds patient_name field to store the DETAILS field from Priority API
--              (actual patient identifier), separate from subjectId (ORDNAME - order number)

-- ============================================================================
-- UP Migration
-- ============================================================================

-- Add patient_name column (nullable for backward compatibility with existing data)
ALTER TABLE treatments
ADD COLUMN IF NOT EXISTS patient_name VARCHAR(255) NULL;

-- Add comment to document the column purpose
COMMENT ON COLUMN treatments.patient_name IS 'Patient identifier from Priority DETAILS field';

-- Optional: Add index if patient_name will be used for searching
-- Uncomment if needed for query performance
-- CREATE INDEX IF NOT EXISTS idx_treatments_patient_name ON treatments(patient_name);

-- ============================================================================
-- DOWN Migration (Rollback)
-- ============================================================================

-- To rollback this migration, run:
-- ALTER TABLE treatments DROP COLUMN IF EXISTS patient_name;

-- ============================================================================
-- Verification Query
-- ============================================================================

-- After running migration, verify with:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'treatments' AND column_name = 'patient_name';
