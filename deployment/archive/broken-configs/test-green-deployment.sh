#!/bin/bash

# Test Green Environment Deployment Script
# This script deploys to green environment and tests WITHOUT affecting production
# Run this on Azure VM: ssh azureuser@20.217.84.100

set -e  # Exit on any error

echo "=========================================="
echo "Green Environment Deployment & Testing"
echo "=========================================="
echo ""

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Verify we're in the right directory
echo -e "${BLUE}[1/10] Verifying location...${NC}"
cd ~/ala-improved
pwd
echo ""

# Step 2: Fetch latest code
echo -e "${BLUE}[2/10] Fetching latest code from GitHub...${NC}"
git fetch origin
echo ""

# Step 3: Checkout feature branch
echo -e "${BLUE}[3/10] Checking out feature branch...${NC}"
git checkout fix/treatment-persistence-refresh
git pull origin fix/treatment-persistence-refresh
echo ""

# Step 4: Verify correct branch
echo -e "${BLUE}[4/10] Verifying branch and commit...${NC}"
echo "Current branch:"
git branch | grep '*'
echo ""
echo "Latest commit:"
git log --oneline -1
echo ""

# Step 5: Check current production environment
echo -e "${BLUE}[5/10] Checking current production environment...${NC}"
if [ -f deployment/.current-env ]; then
    CURRENT_ENV=$(cat deployment/.current-env)
    echo "Current production environment: ${CURRENT_ENV}"

    if [ "$CURRENT_ENV" = "blue" ]; then
        TARGET_ENV="green"
        echo -e "${GREEN}Production is on BLUE, will deploy to GREEN${NC}"
    else
        TARGET_ENV="blue"
        echo -e "${GREEN}Production is on GREEN, will deploy to BLUE${NC}"
    fi
else
    echo -e "${YELLOW}Warning: .current-env file not found. Blue-green may not be initialized.${NC}"
    echo "You may need to run: cd deployment && ./init-bluegreen"
    read -p "Continue anyway? [y/N]: " continue_anyway
    if [ "$continue_anyway" != "y" ]; then
        exit 1
    fi
    TARGET_ENV="green"
fi
echo ""

# Step 6: Navigate to deployment directory
echo -e "${BLUE}[6/10] Navigating to deployment directory...${NC}"
cd deployment
pwd
echo ""

# Step 7: Deploy to inactive environment
echo -e "${BLUE}[7/10] Deploying to ${TARGET_ENV} environment...${NC}"
echo -e "${YELLOW}IMPORTANT: When prompted 'Switch traffic to ${TARGET_ENV}?', answer: N${NC}"
echo -e "${YELLOW}This lets us test ${TARGET_ENV} before switching production traffic.${NC}"
echo ""
read -p "Press Enter to start deployment..."
echo ""

./deploy-zero-downtime

echo ""
echo -e "${GREEN}✓ Deployment to ${TARGET_ENV} complete!${NC}"
echo ""

# Step 8: Run health checks on target environment
echo -e "${BLUE}[8/10] Running health checks on ${TARGET_ENV}...${NC}"
if [ -f scripts/health-check.sh ]; then
    ./scripts/health-check.sh $TARGET_ENV
else
    echo -e "${YELLOW}Warning: health-check.sh not found, skipping...${NC}"
fi
echo ""

# Step 9: Check container status
echo -e "${BLUE}[9/10] Checking ${TARGET_ENV} container status...${NC}"
docker ps --filter name=$TARGET_ENV --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

# Step 10: Display testing instructions
echo -e "${BLUE}[10/10] ${TARGET_ENV} environment is ready for testing!${NC}"
echo ""
echo "=========================================="
echo "Manual Testing Instructions"
echo "=========================================="
echo ""
echo "1. Test ${TARGET_ENV} API health:"
echo -e "   ${GREEN}docker exec ala-api-${TARGET_ENV} wget -q -O- http://localhost:5000/api/health${NC}"
echo ""
echo "2. View ${TARGET_ENV} logs (in separate terminal):"
echo -e "   ${GREEN}docker-compose -f docker-compose.bluegreen.yml logs -f api-${TARGET_ENV} frontend-${TARGET_ENV}${NC}"
echo ""
echo "3. Switch traffic to ${TARGET_ENV} for browser testing:"
echo -e "   ${GREEN}./scripts/switch-traffic.sh ${TARGET_ENV}${NC}"
echo ""
echo "4. Test in browser:"
echo "   - Open: https://ala-app.israelcentral.cloudapp.azure.com"
echo "   - Login and complete treatment workflow"
echo "   - Navigate to UseList page"
echo "   - Press F5 (refresh) - data should persist! ✅"
echo "   - Click Finalize - should work ✅"
echo ""
echo "5. Monitor ${TARGET_ENV} for 30 minutes:"
echo -e "   ${GREEN}watch -n 5 'docker ps --filter name=${TARGET_ENV}'${NC}"
echo ""
echo "6. If everything works, stop old environment:"
if [ "$TARGET_ENV" = "green" ]; then
    echo -e "   ${GREEN}docker-compose -f docker-compose.bluegreen.yml stop api-blue frontend-blue${NC}"
else
    echo -e "   ${GREEN}docker-compose -f docker-compose.bluegreen.yml stop api-green frontend-green${NC}"
fi
echo ""
echo "=========================================="
echo "Rollback (if needed)"
echo "=========================================="
echo ""
echo "If you see ANY issues, rollback immediately:"
echo -e "${RED}./rollback --force${NC}"
echo ""
echo "=========================================="
