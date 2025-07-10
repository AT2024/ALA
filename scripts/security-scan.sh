#!/bin/bash

# ALA Docker Security Scanner
# This script scans all ALA Docker images for security vulnerabilities

set -e

echo "🔍 ALA Docker Security Scanner"
echo "=============================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Trivy is installed
if ! command -v trivy &> /dev/null; then
    print_error "Trivy is not installed. Please install it first:"
    echo "  Windows: choco install trivy"
    echo "  macOS: brew install trivy"
    echo "  Linux: apt-get install trivy"
    exit 1
fi

# Function to scan an image
scan_image() {
    local image_name="$1"
    local service_name="$2"
    
    print_status "Scanning $service_name ($image_name)..."
    
    # Create reports directory if it doesn't exist
    mkdir -p ./security-reports
    
    # Run Trivy scan
    trivy image \
        --format table \
        --severity HIGH,CRITICAL \
        --output "./security-reports/${service_name}-scan-$(date +%Y%m%d).txt" \
        "$image_name"
    
    # Also create JSON report for automation
    trivy image \
        --format json \
        --severity HIGH,CRITICAL \
        --output "./security-reports/${service_name}-scan-$(date +%Y%m%d).json" \
        "$image_name"
    
    # Count vulnerabilities
    high_count=$(trivy image --format json "$image_name" | jq '.Results[]?.Vulnerabilities[]? | select(.Severity == "HIGH") | .VulnerabilityID' | wc -l)
    critical_count=$(trivy image --format json "$image_name" | jq '.Results[]?.Vulnerabilities[]? | select(.Severity == "CRITICAL") | .VulnerabilityID' | wc -l)
    
    if [ "$critical_count" -gt 0 ]; then
        print_error "$service_name has $critical_count CRITICAL vulnerabilities!"
        return 1
    elif [ "$high_count" -gt 0 ]; then
        print_warning "$service_name has $high_count HIGH vulnerabilities"
        return 2
    else
        print_success "$service_name passed security scan!"
        return 0
    fi
}

# Build images first
print_status "Building Docker images..."
docker-compose -f docker-compose.dev.yml build --no-cache

# Scan base images
print_status "Starting security scans..."
echo ""

total_issues=0

# Scan Node.js base image
scan_image "node:20.19.2-bookworm-slim" "nodejs-base"
total_issues=$((total_issues + $?))

# Scan Nginx base image
scan_image "nginx:1.25.3-alpine3.18" "nginx-base"
total_issues=$((total_issues + $?))

# Scan PostgreSQL base image
scan_image "postgres:16.6-alpine" "postgres-base"
total_issues=$((total_issues + $?))

# Scan application images
scan_image "ala-frontend-dev" "frontend"
total_issues=$((total_issues + $?))

scan_image "ala-api-dev" "backend"
total_issues=$((total_issues + $?))

echo ""
print_status "Security scan completed!"

if [ $total_issues -eq 0 ]; then
    print_success "All images passed security scans!"
    exit 0
elif [ $total_issues -lt 5 ]; then
    print_warning "Some images have vulnerabilities. Check reports in ./security-reports/"
    exit 1
else
    print_error "Multiple critical vulnerabilities found! Immediate action required!"
    exit 2
fi
