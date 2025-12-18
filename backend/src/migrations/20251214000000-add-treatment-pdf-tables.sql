-- Migration: Add Treatment PDF and Signature Verification Tables
-- Created: 2024-12-14
-- Purpose: Support treatment finalization PDF generation and digital signature verification
--
-- Related models:
--   - TreatmentPdf: Stores signed PDF documents for completed treatments
--   - SignatureVerification: Tracks verification code attempts for Alpha Tau signature workflow

-- =====================================================
-- UP Migration (Apply changes)
-- =====================================================

BEGIN;

-- Create treatment_pdfs table
-- Stores the signed PDF documents with signature metadata
CREATE TABLE IF NOT EXISTS treatment_pdfs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    treatment_id UUID NOT NULL UNIQUE REFERENCES treatments(id) ON DELETE CASCADE,
    pdf_data BYTEA NOT NULL,
    pdf_size_bytes INTEGER NOT NULL,
    signature_type VARCHAR(50) NOT NULL CHECK (signature_type IN ('hospital_auto', 'alphatau_verified')),
    signer_name VARCHAR(255) NOT NULL,
    signer_email VARCHAR(255) NOT NULL,
    signer_position VARCHAR(100) NOT NULL,
    signed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    email_sent_at TIMESTAMP WITH TIME ZONE,
    email_sent_to VARCHAR(255),
    email_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending', 'sent', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for treatment_pdfs
CREATE INDEX IF NOT EXISTS idx_treatment_pdfs_treatment_id ON treatment_pdfs(treatment_id);
CREATE INDEX IF NOT EXISTS idx_treatment_pdfs_email_status ON treatment_pdfs(email_status);
CREATE INDEX IF NOT EXISTS idx_treatment_pdfs_signed_at ON treatment_pdfs(signed_at);

-- Create signature_verifications table
-- Tracks verification code attempts for Alpha Tau signature workflow
CREATE TABLE IF NOT EXISTS signature_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    treatment_id UUID NOT NULL REFERENCES treatments(id) ON DELETE CASCADE,
    target_email VARCHAR(255) NOT NULL,
    verification_code VARCHAR(255) NOT NULL, -- bcrypt hashed
    verification_expires TIMESTAMP WITH TIME ZONE NOT NULL,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'expired', 'failed')),
    signer_name VARCHAR(255),
    signer_position VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for signature_verifications
CREATE INDEX IF NOT EXISTS idx_signature_verifications_treatment_id ON signature_verifications(treatment_id);
CREATE INDEX IF NOT EXISTS idx_signature_verifications_target_email ON signature_verifications(target_email);
CREATE INDEX IF NOT EXISTS idx_signature_verifications_status ON signature_verifications(status);
CREATE INDEX IF NOT EXISTS idx_signature_verifications_expires ON signature_verifications(verification_expires);

-- Add comment to document the tables
COMMENT ON TABLE treatment_pdfs IS 'Stores signed PDF documents for completed treatments. One PDF per treatment (unique constraint).';
COMMENT ON TABLE signature_verifications IS 'Tracks verification code attempts for Alpha Tau signature workflow. Multiple attempts allowed per treatment.';

COMMIT;

-- =====================================================
-- DOWN Migration (Rollback)
-- =====================================================
-- To rollback, run the following commands:
--
-- BEGIN;
-- DROP TABLE IF EXISTS signature_verifications;
-- DROP TABLE IF EXISTS treatment_pdfs;
-- COMMIT;

-- =====================================================
-- Verification Queries
-- =====================================================
-- After running the UP migration, verify with:
--
-- -- Check tables exist
-- SELECT table_name FROM information_schema.tables
-- WHERE table_name IN ('treatment_pdfs', 'signature_verifications');
--
-- -- Check columns
-- \d treatment_pdfs
-- \d signature_verifications
--
-- -- Check indexes
-- SELECT indexname FROM pg_indexes WHERE tablename IN ('treatment_pdfs', 'signature_verifications');
