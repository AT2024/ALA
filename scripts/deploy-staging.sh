#!/bin/bash

# =================================================================
# ALA Medical Application - Staging Deployment Script
# =================================================================
# This script deploys the application to staging environment
# Supports both local staging and Azure VM staging deployment
#
# Usage:
#   ./scripts/deploy-staging.sh [local|azure]
#
# Examples:
#   ./scripts/deploy-staging.sh local    # Deploy to local staging
#   ./scripts/deploy-staging.sh azure    # Deploy to Azure VM staging
#   ./scripts/deploy-staging.sh          # Default: local staging

set -euo pipefail

# =================================================================
# Configuration
# =================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
AZURE_VM_IP="20.217.84.100"
AZURE_USER="azureuser"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

check_dependencies() {
    local deps=("docker" "docker-compose" "git")

    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            log_error "Required dependency '$dep' is not installed"
        fi
    done
}

# =================================================================
# Health Check Functions
# =================================================================
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=0

    log_info "Waiting for $service_name to be healthy..."

    while [ $attempt -lt $max_attempts ]; do
        if curl -s -f "$url" > /dev/null 2>&1; then
            log_success "$service_name is healthy!"
            return 0
        fi

        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done

    log_error "$service_name health check failed after $max_attempts attempts"
}

verify_deployment() {
    local deployment_type=$1

    if [ "$deployment_type" = "azure" ]; then
        local frontend_url="http://$AZURE_VM_IP:3010"
        local backend_url="http://$AZURE_VM_IP:5010/api/health"
    else
        local frontend_url="http://localhost:3010"
        local backend_url="http://localhost:5010/api/health"
    fi

    log_info "Verifying deployment..."

    # Check backend health
    wait_for_service "$backend_url" "Backend API"

    # Check frontend
    wait_for_service "$frontend_url" "Frontend Application"

    # Verify database connectivity
    if [ "$deployment_type" = "azure" ]; then
        ssh "$AZURE_USER@$AZURE_VM_IP" "docker exec ala-db-staging pg_isready -U ala_staging_user -d ala_staging" || log_error "Database health check failed"
    else
        docker exec ala-db-staging pg_isready -U postgres -d ala_db_staging || log_error "Database health check failed"
    fi

    log_success "All services are healthy!"
}

# =================================================================
# Local Staging Deployment
# =================================================================
deploy_staging_local() {
    log_info "Starting local staging deployment..."

    cd "$PROJECT_ROOT"

    # Check if staging environment file exists
    if [ ! -f "environments/.env.staging" ]; then
        log_warning "Staging environment file not found, creating from template..."
        cp "environments/.env.staging" "environments/.env.staging.local"
        log_info "Please configure environments/.env.staging.local with appropriate values"
    fi

    # Ensure we're on the correct branch
    current_branch=$(git branch --show-current)
    if [ "$current_branch" != "develop" ] && [ "$current_branch" != "main" ]; then
        log_warning "Currently on branch '$current_branch'. Staging typically deploys from 'develop' or 'main'"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_error "Deployment cancelled"
        fi
    fi

    # Pull latest changes
    log_info "Pulling latest changes..."
    git pull origin "$current_branch"

    # Stop existing staging containers
    log_info "Stopping existing staging containers..."
    docker-compose -f docker-compose.yml -f docker-compose.staging.yml down || true

    # Clean up old images and volumes if requested
    read -p "Clean up old Docker resources? This will free space but slow down the build (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Cleaning up Docker resources..."
        docker system prune -f
        # Optionally remove staging volumes
        read -p "Remove staging database volume? This will delete all staging data (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker volume rm ala-postgres-data-staging || true
        fi
    fi

    # Build and start staging environment
    log_info "Building and starting staging environment..."
    docker-compose -f docker-compose.yml -f docker-compose.staging.yml up -d --build

    # Wait for services to be ready
    sleep 10

    # Verify deployment
    verify_deployment "local"

    log_success "Local staging deployment completed successfully!"
    log_info "Access the staging application at:"
    log_info "  Frontend: http://localhost:3010"
    log_info "  Backend API: http://localhost:5010/api"
    log_info "  Health Check: http://localhost:5010/api/health"
}

# =================================================================
# Azure VM Staging Deployment
# =================================================================
deploy_staging_azure() {
    log_info "Starting Azure VM staging deployment..."

    # Check SSH connectivity
    if ! ssh -o ConnectTimeout=10 -o BatchMode=yes "$AZURE_USER@$AZURE_VM_IP" "echo 'SSH connection successful'" &>/dev/null; then
        log_error "Cannot connect to Azure VM. Please check your SSH configuration and VM status."
    fi

    log_info "Connected to Azure VM successfully"

    # Deploy to Azure VM
    log_info "Deploying to Azure VM..."
    ssh "$AZURE_USER@$AZURE_VM_IP" << 'ENDSSH'
        set -euo pipefail

        # Navigate to project directory
        cd ~/ala-improved || { echo "Project directory not found"; exit 1; }

        # Pull latest changes
        echo "Pulling latest changes..."
        git fetch origin
        git checkout develop || git checkout main
        git pull origin $(git branch --show-current)

        # Check if staging environment file exists
        if [ ! -f "azure/.env.staging" ]; then
            echo "WARNING: azure/.env.staging not found. Creating from template..."
            cp "azure/.env.staging" "azure/.env.staging.prod"
            echo "Please configure azure/.env.staging.prod with real values"
            exit 1
        fi

        # Stop existing staging containers
        echo "Stopping existing staging containers..."
        docker-compose -f azure/docker-compose.staging.yml down || true

        # Build and start staging environment
        echo "Building and starting staging environment..."
        docker-compose -f azure/docker-compose.staging.yml --env-file azure/.env.staging up -d --build

        # Show container status
        echo "Container status:"
        docker ps --filter "name=ala-.*-staging"

        echo "Azure staging deployment completed!"
ENDSSH

    # Wait for services to be ready
    log_info "Waiting for services to initialize..."
    sleep 15

    # Verify deployment
    verify_deployment "azure"

    log_success "Azure VM staging deployment completed successfully!"
    log_info "Access the staging application at:"
    log_info "  Frontend: http://$AZURE_VM_IP:3010"
    log_info "  Backend API: http://$AZURE_VM_IP:5010/api"
    log_info "  Health Check: http://$AZURE_VM_IP:5010/api/health"
}

# =================================================================
# Main Function
# =================================================================
main() {
    local deployment_type="${1:-local}"

    log_info "ALA Medical Application - Staging Deployment"
    log_info "Deployment type: $deployment_type"

    # Check dependencies
    check_dependencies

    case "$deployment_type" in
        "local")
            deploy_staging_local
            ;;
        "azure")
            deploy_staging_azure
            ;;
        *)
            log_error "Invalid deployment type. Use 'local' or 'azure'"
            ;;
    esac
}

# =================================================================
# Script Execution
# =================================================================
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi