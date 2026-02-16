-- HIPAA 2025 Compliance: Authentication Audit Logging
-- This migration creates the auth_audit_log table for tracking all authentication events
-- Required for HIPAA audit trail requirements

BEGIN;

CREATE TABLE IF NOT EXISTS auth_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    event_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address VARCHAR(45),
    user_agent TEXT,
    identifier VARCHAR(255),
    failure_reason TEXT,
    request_id VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance indexes for common queries
CREATE INDEX IF NOT EXISTS idx_auth_audit_user_id ON auth_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_event_time ON auth_audit_log(event_time);
CREATE INDEX IF NOT EXISTS idx_auth_audit_event_type ON auth_audit_log(event_type);

-- Composite index for user activity timeline queries
CREATE INDEX IF NOT EXISTS idx_auth_audit_user_timeline ON auth_audit_log(user_id, event_time DESC);

COMMIT;
