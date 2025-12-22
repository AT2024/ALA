-- Migration: Add status, package_label, and attachment columns to applicators table
-- Date: 2025-12-22
-- Description: Adds columns for 8-state applicator workflow and file attachment tracking

-- ============================================================================
-- UP Migration
-- ============================================================================

BEGIN;

-- Add status column for 8-state applicator workflow
ALTER TABLE applicators ADD COLUMN IF NOT EXISTS status VARCHAR(50) NULL;

-- Add package_label column
ALTER TABLE applicators ADD COLUMN IF NOT EXISTS package_label VARCHAR(255) NULL;

-- Add attachment tracking columns
ALTER TABLE applicators ADD COLUMN IF NOT EXISTS attachment_filename VARCHAR(255) NULL;
ALTER TABLE applicators ADD COLUMN IF NOT EXISTS attachment_file_count INTEGER DEFAULT 0;
ALTER TABLE applicators ADD COLUMN IF NOT EXISTS attachment_size_bytes INTEGER DEFAULT 0;
ALTER TABLE applicators ADD COLUMN IF NOT EXISTS attachment_sync_status VARCHAR(50) DEFAULT 'pending';

-- Add comments to document the columns
COMMENT ON COLUMN applicators.status IS 'Applicator status in 8-state workflow (SEALED, OPENED, LOADED, INSERTED, FAULTY, DISPOSED, DISCHARGED, DEPLOYMENT_FAILURE)';
COMMENT ON COLUMN applicators.package_label IS 'Package label from scanned barcode';
COMMENT ON COLUMN applicators.attachment_filename IS 'Filename of attached document';
COMMENT ON COLUMN applicators.attachment_file_count IS 'Number of files in attachment';
COMMENT ON COLUMN applicators.attachment_size_bytes IS 'Total size of attachment in bytes';
COMMENT ON COLUMN applicators.attachment_sync_status IS 'Sync status with Priority ERP (pending, synced, failed)';

COMMIT;

-- ============================================================================
-- DOWN Migration (Rollback)
-- ============================================================================

-- To rollback this migration, run:
-- BEGIN;
-- ALTER TABLE applicators DROP COLUMN IF EXISTS status;
-- ALTER TABLE applicators DROP COLUMN IF EXISTS package_label;
-- ALTER TABLE applicators DROP COLUMN IF EXISTS attachment_filename;
-- ALTER TABLE applicators DROP COLUMN IF EXISTS attachment_file_count;
-- ALTER TABLE applicators DROP COLUMN IF EXISTS attachment_size_bytes;
-- ALTER TABLE applicators DROP COLUMN IF EXISTS attachment_sync_status;
-- COMMIT;

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Check columns were added:
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'applicators' AND column_name IN ('status', 'package_label', 'attachment_filename', 'attachment_file_count', 'attachment_size_bytes', 'attachment_sync_status');
