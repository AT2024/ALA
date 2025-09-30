# Fix HTTPS Deployment - Quick Instructions

## The Problem
The HTTPS deployment failed because:
1. Nginx is running as non-root user and can't bind to ports 80/443
2. The frontend was built with IP address instead of domain
3. The nginx configuration needs to use non-privileged ports

## The Solution
I've created fixed configurations that:
- Use ports 8080/8443 internally (non-privileged)
- Map to 80/443 externally via Docker
- Use the correct domain name in all configurations

## Steps to Fix

### 1. Copy the Fixed Files to Azure VM

```bash
# From your Windows machine, copy the fixed files:

# Copy the nginx configuration
scp frontend/nginx.https.azure.conf azureuser@20.217.84.100:~/ala-improved/frontend/

# Copy the updated docker-compose
scp deployment/azure/docker-compose.https.azure.yml azureuser@20.217.84.100:~/ala-improved/deployment/azure/

# Copy the fix script
scp scripts/fix-https-deployment.sh azureuser@20.217.84.100:~/
```

### 2. SSH to the VM and Run the Fix

```bash
# SSH to VM
ssh azureuser@20.217.84.100

# Make the script executable
chmod +x ~/fix-https-deployment.sh

# Run the fix
cd ~/ala-improved
bash ~/fix-https-deployment.sh
```

## What the Fix Does

1. **Stops current containers**
2. **Updates configuration** to use the domain instead of IP
3. **Rebuilds frontend** with correct HTTPS settings
4. **Deploys with fixed nginx** configuration
5. **Verifies everything works**

## Expected Result

After running the fix, you should see:
- ✅ HTTPS frontend: OK
- ✅ API health: OK

Then you can access:
- **https://ala-app.israelcentral.cloudapp.azure.com**

## If Still Not Working

Check if Azure Network Security Group allows port 443:
1. Go to Azure Portal
2. Find your VM's Network Security Group
3. Add inbound rule for port 443 if missing

## Alternative Manual Fix

If the script doesn't work, manually on the VM:

```bash
# Stop containers
docker-compose -f ~/ala-improved/deployment/azure/docker-compose.https.azure.yml down

# Rebuild frontend with correct URL
docker-compose -f ~/ala-improved/deployment/azure/docker-compose.https.azure.yml \
  build --build-arg VITE_API_URL=https://ala-app.israelcentral.cloudapp.azure.com/api \
  --build-arg VITE_USE_HTTPS=true \
  --no-cache frontend

# Deploy
docker-compose -f ~/ala-improved/deployment/azure/docker-compose.https.azure.yml \
  --env-file ~/ala-improved/deployment/azure/.env.azure.https \
  up -d

# Check logs
docker logs ala-frontend-azure
```