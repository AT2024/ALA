#!/bin/bash

# =================================================================
# ALA Azure VM Secrets Setup Script
# =================================================================
# Run this ONCE on a fresh Azure VM to create .env.azure with secrets
# This script generates secure passwords and creates the environment file
# Usage: bash setup-secrets.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}==================================================================${NC}"
echo -e "${BLUE}ALA Application - Azure VM Secrets Setup${NC}"
echo -e "${BLUE}This will create .env.azure with secure generated passwords${NC}"
echo -e "${BLUE}==================================================================${NC}"

# Ensure we're in the right directory
cd ~/ala-improved

# Check if .env.azure already exists
if [ -f "azure/.env.azure" ]; then
    echo -e "${YELLOW}⚠️  .env.azure already exists!${NC}"
    echo -e "${YELLOW}This will overwrite your existing secrets.${NC}"
    read -p "Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${CYAN}Setup cancelled.${NC}"
        exit 0
    fi
fi

# Step 1: Copy template
echo -e "${YELLOW}[1/4] Copying template file...${NC}"
if [ ! -f "azure/.env.azure.template" ]; then
    echo -e "${RED}❌ Error: azure/.env.azure.template not found${NC}"
    exit 1
fi

cp azure/.env.azure.template azure/.env.azure
echo -e "${GREEN}✅ Template copied${NC}"

# Step 2: Generate secure secrets
echo -e "${YELLOW}[2/4] Generating secure secrets...${NC}"

# Generate JWT secret (base64, no problematic characters)
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n' | tr -d '/')
if [ ${#JWT_SECRET} -lt 32 ]; then
    echo -e "${RED}❌ Error generating JWT secret${NC}"
    exit 1
fi

# Generate database password (base64, no problematic characters)
DB_PASSWORD=$(openssl rand -base64 32 | tr -d '\n' | tr -d '/' | tr -d '+' | tr -d '=')
if [ ${#DB_PASSWORD} -lt 16 ]; then
    echo -e "${RED}❌ Error generating database password${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Secure secrets generated${NC}"
echo -e "${CYAN}JWT Secret length: ${#JWT_SECRET} characters${NC}"
echo -e "${CYAN}DB Password length: ${#DB_PASSWORD} characters${NC}"

# Step 3: Replace placeholders in .env.azure
echo -e "${YELLOW}[3/4] Updating .env.azure with secrets...${NC}"

# Use different delimiter for sed to avoid issues with special characters
sed -i "s|JWT_SECRET=GENERATE_ME_WITH_OPENSSL|JWT_SECRET=$JWT_SECRET|" azure/.env.azure
sed -i "s|POSTGRES_PASSWORD=CHANGE_ME|POSTGRES_PASSWORD=$DB_PASSWORD|" azure/.env.azure
sed -i "s|ala_user:CHANGE_ME|ala_user:$DB_PASSWORD|" azure/.env.azure

# Verify the replacements worked
if grep -q "GENERATE_ME_WITH_OPENSSL" azure/.env.azure; then
    echo -e "${RED}❌ Error: JWT_SECRET replacement failed${NC}"
    exit 1
fi

if grep -q "POSTGRES_PASSWORD=CHANGE_ME" azure/.env.azure; then
    echo -e "${RED}❌ Error: POSTGRES_PASSWORD replacement failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Secrets applied to .env.azure${NC}"

# Step 4: Create encrypted backup
echo -e "${YELLOW}[4/4] Creating encrypted backup...${NC}"
BACKUP_FILE="secrets-backup-$(date +%Y%m%d-%H%M%S).tar.gz.enc"

# Create backup with timestamp
tar -czf - azure/.env.azure | openssl enc -aes-256-cbc -salt -pass pass:"ALA-Backup-$(date +%Y)" -out "$BACKUP_FILE"

if [ -f "$BACKUP_FILE" ]; then
    echo -e "${GREEN}✅ Encrypted backup created: $BACKUP_FILE${NC}"
    echo -e "${CYAN}Backup password: ALA-Backup-$(date +%Y)${NC}"
else
    echo -e "${YELLOW}⚠️  Backup creation failed, but continuing...${NC}"
fi

echo ""
echo -e "${GREEN}==================================================================${NC}"
echo -e "${GREEN}🎉 Secrets Setup Complete!${NC}"
echo -e "${GREEN}==================================================================${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo -e "1. Edit azure/.env.azure to add your Priority API credentials:"
echo -e "   ${CYAN}nano azure/.env.azure${NC}"
echo -e ""
echo -e "2. Look for these lines and replace with your real values:"
echo -e "   ${CYAN}PRIORITY_USERNAME=REPLACE_WITH_YOUR_PRIORITY_USERNAME${NC}"
echo -e "   ${CYAN}PRIORITY_PASSWORD=REPLACE_WITH_YOUR_PRIORITY_PASSWORD${NC}"
echo -e ""
echo -e "3. Deploy the application:"
echo -e "   ${CYAN}sudo docker-compose -f azure/docker-compose.azure.yml up -d --build${NC}"
echo -e ""
echo -e "4. For future updates, use:"
echo -e "   ${CYAN}~/deploy.sh${NC}"
echo ""
echo -e "${YELLOW}⚠️  Important Security Notes:${NC}"
echo -e "   • Never commit azure/.env.azure to Git"
echo -e "   • Store the backup file and password separately"
echo -e "   • The generated passwords are cryptographically secure"
echo -e "   • Database password: $DB_PASSWORD"
echo ""