#!/bin/bash

# ============================================================================
# Offline Sync Migration Script with Backup
# ============================================================================
# This script safely runs the offline sync migration with:
# - Pre-migration backup
# - Dry-run mode for testing
# - Rollback capability
# - Verification queries
# ============================================================================

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_DIR="$SCRIPT_DIR/../src/migrations"
BACKUP_DIR="$SCRIPT_DIR/../backups"
MIGRATION_FILE="20251229000000-add-offline-sync-fields.sql"
VERIFY_FILE="verify-offline-migration.sql"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/pre_offline_migration_$TIMESTAMP.sql"

# Parse arguments
DRY_RUN=false
ROLLBACK=false
VERIFY_ONLY=false

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --dry-run) DRY_RUN=true ;;
        --rollback) ROLLBACK=true ;;
        --verify) VERIFY_ONLY=true ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --dry-run    Show what would be done without executing"
            echo "  --rollback   Rollback the migration"
            echo "  --verify     Only verify the migration status"
            echo "  --help       Show this help message"
            exit 0
            ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
    shift
done

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check for required environment variables
check_env() {
    if [ -z "$DATABASE_URL" ]; then
        # Try to load from .env file
        if [ -f "$SCRIPT_DIR/../.env" ]; then
            export $(grep -v '^#' "$SCRIPT_DIR/../.env" | xargs)
        fi
    fi

    if [ -z "$DATABASE_URL" ]; then
        log_error "DATABASE_URL environment variable is not set"
        exit 1
    fi
}

# Create backup directory if it doesn't exist
create_backup_dir() {
    mkdir -p "$BACKUP_DIR"
}

# Backup the database before migration
backup_database() {
    log_info "Creating database backup..."

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would create backup at: $BACKUP_FILE"
        return
    fi

    pg_dump "$DATABASE_URL" --table=treatments --table=applicators --table=users > "$BACKUP_FILE"

    if [ $? -eq 0 ]; then
        log_info "Backup created successfully: $BACKUP_FILE"
    else
        log_error "Backup failed!"
        exit 1
    fi
}

# Verify migration status
verify_migration() {
    log_info "Verifying migration status..."

    psql "$DATABASE_URL" -f "$MIGRATION_DIR/$VERIFY_FILE"
}

# Run the migration
run_migration() {
    log_info "Running offline sync migration..."

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would run migration: $MIGRATION_DIR/$MIGRATION_FILE"
        echo ""
        echo "=== Migration Content ==="
        cat "$MIGRATION_DIR/$MIGRATION_FILE"
        return
    fi

    psql "$DATABASE_URL" -f "$MIGRATION_DIR/$MIGRATION_FILE"

    if [ $? -eq 0 ]; then
        log_info "Migration completed successfully!"
    else
        log_error "Migration failed! Consider running --rollback"
        exit 1
    fi
}

# Rollback the migration
rollback_migration() {
    log_info "Rolling back offline sync migration..."

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would rollback migration"
        return
    fi

    # Rollback SQL (inline since it's part of the migration file)
    psql "$DATABASE_URL" << 'EOF'
BEGIN;

-- Rollback treatments table changes
ALTER TABLE treatments DROP COLUMN IF EXISTS version;
ALTER TABLE treatments DROP COLUMN IF EXISTS last_synced_at;
ALTER TABLE treatments DROP COLUMN IF EXISTS sync_status;
ALTER TABLE treatments DROP COLUMN IF EXISTS device_id;

-- Rollback applicators table changes
ALTER TABLE applicators DROP COLUMN IF EXISTS version;
ALTER TABLE applicators DROP COLUMN IF EXISTS created_offline;
ALTER TABLE applicators DROP COLUMN IF EXISTS synced_at;

-- Drop version triggers
DROP TRIGGER IF EXISTS treatment_version_trigger ON treatments;
DROP TRIGGER IF EXISTS applicator_version_trigger ON applicators;
DROP FUNCTION IF EXISTS increment_version();

-- Drop new tables
DROP TABLE IF EXISTS offline_audit_logs;
DROP TABLE IF EXISTS sync_conflicts;

COMMIT;
EOF

    if [ $? -eq 0 ]; then
        log_info "Rollback completed successfully!"
    else
        log_error "Rollback failed!"
        exit 1
    fi
}

# Main execution
main() {
    log_info "=== Offline Sync Migration Script ==="
    echo ""

    check_env
    create_backup_dir

    if [ "$VERIFY_ONLY" = true ]; then
        verify_migration
        exit 0
    fi

    if [ "$ROLLBACK" = true ]; then
        if [ "$DRY_RUN" = false ]; then
            read -p "Are you sure you want to rollback? This will remove offline sync columns. (y/N) " confirm
            if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
                log_info "Rollback cancelled"
                exit 0
            fi
        fi
        rollback_migration
        verify_migration
        exit 0
    fi

    # Normal migration flow
    backup_database
    run_migration
    verify_migration

    log_info "=== Migration Complete ==="
}

main
