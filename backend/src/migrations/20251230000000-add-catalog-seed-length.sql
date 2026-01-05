-- Migration: Add catalog and seed_length columns to applicators table
-- Date: 2025-12-30
-- Description: Add catalog number (PARTNAME) and seed length (SIBD_SEEDLEN) fields
-- These fields were added to the Sequelize model but the migration was missing

BEGIN;

-- Add catalog column (VARCHAR 100, nullable)
-- Maps to Priority PARTNAME field (e.g., "FLEX-00101-FG")
ALTER TABLE applicators ADD COLUMN IF NOT EXISTS catalog VARCHAR(100);

-- Add seed_length column (DECIMAL 5,2, nullable)
-- Maps to Priority SIBD_SEEDLEN field
ALTER TABLE applicators ADD COLUMN IF NOT EXISTS seed_length DECIMAL(5, 2);

-- Add index on catalog for faster lookups
CREATE INDEX IF NOT EXISTS idx_applicators_catalog ON applicators(catalog);

COMMIT;

-- Verification query:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'applicators' AND column_name IN ('catalog', 'seed_length');

-- Rollback:
-- ALTER TABLE applicators DROP COLUMN IF EXISTS catalog;
-- ALTER TABLE applicators DROP COLUMN IF EXISTS seed_length;
-- DROP INDEX IF EXISTS idx_applicators_catalog;
