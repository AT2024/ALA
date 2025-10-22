#!/bin/bash

# =================================================================
# ALA Azure VM Production Deployment Script
# =================================================================
# Run this script ON the Azure VM to deploy latest changes
# This preserves your secrets while updating code
# Usage: ~/ala-improved/deployment/scripts/deploy.sh

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="$HOME/ala-improved"
DEPLOYMENT_DIR="$PROJECT_DIR/deployment"
AZURE_DIR="$DEPLOYMENT_DIR/azure"
COMPOSE_FILE="$AZURE_DIR/docker-compose.azure.yml"
ENV_FILE="$AZURE_DIR/.env.azure"

echo -e "${BLUE}==================================================================${NC}"
echo -e "${BLUE}ALA Application - Production Deployment${NC}"
echo -e "${BLUE}Enhanced with recovery and validation${NC}"
echo -e "${BLUE}==================================================================${NC}"

# Function to check if containers are healthy
check_health() {
    local service=$1
    local timeout=${2:-60}
    local counter=0

    echo -e "${CYAN}Waiting for $service to become healthy...${NC}"
    while [ $counter -lt $timeout ]; do
        if docker inspect "ala-$service-azure" --format='{{.State.Health.Status}}' 2>/dev/null | grep -q "healthy"; then
            echo -e "${GREEN}✅ $service is healthy${NC}"
            return 0
        fi
        sleep 2
        counter=$((counter + 2))
        echo -n "."
    done
    echo -e "${RED}❌ $service failed to become healthy within ${timeout}s${NC}"
    return 1
}

# Function to create recovery snapshot
create_snapshot() {
    echo -e "${YELLOW}Creating recovery snapshot...${NC}"
    SNAPSHOT_DIR="$AZURE_DIR/snapshots/$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$SNAPSHOT_DIR"

    # Backup current environment
    cp "$ENV_FILE" "$SNAPSHOT_DIR/" 2>/dev/null || true

    # Save container states
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}" | grep ala > "$SNAPSHOT_DIR/container_state.txt" || true

    echo -e "${GREEN}✅ Snapshot created: $SNAPSHOT_DIR${NC}"
    echo "$SNAPSHOT_DIR" > "$AZURE_DIR/.last_snapshot"
}

# Function to rollback
rollback() {
    echo -e "${RED}Rolling back to previous state...${NC}"
    if [ -f "$AZURE_DIR/.last_snapshot" ]; then
        SNAPSHOT_DIR=$(cat "$AZURE_DIR/.last_snapshot")
        if [ -d "$SNAPSHOT_DIR" ]; then
            echo -e "${CYAN}Restoring from: $SNAPSHOT_DIR${NC}"
            cp "$SNAPSHOT_DIR/.env.azure" "$ENV_FILE" 2>/dev/null || true
            echo -e "${GREEN}✅ Rollback completed${NC}"
        fi
    fi
}

# Navigate to project directory
cd "$PROJECT_DIR"

# Validate required files exist
echo -e "${YELLOW}[1/8] Validating deployment environment...${NC}"
if [ ! -f "$COMPOSE_FILE" ]; then
    echo -e "${RED}❌ Error: $COMPOSE_FILE not found!${NC}"
    echo -e "${YELLOW}Ensure deployment files are synced to Azure VM${NC}"
    exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ Error: $ENV_FILE not found!${NC}"
    echo -e "${YELLOW}Run the initial setup script first${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Environment validation passed${NC}"

# Step 1: Create snapshot
echo -e "${YELLOW}[2/8] Creating deployment snapshot...${NC}"
create_snapshot

# Step 2: Pull latest changes
echo -e "${YELLOW}[3/8] Pulling latest changes from GitHub...${NC}"
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

# Step 3: Validate configuration
echo -e "${YELLOW}[4/8] Validating configuration...${NC}"

# Check for critical missing values
CRITICAL_MISSING=()
if grep -q "POSTGRES_PASSWORD=CHANGE_ME" "$ENV_FILE"; then
    CRITICAL_MISSING+=("POSTGRES_PASSWORD")
fi
if grep -q "JWT_SECRET=GENERATE_ME_WITH_OPENSSL" "$ENV_FILE"; then
    CRITICAL_MISSING+=("JWT_SECRET")
fi

if [ ${#CRITICAL_MISSING[@]} -ne 0 ]; then
    echo -e "${RED}❌ Critical secrets not configured: ${CRITICAL_MISSING[*]}${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Configuration validation passed${NC}"

# Step 4: Test compose file
echo -e "${YELLOW}[5/8] Testing Docker Compose configuration...${NC}"
if ! docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" config > /dev/null; then
    echo -e "${RED}❌ Docker Compose configuration invalid${NC}"
    rollback
    exit 1
fi
echo -e "${GREEN}✅ Docker Compose configuration valid${NC}"

# Step 5: Deploy with graceful handling
echo -e "${YELLOW}[6/8] Deploying updated application...${NC}"

# Check if containers are running before stopping them
RUNNING_CONTAINERS=$(docker ps --filter "name=ala-" --format "{{.Names}}" || true)
if [ -n "$RUNNING_CONTAINERS" ]; then
    echo -e "${CYAN}Stopping existing containers gracefully...${NC}"
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down --timeout 30
fi

# Clean up old images to save space
echo -e "${CYAN}Cleaning up old Docker images...${NC}"
docker image prune -f

# Start new containers
echo -e "${CYAN}Starting new containers...${NC}"
if ! docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build; then
    echo -e "${RED}❌ Failed to start containers${NC}"
    rollback
    exit 1
fi

echo -e "${GREEN}✅ Containers deployed${NC}"

# Step 6: Health verification with timeout
echo -e "${YELLOW}[7/8] Verifying deployment health...${NC}"

# Wait for database first
if ! check_health "db" 90; then
    echo -e "${RED}❌ Database failed to start${NC}"
    echo -e "${YELLOW}Rolling back...${NC}"
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down
    rollback
    exit 1
fi

# Wait for API
if ! check_health "api" 60; then
    echo -e "${RED}❌ API failed to start${NC}"
    echo -e "${YELLOW}Rolling back...${NC}"
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down
    rollback
    exit 1
fi

# Wait for Frontend
if ! check_health "frontend" 60; then
    echo -e "${RED}❌ Frontend failed to start${NC}"
    echo -e "${YELLOW}Rolling back...${NC}"
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down
    rollback
    exit 1
fi

# Step 7: Final verification
echo -e "${YELLOW}[8/8] Final endpoint verification...${NC}"

# Test external endpoints
if ! timeout 10 curl -f -s http://20.217.84.100:3000 > /dev/null; then
    echo -e "${RED}❌ Frontend external access failed${NC}"
    exit 1
fi

if ! timeout 10 curl -f -s http://20.217.84.100:5000/api/health > /dev/null; then
    echo -e "${RED}❌ API external access failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}==================================================================${NC}"
echo -e "${GREEN}🎉 Deployment Complete and Verified!${NC}"
echo -e "${GREEN}==================================================================${NC}"
echo ""
echo -e "${BLUE}Application Access:${NC}"
echo -e "   Frontend: ${CYAN}http://20.217.84.100:3000${NC}"
echo -e "   API Health: ${CYAN}http://20.217.84.100:5000/api/health${NC}"
echo ""
echo -e "${BLUE}Container Status:${NC}"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep ala
echo ""
echo -e "${BLUE}Recovery Information:${NC}"
echo -e "   Snapshot: ${CYAN}$(cat "$AZURE_DIR/.last_snapshot" 2>/dev/null || echo "None")${NC}"
echo -e "   Recovery: ${CYAN}$AZURE_DIR/recover.sh${NC}"
echo ""