#!/bin/bash

# =================================================================
# ALA Azure VM Initial Setup Script
# =================================================================
# Run this ONCE on a fresh Azure VM to set up the environment
# Usage: bash vm-initial-setup.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}==================================================================${NC}"
echo -e "${BLUE}ALA Application - Azure VM Initial Setup${NC}"
echo -e "${BLUE}This script will set up your Azure VM for production deployment${NC}"
echo -e "${BLUE}==================================================================${NC}"

# Step 1: Update system
echo -e "${YELLOW}[1/8] Updating system packages...${NC}"
sudo apt-get update
sudo apt-get upgrade -y

# Step 2: Install Docker
echo -e "${YELLOW}[2/8] Installing Docker...${NC}"
if ! command -v docker &> /dev/null; then
    sudo apt-get install -y docker.io
    sudo systemctl start docker
    sudo systemctl enable docker
    sudo usermod -aG docker $USER
    echo -e "${GREEN}✅ Docker installed${NC}"
else
    echo -e "${GREEN}✅ Docker already installed${NC}"
fi

# Step 3: Install Docker Compose
echo -e "${YELLOW}[3/8] Installing Docker Compose...${NC}"
if ! command -v docker-compose &> /dev/null; then
    sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}✅ Docker Compose installed${NC}"
else
    echo -e "${GREEN}✅ Docker Compose already installed${NC}"
fi

# Step 4: Install Git
echo -e "${YELLOW}[4/8] Installing Git...${NC}"
if ! command -v git &> /dev/null; then
    sudo apt-get install -y git
    echo -e "${GREEN}✅ Git installed${NC}"
else
    echo -e "${GREEN}✅ Git already installed${NC}"
fi

# Step 5: Clone repository
echo -e "${YELLOW}[5/8] Setting up project repository...${NC}"
cd ~
if [ ! -d "ala-improved" ]; then
    git clone https://github.com/AT2024/ALA.git ala-improved
    echo -e "${GREEN}✅ Repository cloned${NC}"
else
    echo -e "${YELLOW}Repository already exists, pulling latest changes...${NC}"
    cd ala-improved
    git pull origin main || git pull origin azure-development
fi

cd ~/ala-improved

# Step 6: Generate production secrets
echo -e "${YELLOW}[6/8] Generating production secrets...${NC}"
if [ ! -f "azure/.env.azure" ]; then
    cp azure/.env.azure.template azure/.env.azure
    
    # Generate secure JWT secret
    JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
    sed -i "s/JWT_SECRET=GENERATE_ME_WITH_OPENSSL/JWT_SECRET=$JWT_SECRET/" azure/.env.azure
    
    # Generate secure database password
    DB_PASSWORD=$(openssl rand -base64 32 | tr -d '\n' | tr -d '/' | tr -d '+')
    sed -i "s/POSTGRES_PASSWORD=CHANGE_ME/POSTGRES_PASSWORD=$DB_PASSWORD/" azure/.env.azure
    sed -i "s/ala_user:CHANGE_ME/ala_user:$DB_PASSWORD/" azure/.env.azure
    
    echo -e "${GREEN}✅ Secrets generated${NC}"
    echo -e "${YELLOW}⚠️  Please edit azure/.env.azure to add your Priority API credentials${NC}"
else
    echo -e "${YELLOW}⚠️  .env.azure already exists, skipping secret generation${NC}"
fi

# Step 7: Set up firewall rules (ufw)
echo -e "${YELLOW}[7/8] Configuring firewall...${NC}"
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 3000/tcp  # Frontend
sudo ufw allow 5000/tcp  # Backend
sudo ufw --force enable
echo -e "${GREEN}✅ Firewall configured${NC}"

# Step 8: Create deployment script
echo -e "${YELLOW}[8/8] Creating deployment script...${NC}"
cat > ~/deploy.sh << 'EOF'
#!/bin/bash
# Quick deployment script for updates
cd ~/ala-improved
git pull origin main || git pull origin azure-development
sudo docker-compose -f azure/docker-compose.azure.yml down
sudo docker-compose -f azure/docker-compose.azure.yml up -d --build
sudo docker ps
echo "Deployment complete! Check http://20.217.84.100:3000"
EOF
chmod +x ~/deploy.sh
echo -e "${GREEN}✅ Deployment script created at ~/deploy.sh${NC}"

echo ""
echo -e "${GREEN}==================================================================${NC}"
echo -e "${GREEN}🎉 Initial Setup Complete!${NC}"
echo -e "${GREEN}==================================================================${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo -e "1. Edit azure/.env.azure to add your Priority API credentials:"
echo -e "   ${CYAN}nano azure/.env.azure${NC}"
echo ""
echo -e "2. Deploy the application:"
echo -e "   ${CYAN}sudo docker-compose -f azure/docker-compose.azure.yml up -d --build${NC}"
echo ""
echo -e "3. Check if containers are running:"
echo -e "   ${CYAN}sudo docker ps${NC}"
echo ""
echo -e "4. For future updates, just run:"
echo -e "   ${CYAN}~/deploy.sh${NC}"
echo ""
echo -e "${YELLOW}⚠️  Note: You may need to log out and back in for docker group changes to take effect${NC}"