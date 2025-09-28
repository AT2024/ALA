#!/bin/bash

# =================================================================
# ALA Medical Application - Emergency Rollback Script
# =================================================================
# This script provides emergency rollback capabilities for the medical application
# Supports rollback to specific versions or last known working state
#
# Usage:
#   ./scripts/rollback.sh [environment] [version]
#   ./scripts/rollback.sh production                    # Latest backup
#   ./scripts/rollback.sh staging v1.2.3               # Specific version
#   ./scripts/rollback.sh production --emergency       # Emergency mode

set -euo pipefail

# =================================================================
# Configuration
# =================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
AZURE_VM_IP="20.217.84.100"
AZURE_USER="azureuser"

# Last known working version
LAST_WORKING_VERSION="v1.0-working-production-2025-09-10"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# =================================================================
# Utility Functions
# =================================================================
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

log_critical() {
    echo -e "${PURPLE}[CRITICAL]${NC} $1"
}

confirm_rollback() {
    local environment=$1
    local version=$2

    echo
    log_critical "🚨 EMERGENCY ROLLBACK INITIATED 🚨"
    log_warning "Environment: $environment"
    log_warning "Target Version: $version"
    echo
    log_critical "This will:"
    echo "  - Stop current $environment services"
    echo "  - Rollback code to version $version"
    echo "  - Restart services with rollback version"
    echo "  - May cause temporary downtime"
    echo
    read -p "Are you absolutely sure? Type 'ROLLBACK' to confirm: " confirmation

    if [ "$confirmation" != "ROLLBACK" ]; then
        log_error "Rollback cancelled - confirmation not received"
    fi
}

# =================================================================
# Version Management
# =================================================================
check_version_exists() {
    local version=$1

    log_info "Checking if version $version exists..."

    git fetch --tags
    if ! git tag -l | grep -q "^$version$"; then
        log_error "Version $version does not exist in repository tags"
    fi

    log_success "Version $version found"
}

get_current_version() {
    local current_commit=$(git rev-parse HEAD)
    local current_tag=$(git describe --exact-match --tags $current_commit 2>/dev/null || echo "untagged")
    echo "$current_tag"
}

# =================================================================
# Backup Functions
# =================================================================
create_pre_rollback_backup() {
    local environment=$1
    local backup_timestamp=$(date +%Y%m%d_%H%M%S)

    log_info "Creating pre-rollback backup..."

    if [ "$environment" = "production" ]; then
        # Backup production database
        ssh "$AZURE_USER@$AZURE_VM_IP" << ENDSSH
            set -euo pipefail
            mkdir -p ~/backups/pre-rollback

            # Database backup
            docker exec ala-db-azure pg_dump -U ala_user ala_production > ~/backups/pre-rollback/pre_rollback_${backup_timestamp}.sql

            # Application state backup
            echo "$(date -Iseconds): Pre-rollback backup created" >> ~/backups/rollback.log
            echo "Current commit: $(cd ~/ala-improved && git rev-parse HEAD)" >> ~/backups/rollback.log

            echo "Pre-rollback backup completed: pre_rollback_${backup_timestamp}.sql"
ENDSSH
    else
        # Local staging backup
        log_info "Creating local staging backup (if applicable)"
        docker exec ala-db-staging pg_dump -U postgres ala_db_staging > "/tmp/pre_rollback_staging_${backup_timestamp}.sql" 2>/dev/null || true
    fi

    log_success "Pre-rollback backup completed"
}

# =================================================================
# Rollback Functions
# =================================================================
rollback_production() {
    local target_version=$1

    log_critical "Rolling back PRODUCTION to version $target_version"

    create_pre_rollback_backup "production"

    # Execute rollback on Azure VM
    ssh "$AZURE_USER@$AZURE_VM_IP" << ENDSSH
        set -euo pipefail

        # Navigate to project directory
        cd ~/ala-improved || { echo "ERROR: Project directory not found"; exit 1; }

        # Record rollback start
        echo "[$(date -Iseconds)] ROLLBACK INITIATED: Target version $target_version" >> rollback.log

        # Stop current services
        echo "Stopping current production services..."
        docker-compose -f azure/docker-compose.azure.yml down || true

        # Fetch latest tags and checkout target version
        echo "Fetching repository updates..."
        git fetch --tags
        git fetch origin

        echo "Checking out version $target_version..."
        git checkout $target_version

        # Verify environment files exist
        if [ ! -f "azure/.env.azure" ]; then
            echo "ERROR: Production environment file not found after rollback"
            exit 1
        fi

        # Start services with rollback version
        echo "Starting services with rollback version..."
        docker-compose -f azure/docker-compose.azure.yml --env-file azure/.env.azure up -d --build

        # Wait for services to start
        echo "Waiting for services to initialize..."
        sleep 30

        # Show container status
        echo "Container status after rollback:"
        docker ps --filter "name=ala-.*-azure"

        echo "[$(date -Iseconds)] ROLLBACK COMPLETED: Version $target_version" >> rollback.log
        echo "Production rollback completed successfully"
ENDSSH

    # Verify rollback success
    verify_rollback_success "production" "$target_version"

    log_success "Production rollback completed successfully!"
}

rollback_staging() {
    local target_version=$1

    log_info "Rolling back STAGING to version $target_version"

    create_pre_rollback_backup "staging"

    # Check if we're doing local or Azure staging rollback
    if ssh -o ConnectTimeout=5 -o BatchMode=yes "$AZURE_USER@$AZURE_VM_IP" "echo 'connected'" &>/dev/null; then
        # Azure staging rollback
        ssh "$AZURE_USER@$AZURE_VM_IP" << ENDSSH
            set -euo pipefail
            cd ~/ala-improved

            echo "Rolling back Azure staging environment..."

            # Stop staging services
            docker-compose -f azure/docker-compose.staging.yml down || true

            # Checkout target version
            git fetch --tags
            git checkout $target_version

            # Start staging with rollback version
            docker-compose -f azure/docker-compose.staging.yml --env-file azure/.env.staging up -d --build

            echo "Azure staging rollback completed"
ENDSSH
    else
        # Local staging rollback
        cd "$PROJECT_ROOT"

        log_info "Performing local staging rollback..."

        # Stop local staging services
        docker-compose -f docker-compose.yml -f docker-compose.staging.yml down || true

        # Checkout target version
        git fetch --tags
        git checkout "$target_version"

        # Start staging with rollback version
        docker-compose -f docker-compose.yml -f docker-compose.staging.yml up -d --build
    fi

    verify_rollback_success "staging" "$target_version"
    log_success "Staging rollback completed successfully!"
}

# =================================================================
# Verification Functions
# =================================================================
verify_rollback_success() {
    local environment=$1
    local target_version=$2

    log_info "Verifying rollback success for $environment..."

    if [ "$environment" = "production" ]; then
        local frontend_url="http://$AZURE_VM_IP:3000"
        local backend_url="http://$AZURE_VM_IP:5000/api/health"
    elif [ "$environment" = "staging" ]; then
        # Try Azure staging first, then local
        local frontend_url="http://$AZURE_VM_IP:3010"
        local backend_url="http://$AZURE_VM_IP:5010/api/health"

        # If Azure not accessible, use local
        if ! curl -s -f "$backend_url" > /dev/null 2>&1; then
            frontend_url="http://localhost:3010"
            backend_url="http://localhost:5010/api/health"
        fi
    fi

    # Check backend health
    local max_attempts=15
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if curl -s -f "$backend_url" > /dev/null 2>&1; then
            log_success "Backend is responding after rollback"
            break
        fi
        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done

    if [ $attempt -eq $max_attempts ]; then
        log_error "Backend health check failed after rollback!"
    fi

    # Check frontend
    if curl -s -f "$frontend_url" > /dev/null 2>&1; then
        log_success "Frontend is accessible after rollback"
    else
        log_warning "Frontend may not be fully accessible yet"
    fi

    log_success "Rollback verification completed!"
}

# =================================================================
# Emergency Functions
# =================================================================
emergency_rollback() {
    local environment=$1

    log_critical "🚨 EMERGENCY ROLLBACK MODE 🚨"
    log_critical "Rolling back $environment to last known working version: $LAST_WORKING_VERSION"

    # Skip normal confirmations in emergency mode
    echo "Emergency rollback initiated - minimal prompts"

    case "$environment" in
        "production")
            rollback_production "$LAST_WORKING_VERSION"
            ;;
        "staging")
            rollback_staging "$LAST_WORKING_VERSION"
            ;;
        *)
            log_error "Invalid environment for emergency rollback: $environment"
            ;;
    esac

    log_critical "Emergency rollback completed - please verify system functionality immediately"

    # Show post-rollback instructions
    echo
    log_info "Post-rollback checklist:"
    echo "  1. Test critical application workflows"
    echo "  2. Verify Priority API integration"
    echo "  3. Check database connectivity"
    echo "  4. Monitor application logs for errors"
    echo "  5. Inform team of rollback completion"
}

# =================================================================
# Main Function
# =================================================================
main() {
    local environment=${1:-""}
    local version=${2:-"$LAST_WORKING_VERSION"}

    # Handle emergency flag
    if [ "$version" = "--emergency" ]; then
        emergency_rollback "$environment"
        exit 0
    fi

    # Validate inputs
    if [ -z "$environment" ]; then
        echo "Usage: $0 [production|staging] [version] [--emergency]"
        echo ""
        echo "Examples:"
        echo "  $0 production                    # Rollback production to last working version"
        echo "  $0 staging v1.2.3               # Rollback staging to specific version"
        echo "  $0 production --emergency        # Emergency rollback production"
        echo ""
        echo "Last known working version: $LAST_WORKING_VERSION"
        exit 1
    fi

    if [ "$environment" != "production" ] && [ "$environment" != "staging" ]; then
        log_error "Invalid environment: $environment. Use 'production' or 'staging'"
    fi

    log_info "ALA Medical Application - Rollback Tool"
    log_info "Environment: $environment"
    log_info "Target version: $version"

    # Check if target version exists
    check_version_exists "$version"

    # Get current version
    local current_version=$(get_current_version)
    log_info "Current version: $current_version"

    # Confirm rollback
    confirm_rollback "$environment" "$version"

    # Execute rollback
    case "$environment" in
        "production")
            rollback_production "$version"
            ;;
        "staging")
            rollback_staging "$version"
            ;;
    esac

    log_success "Rollback operation completed successfully!"
}

# =================================================================
# Script Execution
# =================================================================
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi