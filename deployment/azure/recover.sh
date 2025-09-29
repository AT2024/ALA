#!/bin/bash

# =================================================================
# ALA Azure VM Recovery Script
# =================================================================
# Automatically recover from container failures
# Preserves database data and network configuration
# Usage: ~/ala-improved/deployment/azure/recover.sh

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
echo -e "${BLUE}ALA Application - Recovery System${NC}"
echo -e "${BLUE}Preserving data while recovering services${NC}"
echo -e "${BLUE}==================================================================${NC}"

cd "$PROJECT_DIR"

# Function to check container health
is_healthy() {
    local container=$1
    docker inspect "$container" --format='{{.State.Health.Status}}' 2>/dev/null | grep -q "healthy"
}

# Function to check if container is running
is_running() {
    local container=$1
    docker inspect "$container" --format='{{.State.Running}}' 2>/dev/null | grep -q "true"
}

# Function to restart specific service
restart_service() {
    local service=$1
    echo -e "${YELLOW}Restarting $service...${NC}"
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" restart "$service"
    sleep 10
}

# Function to recreate service
recreate_service() {
    local service=$1
    echo -e "${YELLOW}Recreating $service...${NC}"
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --force-recreate "$service"
    sleep 15
}

# Step 1: Check container status
echo -e "${YELLOW}[1/4] Checking container status...${NC}"

CONTAINERS=("ala-db-azure" "ala-api-azure" "ala-frontend-azure")
FAILED_CONTAINERS=()

for container in "${CONTAINERS[@]}"; do
    if ! is_running "$container"; then
        echo -e "${RED}❌ $container is not running${NC}"
        FAILED_CONTAINERS+=("$container")
    elif ! is_healthy "$container"; then
        echo -e "${YELLOW}⚠️  $container is running but unhealthy${NC}"
        FAILED_CONTAINERS+=("$container")
    else
        echo -e "${GREEN}✅ $container is healthy${NC}"
    fi
done

if [ ${#FAILED_CONTAINERS[@]} -eq 0 ]; then
    echo -e "${GREEN}All containers are healthy! No recovery needed.${NC}"
    exit 0
fi

# Step 2: Verify network and volume integrity
echo -e "${YELLOW}[2/4] Verifying infrastructure integrity...${NC}"

# Check network
if ! docker network inspect azure_ala-network > /dev/null 2>&1; then
    echo -e "${RED}❌ Network azure_ala-network missing, recreating...${NC}"
    docker network create azure_ala-network
fi

# Check volume
if ! docker volume inspect azure_ala-postgres-data-prod > /dev/null 2>&1; then
    echo -e "${RED}❌ Volume azure_ala-postgres-data-prod missing!${NC}"
    echo -e "${RED}This may result in data loss. Creating new volume...${NC}"
    docker volume create azure_ala-postgres-data-prod
fi

echo -e "${GREEN}✅ Infrastructure verified${NC}"

# Step 3: Recover failed containers
echo -e "${YELLOW}[3/4] Recovering failed containers...${NC}"

# Always recover in dependency order: db -> api -> frontend
if [[ " ${FAILED_CONTAINERS[@]} " =~ " ala-db-azure " ]]; then
    echo -e "${CYAN}Recovering database...${NC}"
    if is_running "ala-db-azure"; then
        restart_service "db"
    else
        recreate_service "db"
    fi

    # Wait for database to be healthy before proceeding
    counter=0
    while [ $counter -lt 60 ]; do
        if is_healthy "ala-db-azure"; then
            echo -e "${GREEN}✅ Database recovered${NC}"
            break
        fi
        sleep 2
        counter=$((counter + 2))
        echo -n "."
    done

    if ! is_healthy "ala-db-azure"; then
        echo -e "${RED}❌ Database recovery failed${NC}"
        exit 1
    fi
fi

if [[ " ${FAILED_CONTAINERS[@]} " =~ " ala-api-azure " ]]; then
    echo -e "${CYAN}Recovering API...${NC}"
    if is_running "ala-api-azure"; then
        restart_service "api"
    else
        recreate_service "api"
    fi

    # Wait for API to be healthy
    counter=0
    while [ $counter -lt 60 ]; do
        if is_healthy "ala-api-azure"; then
            echo -e "${GREEN}✅ API recovered${NC}"
            break
        fi
        sleep 2
        counter=$((counter + 2))
        echo -n "."
    done

    if ! is_healthy "ala-api-azure"; then
        echo -e "${RED}❌ API recovery failed${NC}"
        exit 1
    fi
fi

if [[ " ${FAILED_CONTAINERS[@]} " =~ " ala-frontend-azure " ]]; then
    echo -e "${CYAN}Recovering Frontend...${NC}"
    if is_running "ala-frontend-azure"; then
        restart_service "frontend"
    else
        recreate_service "frontend"
    fi

    # Wait for frontend to be healthy
    counter=0
    while [ $counter -lt 45 ]; do
        if is_healthy "ala-frontend-azure"; then
            echo -e "${GREEN}✅ Frontend recovered${NC}"
            break
        fi
        sleep 2
        counter=$((counter + 2))
        echo -n "."
    done

    if ! is_healthy "ala-frontend-azure"; then
        echo -e "${RED}❌ Frontend recovery failed${NC}"
        exit 1
    fi
fi

# Step 4: Final verification
echo -e "${YELLOW}[4/4] Final verification...${NC}"

# Test endpoints
if timeout 10 curl -f -s http://localhost:3000 > /dev/null; then
    echo -e "${GREEN}✅ Frontend is accessible${NC}"
else
    echo -e "${RED}❌ Frontend verification failed${NC}"
fi

if timeout 10 curl -f -s http://localhost:5000/api/health > /dev/null; then
    echo -e "${GREEN}✅ API is accessible${NC}"
else
    echo -e "${RED}❌ API verification failed${NC}"
fi

echo ""
echo -e "${GREEN}==================================================================${NC}"
echo -e "${GREEN}🎉 Recovery Complete!${NC}"
echo -e "${GREEN}==================================================================${NC}"
echo ""
echo -e "${BLUE}Container Status:${NC}"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep ala
echo ""
echo -e "${BLUE}Recovery Log:${NC}"
echo "Recovery completed at $(date)" >> "$AZURE_DIR/recovery.log"
echo "Recovered containers: ${FAILED_CONTAINERS[*]}" >> "$AZURE_DIR/recovery.log"