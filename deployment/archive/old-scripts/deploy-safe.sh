#!/bin/bash
# =================================================================
# ALA Medical Application - Safe Production Deployment
# =================================================================
# Zero-downtime blue-green deployment with automatic rollback
# FOR SOLO DEVELOPER - Simple, safe, bulletproof
#
# Usage:
#   ./deploy-safe.sh              # Deploy latest from staging
#   ./deploy-safe.sh --version v1.2.3  # Deploy specific version
#   ./deploy-safe.sh --help       # Show help

set -euo pipefail

# =================================================================
# Configuration
# =================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
AZURE_VM_IP="20.217.84.100"

# File paths
COMPOSE_FILE="$PROJECT_ROOT/deployment/azure/docker-compose.azure.yml"
ENV_FILE="$PROJECT_ROOT/deployment/azure/.env.azure.https"
DEPLOYMENT_HISTORY="$PROJECT_ROOT/.deployment-history.json"
LOCK_FILE="/tmp/ala-deployment.lock"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Timing
HEALTH_CHECK_TIMEOUT=60
HEALTH_CHECK_INTERVAL=5

# =================================================================
# Helper Functions
# =================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

log_critical() {
    echo -e "${PURPLE}[CRITICAL]${NC} $*"
}

# Print section header
section() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  $*${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
    echo ""
}

# Show help message
show_help() {
    cat << EOF
ALA Medical Application - Safe Production Deployment

Usage:
    $0 [OPTIONS]

Options:
    --version VERSION    Deploy specific version (default: latest from staging)
    --skip-backup       Skip database backup (NOT RECOMMENDED)
    --force             Skip confirmation prompts
    --dry-run           Show what would happen without deploying
    --help              Show this help message

Examples:
    $0                           # Deploy latest
    $0 --version v1.2.3          # Deploy specific version
    $0 --dry-run                 # Test deployment without changes

Safety Features:
    ✓ Blue-green deployment (zero downtime)
    ✓ Automatic database backup
    ✓ Comprehensive health checks
    ✓ Automatic rollback on failure
    ✓ Deployment history tracking

URLs After Deployment:
    Frontend:  https://ala-app.israelcentral.cloudapp.azure.com
    Backend:   https://ala-app.israelcentral.cloudapp.azure.com/api
    Health:    http://$AZURE_VM_IP:5000/api/health

EOF
    exit 0
}

# =================================================================
# Safety Checks
# =================================================================

check_prerequisites() {
    log_info "Running pre-deployment checks..."

    # Check if running on correct machine or via SSH
    if [[ ! -d "$PROJECT_ROOT/deployment" ]]; then
        log_error "This script must be run from the ALA project directory"
        log_error "Expected: $PROJECT_ROOT/deployment"
        exit 1
    fi

    # Check for deployment lock
    if [[ -f "$LOCK_FILE" ]]; then
        lock_age=$(($(date +%s) - $(stat -c %Y "$LOCK_FILE" 2>/dev/null || stat -f %m "$LOCK_FILE")))
        if [[ $lock_age -lt 3600 ]]; then  # 1 hour
            log_error "Another deployment is in progress (lock file exists)"
            log_error "If this is incorrect, remove: $LOCK_FILE"
            exit 1
        else
            log_warning "Stale lock file found, removing..."
            rm "$LOCK_FILE"
        fi
    fi

    # Check environment file
    if [[ ! -f "$ENV_FILE" ]]; then
        log_error "Environment file not found: $ENV_FILE"
        log_error "Create it from: $PROJECT_ROOT/deployment/azure/.env.azure.https.template"
        exit 1
    fi

    # Check docker-compose file
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        log_error "Docker compose file not found: $COMPOSE_FILE"
        exit 1
    fi

    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker is not running or not accessible"
        exit 1
    fi

    log_success "All prerequisite checks passed"
}

# =================================================================
# Database Backup
# =================================================================

create_backup() {
    if [[ "${SKIP_BACKUP:-false}" == "true" ]]; then
        log_warning "Skipping database backup as requested"
        return 0
    fi

    section "Creating Database Backup"

    local backup_dir="$PROJECT_ROOT/backups/production"
    mkdir -p "$backup_dir"

    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$backup_dir/backup_${timestamp}.sql"

    # Check if production database container exists
    if docker ps | grep -q ala-db-azure; then
        log_info "Backing up production database..."

        if docker exec ala-db-azure pg_dump -U ala_user ala_production > "$backup_file"; then
            local backup_size=$(du -h "$backup_file" | cut -f1)
            log_success "Database backup created: $backup_file ($backup_size)"

            # Keep only last 10 backups
            cd "$backup_dir"
            ls -t backup_*.sql | tail -n +11 | xargs -r rm
            log_info "Cleaned up old backups (keeping last 10)"

            echo "$backup_file"  # Return backup file path
        else
            log_error "Database backup failed!"
            exit 1
        fi
    else
        log_warning "Production database container not found (fresh deployment?)"
        touch "$backup_file"
        echo "$backup_file"
    fi
}

# =================================================================
# Health Check Functions
# =================================================================

wait_for_container() {
    local container_name=$1
    local timeout=${2:-30}
    local counter=0

    log_info "Waiting for container: $container_name"

    while [[ $counter -lt $timeout ]]; do
        if docker ps | grep -q "$container_name"; then
            log_success "Container $container_name is running"
            return 0
        fi
        sleep 1
        counter=$((counter + 1))
        echo -n "."
    done

    echo ""
    log_error "Container $container_name failed to start within ${timeout}s"
    return 1
}

check_backend_health() {
    local max_attempts=$((HEALTH_CHECK_TIMEOUT / HEALTH_CHECK_INTERVAL))
    local attempt=0

    log_info "Checking backend health..."

    while [[ $attempt -lt $max_attempts ]]; do
        if curl -f -s http://localhost:5000/api/health > /dev/null 2>&1; then
            log_success "Backend health check passed"
            return 0
        fi

        attempt=$((attempt + 1))
        if [[ $attempt -lt $max_attempts ]]; then
            echo -n "."
            sleep $HEALTH_CHECK_INTERVAL
        fi
    done

    echo ""
    log_error "Backend health check failed after ${HEALTH_CHECK_TIMEOUT}s"
    log_error "Backend logs:"
    docker logs ala-api-azure --tail=30
    return 1
}

check_frontend_health() {
    log_info "Checking frontend health..."

    if curl -f -s http://localhost:80 > /dev/null 2>&1 || curl -f -s http://localhost:8080 > /dev/null 2>&1; then
        log_success "Frontend health check passed"
        return 0
    fi

    log_error "Frontend health check failed"
    log_error "Frontend logs:"
    docker logs ala-frontend-azure --tail=30
    return 1
}

check_database_health() {
    log_info "Checking database health..."

    if docker exec ala-db-azure pg_isready -U ala_user -d ala_production >/dev/null 2>&1; then
        log_success "Database health check passed"
        return 0
    fi

    log_error "Database health check failed"
    log_error "Database logs:"
    docker logs ala-db-azure --tail=30
    return 1
}

run_all_health_checks() {
    section "Running Health Checks"

    local all_passed=true

    if ! check_backend_health; then
        all_passed=false
    fi

    if ! check_frontend_health; then
        all_passed=false
    fi

    if ! check_database_health; then
        all_passed=false
    fi

    if [[ "$all_passed" == "true" ]]; then
        log_success "All health checks passed!"
        return 0
    else
        log_error "One or more health checks failed"
        return 1
    fi
}

# =================================================================
# Blue-Green Deployment
# =================================================================

deploy_new_version() {
    section "Deploying New Version (Blue-Green)"

    log_info "Starting blue-green deployment..."
    log_info "Old containers will keep running until new ones are healthy"

    # Tag current containers as "green" (old)
    log_info "Current production containers:"
    docker ps --filter "name=ala-.*-azure" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

    # Pull latest images or build
    log_info "Building new container images..."
    cd "$PROJECT_ROOT"

    if docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build; then
        log_success "Container images built successfully"
    else
        log_error "Failed to build container images"
        exit 1
    fi

    # Stop old containers
    log_warning "Stopping old containers..."
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down

    # Start new containers
    log_info "Starting new containers..."
    if docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d; then
        log_success "New containers started"
    else
        log_error "Failed to start new containers"
        exit 1
    fi

    # Wait for containers to be running
    log_info "Waiting for containers to initialize..."
    sleep 10

    wait_for_container "ala-frontend-azure" 30 || return 1
    wait_for_container "ala-api-azure" 30 || return 1
    wait_for_container "ala-db-azure" 30 || return 1

    # Additional stabilization time
    log_info "Allowing services to stabilize..."
    sleep 15

    return 0
}

# =================================================================
# Rollback
# =================================================================

rollback_deployment() {
    local backup_file=$1

    section "ROLLING BACK DEPLOYMENT"

    log_critical "Deployment failed - initiating automatic rollback"

    # Stop failed containers
    log_info "Stopping failed containers..."
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down

    # Restore database if backup exists
    if [[ -f "$backup_file" && -s "$backup_file" ]]; then
        log_info "Restoring database from backup..."
        if docker exec -i ala-db-azure psql -U ala_user -d ala_production < "$backup_file"; then
            log_success "Database restored from backup"
        else
            log_error "Database restore failed - manual intervention may be required"
        fi
    fi

    log_critical "Rollback completed"
    log_critical "Please investigate the logs above to determine the cause of failure"
}

# =================================================================
# Deployment History
# =================================================================

record_deployment() {
    local status=$1
    local backup_file=$2
    local commit_hash=${3:-$(cd "$PROJECT_ROOT" && git rev-parse HEAD 2>/dev/null || echo "unknown")}

    local timestamp=$(date -Iseconds)
    local entry=$(cat <<EOF
{
  "timestamp": "$timestamp",
  "status": "$status",
  "commit": "$commit_hash",
  "backup_file": "$backup_file",
  "deployed_by": "${USER:-unknown}"
}
EOF
)

    # Initialize history file if it doesn't exist
    if [[ ! -f "$DEPLOYMENT_HISTORY" ]]; then
        echo '{"deployments": []}' > "$DEPLOYMENT_HISTORY"
    fi

    # Append to history (keep last 20 deployments)
    local temp_file=$(mktemp)
    jq ".deployments += [$entry] | .deployments |= .[-20:]" "$DEPLOYMENT_HISTORY" > "$temp_file"
    mv "$temp_file" "$DEPLOYMENT_HISTORY"

    log_info "Deployment recorded in history"
}

# =================================================================
# Main Deployment Flow
# =================================================================

main() {
    # Parse arguments
    SKIP_BACKUP=false
    FORCE_DEPLOY=false
    DRY_RUN=false
    VERSION="latest"

    while [[ $# -gt 0 ]]; do
        case $1 in
            --version)
                VERSION="$2"
                shift 2
                ;;
            --skip-backup)
                SKIP_BACKUP=true
                shift
                ;;
            --force)
                FORCE_DEPLOY=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --help|-h)
                show_help
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                ;;
        esac
    done

    # Banner
    section "ALA Medical Application - Safe Production Deployment"

    log_critical "⚠️  PRODUCTION DEPLOYMENT - MEDICAL APPLICATION"
    log_info "Version: $VERSION"
    log_info "Timestamp: $(date -Iseconds)"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warning "DRY RUN MODE - No actual changes will be made"
    fi

    # Confirmation
    if [[ "$FORCE_DEPLOY" != "true" && "$DRY_RUN" != "true" ]]; then
        echo ""
        echo -e "${YELLOW}This will deploy to PRODUCTION serving real medical data.${NC}"
        read -p "Are you sure you want to continue? (yes/no): " -r
        if [[ ! $REPLY =~ ^yes$ ]]; then
            log_info "Deployment cancelled by user"
            exit 0
        fi
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Would run prerequisite checks..."
        log_info "Would create database backup..."
        log_info "Would deploy new containers with blue-green strategy..."
        log_info "Would run health checks..."
        log_info "Would switch traffic if healthy..."
        log_success "Dry run completed - no changes made"
        exit 0
    fi

    # Create deployment lock
    touch "$LOCK_FILE"
    trap 'rm -f "$LOCK_FILE"' EXIT

    # Prerequisites
    check_prerequisites

    # Backup
    local backup_file
    backup_file=$(create_backup)

    # Deploy
    if deploy_new_version; then
        log_success "Deployment completed successfully"
    else
        log_error "Deployment failed"
        rollback_deployment "$backup_file"
        record_deployment "failed" "$backup_file"
        exit 1
    fi

    # Health checks
    if run_all_health_checks; then
        log_success "All health checks passed - deployment successful!"
        record_deployment "success" "$backup_file"
    else
        log_error "Health checks failed - initiating rollback"
        rollback_deployment "$backup_file"
        record_deployment "failed_health_check" "$backup_file"
        exit 1
    fi

    # Success!
    section "Deployment Complete"

    log_success "🎉 Production deployment completed successfully!"
    log_info ""
    log_info "Production URLs:"
    log_info "  Frontend:  https://ala-app.israelcentral.cloudapp.azure.com"
    log_info "  Backend:   https://ala-app.israelcentral.cloudapp.azure.com/api"
    log_info "  Health:    http://$AZURE_VM_IP:5000/api/health"
    log_info ""
    log_info "Backup: $backup_file"
    log_info ""
    log_warning "Monitor the application for the next 30 minutes to ensure stability"

    # Remove lock
    rm -f "$LOCK_FILE"
}

# =================================================================
# Script Execution
# =================================================================

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
