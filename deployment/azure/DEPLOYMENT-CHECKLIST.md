# ✅ Azure VM Deployment Checklist

## 🎯 Goal: Deploy ALA Application to Azure VM (20.217.84.100)

---

## Prerequisites
- [ ] SSH access to Azure VM (username: azureuser)
- [ ] Deployment files synced to VM
- [ ] .env.azure configured with secrets

---

## Step 1: Prepare Local Environment

**Stop local containers to free ports:**
```cmd
cd C:\Users\amitaik\Desktop\ala-improved
docker-compose down
```

**✅ Verify:** No ALA containers running locally
```cmd
docker ps | grep ala
# Should return nothing
```

---

## Step 2: SSH to Azure VM

```cmd
ssh azureuser@20.217.84.100
```

**✅ Verify:** Successfully connected to VM
```bash
# You should see:
azureuser@ALAapp:~$
```

---

## Step 3: Deploy Using Correct Scripts

### Option A: Automated Deployment (RECOMMENDED)
```bash
cd ~/ala-improved
~/ala-improved/deployment/scripts/deploy.sh
```

### Option B: Recovery Script (If containers fail)
```bash
~/ala-improved/deployment/azure/recover.sh
```

### Option C: Manual Deployment
```bash
cd ~/ala-improved

# CRITICAL: Create infrastructure first
docker network create azure_ala-network 2>/dev/null || true
docker volume create azure_ala-postgres-data-prod 2>/dev/null || true

# Deploy with correct paths
docker-compose -f deployment/azure/docker-compose.azure.yml \
  --env-file deployment/azure/.env.azure up -d --build
```

**✅ Verify:** Containers running on Azure VM
```bash
docker ps --format 'table {{.Names}}\t{{.Status}}'
# Should show: ala-frontend-azure, ala-api-azure, ala-db-azure (all healthy)
```

---

## Step 4: Test Connectivity

### Test from Azure VM (locally):
```bash
# API health check
curl http://localhost:5000/api/health
# Should return: {"status":"ok","databaseConnected":true}

# Frontend check
curl -I http://localhost:3000
# Should return: HTTP/1.1 200 OK
```

### Test from external (phone/browser):
- Open browser and navigate to: **http://20.217.84.100:3000**
- Should load the ALA application interface

**✅ Verify:** Phone can access the application without "Cannot connect to server" errors

---

## 🚨 Common Issues & Quick Fixes

### ❌ Database Container Missing (MOST COMMON ISSUE)
**Symptoms:** API shows "databaseConnected":false, authentication fails
**Solution:**
```bash
# Recreate database with proper network alias
docker run -d \
  --name ala-db-azure \
  --network azure_ala-network \
  --network-alias db \
  -v azure_ala-postgres-data-prod:/var/lib/postgresql/data \
  -e POSTGRES_DB=ala_production \
  -e POSTGRES_USER=ala_user \
  -e POSTGRES_PASSWORD=AzureProd2024! \
  -p 5432:5432 \
  --restart=unless-stopped \
  postgres:16.6-alpine

# Then restart API to reconnect
docker restart ala-api-azure
```

### ❌ Script Line Ending Errors
**Symptoms:** "bad interpreter: /bin/bash^M"
**Solution:**
```bash
# Fix Windows line endings
sed -i 's/\r$//' ~/ala-improved/deployment/scripts/*.sh ~/ala-improved/deployment/azure/*.sh
```

### ❌ Containers Won't Build
**Check:** Build context paths in docker-compose.azure.yml
```bash
# Should be: context: ../../backend (NOT ../backend)
# Should be: context: ../../frontend (NOT ../frontend)
```

### ❌ Network/Volume Errors
```bash
# Create missing infrastructure
docker network create azure_ala-network 2>/dev/null || true
docker volume create azure_ala-postgres-data-prod 2>/dev/null || true
```

### ❌ Frontend Shows "Cannot connect to server"
```bash
# Check backend is healthy
curl http://localhost:5000/api/health

# Check environment variables
grep VITE_API_URL deployment/azure/.env.azure
# Should show: VITE_API_URL=http://20.217.84.100:5000/api

# Restart containers
docker-compose -f deployment/azure/docker-compose.azure.yml \
  --env-file deployment/azure/.env.azure restart
```

---

## Step 5: Enable Monitoring (Optional but Recommended)

```bash
# Start auto-recovery monitoring
nohup ~/ala-improved/deployment/scripts/monitor-auto.sh > monitor.log 2>&1 &

# Check monitoring status
tail -f monitor.log

# Verify monitoring is running
ps aux | grep monitor-auto
```

---

## 📋 Final Verification Checklist

- [ ] **Local containers stopped** (on Windows machine)
- [ ] **SSH connection working** to 20.217.84.100
- [ ] **Project directory found** at ~/ala-improved on Azure VM
- [ ] **Docker containers running** on Azure VM:
  - [ ] ala-frontend-azure (port 3000) - Status: healthy
  - [ ] ala-api-azure (port 5000) - Status: healthy
  - [ ] ala-db-azure (port 5432) - Status: healthy
- [ ] **Local connectivity working** on VM:
  - [ ] `curl http://localhost:5000/api/health` returns {"databaseConnected":true}
  - [ ] `curl http://localhost:3000` returns 200 OK
- [ ] **External connectivity working**:
  - [ ] Phone browser can load http://20.217.84.100:3000
  - [ ] Application interface appears correctly
  - [ ] No "Cannot connect to server" errors
  - [ ] Users can authenticate with Priority credentials

---

## 🎉 Success Criteria

✅ **Phone shows ALA application interface at http://20.217.84.100:3000**

✅ **Application connects to backend API successfully**

✅ **All containers healthy on Azure VM, none running locally**

✅ **Authentication works with Priority users (e.g., tamig@alphatau.com)**

---

## 📞 Quick Commands Reference

### On Windows (before SSH):
```cmd
docker-compose down
ssh azureuser@20.217.84.100
```

### On Azure VM (after SSH):
```bash
# Quick deployment
~/ala-improved/deployment/scripts/deploy.sh

# Check status
docker ps --format 'table {{.Names}}\t{{.Status}}'

# Test connectivity
curl http://localhost:5000/api/health
```

### Critical File Locations:
- **Deployment Config**: `~/ala-improved/deployment/azure/docker-compose.azure.yml`
- **Environment Secrets**: `~/ala-improved/deployment/azure/.env.azure`
- **Main Deploy Script**: `~/ala-improved/deployment/scripts/deploy.sh`
- **Recovery Script**: `~/ala-improved/deployment/azure/recover.sh`
- **Monitor Script**: `~/ala-improved/deployment/scripts/monitor-auto.sh`

### Testing URLs:
- **From phone/external**: http://20.217.84.100:3000
- **From VM (local)**: http://localhost:3000
- **API health check**: http://20.217.84.100:5000/api/health

---

## ⚠️ Remember

**The key is that containers must run ON the Azure VM, not on your local Windows machine!**

All paths use `deployment/azure/` structure, not the old `azure/` paths.