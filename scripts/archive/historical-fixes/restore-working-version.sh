#!/bin/bash

# =================================================================
# ALA Application - Restore Working Production Version
# =================================================================
# This script restores the application to the last known working state
# Tagged as: v1.0-working-production-2025-09-10

set -e  # Exit on error

echo "🔄 Restoring ALA Application to Working Production Version"
echo "=================================================="
echo "📅 Target Version: v1.0-working-production-2025-09-10"
echo "📊 Status: All database tables working, applicator saving functional"
echo ""

# Fetch latest tags
echo "📥 Fetching latest tags from repository..."
git fetch --tags

# Show current status
echo "📍 Current branch/commit:"
git log --oneline -1
echo ""

# Checkout the working version
echo "🔄 Checking out working version..."
git checkout v1.0-working-production-2025-09-10

echo ""
echo "✅ Local code restored to working version!"
echo ""

# Check if we should deploy to Azure VM
read -p "🚀 Deploy to Azure VM? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "🚀 Deploying to Azure VM (20.217.84.100)..."
    echo "=================================================="
    
    # Restore code on Azure VM
    echo "📥 Pulling working version on Azure VM..."
    ssh azureuser@20.217.84.100 "cd ala-improved && git fetch --tags && git checkout v1.0-working-production-2025-09-10"
    
    # Stop containers
    echo "⏹️  Stopping containers..."
    ssh azureuser@20.217.84.100 "cd ala-improved && docker-compose -f azure/docker-compose.azure.yml --env-file azure/.env.azure down"
    
    # Start containers with rebuild
    echo "🔨 Rebuilding and starting containers..."
    ssh azureuser@20.217.84.100 "cd ala-improved && docker-compose -f azure/docker-compose.azure.yml --env-file azure/.env.azure up -d --build"
    
    echo ""
    echo "⏳ Waiting for containers to start..."
    sleep 10
    
    echo ""
    echo "🔍 Verifying deployment..."
    echo "=================================================="
    
    # Check backend health
    echo "📊 Backend API Health:"
    curl -s http://20.217.84.100:5000/api/health | jq '.'
    echo ""
    
    # Check database tables
    echo "🗃️  Database Tables:"
    ssh azureuser@20.217.84.100 "docker exec ala-db-azure psql -U ala_user -d ala_production -c '\\dt'"
    echo ""
    
    # Check containers
    echo "🐳 Running Containers:"
    ssh azureuser@20.217.84.100 "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep ala-"
    echo ""
    
    echo "✅ Deployment completed!"
    echo ""
    echo "🌐 Application URLs:"
    echo "   Frontend: http://20.217.84.100:3000"
    echo "   Backend:  http://20.217.84.100:5000/api/health"
    echo "   Login:    http://20.217.84.100:3000/login"
    echo ""
    
else
    echo ""
    echo "💡 To deploy to Azure VM later, run:"
    echo "   ssh azureuser@20.217.84.100 \"cd ala-improved && git fetch --tags && git checkout v1.0-working-production-2025-09-10\""
    echo "   ssh azureuser@20.217.84.100 \"cd ala-improved && docker-compose -f azure/docker-compose.azure.yml --env-file azure/.env.azure up -d --build\""
fi

echo ""
echo "🎉 Restoration complete!"
echo "📋 This version includes:"
echo "   ✅ All database tables (users, treatments, applicators)"
echo "   ✅ Fixed field mappings (camelCase to snake_case)" 
echo "   ✅ Working applicator saving functionality"
echo "   ✅ PDF and JSON export capabilities"
echo "   ✅ Priority API authentication"
echo ""
echo "💡 If you encounter any issues, this script can be run again to restore the working state."