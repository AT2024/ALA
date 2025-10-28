#!/bin/bash
# =======================================================================
# Traffic Switch Script for Blue-Green Deployment
# =======================================================================
# Switches nginx traffic between blue and green environments
#
# Usage: ./switch-traffic.sh <environment>
#   environment: blue or green (the environment to switch TO)
#
# This script:
#   1. Updates the nginx upstream configuration symlink
#   2. Reloads nginx configuration (zero downtime)
#   3. Verifies the switch was successful
#
# Exit codes:
#   0 = Traffic switched successfully
#   1 = Switch failed
#   2 = Invalid arguments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
TARGET_ENV=${1:-}
PROXY_CONTAINER="ala-proxy"
UPSTREAM_DIR="/etc/nginx/conf.d"

# Validate arguments
if [ -z "$TARGET_ENV" ]; then
    echo -e "${RED}Error: Target environment not specified${NC}"
    echo "Usage: $0 <environment>"
    exit 2
fi

if [ "$TARGET_ENV" != "blue" ] && [ "$TARGET_ENV" != "green" ]; then
    echo -e "${RED}Error: Environment must be 'blue' or 'green'${NC}"
    exit 2
fi

echo "========================================="
echo "Switching traffic to: $TARGET_ENV"
echo "========================================="
echo ""

# =======================================================================
# Step 1: Verify target environment is healthy
# =======================================================================
echo -e "${YELLOW}[1/4] Verifying target environment health...${NC}"

# Check if target containers exist and are healthy
API_CONTAINER="ala-api-${TARGET_ENV}"
FRONTEND_CONTAINER="ala-frontend-${TARGET_ENV}"

API_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' "$API_CONTAINER" 2>/dev/null || echo "none")
FRONTEND_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' "$FRONTEND_CONTAINER" 2>/dev/null || echo "none")

if [ "$API_HEALTH" != "healthy" ]; then
    echo -e "${RED}✗ API container not healthy (status: $API_HEALTH)${NC}"
    exit 1
fi

if [ "$FRONTEND_HEALTH" != "healthy" ]; then
    echo -e "${RED}✗ Frontend container not healthy (status: $FRONTEND_HEALTH)${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Target environment is healthy${NC}"
echo ""

# =======================================================================
# Step 2: Update nginx upstream configuration
# =======================================================================
echo -e "${YELLOW}[2/4] Updating nginx configuration...${NC}"

# Update the symlink inside the proxy container
docker exec "$PROXY_CONTAINER" sh -c "
    rm -f ${UPSTREAM_DIR}/upstream-active.conf && \
    ln -sf ${UPSTREAM_DIR}/upstream-${TARGET_ENV}.conf ${UPSTREAM_DIR}/upstream-active.conf
"

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Failed to update nginx configuration${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Nginx configuration updated${NC}"
echo ""

# =======================================================================
# Step 3: Reload nginx (zero downtime)
# =======================================================================
echo -e "${YELLOW}[3/4] Reloading nginx...${NC}"

# Graceful reload - nginx will test the configuration first
docker exec "$PROXY_CONTAINER" nginx -t

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Nginx configuration test failed${NC}"
    # Rollback the symlink
    docker exec "$PROXY_CONTAINER" sh -c "
        rm -f ${UPSTREAM_DIR}/upstream-active.conf && \
        ln -sf ${UPSTREAM_DIR}/upstream-$([ \"$TARGET_ENV\" = \"blue\" ] && echo \"green\" || echo \"blue\").conf ${UPSTREAM_DIR}/upstream-active.conf
    "
    exit 1
fi

# Reload nginx configuration
docker exec "$PROXY_CONTAINER" nginx -s reload

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Nginx reload failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Nginx reloaded successfully${NC}"
echo ""

# =======================================================================
# Step 4: Verify traffic is flowing to new environment
# =======================================================================
echo -e "${YELLOW}[4/4] Verifying traffic switch...${NC}"

# Give nginx a moment to apply changes
sleep 2

# Test that we can reach the API through the proxy
# Note: This tests from inside the proxy container to the backend
HEALTH_CHECK=$(docker exec "$PROXY_CONTAINER" wget -q -O- http://backend:5000/api/health 2>/dev/null || echo "")

if echo "$HEALTH_CHECK" | grep -q '"status":"ok"'; then
    echo -e "${GREEN}✓ Traffic successfully switched to $TARGET_ENV${NC}"

    # Try to extract environment name from health response if available
    ENV_NAME=$(echo "$HEALTH_CHECK" | grep -o '"env":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
    if [ "$ENV_NAME" != "unknown" ]; then
        echo "  Environment: $ENV_NAME"
    fi
else
    echo -e "${RED}✗ Traffic verification failed${NC}"
    echo "Health check response: $HEALTH_CHECK"
    echo -e "${YELLOW}Warning: Traffic may have switched but verification failed${NC}"
    exit 1
fi

echo ""

# =======================================================================
# Summary
# =======================================================================
echo "========================================="
echo -e "${GREEN}✓ Traffic successfully switched to $TARGET_ENV${NC}"
echo "Nginx has been reloaded with zero downtime"
echo "========================================="

# Update state file (if it exists in parent directory)
if [ -f "../.current-env" ]; then
    echo "$TARGET_ENV" > ../.current-env
    echo "State file updated: $TARGET_ENV is now active"
fi

exit 0
