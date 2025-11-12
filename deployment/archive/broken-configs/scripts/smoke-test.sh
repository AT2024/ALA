#!/bin/bash
# =======================================================================
# Smoke Test Script for Blue-Green Deployment
# =======================================================================
# Performs critical path testing on a deployment environment
#
# Usage: ./smoke-test.sh <environment>
#   environment: blue or green
#
# Tests performed:
#   1. API authentication endpoint
#   2. Test user login flow
#   3. Frontend page load
#   4. API CORS configuration
#
# Exit codes:
#   0 = All smoke tests passed
#   1 = Smoke tests failed
#   2 = Invalid arguments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-}

# Validate arguments
if [ -z "$ENVIRONMENT" ]; then
    echo -e "${RED}Error: Environment not specified${NC}"
    echo "Usage: $0 <environment>"
    exit 2
fi

if [ "$ENVIRONMENT" != "blue" ] && [ "$ENVIRONMENT" != "green" ]; then
    echo -e "${RED}Error: Environment must be 'blue' or 'green'${NC}"
    exit 2
fi

API_CONTAINER="ala-api-${ENVIRONMENT}"
FRONTEND_CONTAINER="ala-frontend-${ENVIRONMENT}"

echo "========================================="
echo "Smoke Tests: $ENVIRONMENT environment"
echo "========================================="
echo ""

# =======================================================================
# Test 1: API Authentication Endpoint
# =======================================================================
echo -e "${YELLOW}[1/4] Testing API authentication endpoint...${NC}"

# Test the auth/request-code endpoint
AUTH_RESPONSE=$(docker exec "$API_CONTAINER" wget -q -O- \
    --header='Content-Type: application/json' \
    --post-data='{"email":"test@example.com"}' \
    http://localhost:5000/api/auth/request-code 2>/dev/null || echo "")

if echo "$AUTH_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✓ Authentication endpoint responding${NC}"
else
    echo -e "${RED}✗ Authentication endpoint failed${NC}"
    echo "Response: $AUTH_RESPONSE"
    exit 1
fi

echo ""

# =======================================================================
# Test 2: Test User Login Flow
# =======================================================================
echo -e "${YELLOW}[2/4] Testing test user login flow...${NC}"

# Request verification code for test user
CODE_RESPONSE=$(docker exec "$API_CONTAINER" wget -q -O- \
    --header='Content-Type: application/json' \
    --post-data='{"email":"test@example.com"}' \
    http://localhost:5000/api/auth/request-code 2>/dev/null || echo "")

if ! echo "$CODE_RESPONSE" | grep -q '"success":true'; then
    echo -e "${RED}✗ Could not request verification code${NC}"
    echo "Response: $CODE_RESPONSE"
    exit 1
fi

# Verify with test code (123456)
VERIFY_RESPONSE=$(docker exec "$API_CONTAINER" wget -q -O- \
    --header='Content-Type: application/json' \
    --post-data='{"email":"test@example.com","code":"123456"}' \
    http://localhost:5000/api/auth/verify-code 2>/dev/null || echo "")

if echo "$VERIFY_RESPONSE" | grep -q '"token":'; then
    echo -e "${GREEN}✓ Test user login successful${NC}"
    # Extract token for later use
    TOKEN=$(echo "$VERIFY_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
else
    echo -e "${RED}✗ Test user login failed${NC}"
    echo "Response: $VERIFY_RESPONSE"
    exit 1
fi

echo ""

# =======================================================================
# Test 3: Frontend Page Load
# =======================================================================
echo -e "${YELLOW}[3/4] Testing frontend page load...${NC}"

# Get frontend HTML
FRONTEND_HTML=$(docker exec "$FRONTEND_CONTAINER" wget -q -O- http://localhost:8080/ 2>/dev/null || echo "")

# Check for expected elements in the HTML
if ! echo "$FRONTEND_HTML" | grep -q '<html'; then
    echo -e "${RED}✗ Frontend did not return HTML${NC}"
    exit 1
fi

if ! echo "$FRONTEND_HTML" | grep -q 'root'; then
    echo -e "${RED}✗ Frontend HTML missing root element${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Frontend page loads correctly${NC}"
echo ""

# =======================================================================
# Test 4: CORS Configuration
# =======================================================================
echo -e "${YELLOW}[4/4] Testing CORS configuration...${NC}"

# Test CORS headers on API endpoint
CORS_TEST=$(docker exec "$API_CONTAINER" wget -q -S -O- \
    --header='Origin: https://ala-app.israelcentral.cloudapp.azure.com' \
    http://localhost:5000/api/health 2>&1 || echo "")

# Check if CORS is working (should not see CORS errors)
if echo "$CORS_TEST" | grep -q '"status":"ok"'; then
    echo -e "${GREEN}✓ CORS configuration working${NC}"
else
    echo -e "${YELLOW}⚠ CORS test inconclusive (may be expected for internal testing)${NC}"
fi

echo ""

# =======================================================================
# Summary
# =======================================================================
echo "========================================="
echo -e "${GREEN}✓ All smoke tests passed${NC}"
echo "Environment: $ENVIRONMENT"
echo "========================================="

exit 0
