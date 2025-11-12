# ALA Application - Azure VM Production Deployment Guide

⚠️ **DEPRECATED - October 2025**

**This documentation is DEPRECATED.** The deployment system has been radically simplified.

**For current deployment instructions, see:**
- [deployment/README.md](../README.md) - Current deployment guide
- [deployment/deploy](../deploy) - Simplified deployment script

**To deploy now:**
```bash
ssh azureuser@20.217.84.100 "cd ~/ala-improved/deployment && ./deploy"
```

---

## Legacy Documentation (Archived)

The content below describes the OLD deployment system and is preserved for historical reference only.

## 🚀 Quick Start (First Time Setup)

This guide explains the **correct production approach** for deploying the ALA medical application to Azure VM.

## 🎯 Architecture & Security Model

```
Development → Git Push → Azure VM → Secure Deployment
     ↓              ↓           ↓
Local .env → Template → Production Secrets (never in Git)
```

### Security Principles:
- ✅ **Template in Git** - Contains placeholders only
- ✅ **Secrets on VM** - Generated securely, never committed
- ✅ **Backup Strategy** - Encrypted backups with recovery
- ✅ **Smart Updates** - Code changes without losing secrets

## 📋 Prerequisites

- SSH access to Azure VM (`azureuser@20.217.84.100`)
- GitHub repository: https://github.com/AT2024/ALA
- Basic understanding of Docker and environment variables

## 🚀 Initial Setup (One-time)

### Step 1: VM Preparation
```bash
# SSH to your Azure VM
ssh azureuser@20.217.84.100

# Run the VM initial setup (installs Docker, Git, etc.)
bash vm-initial-setup.sh
```

### Step 2: Generate Production Secrets
```bash
# Navigate to project directory
cd ~/ala-improved

# Generate secure production secrets
bash azure/setup-secrets.sh
```

This creates:
- Cryptographically secure database password
- Strong JWT secret for authentication
- Encrypted backup of secrets
- Production-ready `.env.azure` file

### Step 3: Add Priority API Credentials
```bash
# Edit the environment file
nano azure/.env.azure

# Replace these lines with your real Priority credentials:
# PRIORITY_USERNAME=REPLACE_WITH_YOUR_PRIORITY_USERNAME
# PRIORITY_PASSWORD=REPLACE_WITH_YOUR_PRIORITY_PASSWORD
```

### Step 4: Deploy Application
```bash
# Deploy the application
sudo docker-compose -f azure/docker-compose.azure.yml up -d --build

# Verify deployment
sudo docker ps
```

## 🔄 Updates & Maintenance

## Updating the Application

### Method 1: Manual Update
SSH to the VM and run:
```bash
~/deploy.sh
```

### Method 2: Automatic GitHub Actions
Push to `main` or `azure-development` branch, and GitHub Actions will automatically deploy.

## Useful Commands

### View logs
```bash
sudo docker-compose -f azure/docker-compose.azure.yml logs -f
```

### Restart containers
```bash
sudo docker-compose -f azure/docker-compose.azure.yml restart
```

### Check container status
```bash
sudo docker ps
```

### Stop application
```bash
sudo docker-compose -f azure/docker-compose.azure.yml down
```

## Access Points

- **Frontend**: http://20.217.84.100:3000
- **Backend API**: http://20.217.84.100:5000
- **Health Check**: http://20.217.84.100:5000/api/health

## Security Notes

- Never commit `.env.azure` to Git
- Secrets are generated automatically during setup
- Firewall allows only ports 22 (SSH), 3000 (Frontend), 5000 (Backend)
- All containers run as non-root user (UID 1001)

## Troubleshooting

### Containers not starting
```bash
# Check logs
sudo docker-compose -f azure/docker-compose.azure.yml logs

# Check disk space
df -h

# Restart Docker
sudo systemctl restart docker
```

### Cannot connect from phone/browser
1. Verify firewall rules: `sudo ufw status`
2. Check if containers are running: `sudo docker ps`
3. Test locally on VM: `curl http://localhost:3000`

### Database issues
```bash
# Connect to database
sudo docker exec -it ala-db-azure psql -U ala_user -d ala_production

# Backup database
sudo docker exec ala-db-azure pg_dump -U ala_user ala_production > backup.sql
```

## GitHub Actions Setup

To enable automatic deployment:

1. Go to GitHub repository settings
2. Add these secrets:
   - `AZURE_VM_HOST`: 20.217.84.100
   - `AZURE_VM_USERNAME`: azureuser
   - `AZURE_VM_SSH_KEY`: Your private SSH key

## Maintenance

### Daily backups
Create a cron job for automatic backups:
```bash
crontab -e
# Add: 0 2 * * * docker exec ala-db-azure pg_dump -U ala_user ala_production > ~/backups/db_$(date +\%Y\%m\%d).sql
```

### Update system
```bash
sudo apt update && sudo apt upgrade -y
sudo reboot  # if kernel was updated
```

## Support

For issues or questions, check the main project documentation or create an issue on GitHub.