#!/bin/bash

# =================================================================
# ALA Azure VM Deployment Script
# =================================================================
# Run this script ON the Azure VM to deploy latest changes
# Usage: ./deploy.sh

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}==================================================================${NC}"
echo -e "${BLUE}Deploying ALA Application Updates${NC}"
echo -e "${BLUE}==================================================================${NC}"

# Navigate to project directory
cd ~/ala-improved

# Step 1: Pull latest changes
echo -e "${YELLOW}[1/5] Pulling latest changes from GitHub...${NC}"
git fetch --all
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
git pull origin $CURRENT_BRANCH
echo -e "${GREEN}✅ Code updated${NC}"

# Step 2: Check environment file
echo -e "${YELLOW}[2/5] Checking environment configuration...${NC}"
if [ ! -f "azure/.env.azure" ]; then
    echo -e "${RED}❌ Error: azure/.env.azure not found!${NC}"
    echo -e "${YELLOW}Creating from template...${NC}"
    cp azure/.env.azure.template azure/.env.azure
    echo -e "${YELLOW}⚠️  Please edit azure/.env.azure with your secrets before continuing${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Environment configured${NC}"

# Step 3: Stop existing containers
echo -e "${YELLOW}[3/5] Stopping existing containers...${NC}"
sudo docker-compose -f azure/docker-compose.azure.yml down
echo -e "${GREEN}✅ Containers stopped${NC}"

# Step 4: Build and start new containers
echo -e "${YELLOW}[4/5] Building and starting containers...${NC}"
sudo docker-compose -f azure/docker-compose.azure.yml up -d --build
echo -e "${GREEN}✅ Containers started${NC}"

# Step 5: Verify deployment
echo -e "${YELLOW}[5/5] Verifying deployment...${NC}"
sleep 10

# Check container status
RUNNING_CONTAINERS=$(sudo docker ps --format "table {{.Names}}\t{{.Status}}" | grep ala)
echo "$RUNNING_CONTAINERS"

# Test endpoints
echo -e "${YELLOW}Testing endpoints...${NC}"
if curl -f -s http://localhost:3000 > /dev/null; then
    echo -e "${GREEN}✅ Frontend is responding${NC}"
else
    echo -e "${RED}⚠️  Frontend may still be starting up${NC}"
fi

if curl -f -s http://localhost:5000/api/health > /dev/null; then
    echo -e "${GREEN}✅ Backend API is healthy${NC}"
else
    echo -e "${RED}⚠️  Backend may still be starting up${NC}"
fi

echo ""
echo -e "${GREEN}==================================================================${NC}"
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo -e "${GREEN}==================================================================${NC}"
echo -e "${BLUE}Application URL: http://20.217.84.100:3000${NC}"
echo -e "${BLUE}API Health: http://20.217.84.100:5000/api/health${NC}"
echo ""
echo -e "${YELLOW}View logs: sudo docker-compose -f azure/docker-compose.azure.yml logs -f${NC}"