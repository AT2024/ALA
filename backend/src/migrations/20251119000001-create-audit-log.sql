-- Migration: Create applicator audit log table
-- Purpose: Track all status transitions for regulatory compliance and data integrity
-- Date: 2025-11-19
-- CRITICAL: P0 - Required for medical safety and regulatory compliance

BEGIN;

-- Create applicator_audit_log table
CREATE TABLE IF NOT EXISTS applicator_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    applicator_id UUID NOT NULL,
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by VARCHAR(255) NOT NULL,  -- User email
    changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    reason TEXT,
    request_id VARCHAR(100),  -- For request tracing
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Foreign key constraint
    CONSTRAINT fk_applicator_audit_log_applicator
        FOREIGN KEY (applicator_id)
        REFERENCES applicators(id)
        ON DELETE CASCADE
);

-- Index on applicator_id for query performance
CREATE INDEX IF NOT EXISTS idx_audit_log_applicator_id
    ON applicator_audit_log(applicator_id);

-- Index on changed_at for temporal queries
CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at
    ON applicator_audit_log(changed_at);

-- Index on request_id for tracing
CREATE INDEX IF NOT EXISTS idx_audit_log_request_id
    ON applicator_audit_log(request_id);

-- Composite index for applicator timeline queries
CREATE INDEX IF NOT EXISTS idx_audit_log_applicator_timeline
    ON applicator_audit_log(applicator_id, changed_at DESC);

-- Comment on table for documentation
COMMENT ON TABLE applicator_audit_log IS 'Audit trail for all applicator status transitions - required for regulatory compliance';
COMMENT ON COLUMN applicator_audit_log.applicator_id IS 'References applicators table';
COMMENT ON COLUMN applicator_audit_log.old_status IS 'Previous status (NULL for initial creation)';
COMMENT ON COLUMN applicator_audit_log.new_status IS 'New status after transition';
COMMENT ON COLUMN applicator_audit_log.changed_by IS 'User email who made the change';
COMMENT ON COLUMN applicator_audit_log.changed_at IS 'When the change occurred';
COMMENT ON COLUMN applicator_audit_log.reason IS 'Optional reason for status change (e.g., why marked faulty)';
COMMENT ON COLUMN applicator_audit_log.request_id IS 'Request ID for tracing related operations';

COMMIT;

-- Rollback (if needed):
-- BEGIN;
-- DROP INDEX IF EXISTS idx_audit_log_applicator_timeline;
-- DROP INDEX IF EXISTS idx_audit_log_request_id;
-- DROP INDEX IF EXISTS idx_audit_log_changed_at;
-- DROP INDEX IF EXISTS idx_audit_log_applicator_id;
-- DROP TABLE IF EXISTS applicator_audit_log;
-- COMMIT;
