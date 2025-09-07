# Azure VM Deployment Guide

## 🚀 Quick Start

This guide explains how to deploy the ALA application to Azure VM at `20.217.84.100`.

## Architecture

```
GitHub Repository → Azure VM (Git Pull) → Docker Compose → Live Application
```

## Prerequisites

- SSH access to Azure VM (`azureuser@20.217.84.100`)
- GitHub repository: https://github.com/AT2024/ALA

## Initial Setup (One-time)

### 1. SSH to Azure VM
```bash
ssh azureuser@20.217.84.100
```

### 2. Run Initial Setup Script
```bash
# Download and run the setup script
curl -O https://raw.githubusercontent.com/AT2024/ALA/main/azure/vm-initial-setup.sh
bash vm-initial-setup.sh
```

This script will:
- Install Docker and Docker Compose
- Clone the repository
- Generate secure secrets
- Configure firewall
- Create deployment scripts

### 3. Configure Secrets
Edit the environment file to add your Priority API credentials:
```bash
nano ~/ala-improved/azure/.env.azure
```

### 4. Deploy Application
```bash
cd ~/ala-improved
sudo docker-compose -f azure/docker-compose.azure.yml up -d --build
```

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