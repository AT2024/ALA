#!/bin/bash

# =================================================================
# ALA Azure VM Production Deployment Script
# =================================================================
# Run this script ON the Azure VM to deploy latest changes
# This preserves your secrets while updating code
# Usage: ~/deploy.sh

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}==================================================================${NC}"
echo -e "${BLUE}ALA Application - Production Deployment${NC}"
echo -e "${BLUE}Preserving secrets while updating code${NC}"
echo -e "${BLUE}==================================================================${NC}"

# Navigate to project directory
cd ~/ala-improved

# Step 1: Pull latest changes
echo -e "${YELLOW}[1/6] Pulling latest changes from GitHub...${NC}"
git fetch --all
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Show what will be updated
echo -e "${CYAN}Current branch: $CURRENT_BRANCH${NC}"
COMMITS_BEHIND=$(git rev-list HEAD..origin/$CURRENT_BRANCH --count)
if [ "$COMMITS_BEHIND" -gt 0 ]; then
    echo -e "${CYAN}Updates available: $COMMITS_BEHIND commits${NC}"
    git log --oneline HEAD..origin/$CURRENT_BRANCH | head -5
else
    echo -e "${GREEN}Already up to date${NC}"
fi

git pull origin $CURRENT_BRANCH
echo -e "${GREEN}✅ Code updated${NC}"

# Step 2: Backup current secrets
echo -e "${YELLOW}[2/6] Backing up current secrets...${NC}"
if [ -f "azure/.env.azure" ]; then
    BACKUP_FILE="azure/.env.azure.backup-$(date +%Y%m%d-%H%M%S)"
    cp azure/.env.azure "$BACKUP_FILE"
    echo -e "${GREEN}✅ Secrets backed up to $BACKUP_FILE${NC}"
else
    echo -e "${RED}❌ Error: azure/.env.azure not found!${NC}"
    echo -e "${YELLOW}Run the initial setup script first:${NC}"
    echo -e "${BLUE}   bash azure/setup-secrets.sh${NC}"
    exit 1
fi

# Step 3: Check if new environment variables were added to template
echo -e "${YELLOW}[3/6] Checking for new environment variables...${NC}"
# Extract variable names from template and current env
TEMPLATE_VARS=$(grep '^[A-Z]' azure/.env.azure.template | cut -d'=' -f1 | sort)
CURRENT_VARS=$(grep '^[A-Z]' azure/.env.azure | cut -d'=' -f1 | sort)

# Find missing variables
MISSING_VARS=$(comm -23 <(echo "$TEMPLATE_VARS") <(echo "$CURRENT_VARS"))

if [ -n "$MISSING_VARS" ]; then
    echo -e "${YELLOW}⚠️  New environment variables found in template:${NC}"
    echo "$MISSING_VARS"
    echo -e "${YELLOW}Adding them to your .env.azure with placeholder values...${NC}"
    
    # Add missing variables from template
    for var in $MISSING_VARS; do
        TEMPLATE_LINE=$(grep "^$var=" azure/.env.azure.template)
        echo "$TEMPLATE_LINE" >> azure/.env.azure
        echo -e "${CYAN}Added: $TEMPLATE_LINE${NC}"
    done
    
    echo -e "${YELLOW}⚠️  Please review and update these new variables if needed${NC}"
else
    echo -e "${GREEN}✅ No new environment variables${NC}"
fi

# Step 4: Validate environment configuration
echo -e "${YELLOW}[4/6] Validating environment configuration...${NC}"

# Check for critical missing values
CRITICAL_MISSING=()
if grep -q "POSTGRES_PASSWORD=CHANGE_ME" azure/.env.azure; then
    CRITICAL_MISSING+=("POSTGRES_PASSWORD")
fi
if grep -q "JWT_SECRET=GENERATE_ME_WITH_OPENSSL" azure/.env.azure; then
    CRITICAL_MISSING+=("JWT_SECRET")
fi

if [ ${#CRITICAL_MISSING[@]} -ne 0 ]; then
    echo -e "${RED}❌ Critical secrets not configured: ${CRITICAL_MISSING[*]}${NC}"
    echo -e "${YELLOW}Run the setup script to generate them:${NC}"
    echo -e "${BLUE}   bash azure/setup-secrets.sh${NC}"
    exit 1
fi

# Warn about placeholder values
PLACEHOLDER_COUNT=$(grep -c "REPLACE_WITH_YOUR" azure/.env.azure || true)
if [ "$PLACEHOLDER_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  $PLACEHOLDER_COUNT placeholder values found in .env.azure${NC}"
    echo -e "${YELLOW}Application may not work fully without real Priority credentials${NC}"
fi

echo -e "${GREEN}✅ Environment validation passed${NC}"

# Step 5: Stop existing containers and deploy
echo -e "${YELLOW}[5/6] Deploying updated application...${NC}"
sudo docker-compose -f azure/docker-compose.azure.yml down

# Clean up old images to save space
echo -e "${CYAN}Cleaning up old Docker images...${NC}"
sudo docker image prune -f

# Start new containers
sudo docker-compose -f azure/docker-compose.azure.yml up -d --build
echo -e "${GREEN}✅ Containers deployed${NC}"

# Step 6: Verify deployment
echo -e "${YELLOW}[6/6] Verifying deployment...${NC}"
sleep 15

# Check container status
echo -e "${CYAN}Container Status:${NC}"
RUNNING_CONTAINERS=$(sudo docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep ala)
echo "$RUNNING_CONTAINERS"

# Test endpoints with timeout
echo -e "${CYAN}Testing endpoints...${NC}"

# Test frontend
if timeout 10 curl -f -s http://localhost:3000 > /dev/null; then
    echo -e "${GREEN}✅ Frontend (port 3000) is responding${NC}"
else
    echo -e "${RED}❌ Frontend is not responding${NC}"
    echo -e "${YELLOW}Check logs: sudo docker logs ala-frontend-azure${NC}"
fi

# Test backend
if timeout 10 curl -f -s http://localhost:5000/api/health > /dev/null; then
    echo -e "${GREEN}✅ Backend API (port 5000) is healthy${NC}"
else
    echo -e "${RED}❌ Backend API is not responding${NC}"
    echo -e "${YELLOW}Check logs: sudo docker logs ala-api-azure${NC}"
fi

# Test database connection
DB_STATUS=$(sudo docker exec ala-db-azure pg_isready -U ala_user -d ala_production 2>/dev/null | grep "accepting connections" || echo "not ready")
if [[ $DB_STATUS == *"accepting connections"* ]]; then
    echo -e "${GREEN}✅ Database is accepting connections${NC}"
else
    echo -e "${RED}❌ Database is not ready${NC}"
    echo -e "${YELLOW}Check logs: sudo docker logs ala-db-azure${NC}"
fi

echo ""
echo -e "${GREEN}==================================================================${NC}"
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo -e "${GREEN}==================================================================${NC}"
echo ""
echo -e "${BLUE}Application Access:${NC}"
echo -e "   Frontend: ${CYAN}http://20.217.84.100:3000${NC}"
echo -e "   API Health: ${CYAN}http://20.217.84.100:5000/api/health${NC}"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo -e "   View logs: ${CYAN}sudo docker-compose -f azure/docker-compose.azure.yml logs -f${NC}"
echo -e "   Stop app: ${CYAN}sudo docker-compose -f azure/docker-compose.azure.yml down${NC}"
echo -e "   Check status: ${CYAN}sudo docker ps${NC}"
echo ""
echo -e "${BLUE}Backup Info:${NC}"
echo -e "   Secrets backup: ${CYAN}$BACKUP_FILE${NC}"
echo ""