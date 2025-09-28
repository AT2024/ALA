#!/bin/bash

# =================================================================
# ALA Medical Application - Environment Setup Script
# =================================================================
# This script helps create secure environment files from templates
# and ensures sensitive data is never committed to version control
#
# Usage:
#   ./scripts/setup-environments.sh [staging|production|all]

set -euo pipefail

# =================================================================
# Configuration
# =================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

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

# =================================================================
# Security Functions
# =================================================================
generate_secure_password() {
    local length=${1:-32}
    openssl rand -base64 $length 2>/dev/null || head -c $length < /dev/urandom | base64 | tr -d '\\n='
}

generate_jwt_secret() {
    generate_secure_password 64
}

prompt_for_value() {
    local var_name=$1
    local description=$2
    local default_value=${3:-""}
    local is_secret=${4:-false}

    echo -e "${YELLOW}$description${NC}"
    if [ "$is_secret" = true ]; then
        read -s -p "Enter $var_name (hidden): " value
        echo
    else
        read -p "Enter $var_name [$default_value]: " value
    fi

    echo "${value:-$default_value}"
}

# =================================================================
# Environment File Creation
# =================================================================
create_staging_environment() {
    local env_file="$PROJECT_ROOT/environments/.env.staging"
    local template_file="$PROJECT_ROOT/environments/.env.staging.template"

    log_info "Creating staging environment file..."

    if [ ! -f "$template_file" ]; then
        log_error "Template file not found: $template_file"
    fi

    if [ -f "$env_file" ]; then
        log_warning "Staging environment file already exists: $env_file"
        read -p "Overwrite existing file? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Skipping staging environment file creation"
            return 0
        fi
    fi

    # Copy template to new file
    cp "$template_file" "$env_file"

    log_info "Please configure the following staging environment variables:"
    echo

    # Generate secure values
    local db_password=$(generate_secure_password 24)
    local jwt_secret=$(generate_jwt_secret)

    # Prompt for Priority API credentials
    local priority_username=$(prompt_for_value "PRIORITY_API_USERNAME" "Priority API staging username")
    local priority_password=$(prompt_for_value "PRIORITY_API_PASSWORD" "Priority API staging password" "" true)

    # Update the file with secure values
    sed -i.bak "s/staging_secure_password_123/$db_password/g" "$env_file"
    sed -i.bak "s/staging_jwt_secret_key_very_long_and_secure_for_medical_app/$jwt_secret/g" "$env_file"
    sed -i.bak "s/staging_user/$priority_username/g" "$env_file"
    sed -i.bak "s/staging_password/$priority_password/g" "$env_file"

    # Clean up backup file
    rm -f "$env_file.bak"

    log_success "Staging environment file created: $env_file"
    log_warning "Remember: This file is git-ignored and contains sensitive data!"
}

create_azure_staging_environment() {
    local env_file="$PROJECT_ROOT/azure/.env.staging"
    local template_file="$PROJECT_ROOT/azure/.env.staging.template"

    log_info "Creating Azure staging environment file..."

    if [ ! -f "$template_file" ]; then
        log_error "Template file not found: $template_file"
    fi

    if [ -f "$env_file" ]; then
        log_warning "Azure staging environment file already exists: $env_file"
        read -p "Overwrite existing file? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Skipping Azure staging environment file creation"
            return 0
        fi
    fi

    # Copy template to new file
    cp "$template_file" "$env_file"

    log_info "Please configure the following Azure staging environment variables:"
    echo

    # Generate secure values
    local staging_db_password=$(generate_secure_password 32)
    local jwt_secret=$(generate_jwt_secret)

    # Prompt for credentials
    local priority_username=$(prompt_for_value "PRIORITY_API_USERNAME" "Priority API staging username")
    local priority_password=$(prompt_for_value "PRIORITY_API_PASSWORD" "Priority API staging password" "" true)

    # Update the file with secure values
    sed -i.bak "s/REPLACE_WITH_SECURE_STAGING_PASSWORD/$staging_db_password/g" "$env_file"
    sed -i.bak "s/REPLACE_WITH_STAGING_JWT_SECRET_MINIMUM_32_CHARACTERS/$jwt_secret/g" "$env_file"
    sed -i.bak "s/REPLACE_WITH_STAGING_PRIORITY_USERNAME/$priority_username/g" "$env_file"
    sed -i.bak "s/REPLACE_WITH_STAGING_PRIORITY_PASSWORD/$priority_password/g" "$env_file"

    # Clean up backup file
    rm -f "$env_file.bak"

    log_success "Azure staging environment file created: $env_file"
    log_warning "Remember: This file is git-ignored and contains sensitive data!"
}

# =================================================================
# Verification Functions
# =================================================================
verify_gitignore() {
    log_info "Verifying .gitignore configuration..."

    local gitignore_file="$PROJECT_ROOT/.gitignore"

    # Check if .gitignore exists
    if [ ! -f "$gitignore_file" ]; then
        log_error ".gitignore file not found"
    fi

    # Check if environment files are properly ignored
    local ignored_patterns=(
        "environments/.env*"
        "azure/.env*"
        ".env*"
    )

    local missing_patterns=()

    for pattern in "${ignored_patterns[@]}"; do
        if ! grep -q "^$pattern" "$gitignore_file"; then
            missing_patterns+=("$pattern")
        fi
    done

    if [ ${#missing_patterns[@]} -gt 0 ]; then
        log_warning "Some environment patterns might not be properly ignored:"
        for pattern in "${missing_patterns[@]}"; do
            echo "  - $pattern"
        done
        log_info "Please verify your .gitignore configuration"
    else
        log_success "Environment files are properly configured in .gitignore"
    fi
}

check_existing_environments() {
    log_info "Checking existing environment files..."

    local env_files=(
        "environments/.env.staging"
        "azure/.env.staging"
        "azure/.env.azure"  # Production file
    )

    for env_file in "${env_files[@]}"; do
        local full_path="$PROJECT_ROOT/$env_file"
        if [ -f "$full_path" ]; then
            log_info "✅ Found: $env_file"

            # Check if file contains template placeholders
            if grep -q "REPLACE_WITH\|staging_password\|your_" "$full_path" 2>/dev/null; then
                log_warning "⚠️  $env_file contains template placeholders - needs configuration"
            fi
        else
            log_warning "❌ Missing: $env_file"
        fi
    done
}

# =================================================================
# Main Functions
# =================================================================
setup_staging() {
    log_info "Setting up staging environment..."
    create_staging_environment
    create_azure_staging_environment
    log_success "Staging environment setup completed!"
}

setup_production() {
    log_warning "Production environment setup requires manual configuration"
    log_info "Production environment file: azure/.env.azure"
    log_info "Please ensure this file is properly configured with production credentials"

    if [ ! -f "$PROJECT_ROOT/azure/.env.azure" ]; then
        log_warning "Production environment file not found!"
        log_info "Please create azure/.env.azure with production values"
    else
        log_success "Production environment file exists: azure/.env.azure"
    fi
}

show_security_reminder() {
    echo
    log_warning "🔒 SECURITY REMINDERS:"
    echo -e "${YELLOW}1. Never commit .env files to version control${NC}"
    echo -e "${YELLOW}2. Use strong, unique passwords for each environment${NC}"
    echo -e "${YELLOW}3. Regularly rotate API credentials and secrets${NC}"
    echo -e "${YELLOW}4. Use different credentials for staging vs production${NC}"
    echo -e "${YELLOW}5. Backup environment files securely (encrypted)${NC}"
    echo
}

# =================================================================
# Main Function
# =================================================================
main() {
    local environment=${1:-""}

    log_info "ALA Medical Application - Environment Setup"

    # Always verify gitignore first
    verify_gitignore

    # Check existing environment files
    check_existing_environments

    case "$environment" in
        "staging")
            setup_staging
            ;;
        "production")
            setup_production
            ;;
        "all")
            setup_staging
            setup_production
            ;;
        "")
            echo
            log_info "Usage: $0 [staging|production|all]"
            echo
            log_info "Available commands:"
            echo "  staging     - Set up staging environment files"
            echo "  production  - Check production environment"
            echo "  all         - Set up all environments"
            echo
            exit 0
            ;;
        *)
            log_error "Invalid environment: $environment. Use 'staging', 'production', or 'all'"
            ;;
    esac

    show_security_reminder
}

# =================================================================
# Script Execution
# =================================================================
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi