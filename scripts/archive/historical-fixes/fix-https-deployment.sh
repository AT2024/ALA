#!/bin/bash

# Fix HTTPS Deployment Script
# This script fixes the HTTPS configuration issues

set -e

echo "=================================================="
echo "    Fixing HTTPS Deployment for ALA App         "
echo "=================================================="
echo ""

DOMAIN="ala-app.israelcentral.cloudapp.azure.com"

echo "📋 Current status check..."
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "🛑 Stopping existing containers..."
docker-compose -f ~/ala-improved/deployment/azure/docker-compose.https.azure.yml down

echo ""
echo "🔧 Fixing nginx permissions for SSL certificates..."
# Ensure certificates have correct permissions
chmod 644 ~/ala-improved/ssl-certs/certs/*.crt 2>/dev/null || true
chmod 644 ~/ala-improved/ssl-certs/private/private.key 2>/dev/null || true

echo ""
echo "📝 Updating environment configuration..."
# Update the HTTPS environment file if it exists
if [ -f ~/ala-improved/deployment/azure/.env.azure.https ]; then
    echo "Using existing .env.azure.https"
else
    echo "Creating .env.azure.https from template"
    cp ~/ala-improved/deployment/azure/.env.azure ~/ala-improved/deployment/azure/.env.azure.https

    # Update key variables
    sed -i "s|VITE_API_URL=.*|VITE_API_URL=https://${DOMAIN}/api|g" ~/ala-improved/deployment/azure/.env.azure.https
    sed -i "s|CORS_ORIGIN=.*|CORS_ORIGIN=https://${DOMAIN}|g" ~/ala-improved/deployment/azure/.env.azure.https
    sed -i "s|USE_HTTPS=.*|USE_HTTPS=true|g" ~/ala-improved/deployment/azure/.env.azure.https
    sed -i "s|DOMAIN=.*|DOMAIN=${DOMAIN}|g" ~/ala-improved/deployment/azure/.env.azure.https

    # Add VITE_USE_HTTPS if not present
    if ! grep -q "VITE_USE_HTTPS" ~/ala-improved/deployment/azure/.env.azure.https; then
        echo "VITE_USE_HTTPS=true" >> ~/ala-improved/deployment/azure/.env.azure.https
    fi
fi

echo ""
echo "🚀 Rebuilding and deploying with corrected configuration..."
cd ~/ala-improved

# Build with correct arguments
docker-compose -f deployment/azure/docker-compose.https.azure.yml \
    --env-file deployment/azure/.env.azure.https \
    build --no-cache frontend

# Deploy
docker-compose -f deployment/azure/docker-compose.https.azure.yml \
    --env-file deployment/azure/.env.azure.https \
    up -d

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 15

# Check container health
echo ""
echo "📊 Container Status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "🔍 Verifying deployment..."

# Test HTTPS
echo -n "Testing HTTPS frontend: "
if curl -s -o /dev/null -w "%{http_code}" https://${DOMAIN} | grep -q "200\|301\|302"; then
    echo "✅ OK"
else
    echo "❌ Failed"
    echo "Checking container logs..."
    docker logs ala-frontend-azure --tail=20
fi

echo -n "Testing API health: "
if curl -s https://${DOMAIN}/api/health | grep -q "status"; then
    echo "✅ OK"
else
    echo "❌ Failed"
    echo "Checking API logs..."
    docker logs ala-api-azure --tail=20
fi

echo ""
echo "=================================================="
echo "              Deployment Complete                "
echo "=================================================="
echo ""
echo "Access your application at:"
echo "🌐 https://${DOMAIN}"
echo ""
echo "If you still see issues:"
echo "1. Clear browser cache (Ctrl+Shift+R)"
echo "2. Check Azure NSG allows port 443"
echo "3. Run: docker logs ala-frontend-azure"
echo ""