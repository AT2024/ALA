-- ============================================================================
-- Verify Offline Sync Migration
-- ============================================================================
-- Run this script to verify the offline sync migration was applied correctly
-- ============================================================================

-- Check treatments table for new columns
SELECT
    'treatments' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'treatments'
AND column_name IN ('version', 'last_synced_at', 'sync_status', 'device_id')
ORDER BY column_name;

-- Check applicators table for new columns
SELECT
    'applicators' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'applicators'
AND column_name IN ('version', 'created_offline', 'synced_at')
ORDER BY column_name;

-- Check sync_conflicts table exists
SELECT
    table_name,
    'exists' as status
FROM information_schema.tables
WHERE table_name = 'sync_conflicts';

-- Check offline_audit_logs table exists
SELECT
    table_name,
    'exists' as status
FROM information_schema.tables
WHERE table_name = 'offline_audit_logs';

-- Check triggers exist
SELECT
    trigger_name,
    event_manipulation,
    action_timing
FROM information_schema.triggers
WHERE trigger_name IN ('treatment_version_trigger', 'applicator_version_trigger');

-- Check function exists
SELECT
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_name = 'increment_version';

-- Summary count
SELECT
    'New Columns Added' as check_type,
    COUNT(*) as count
FROM information_schema.columns
WHERE (table_name = 'treatments' AND column_name IN ('version', 'last_synced_at', 'sync_status', 'device_id'))
   OR (table_name = 'applicators' AND column_name IN ('version', 'created_offline', 'synced_at'));
