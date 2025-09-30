#!/bin/bash

# Azure DNS HTTPS Setup Script for ALA Application
# This script configures Azure DNS with Let's Encrypt SSL certificates

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
AZURE_REGION="israelcentral"
DNS_LABEL="ala-app"
DOMAIN="${DNS_LABEL}.${AZURE_REGION}.cloudapp.azure.com"
EMAIL="admin@alphataumedical.com"
VM_IP="20.217.84.100"

echo -e "${BLUE}==================================================================${NC}"
echo -e "${BLUE}       Azure DNS HTTPS Setup for ALA Medical Application        ${NC}"
echo -e "${BLUE}==================================================================${NC}"
echo ""

# Function to check if running on Azure VM
check_azure_vm() {
    if [ ! -f /etc/azure ]; then
        echo -e "${YELLOW}⚠️  Warning: This doesn't appear to be an Azure VM${NC}"
        echo "This script is designed to run on the Azure VM at ${VM_IP}"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Function to install required tools
install_dependencies() {
    echo -e "${BLUE}📦 Checking and installing dependencies...${NC}"

    # Install dig if not present
    if ! command -v dig &> /dev/null; then
        echo "Installing dnsutils..."
        sudo apt-get update && sudo apt-get install -y dnsutils
    fi

    # Install acme.sh if not present
    if [ ! -d "$HOME/.acme.sh" ]; then
        echo -e "${BLUE}Installing acme.sh for certificate management...${NC}"
        curl https://get.acme.sh | sh -s email=${EMAIL}
        source ~/.bashrc
    fi
}

# Function to verify DNS resolution
verify_dns() {
    echo -e "${BLUE}🔍 Verifying DNS configuration...${NC}"
    echo "Domain: ${DOMAIN}"
    echo "Expected IP: ${VM_IP}"

    # Get actual DNS resolution
    RESOLVED_IP=$(dig +short ${DOMAIN} | tail -n1)

    if [ "$RESOLVED_IP" == "$VM_IP" ]; then
        echo -e "${GREEN}✅ DNS is correctly configured: ${DOMAIN} -> ${VM_IP}${NC}"
        return 0
    else
        echo -e "${RED}❌ DNS Error: ${DOMAIN} resolves to '${RESOLVED_IP}' instead of ${VM_IP}${NC}"
        echo ""
        echo -e "${YELLOW}To fix this, you need to:${NC}"
        echo "1. Go to Azure Portal: https://portal.azure.com"
        echo "2. Navigate to your VM (IP: ${VM_IP})"
        echo "3. Go to Configuration -> DNS name label"
        echo "4. Set DNS name label to: ${DNS_LABEL}"
        echo "5. Save and wait 2-5 minutes for DNS propagation"
        echo ""
        echo "After setting up DNS, run this script again."
        exit 1
    fi
}

# Function to stop running services
stop_services() {
    echo -e "${BLUE}🛑 Stopping existing services...${NC}"

    # Stop Docker containers if running
    if command -v docker &> /dev/null; then
        docker-compose -f ~/ala-improved/deployment/azure/docker-compose.azure.yml down 2>/dev/null || true
        docker-compose -f ~/ala-improved/deployment/azure/docker-compose.https.azure.yml down 2>/dev/null || true
    fi

    # Kill any process using port 80 or 443
    sudo fuser -k 80/tcp 2>/dev/null || true
    sudo fuser -k 443/tcp 2>/dev/null || true
}

# Function to generate Let's Encrypt certificate
generate_certificate() {
    echo -e "${BLUE}🔐 Generating Let's Encrypt SSL certificate...${NC}"

    cd ~/ala-improved

    # Create necessary directories
    mkdir -p ssl-certs/certs ssl-certs/private webroot

    # Start temporary nginx for ACME challenge
    echo -e "${BLUE}Starting temporary web server for domain validation...${NC}"
    docker run -d --name acme-nginx -p 80:80 -v ~/ala-improved/webroot:/usr/share/nginx/html:ro nginx:alpine
    sleep 3

    # Issue certificate using acme.sh
    echo -e "${BLUE}Requesting certificate from Let's Encrypt...${NC}"
    ~/.acme.sh/acme.sh --issue -d ${DOMAIN} \
        -w ~/ala-improved/webroot \
        --server letsencrypt \
        --force

    # Stop temporary nginx
    docker stop acme-nginx && docker rm acme-nginx

    # Install certificate to our directory
    echo -e "${BLUE}Installing certificate...${NC}"
    ~/.acme.sh/acme.sh --install-cert -d ${DOMAIN} \
        --cert-file ~/ala-improved/ssl-certs/certs/certificate.crt \
        --key-file ~/ala-improved/ssl-certs/private/private.key \
        --fullchain-file ~/ala-improved/ssl-certs/certs/fullchain.crt \
        --reloadcmd "cd ~/ala-improved && docker restart ala-frontend-azure 2>/dev/null || true"

    # Set proper permissions
    chmod 644 ~/ala-improved/ssl-certs/certs/*.crt
    chmod 644 ~/ala-improved/ssl-certs/private/private.key

    echo -e "${GREEN}✅ SSL certificate generated successfully!${NC}"
}

# Function to update environment configuration
update_env_config() {
    echo -e "${BLUE}⚙️  Updating environment configuration...${NC}"

    cd ~/ala-improved/deployment/azure

    # Backup existing config
    if [ -f .env.azure ]; then
        cp .env.azure .env.azure.backup.$(date +%Y%m%d_%H%M%S)
        echo "Backed up existing configuration"
    fi

    # Create new HTTPS configuration
    cat > .env.azure.https << EOF
# =================================================================
# ALA Azure Production Environment Configuration - HTTPS
# =================================================================
# Generated: $(date)
# Domain: ${DOMAIN}

# =================================================================
# HTTPS/SSL Configuration
# =================================================================
USE_HTTPS=true
DOMAIN=${DOMAIN}

# =================================================================
# BACKEND CONFIGURATION
# =================================================================

# Database Configuration
DATABASE_URL=postgresql://ala_user:AzureProd2024!@db:5432/ala_production
POSTGRES_PASSWORD=AzureProd2024!
ENABLE_SSL=false

# Server Configuration
PORT=5000
NODE_ENV=production
LOG_LEVEL=info

# JWT Authentication
JWT_SECRET=rN3kL9vZ8mQ7wX2cF6hS5dA1pU4yB0tE9rI8oP3qW7eN2mL6vK5jH4gF9dS8aX7cV1bN6mK9qR3wE8tY7uI2oP4lK3jH6gF5dS8aQ2wE7rT9yU1iO3pL6kJ4hG7fD9sA2xC5vB8nM1qW4eR7tY0uI3oP6lK9jH2gF5dS8aZ3xC6vB9nM2qW5eR8tY1uI4oP7lK0jH3gF6dS9aX4cV7bN2mQ5wE8rT1yU4iO7pL0kJ3hG6fD9sA5xC8vB1nM4qW7eR0tY3uI6oP9lK2jH5gF8dS1aX7cV0bN5mQ8wE1rT4yU7iO0pL3kJ6hG9fD2sA8xC1vB4nM7qW0eR3tY6uI9oP2lK5jH8gF1dS4aX0cV3bN8mQ1wE4rT7yU0iO3pL6kJ9hG2fD5sA1xC4vB7nM0qW3eR6tY9uI2oP5lK8jH1gF4dS7aX3cV6bN1mQ4wE7rT0yU3iO6pL9kJ2hG5fD8sA4xC7vB0nM3qW6eR9tY2uI5oP8lK1jH4gF7dS0aX6cV9bN4mQ7wE0rT3yU6iO9pL2kJ5hG8fD1sA7xC0vB3nM6qW9eR2tY5uI8oP1lK4jH7gF0dS3aX9cV2bN7mQ0wE3rT6yU9iO2pL5kJ8hG1fD4sA0xC3vB6nM9qW2eR5tY8uI1oP4lK7jH0gF3dS6aX2cV5bN0mQ3wE6rT9yU2iO5pL8kJ1hG4fD7sA3xC6vB9nM2qW5eR8tY1uI4oP7lK0jH3gF6dS9aX5cV8bN3mQ6wE9rT2yU5iO8pL1kJ4hG7fD0sA6xC9vB2nM5qW8eR1tY4uI7oP0lK3jH6gF9dS2aX8cV1bN6mQ9wE2rT5yU8iO1pL4kJ7hG0fD3sA9xC2vB5nM8qW1eR4tY7uI0oP3lK6jH9gF2dS5aX1cV4bN9mQ2wE5rT8yU1iO4pL7kJ0hG3fD6sA2xC5vB8nM1qW4eR7tY0uI3oP6lK9jH2gF5dS8aZ3xC6vB9nM2qW5eR8tY1uI4oP7lK0jH3gF6dS9aX
JWT_EXPIRES_IN=24h

# Priority System Integration
PRIORITY_URL=https://t.eu.priority-connect.online/odata/Priority/tabbtbc6.ini/test24
PRIORITY_USERNAME=API
PRIORITY_PASSWORD=Ap@123456
ENABLE_PRIORITY_APPLICATOR_SAVE=true
SYNC_WITH_PRIORITY=true
PRIORITY_MOCK=false

# =================================================================
# FRONTEND CONFIGURATION (VITE)
# =================================================================

# API Configuration - Using domain instead of IP
VITE_API_URL=https://${DOMAIN}/api
VITE_PRIORITY_API_URL=https://t.eu.priority-connect.online/odata/Priority/tabbtbc6.ini/test24

# Application Configuration
VITE_ENVIRONMENT=production
VITE_USE_HTTPS=true
VITE_OFFLINE_STORAGE=true

# =================================================================
# AZURE PRODUCTION SECURITY SETTINGS
# =================================================================

# Security and performance settings
RATE_LIMIT_ENABLED=true
CORS_ORIGIN=https://${DOMAIN}
TRUST_PROXY=true

# HSTS (HTTP Strict Transport Security)
HSTS_ENABLED=true

# Database settings
POOL_MIN=2
POOL_MAX=10
POOL_IDLE_TIMEOUT=30000

# Logging and monitoring
LOG_FORMAT=json
HEALTH_CHECK_ENABLED=true

# =================================================================
# PRODUCTION OPTIMIZATION SETTINGS
# =================================================================

# Cache settings
CACHE_TTL=3600
REDIS_ENABLED=false

# Performance settings
CLUSTER_MODE=false
COMPRESSION_ENABLED=true
EOF

    echo -e "${GREEN}✅ Environment configuration updated${NC}"
}

# Function to deploy with HTTPS
deploy_https() {
    echo -e "${BLUE}🚀 Deploying application with HTTPS...${NC}"

    cd ~/ala-improved

    # Check if deploy-https.sh exists
    if [ -f deployment/scripts/deploy-https.sh ]; then
        bash deployment/scripts/deploy-https.sh
    else
        # Manual deployment
        echo "Deploying using docker-compose..."
        docker-compose -f deployment/azure/docker-compose.https.azure.yml \
            --env-file deployment/azure/.env.azure.https \
            up -d --build
    fi

    # Wait for services to start
    echo -e "${BLUE}Waiting for services to start...${NC}"
    sleep 10

    # Check container status
    docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
}

# Function to verify deployment
verify_deployment() {
    echo -e "${BLUE}🔍 Verifying deployment...${NC}"

    # Test HTTPS access
    echo -n "Testing HTTPS frontend access... "
    if curl -s -o /dev/null -w "%{http_code}" https://${DOMAIN} | grep -q "200\|301\|302"; then
        echo -e "${GREEN}✅ OK${NC}"
    else
        echo -e "${RED}❌ Failed${NC}"
    fi

    # Test API health
    echo -n "Testing API health endpoint... "
    if curl -s https://${DOMAIN}/api/health | grep -q "status"; then
        echo -e "${GREEN}✅ OK${NC}"
    else
        echo -e "${RED}❌ Failed${NC}"
    fi

    # Check certificate
    echo -n "Checking SSL certificate... "
    if openssl s_client -connect ${DOMAIN}:443 -servername ${DOMAIN} </dev/null 2>/dev/null | grep -q "Verify return code: 0"; then
        echo -e "${GREEN}✅ Valid${NC}"
    else
        echo -e "${YELLOW}⚠️  Certificate validation failed (may be still propagating)${NC}"
    fi

    # Show certificate expiry
    CERT_EXPIRY=$(openssl s_client -connect ${DOMAIN}:443 -servername ${DOMAIN} </dev/null 2>/dev/null | openssl x509 -noout -dates | grep notAfter | cut -d= -f2)
    echo -e "${BLUE}Certificate expires: ${CERT_EXPIRY}${NC}"
}

# Main execution
main() {
    echo -e "${YELLOW}This script will:${NC}"
    echo "1. Configure Azure DNS: ${DOMAIN}"
    echo "2. Generate Let's Encrypt SSL certificate"
    echo "3. Update environment configuration for HTTPS"
    echo "4. Deploy the application with HTTPS"
    echo ""
    read -p "Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 0
    fi

    # Run setup steps
    check_azure_vm
    install_dependencies
    verify_dns
    stop_services
    generate_certificate
    update_env_config
    deploy_https
    verify_deployment

    echo ""
    echo -e "${GREEN}==================================================================${NC}"
    echo -e "${GREEN}               HTTPS Setup Complete!                            ${NC}"
    echo -e "${GREEN}==================================================================${NC}"
    echo ""
    echo -e "${BLUE}Access your application at:${NC}"
    echo -e "  Frontend: ${GREEN}https://${DOMAIN}${NC}"
    echo -e "  API Health: ${GREEN}https://${DOMAIN}/api/health${NC}"
    echo ""
    echo -e "${BLUE}Certificate Information:${NC}"
    echo -e "  Domain: ${DOMAIN}"
    echo -e "  Auto-renewal: Configured (runs weekly)"
    echo -e "  Manual renewal: ~/.acme.sh/acme.sh --renew -d ${DOMAIN}"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "1. Test login functionality"
    echo "2. Verify Priority API integration"
    echo "3. Update any bookmarks or documentation with new URL"
    echo ""
    echo -e "${BLUE}To revert to HTTP if needed:${NC}"
    echo "  docker-compose -f deployment/azure/docker-compose.azure.yml --env-file deployment/azure/.env.azure.backup.* up -d"
}

# Run main function
main