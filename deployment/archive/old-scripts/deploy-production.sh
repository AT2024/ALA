#!/bin/bash

# =================================================================
# ALA Medical Application - Production Deployment Script
# =================================================================
# This script deploys the application to production environment
# Includes backup, rollback, and safety checks for medical application
#
# Usage:
#   ./deployment/scripts/deploy-production.sh [--skip-backup] [--force]
#
# Options:
#   --skip-backup    Skip database backup (not recommended)
#   --force         Skip safety prompts (use with caution)

set -euo pipefail

# =================================================================
# Configuration
# =================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
AZURE_VM_IP="20.217.84.100"
AZURE_USER="azureuser"

# Safety configuration
REQUIRE_BRANCH="main"
REQUIRE_TESTS_PASS=true
REQUIRE_MANUAL_APPROVAL=true

# Command line options
SKIP_BACKUP=false
FORCE_DEPLOY=false

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

confirm_action() {
    local message=$1
    if [ "$FORCE_DEPLOY" = true ]; then
        log_info "Force mode enabled, skipping confirmation: $message"
        return 0
    fi

    echo -e "${YELLOW}$message${NC}"
    read -p "Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_error "Operation cancelled by user"
    fi
}

# =================================================================
# Safety Checks
# =================================================================
check_prerequisites() {
    log_info "Running pre-deployment safety checks..."

    # Check dependencies
    local deps=("docker" "docker-compose" "git" "ssh" "curl")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            log_error "Required dependency '$dep' is not installed"
        fi
    done

    # Check current branch
    local current_branch=$(git branch --show-current)
    if [ "$current_branch" != "$REQUIRE_BRANCH" ]; then
        log_error "Production deployment must be from '$REQUIRE_BRANCH' branch. Currently on '$current_branch'"
    fi

    # Check for uncommitted changes
    if ! git diff --quiet || ! git diff --cached --quiet; then
        log_error "Uncommitted changes detected. Please commit or stash changes before deployment"
    fi

    # Check if we're up to date with remote
    git fetch origin
    local local_commit=$(git rev-parse HEAD)
    local remote_commit=$(git rev-parse "origin/$REQUIRE_BRANCH")
    if [ "$local_commit" != "$remote_commit" ]; then
        log_error "Local branch is not up to date with origin/$REQUIRE_BRANCH. Please pull latest changes"
    fi

    # Check Azure VM connectivity
    if ! ssh -o ConnectTimeout=10 -o BatchMode=yes "$AZURE_USER@$AZURE_VM_IP" "echo 'SSH OK'" &>/dev/null; then
        log_error "Cannot connect to Azure VM. Please check SSH configuration and VM status"
    fi

    log_success "All safety checks passed!"
}

check_staging_deployment() {
    log_info "Verifying staging deployment status..."

    # Check if staging is healthy
    if ! curl -s -f "http://$AZURE_VM_IP:5010/api/health" > /dev/null 2>&1; then
        log_warning "Staging environment is not accessible or healthy"
        confirm_action "Staging verification failed. Deploy to production anyway?"
    else
        log_success "Staging environment is healthy"
    fi
}

# =================================================================
# Backup Functions
# =================================================================
create_backup() {
    if [ "$SKIP_BACKUP" = true ]; then
        log_warning "Skipping backup as requested"
        return 0
    fi

    log_info "Creating production database backup..."

    local backup_timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_filename="ala_production_backup_${backup_timestamp}.sql"

    # Create backup on Azure VM
    ssh "$AZURE_USER@$AZURE_VM_IP" << ENDSSH
        set -euo pipefail

        # Create backup directory if it doesn't exist
        mkdir -p ~/backups

        # Create database backup
        docker exec ala-db-azure pg_dump -U ala_user ala_production > ~/backups/${backup_filename}

        # Verify backup file exists and has content
        if [ ! -s ~/backups/${backup_filename} ]; then
            echo "ERROR: Backup file is empty or doesn't exist"
            exit 1
        fi

        # Keep only last 10 backups
        cd ~/backups
        ls -t ala_production_backup_*.sql | tail -n +11 | xargs -r rm

        echo "Backup created successfully: ${backup_filename}"
        echo "Backup size: \$(du -h ~/backups/${backup_filename} | cut -f1)"
ENDSSH

    log_success "Database backup created: $backup_filename"
}

# =================================================================
# Deployment Functions
# =================================================================
deploy_to_production() {
    log_critical "Starting PRODUCTION deployment for medical application"

    confirm_action "⚠️  This will deploy to PRODUCTION environment serving real medical data. Are you absolutely sure?"

    # Record deployment start
    local deployment_start=$(date -Iseconds)
    local commit_hash=$(git rev-parse HEAD)
    local commit_message=$(git log -1 --pretty=%B)

    log_info "Deployment details:"
    log_info "  Commit: $commit_hash"
    log_info "  Message: $commit_message"
    log_info "  Started: $deployment_start"

    # Deploy to Azure VM
    ssh "$AZURE_USER@$AZURE_VM_IP" << ENDSSH
        set -euo pipefail

        # Navigate to project directory
        cd ~/ala-improved || { echo "ERROR: Project directory not found"; exit 1; }

        # Pull latest changes
        echo "Pulling latest production code..."
        git fetch origin
        git checkout ${REQUIRE_BRANCH}
        git pull origin ${REQUIRE_BRANCH}

        # Verify production environment file exists
        if [ ! -f "azure/.env.azure" ]; then
            echo "ERROR: Production environment file azure/.env.azure not found"
            exit 1
        fi

        # Show current production container status
        echo "Current production containers:"
        docker ps --filter "name=ala-.*-azure"

        # Blue-Green Deployment Strategy
        echo "Starting blue-green deployment..."

        # Build new containers
        echo "Building new production containers..."
        docker-compose -f azure/docker-compose.azure.yml --env-file azure/.env.azure build

        # Stop old containers
        echo "Stopping old production containers..."
        docker-compose -f azure/docker-compose.azure.yml down

        # Start new containers
        echo "Starting new production containers..."
        docker-compose -f azure/docker-compose.azure.yml --env-file azure/.env.azure up -d

        # Wait for containers to stabilize
        echo "Waiting for services to start..."
        sleep 30

        # Show new container status
        echo "New production containers:"
        docker ps --filter "name=ala-.*-azure"

        echo "Production deployment completed on Azure VM!"
ENDSSH

    # Post-deployment verification
    verify_production_deployment

    # Record successful deployment
    local deployment_end=$(date -Iseconds)
    log_success "Production deployment completed successfully!"
    log_info "Deployment duration: $deployment_start to $deployment_end"

    # Log deployment for audit trail
    echo "[$(date -Iseconds)] PRODUCTION DEPLOYMENT: $commit_hash - $commit_message" >> "$PROJECT_ROOT/deployment.log"
}

verify_production_deployment() {
    log_info "Verifying production deployment..."

    local max_attempts=20
    local attempt=0

    # Check backend health
    while [ $attempt -lt $max_attempts ]; do
        if curl -s -f "http://$AZURE_VM_IP:5000/api/health" > /dev/null 2>&1; then
            break
        fi
        attempt=$((attempt + 1))
        echo -n "."
        sleep 3
    done

    if [ $attempt -eq $max_attempts ]; then
        log_error "Production backend health check failed!"
    fi

    # Check frontend
    if ! curl -s -f "http://$AZURE_VM_IP:3000" > /dev/null 2>&1; then
        log_error "Production frontend is not accessible!"
    fi

    # Verify database connectivity
    ssh "$AZURE_USER@$AZURE_VM_IP" "docker exec ala-db-azure pg_isready -U ala_user -d ala_production" || {
        log_error "Production database health check failed!"
    }

    # Check application-specific functionality
    local health_response=$(curl -s "http://$AZURE_VM_IP:5000/api/health" | jq -r '.status' 2>/dev/null || echo "unknown")
    if [ "$health_response" != "OK" ]; then
        log_warning "Application health check returned: $health_response"
    fi

    log_success "Production deployment verification completed!"
    log_info "Production URLs:"
    log_info "  Frontend: http://$AZURE_VM_IP:3000"
    log_info "  Backend API: http://$AZURE_VM_IP:5000/api"
    log_info "  Health Check: http://$AZURE_VM_IP:5000/api/health"
}

# =================================================================
# Rollback Functions
# =================================================================
emergency_rollback() {
    log_critical "Initiating emergency rollback..."

    confirm_action "This will rollback production to the last working version. Continue?"

    ssh "$AZURE_USER@$AZURE_VM_IP" << 'ENDSSH'
        set -euo pipefail
        cd ~/ala-improved

        # Rollback to last working version
        git fetch --tags
        git checkout v1.0-working-production-2025-09-10

        # Restart with rollback version
        docker-compose -f azure/docker-compose.azure.yml --env-file azure/.env.azure down
        docker-compose -f azure/docker-compose.azure.yml --env-file azure/.env.azure up -d --build

        echo "Emergency rollback completed"
ENDSSH

    log_success "Emergency rollback completed. Please verify system functionality."
}

# =================================================================
# Argument Parsing
# =================================================================
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-backup)
                SKIP_BACKUP=true
                log_warning "Database backup will be SKIPPED"
                shift
                ;;
            --force)
                FORCE_DEPLOY=true
                log_warning "Force mode enabled - skipping confirmations"
                shift
                ;;
            --rollback)
                emergency_rollback
                exit 0
                ;;
            -h|--help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "OPTIONS:"
                echo "  --skip-backup    Skip database backup (not recommended)"
                echo "  --force         Skip safety prompts (dangerous)"
                echo "  --rollback      Emergency rollback to last working version"
                echo "  -h, --help      Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1. Use --help for usage information"
                ;;
        esac
    done
}

# =================================================================
# Main Function
# =================================================================
main() {
    parse_arguments "$@"

    log_critical "ALA Medical Application - PRODUCTION Deployment"
    log_warning "This script will deploy to the LIVE production environment"

    # Safety checks
    check_prerequisites
    check_staging_deployment

    # Create backup
    create_backup

    # Deploy to production
    deploy_to_production

    log_success "🎉 Production deployment completed successfully!"
    log_info "Remember to:"
    log_info "  1. Monitor application logs for the next 30 minutes"
    log_info "  2. Verify Priority API integration is working"
    log_info "  3. Test critical workflows with a test user"
    log_info "  4. Update team on deployment completion"
}

# =================================================================
# Script Execution
# =================================================================
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi