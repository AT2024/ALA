# HTTPS Setup Instructions for ALA Medical App

## Prerequisites
Before starting, you need to configure Azure DNS for your VM.

## Step 1: Configure Azure DNS in Azure Portal

1. **Open Azure Portal**: https://portal.azure.com
2. **Navigate to your VM**:
   - Find the VM with IP: `20.217.84.100`
   - It should be in the `ATM-ISR-Docker` resource group
3. **Configure DNS Name**:
   - Go to **Configuration** → **DNS name label**
   - Set DNS name label to: `ala-app`
   - Click **Save**
   - Your domain will be: `ala-app.israelcentral.cloudapp.azure.com`
4. **Wait 2-5 minutes** for DNS propagation

## Step 2: Transfer Setup Script to Azure VM

From your local machine, run:

```bash
# Copy the setup script to Azure VM
scp scripts/setup-azure-dns-https.sh azureuser@20.217.84.100:~/

# SSH into the Azure VM
ssh azureuser@20.217.84.100
```

## Step 3: Run the Setup Script

On the Azure VM, execute:

```bash
# Navigate to the project directory
cd ~/ala-improved

# Copy the setup script to scripts directory
cp ~/setup-azure-dns-https.sh scripts/

# Make it executable
chmod +x scripts/setup-azure-dns-https.sh

# Run the setup script
bash scripts/setup-azure-dns-https.sh
```

The script will:
- ✅ Verify DNS is configured correctly
- ✅ Install necessary dependencies
- ✅ Generate Let's Encrypt SSL certificates
- ✅ Update environment configuration
- ✅ Deploy the application with HTTPS
- ✅ Set up automatic certificate renewal

## Step 4: Verify the Setup

After the script completes, verify everything is working:

### Check in Browser:
1. Open: **https://ala-app.israelcentral.cloudapp.azure.com**
2. You should see:
   - 🔒 Green padlock (secure connection)
   - No certificate warnings
   - Login page loads correctly

### Check via Command Line (on VM):
```bash
# Check container status
docker ps

# Test API health
curl https://ala-app.israelcentral.cloudapp.azure.com/api/health

# Check certificate
openssl s_client -connect ala-app.israelcentral.cloudapp.azure.com:443 -servername ala-app.israelcentral.cloudapp.azure.com </dev/null 2>/dev/null | grep "Verify return code"
```

## Step 5: Update Frontend Configuration (if needed)

If the frontend still tries to connect to the IP address, we need to rebuild it:

```bash
# On the Azure VM
cd ~/ala-improved

# Force rebuild frontend with new configuration
docker-compose -f deployment/azure/docker-compose.https.azure.yml \
  --env-file deployment/azure/.env.azure.https \
  up -d --build frontend
```

## Troubleshooting

### DNS Not Resolving
```bash
# Check DNS resolution
nslookup ala-app.israelcentral.cloudapp.azure.com

# Should return: 20.217.84.100
```

### Certificate Issues
```bash
# Manually renew certificate
~/.acme.sh/acme.sh --renew -d ala-app.israelcentral.cloudapp.azure.com --force

# Check certificate details
openssl x509 -in ~/ala-improved/ssl-certs/certs/certificate.crt -text -noout
```

### Container Issues
```bash
# Check logs
docker logs ala-frontend-azure
docker logs ala-api-azure

# Restart containers
docker restart ala-frontend-azure ala-api-azure
```

## Rollback (if needed)

To revert to HTTP:
```bash
# On Azure VM
cd ~/ala-improved

# Use backup configuration
docker-compose -f deployment/azure/docker-compose.azure.yml \
  --env-file deployment/azure/.env.azure \
  up -d --build
```

## Success Indicators

✅ **DNS**: `ala-app.israelcentral.cloudapp.azure.com` resolves to `20.217.84.100`
✅ **HTTPS**: Browser shows secure connection with no warnings
✅ **API**: Health endpoint responds at `https://ala-app.israelcentral.cloudapp.azure.com/api/health`
✅ **Frontend**: Login page loads without console errors
✅ **Certificates**: Valid Let's Encrypt certificate installed
✅ **Auto-renewal**: Cron job configured for weekly renewal

## Final URLs

- **Frontend**: https://ala-app.israelcentral.cloudapp.azure.com
- **API Health**: https://ala-app.israelcentral.cloudapp.azure.com/api/health
- **Old HTTP Access** (will redirect): http://ala-app.israelcentral.cloudapp.azure.com

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review logs: `docker logs ala-frontend-azure`
3. Verify DNS propagation: https://www.whatsmydns.net/
4. The setup script creates backups - you can always rollback