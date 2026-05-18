-- ============================================================================
-- Clear persisted Test Mode flag from user metadata
-- ============================================================================
-- Context: Test Mode is now a deliberate, per-session, admin-only choice
-- signalled per-request via the `X-Test-Mode` header. It is NO LONGER read
-- from or written to user metadata. This migration removes any stale
-- `testModeEnabled` key so production admin accounts can never silently
-- start in Test Mode (serving simulated patient/applicator data).
--
-- `users.metadata` is a JSON column, so cast to jsonb for key removal.
-- Idempotent: only touches rows that still contain the key; re-running is a
-- no-op.
-- ============================================================================

BEGIN;

UPDATE users
SET metadata = (metadata::jsonb - 'testModeEnabled')::json
WHERE metadata IS NOT NULL
  AND metadata::jsonb ? 'testModeEnabled';

COMMIT;

-- Verification (run manually after applying):
--   SELECT COUNT(*) AS still_has_flag
--   FROM users
--   WHERE metadata IS NOT NULL AND metadata::jsonb ? 'testModeEnabled';
--   -- expected: 0
