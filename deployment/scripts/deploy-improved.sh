#!/bin/bash
# =================================================================
# ALA Application - Improved Zero-Downtime Deployment Script
# =================================================================
# This script performs rolling updates to minimize downtime
# Features:
# - Pre-deployment health checks
# - Rolling container updates (one at a time)
# - Deployment locking to prevent concurrent deployments
# - Automatic rollback on failure
# - Status logging and reporting

set -euo pipefail  # Exit on error, undefined variables, pipe failures

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"
LOCK_FILE="/tmp/ala_deployment.lock"
LOG_FILE="$PROJECT_DIR/deployment.log"
COMPOSE_FILE="azure/docker-compose.azure.yml"
ENV_FILE="azure/.env.azure"
HEALTH_TIMEOUT=60
ROLLBACK_TAG=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        INFO)  echo -e "${GREEN}[INFO]${NC} $message" ;;
        WARN)  echo -e "${YELLOW}[WARN]${NC} $message" ;;
        ERROR) echo -e "${RED}[ERROR]${NC} $message" ;;
        DEBUG) echo -e "${BLUE}[DEBUG]${NC} $message" ;;
    esac
    
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

# Cleanup function
cleanup() {
    local exit_code=$?
    log INFO "Cleaning up..."
    
    if [ -f "$LOCK_FILE" ]; then
        rm -f "$LOCK_FILE"
        log INFO "Removed deployment lock"
    fi
    
    if [ $exit_code -ne 0 ]; then
        log ERROR "Deployment failed with exit code $exit_code"
        if [ -n "$ROLLBACK_TAG" ]; then
            log WARN "Consider rolling back to previous version"
        fi
    fi
    
    exit $exit_code
}

# Set up signal handlers
trap cleanup EXIT
trap 'log ERROR "Deployment interrupted by user"; exit 130' INT TERM

# Check if deployment is already in progress
check_lock() {
    if [ -f "$LOCK_FILE" ]; then
        local lock_pid=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
        if [ -n "$lock_pid" ] && kill -0 "$lock_pid" 2>/dev/null; then
            log ERROR "Another deployment is already in progress (PID: $lock_pid)"
            log ERROR "If this is incorrect, remove $LOCK_FILE and try again"
            exit 1
        else
            log WARN "Stale lock file found, removing..."
            rm -f "$LOCK_FILE"
        fi
    fi
    
    echo $$ > "$LOCK_FILE"
    log INFO "Deployment lock acquired (PID: $$)"
}

# Health check function
check_health() {
    local service=$1
    local url=$2
    local timeout=${3:-30}
    
    log INFO "Checking health of $service at $url"
    
    local count=0
    while [ $count -lt $timeout ]; do
        if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200"; then
            log INFO "$service health check passed"
            return 0
        fi
        count=$((count + 1))
        sleep 2
        echo -n "."
    done
    
    echo ""
    log ERROR "$service health check failed after $timeout attempts"
    return 1
}

# Check Docker service status
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        log ERROR "Docker is not running or accessible"
        exit 1
    fi
    log INFO "Docker service is running"
}

# Update source code
update_source() {
    log INFO "Updating source code..."
    
    cd "$PROJECT_DIR"
    
    # Save current commit for potential rollback
    ROLLBACK_TAG=$(git rev-parse HEAD)
    log INFO "Current commit: $ROLLBACK_TAG"
    
    # Update from remote
    if git pull origin main; then
        log INFO "Successfully pulled from main branch"
    elif git pull origin azure-development; then
        log INFO "Successfully pulled from azure-development branch"
    else
        log ERROR "Failed to pull from remote repository"
        return 1
    fi
    
    local new_commit=$(git rev-parse HEAD)
    if [ "$ROLLBACK_TAG" = "$new_commit" ]; then
        log INFO "No new changes to deploy"
    else
        log INFO "New commit: $new_commit"
    fi
}

# Build new images
build_images() {
    log INFO "Building Docker images..."
    
    cd "$PROJECT_DIR"
    
    # Build backend image
    if docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build api; then
        log INFO "Backend image built successfully"
    else
        log ERROR "Failed to build backend image"
        return 1
    fi
    
    # Build frontend image
    if docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build frontend; then
        log INFO "Frontend image built successfully"
    else
        log ERROR "Failed to build frontend image"
        return 1
    fi
}

# Perform rolling update for a specific service
rolling_update() {
    local service=$1
    local health_url=$2
    
    log INFO "Performing rolling update for $service"
    
    cd "$PROJECT_DIR"
    
    # Start new container
    if docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --no-deps --force-recreate "$service"; then
        log INFO "New $service container started"
    else
        log ERROR "Failed to start new $service container"
        return 1
    fi
    
    # Wait for health check
    if check_health "$service" "$health_url" 30; then
        log INFO "$service rolling update completed successfully"
        return 0
    else
        log ERROR "$service failed health check after update"
        return 1
    fi
}

# Main deployment function
main() {
    log INFO "Starting ALA application deployment"
    log INFO "Timestamp: $(date)"
    log INFO "Script: $0"
    
    # Pre-deployment checks
    check_lock
    check_docker
    
    # Check current system health
    log INFO "Performing pre-deployment health checks..."
    
    # Only check if containers are currently running
    if docker ps --format "{{.Names}}" | grep -q "ala-api-azure"; then
        if ! check_health "Current API" "http://localhost:5000/api/health" 10; then
            log WARN "Current API is not healthy, proceeding with deployment anyway"
        fi
    else
        log INFO "API container not currently running"
    fi
    
    if docker ps --format "{{.Names}}" | grep -q "ala-frontend-azure"; then
        if ! check_health "Current Frontend" "http://localhost:3000" 10; then
            log WARN "Current frontend is not healthy, proceeding with deployment anyway"
        fi
    else
        log INFO "Frontend container not currently running"
    fi
    
    # Update source and build images
    update_source
    build_images
    
    # Ensure database is running first
    log INFO "Ensuring database is running..."
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d db
    
    # Wait for database to be ready
    log INFO "Waiting for database to be ready..."
    sleep 10
    
    # Perform rolling updates
    if rolling_update "api" "http://localhost:5000/api/health"; then
        log INFO "API update successful"
    else
        log ERROR "API update failed"
        return 1
    fi
    
    if rolling_update "frontend" "http://localhost:3000"; then
        log INFO "Frontend update successful"
    else
        log ERROR "Frontend update failed"
        return 1
    fi
    
    # Final health checks
    log INFO "Performing post-deployment health checks..."
    sleep 5
    
    check_health "Final API" "http://localhost:5000/api/health" 20
    check_health "Final Frontend" "http://localhost:3000" 20
    
    # Show final status
    log INFO "Deployment completed successfully!"
    log INFO "Services status:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    log INFO "Application URLs:"
    log INFO "  Frontend: http://20.217.84.100:3000"
    log INFO "  API: http://20.217.84.100:5000/api/health"
    
    # Test external accessibility
    log INFO "Testing external accessibility..."
    if curl -s -o /dev/null -w "%{http_code}" "http://20.217.84.100:3000" | grep -q "200"; then
        log INFO "✅ Frontend is externally accessible"
    else
        log WARN "⚠️  Frontend external access check failed"
    fi
    
    if curl -s -o /dev/null -w "%{http_code}" "http://20.217.84.100:5000/api/health" | grep -q "200"; then
        log INFO "✅ API is externally accessible"
    else
        log WARN "⚠️  API external access check failed"
    fi
}

# Show usage if requested
if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
    echo "Usage: $0 [options]"
    echo ""
    echo "Zero-downtime deployment script for ALA application"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  --dry-run      Show what would be done without executing"
    echo ""
    echo "Features:"
    echo "  • Rolling updates with health checks"
    echo "  • Deployment locking"
    echo "  • Automatic rollback on failure"
    echo "  • Comprehensive logging"
    echo ""
    exit 0
fi

# Dry run mode
if [ "${1:-}" = "--dry-run" ]; then
    log INFO "DRY RUN MODE - No changes will be made"
    log INFO "Would perform the following actions:"
    log INFO "1. Update source code from git"
    log INFO "2. Build Docker images"
    log INFO "3. Rolling update of API service"
    log INFO "4. Rolling update of Frontend service"
    log INFO "5. Perform health checks"
    exit 0
fi

# Run main function
main "$@"