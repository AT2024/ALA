-- Migration: Add inserted_seeds_qty column to applicators table
-- Date: 2026-05-20
-- Description: Persists the number of seeds actually inserted from an
--              applicator. For full-use applicators this equals seed_quantity;
--              for faulty applicators it is the operator-entered partial
--              count; for no-use applicators it is 0. Without this column,
--              the user-entered value was silently dropped at Applicator.create()
--              (Sequelize ignores unknown attributes) and treatment PDFs
--              showed "Inserted: 0" for every faulty applicator.
-- Patient-safety: inserted-seed count is a medical-record value. Per the
--              "LOCAL DB wins for SAFETY" rule it must live locally, not
--              be re-fetched from Priority at PDF time.

-- ============================================================================
-- UP Migration
-- ============================================================================

BEGIN;

-- Nullable INTEGER (no default). NULL means "legacy row, value unknown"
-- (existing applicators created before this migration). 0 means "explicitly
-- zero seeds inserted." These are distinct and must not be conflated.
ALTER TABLE applicators ADD COLUMN IF NOT EXISTS inserted_seeds_qty INTEGER NULL;

COMMENT ON COLUMN applicators.inserted_seeds_qty IS 'Seeds actually inserted from this applicator (full → seed_quantity, faulty → partial count, none → 0). NULL = legacy row, value unknown.';

COMMIT;

-- ============================================================================
-- DOWN Migration (Rollback)
-- ============================================================================

-- To rollback this migration, run:
-- BEGIN;
-- ALTER TABLE applicators DROP COLUMN IF EXISTS inserted_seeds_qty;
-- COMMIT;

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Check column was added:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'applicators' AND column_name = 'inserted_seeds_qty';

-- Check existing applicators have NULL (expected on legacy rows):
-- SELECT COUNT(*) AS null_count FROM applicators WHERE inserted_seeds_qty IS NULL;

-- Backfill candidate query (DO NOT RUN HERE — separate backfill task):
-- After running a Priority-to-local backfill script, this should be 0:
-- SELECT COUNT(*) FROM applicators WHERE inserted_seeds_qty IS NULL;
