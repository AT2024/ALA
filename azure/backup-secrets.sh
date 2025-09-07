#!/bin/bash

# =================================================================
# ALA Azure VM Secrets Backup Script
# =================================================================
# Creates encrypted backups of your production secrets
# Usage: bash backup-secrets.sh

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}==================================================================${NC}"
echo -e "${BLUE}ALA Application - Secrets Backup${NC}"
echo -e "${BLUE}Creating encrypted backup of production secrets${NC}"
echo -e "${BLUE}==================================================================${NC}"

# Ensure we're in the right directory
cd ~/ala-improved

# Check if .env.azure exists
if [ ! -f "azure/.env.azure" ]; then
    echo -e "${RED}❌ Error: azure/.env.azure not found${NC}"
    echo -e "${YELLOW}No secrets to backup. Run setup-secrets.sh first.${NC}"
    exit 1
fi

# Create backup directory
BACKUP_DIR="backups"
if [ ! -d "$BACKUP_DIR" ]; then
    mkdir -p "$BACKUP_DIR"
    echo -e "${GREEN}✅ Created backup directory${NC}"
fi

# Generate backup filename with timestamp
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_NAME="ala-secrets-backup-$TIMESTAMP"
ENCRYPTED_FILE="$BACKUP_DIR/$BACKUP_NAME.tar.gz.enc"
CHECKSUM_FILE="$BACKUP_DIR/$BACKUP_NAME.sha256"

echo -e "${YELLOW}[1/5] Creating backup archive...${NC}"

# Create tar archive with secrets and related files
FILES_TO_BACKUP=(
    "azure/.env.azure"
    "azure/.env.azure.template"
    "azure/docker-compose.azure.yml"
)

# Check which files exist
EXISTING_FILES=()
for file in "${FILES_TO_BACKUP[@]}"; do
    if [ -f "$file" ]; then
        EXISTING_FILES+=("$file")
    fi
done

if [ ${#EXISTING_FILES[@]} -eq 0 ]; then
    echo -e "${RED}❌ No backup files found${NC}"
    exit 1
fi

# Create the archive
tar -czf "$BACKUP_DIR/$BACKUP_NAME.tar.gz" "${EXISTING_FILES[@]}"
echo -e "${GREEN}✅ Archive created: ${#EXISTING_FILES[@]} files${NC}"

echo -e "${YELLOW}[2/5] Encrypting backup...${NC}"

# Generate backup password
BACKUP_PASSWORD="ALA-Backup-$(date +%Y)-$(openssl rand -hex 4)"

# Encrypt the archive
openssl enc -aes-256-cbc -salt -in "$BACKUP_DIR/$BACKUP_NAME.tar.gz" -out "$ENCRYPTED_FILE" -pass pass:"$BACKUP_PASSWORD"

if [ -f "$ENCRYPTED_FILE" ]; then
    echo -e "${GREEN}✅ Backup encrypted${NC}"
    # Remove unencrypted archive
    rm "$BACKUP_DIR/$BACKUP_NAME.tar.gz"
else
    echo -e "${RED}❌ Encryption failed${NC}"
    exit 1
fi

echo -e "${YELLOW}[3/5] Generating checksum...${NC}"
# Create checksum for integrity verification
sha256sum "$ENCRYPTED_FILE" > "$CHECKSUM_FILE"
echo -e "${GREEN}✅ Checksum created${NC}"

echo -e "${YELLOW}[4/5] Verifying backup...${NC}"
# Verify the backup can be decrypted
TEST_DECRYPT=$(openssl enc -aes-256-cbc -d -in "$ENCRYPTED_FILE" -pass pass:"$BACKUP_PASSWORD" 2>/dev/null | head -c 10)
if [ -n "$TEST_DECRYPT" ]; then
    echo -e "${GREEN}✅ Backup verification successful${NC}"
else
    echo -e "${RED}❌ Backup verification failed${NC}"
    exit 1
fi

echo -e "${YELLOW}[5/5] Creating recovery instructions...${NC}"
# Create recovery instructions
RECOVERY_FILE="$BACKUP_DIR/$BACKUP_NAME-RECOVERY.txt"
cat > "$RECOVERY_FILE" << EOF
# ALA Secrets Recovery Instructions
# Generated: $(date)
# Backup: $ENCRYPTED_FILE

## Recovery Steps:

1. Decrypt the backup:
   openssl enc -aes-256-cbc -d -in "$ENCRYPTED_FILE" -out "restored.tar.gz" -pass pass:"$BACKUP_PASSWORD"

2. Extract the files:
   tar -xzf restored.tar.gz

3. Verify the restored .env.azure file:
   cat azure/.env.azure

4. Copy to production location:
   cp azure/.env.azure ~/ala-improved/azure/.env.azure

## Files in this backup:
$(echo "${EXISTING_FILES[@]}" | tr ' ' '\n')

## Verification:
Expected SHA256: $(cat "$CHECKSUM_FILE" | cut -d' ' -f1)

## Security Notes:
- This backup contains production secrets
- Store the password separately and securely
- Delete this file after copying the password to a secure location
- Backup password: $BACKUP_PASSWORD

## Backup Info:
- Date: $(date)
- Host: $(hostname)
- User: $(whoami)
- Size: $(ls -lh "$ENCRYPTED_FILE" | awk '{print $5}')
EOF

echo -e "${GREEN}✅ Recovery instructions created${NC}"

# Display summary
echo ""
echo -e "${GREEN}==================================================================${NC}"
echo -e "${GREEN}🎉 Backup Complete!${NC}"
echo -e "${GREEN}==================================================================${NC}"
echo ""
echo -e "${BLUE}Backup Details:${NC}"
echo -e "   Encrypted file: ${CYAN}$ENCRYPTED_FILE${NC}"
echo -e "   Recovery guide: ${CYAN}$RECOVERY_FILE${NC}"
echo -e "   File size: ${CYAN}$(ls -lh "$ENCRYPTED_FILE" | awk '{print $5}')${NC}"
echo -e "   Files backed up: ${CYAN}${#EXISTING_FILES[@]}${NC}"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT - Save this password securely:${NC}"
echo -e "${RED}   $BACKUP_PASSWORD${NC}"
echo ""
echo -e "${BLUE}Security Recommendations:${NC}"
echo -e "   • Store password in a different location than the backup"
echo -e "   • Copy backup file to external storage"
echo -e "   • Delete recovery file after saving the password"
echo -e "   • Test recovery process in development environment"
echo ""
echo -e "${BLUE}Cleanup old backups:${NC}"
echo -e "   ${CYAN}ls -la $BACKUP_DIR/${NC}"
echo -e "   ${CYAN}rm $BACKUP_DIR/old-backup-file.tar.gz.enc${NC}"
echo ""

# List existing backups
if [ "$(ls -1 "$BACKUP_DIR"/*.enc 2>/dev/null | wc -l)" -gt 1 ]; then
    echo -e "${YELLOW}Existing backups:${NC}"
    ls -lah "$BACKUP_DIR"/*.enc 2>/dev/null || true
    echo ""
fi

echo -e "${CYAN}Backup password (copy this): $BACKUP_PASSWORD${NC}"