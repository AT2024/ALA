#!/bin/bash
# =======================================================================
# Health Check Script for Blue-Green Deployment
# =======================================================================
# Performs comprehensive health checks on a deployment environment
#
# Usage: ./health-check.sh <environment> [timeout]
#   environment: blue or green
#   timeout: max seconds to wait (default: 120)
#
# Exit codes:
#   0 = All health checks passed
#   1 = Health checks failed
#   2 = Invalid arguments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-}
TIMEOUT=${2:-120}
START_TIME=$(date +%s)

# Validate arguments
if [ -z "$ENVIRONMENT" ]; then
    echo -e "${RED}Error: Environment not specified${NC}"
    echo "Usage: $0 <environment> [timeout]"
    exit 2
fi

if [ "$ENVIRONMENT" != "blue" ] && [ "$ENVIRONMENT" != "green" ]; then
    echo -e "${RED}Error: Environment must be 'blue' or 'green'${NC}"
    exit 2
fi

# Helper function to check if we've exceeded timeout
check_timeout() {
    local current_time=$(date +%s)
    local elapsed=$((current_time - START_TIME))
    if [ $elapsed -gt $TIMEOUT ]; then
        echo -e "${RED}✗ Timeout exceeded (${elapsed}s > ${TIMEOUT}s)${NC}"
        return 1
    fi
    return 0
}

# Helper function to wait with exponential backoff
wait_with_backoff() {
    local attempt=$1
    local max_wait=10
    local wait_time=$((attempt < max_wait ? attempt : max_wait))
    sleep $wait_time
}

echo "========================================="
echo "Health Check: $ENVIRONMENT environment"
echo "Timeout: ${TIMEOUT}s"
echo "========================================="
echo ""

# =======================================================================
# Level 1: Container Status Check
# =======================================================================
echo -e "${YELLOW}[1/5] Checking container status...${NC}"

API_CONTAINER="ala-api-${ENVIRONMENT}"
FRONTEND_CONTAINER="ala-frontend-${ENVIRONMENT}"

# Check if containers exist and are running
if ! docker ps --format '{{.Names}}' | grep -q "^${API_CONTAINER}$"; then
    echo -e "${RED}✗ API container not found or not running${NC}"
    exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -q "^${FRONTEND_CONTAINER}$"; then
    echo -e "${RED}✗ Frontend container not found or not running${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Containers are running${NC}"
echo ""

# =======================================================================
# Level 2: Docker Health Check Status
# =======================================================================
echo -e "${YELLOW}[2/5] Waiting for Docker health checks...${NC}"

attempt=0
max_attempts=30

# Wait for API container to be healthy
while [ $attempt -lt $max_attempts ]; do
    check_timeout || exit 1

    API_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' "$API_CONTAINER" 2>/dev/null || echo "none")

    if [ "$API_HEALTH" = "healthy" ]; then
        echo -e "${GREEN}✓ API container healthy${NC}"
        break
    elif [ "$API_HEALTH" = "none" ]; then
        echo -e "${RED}✗ API container has no health check configured${NC}"
        exit 1
    fi

    attempt=$((attempt + 1))
    if [ $attempt -ge $max_attempts ]; then
        echo -e "${RED}✗ API container did not become healthy (status: $API_HEALTH)${NC}"
        exit 1
    fi

    wait_with_backoff $attempt
done

# Wait for Frontend container to be healthy
attempt=0
while [ $attempt -lt $max_attempts ]; do
    check_timeout || exit 1

    FRONTEND_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' "$FRONTEND_CONTAINER" 2>/dev/null || echo "none")

    if [ "$FRONTEND_HEALTH" = "healthy" ]; then
        echo -e "${GREEN}✓ Frontend container healthy${NC}"
        break
    elif [ "$FRONTEND_HEALTH" = "none" ]; then
        echo -e "${RED}✗ Frontend container has no health check configured${NC}"
        exit 1
    fi

    attempt=$((attempt + 1))
    if [ $attempt -ge $max_attempts ]; then
        echo -e "${RED}✗ Frontend container did not become healthy (status: $FRONTEND_HEALTH)${NC}"
        exit 1
    fi

    wait_with_backoff $attempt
done

echo ""

# =======================================================================
# Level 3: API Health Endpoint Check
# =======================================================================
echo -e "${YELLOW}[3/5] Checking API health endpoint...${NC}"

attempt=0
while [ $attempt -lt $max_attempts ]; do
    check_timeout || exit 1

    # Try to get health endpoint from API container
    HEALTH_RESPONSE=$(docker exec "$API_CONTAINER" wget -q -O- http://localhost:5000/api/health 2>/dev/null || echo "")

    if echo "$HEALTH_RESPONSE" | grep -q '"status":"ok"'; then
        echo -e "${GREEN}✓ API health endpoint responding${NC}"

        # Extract and display health details
        if command -v jq &> /dev/null; then
            echo "$HEALTH_RESPONSE" | jq '.' 2>/dev/null || echo "$HEALTH_RESPONSE"
        else
            echo "$HEALTH_RESPONSE"
        fi
        break
    fi

    attempt=$((attempt + 1))
    if [ $attempt -ge $max_attempts ]; then
        echo -e "${RED}✗ API health endpoint not responding${NC}"
        echo "Response: $HEALTH_RESPONSE"
        exit 1
    fi

    wait_with_backoff $attempt
done

echo ""

# =======================================================================
# Level 4: Database Connection Check
# =======================================================================
echo -e "${YELLOW}[4/5] Checking database connectivity...${NC}"

# Extract database connection status from health endpoint
DB_CONNECTED=$(echo "$HEALTH_RESPONSE" | grep -o '"databaseConnected":[^,}]*' | cut -d':' -f2 || echo "false")

if [ "$DB_CONNECTED" = "true" ]; then
    echo -e "${GREEN}✓ Database connected${NC}"
else
    echo -e "${RED}✗ Database not connected${NC}"
    exit 1
fi

echo ""

# =======================================================================
# Level 5: Frontend Accessibility Check
# =======================================================================
echo -e "${YELLOW}[5/5] Checking frontend accessibility...${NC}"

attempt=0
while [ $attempt -lt $max_attempts ]; do
    check_timeout || exit 1

    # Try to get frontend from container
    FRONTEND_RESPONSE=$(docker exec "$FRONTEND_CONTAINER" wget -q -O- http://localhost:8080/ 2>/dev/null || echo "")

    # Check if we got HTML response with expected content
    if echo "$FRONTEND_RESPONSE" | grep -q '<html'; then
        echo -e "${GREEN}✓ Frontend responding with HTML${NC}"
        break
    fi

    attempt=$((attempt + 1))
    if [ $attempt -ge $max_attempts ]; then
        echo -e "${RED}✗ Frontend not responding with valid HTML${NC}"
        exit 1
    fi

    wait_with_backoff $attempt
done

echo ""

# =======================================================================
# Summary
# =======================================================================
ELAPSED=$(($(date +%s) - START_TIME))
echo "========================================="
echo -e "${GREEN}✓ All health checks passed${NC}"
echo "Environment: $ENVIRONMENT"
echo "Time elapsed: ${ELAPSED}s"
echo "========================================="

exit 0
