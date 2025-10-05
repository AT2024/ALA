# Deploy Removal Logic Update to Azure

## Quick Deployment Steps

### 1. Connect to Azure VM
```bash
ssh azureuser@20.217.84.100
```

### 2. Navigate to Project Directory
```bash
cd ~/ala-improved
```

### 3. Pull Latest Changes
```bash
git fetch --all
git checkout develop
git pull origin develop
```

### 4. Verify Changes
```bash
# Check that you have the latest removal logic
git log --oneline -1
# Should show: "feat: Add removal logic with test data for Azure deployment"
```

### 5. Stop Current Containers
```bash
sudo docker-compose -f deployment/azure/docker-compose.https.azure.yml down
```

### 6. Rebuild and Deploy
```bash
sudo docker-compose -f deployment/azure/docker-compose.https.azure.yml \
  --env-file deployment/azure/.env.azure.https \
  up -d --build
```

### 7. Monitor Deployment
```bash
# Watch logs
sudo docker-compose -f deployment/azure/docker-compose.https.azure.yml logs -f

# Or check specific service
sudo docker-compose -f deployment/azure/docker-compose.https.azure.yml logs -f api
```

### 8. Verify Deployment

#### Check Health
```bash
curl https://ala-app.israelcentral.cloudapp.azure.com/api/health
```

#### Test Removal Feature
1. Open browser: https://ala-app.israelcentral.cloudapp.azure.com
2. Login with: test@example.com / 123456
3. Click "Seed Removal" option
4. You should see treatments:
   - SO25000017 - "Waiting for removal" (20 seeds)
   - SO25000018 - "Performed" (15 seeds)
   - SO25000019 - "Waiting for removal" (18 seeds)

## What's New in This Update

### Backend Changes
- ✅ Complete removal treatment endpoints
- ✅ Applicator removal logic
- ✅ Test data with removal treatments (SO25000017-19)
- ✅ Proper validation and error handling

### Frontend Changes
- ✅ SeedRemoval component updates
- ✅ Treatment context for removal state
- ✅ Removal workflow UI

### Test Data
Three removal treatments added:
- **SO25000017**: Main Test Hospital - 20 seeds (Ready for removal)
- **SO25000018**: Regional Medical Center - 15 seeds (Performed)
- **SO25000019**: City General Hospital - 18 seeds (Awaiting removal)

## Rollback Instructions (If Needed)

If issues occur, rollback to previous version:

```bash
# Connect to Azure
ssh azureuser@20.217.84.100
cd ~/ala-improved

# Checkout previous working version
git checkout v1.0-working-production-2025-09-10

# Rebuild with previous version
sudo docker-compose -f deployment/azure/docker-compose.https.azure.yml down
sudo docker-compose -f deployment/azure/docker-compose.https.azure.yml up -d --build
```

## Files NOT Deployed
These test scripts remain local only:
- test-removal-final.js
- test-removal-fix.js
- test-removal.sh

Keep them for local testing but they're not needed on Azure.

## Support

If you encounter issues:
1. Check logs: `sudo docker logs ala-api-azure`
2. Verify database: `sudo docker exec ala-db-azure psql -U ala_user -d ala_production -c '\dt'`
3. Test API directly: `curl http://localhost:5000/api/health`