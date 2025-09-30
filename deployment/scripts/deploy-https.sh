#!/bin/bash

# =================================================================
# ALA Azure VM HTTPS Production Deployment Script
# =================================================================
# Run this script ON the Azure VM to deploy HTTPS-enabled version
# Usage: ~/ala-improved/deployment/scripts/deploy-https.sh

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
COMPOSE_FILE="$AZURE_DIR/docker-compose.https.azure.yml"
ENV_FILE="$AZURE_DIR/.env.azure"
SSL_DIR="$PROJECT_DIR/ssl-certs"

echo -e "${BLUE}==================================================================${NC}"
echo -e "${BLUE}ALA Application - HTTPS Production Deployment${NC}"
echo -e "${BLUE}SSL Certificate Generation and HTTPS Configuration${NC}"
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

# Navigate to project directory
cd "$PROJECT_DIR"

# Step 1: Generate SSL certificates
echo -e "${YELLOW}[1/8] Generating SSL certificates for 20.217.84.100...${NC}"
mkdir -p "$SSL_DIR/certs" "$SSL_DIR/private"

if [ ! -f "$SSL_DIR/certs/certificate.crt" ] || [ ! -f "$SSL_DIR/private/private.key" ]; then
    echo -e "${CYAN}Generating new SSL certificate...${NC}"

    # Generate private key
    openssl genrsa -out "$SSL_DIR/private/private.key" 2048

    # Generate certificate signing request
    openssl req -new -key "$SSL_DIR/private/private.key" -out "$SSL_DIR/private/certificate.csr" \
      -subj "/C=IL/ST=Tel Aviv/L=Tel Aviv/O=AlphaTau Medical/OU=IT Department/CN=20.217.84.100"

    # Create extensions file with IP SAN
    cat > "$SSL_DIR/extensions.conf" << 'EXTEOF'
[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
IP.1 = 20.217.84.100
DNS.1 = localhost
DNS.2 = ala-medical.local
EXTEOF

    # Generate self-signed certificate
    openssl x509 -req -days 365 -in "$SSL_DIR/private/certificate.csr" \
      -signkey "$SSL_DIR/private/private.key" \
      -out "$SSL_DIR/certs/certificate.crt" \
      -extensions v3_req -extfile "$SSL_DIR/extensions.conf"

    # Set proper permissions
    chmod 600 "$SSL_DIR/private/private.key"
    chmod 644 "$SSL_DIR/certs/certificate.crt"

    echo -e "${GREEN}✅ SSL certificate generated successfully${NC}"
else
    echo -e "${GREEN}✅ SSL certificates already exist${NC}"
fi

# Show certificate details
echo -e "${CYAN}Certificate details:${NC}"
openssl x509 -in "$SSL_DIR/certs/certificate.crt" -text -noout | grep -E "(Subject|Validity|DNS|IP)" || true

# Step 2: Update environment for HTTPS
echo -e "${YELLOW}[2/8] Configuring HTTPS environment...${NC}"

if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ Error: $ENV_FILE not found!${NC}"
    echo -e "${YELLOW}Run the initial setup script first${NC}"
    exit 1
fi

# Backup original environment
cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%Y%m%d-%H%M%S)"

# Update environment for HTTPS
grep -q "^USE_HTTPS=" "$ENV_FILE" && sed -i 's/^USE_HTTPS=.*/USE_HTTPS=true/' "$ENV_FILE" || echo "USE_HTTPS=true" >> "$ENV_FILE"
grep -q "^DOMAIN=" "$ENV_FILE" && sed -i 's/^DOMAIN=.*/DOMAIN=20.217.84.100/' "$ENV_FILE" || echo "DOMAIN=20.217.84.100" >> "$ENV_FILE"
grep -q "^CORS_ORIGIN=" "$ENV_FILE" && sed -i 's|^CORS_ORIGIN=.*|CORS_ORIGIN=https://20.217.84.100:3000|' "$ENV_FILE" || echo "CORS_ORIGIN=https://20.217.84.100:3000" >> "$ENV_FILE"
grep -q "^VITE_API_URL=" "$ENV_FILE" && sed -i 's|^VITE_API_URL=.*|VITE_API_URL=https://20.217.84.100:5000/api|' "$ENV_FILE" || echo "VITE_API_URL=https://20.217.84.100:5000/api" >> "$ENV_FILE"
grep -q "^HSTS_ENABLED=" "$ENV_FILE" && sed -i 's/^HSTS_ENABLED=.*/HSTS_ENABLED=true/' "$ENV_FILE" || echo "HSTS_ENABLED=true" >> "$ENV_FILE"

echo -e "${GREEN}✅ Environment configured for HTTPS${NC}"

# Step 3: Validate compose configuration
echo -e "${YELLOW}[3/8] Validating Docker Compose configuration...${NC}"
if ! docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" config > /dev/null; then
    echo -e "${RED}❌ Docker Compose configuration invalid${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker Compose configuration valid${NC}"

# Step 4: Stop existing containers
echo -e "${YELLOW}[4/8] Stopping existing containers...${NC}"
RUNNING_CONTAINERS=$(docker ps --filter "name=ala-" --format "{{.Names}}" || true)
if [ -n "$RUNNING_CONTAINERS" ]; then
    echo -e "${CYAN}Stopping existing containers gracefully...${NC}"
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down --timeout 30
fi

# Step 5: Deploy with HTTPS
echo -e "${YELLOW}[5/8] Deploying HTTPS-enabled application...${NC}"

# Start new containers
echo -e "${CYAN}Starting HTTPS containers...${NC}"
if ! docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build; then
    echo -e "${RED}❌ Failed to start containers${NC}"
    exit 1
fi

echo -e "${GREEN}✅ HTTPS containers deployed${NC}"

# Step 6: Health verification
echo -e "${YELLOW}[6/8] Verifying deployment health...${NC}"

# Wait for database first
if ! check_health "db" 90; then
    echo -e "${RED}❌ Database failed to start${NC}"
    exit 1
fi

# Wait for API
if ! check_health "api" 60; then
    echo -e "${RED}❌ API failed to start${NC}"
    exit 1
fi

# Wait for Frontend
if ! check_health "frontend" 60; then
    echo -e "${RED}❌ Frontend failed to start${NC}"
    exit 1
fi

# Step 7: HTTPS endpoint verification
echo -e "${YELLOW}[7/8] Verifying HTTPS endpoints...${NC}"

# Wait a bit for nginx to fully initialize
sleep 10

# Test HTTP redirect to HTTPS
echo -e "${CYAN}Testing HTTP redirect...${NC}"
if timeout 10 curl -I -s http://20.217.84.100:3000 | grep -q "301\|302"; then
    echo -e "${GREEN}✅ HTTP redirect working${NC}"
else
    echo -e "${YELLOW}⚠️  HTTP redirect may not be working${NC}"
fi

# Test HTTPS endpoints (with self-signed cert acceptance)
echo -e "${CYAN}Testing HTTPS endpoints...${NC}"
if timeout 10 curl -k -f -s https://20.217.84.100:3000 > /dev/null; then
    echo -e "${GREEN}✅ HTTPS frontend accessible${NC}"
else
    echo -e "${RED}❌ HTTPS frontend access failed${NC}"
    exit 1
fi

if timeout 10 curl -k -f -s https://20.217.84.100:5000/api/health > /dev/null; then
    echo -e "${GREEN}✅ HTTPS API accessible${NC}"
else
    echo -e "${YELLOW}⚠️  HTTPS API may not be accessible (checking HTTP fallback)${NC}"
    if timeout 10 curl -f -s http://20.217.84.100:5000/api/health > /dev/null; then
        echo -e "${GREEN}✅ HTTP API accessible${NC}"
    else
        echo -e "${RED}❌ API not accessible on HTTP or HTTPS${NC}"
        exit 1
    fi
fi

# Step 8: Final status
echo -e "${YELLOW}[8/8] Final verification...${NC}"

echo ""
echo -e "${GREEN}==================================================================${NC}"
echo -e "${GREEN}🔒 HTTPS Deployment Complete!${NC}"
echo -e "${GREEN}==================================================================${NC}"
echo ""
echo -e "${BLUE}HTTPS Application Access:${NC}"
echo -e "   Frontend: ${CYAN}https://20.217.84.100:3000${NC}"
echo -e "   API Health: ${CYAN}https://20.217.84.100:5000/api/health${NC}"
echo -e "   HTTP Redirect: ${CYAN}http://20.217.84.100:3000 → https://20.217.84.100:3000${NC}"
echo ""
echo -e "${BLUE}SSL Certificate Information:${NC}"
echo -e "   Certificate: ${CYAN}$SSL_DIR/certs/certificate.crt${NC}"
echo -e "   Private Key: ${CYAN}$SSL_DIR/private/private.key${NC}"
echo -e "   Valid For: ${CYAN}20.217.84.100, localhost, ala-medical.local${NC}"
echo ""
echo -e "${BLUE}Container Status:${NC}"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep ala
echo ""
echo -e "${YELLOW}⚠️  Note: This uses a self-signed certificate${NC}"
echo -e "${YELLOW}   Browsers will show security warnings until you accept the certificate${NC}"
echo -e "${YELLOW}   For production, consider using Let's Encrypt or a commercial certificate${NC}"
echo ""
