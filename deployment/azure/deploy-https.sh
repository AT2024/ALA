#!/bin/bash

# ALA HTTPS Deployment Script for Azure VM
# This script deploys the application with HTTPS enabled

set -e

DOMAIN="ala-app.israelcentral.cloudapp.azure.com"
PROJECT_DIR="$HOME/ala-improved"

echo "========================================"
echo "🚀 ALA HTTPS Deployment"
echo "========================================"
echo "Domain: $DOMAIN"
echo "Project: $PROJECT_DIR"

# Navigate to project directory
cd "$PROJECT_DIR"

# Stop existing containers
echo "📦 Stopping existing containers..."
docker-compose -f deployment/azure/docker-compose.https.azure.yml down 2>/dev/null || true

# Ensure SSL certificates exist
if [ ! -d "ssl-certs/certs" ] || [ ! -d "ssl-certs/private" ]; then
    echo "⚠️  SSL certificates not found. Creating self-signed certificates..."
    mkdir -p ssl-certs/certs ssl-certs/private
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout ssl-certs/private/private.key \
        -out ssl-certs/certs/certificate.crt \
        -subj "/C=US/ST=State/L=City/O=ALA/CN=$DOMAIN"
    chmod 644 ssl-certs/certs/certificate.crt
    chmod 600 ssl-certs/private/private.key
fi

# Ensure environment file exists
if [ ! -f "deployment/azure/.env.azure.https" ]; then
    echo "📝 Creating HTTPS environment configuration..."
    cat > deployment/azure/.env.azure.https << EOF
# HTTPS Configuration
USE_HTTPS=true
DOMAIN=$DOMAIN

# Backend Configuration
DATABASE_URL=postgresql://ala_user:AzureProd2024!@db:5432/ala_production
POSTGRES_PASSWORD=AzureProd2024!
PORT=5000
NODE_ENV=production
LOG_LEVEL=info

# JWT Configuration
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
JWT_EXPIRES_IN=24h

# Priority Integration
PRIORITY_URL=https://t.eu.priority-connect.online/odata/Priority/tabbtbc6.ini/test24
PRIORITY_USERNAME=API
PRIORITY_PASSWORD=Ap@123456
ENABLE_PRIORITY_APPLICATOR_SAVE=true
SYNC_WITH_PRIORITY=true
PRIORITY_MOCK=false
ENABLE_TEST_DATA=true
BYPASS_PRIORITY_EMAILS=test@example.com

# Frontend Configuration
VITE_API_URL=https://$DOMAIN/api
VITE_PRIORITY_API_URL=https://t.eu.priority-connect.online/odata/Priority/tabbtbc6.ini/test24
VITE_ENVIRONMENT=production
VITE_USE_HTTPS=true
VITE_OFFLINE_STORAGE=true

# Security Settings
RATE_LIMIT_ENABLED=true
CORS_ORIGIN=https://$DOMAIN
TRUST_PROXY=true
HSTS_ENABLED=true
HSTS_MAX_AGE=31536000
EOF
fi

# Deploy with HTTPS configuration
echo "🚀 Starting deployment with HTTPS..."
docker-compose -f deployment/azure/docker-compose.https.azure.yml \
  --env-file deployment/azure/.env.azure.https \
  up -d --build

# Wait for services
echo "⏳ Waiting for services to start..."
sleep 20

# Check status
echo "📊 Checking container status..."
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Test endpoints
echo ""
echo "🧪 Testing endpoints..."
echo -n "HTTPS Frontend: "
curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN || echo "Failed"

echo -n "API Health: "
curl -s https://$DOMAIN/api/health | grep -o '"status":"ok"' > /dev/null && echo "OK" || echo "Failed"

echo -n "HTTP Redirect: "
curl -s -o /dev/null -w "%{http_code}" -I http://$DOMAIN || echo "Failed"

echo ""
echo "========================================"
echo "✅ Deployment complete!"
echo "========================================"
echo "Access the application at: https://$DOMAIN"
echo "Test user: test@example.com (code: 123456)"
echo ""
echo "To check logs: docker-compose -f deployment/azure/docker-compose.https.azure.yml logs -f"