# ✅ Azure VM Deployment Checklist

## 🎯 Goal: Get Your Phone Connected to http://20.217.84.100:3000

---

## Step 1: Stop Local Containers (Windows Machine)

**❌ STOP:** First, stop your local development containers to prevent conflicts.

**On your Windows machine:**
```cmd
cd C:\Users\amitaik\Desktop\ala-improved
azure\stop-local-containers.bat
```

**✅ Verify:** Local containers stopped
```cmd
docker ps
# Should show no ALA containers running locally
```

---

## Step 2: Configure Azure Firewall (Already Done!)

**✅ COMPLETED:** You already ran the NSG configuration script and confirmed:
- Port 3000 is reachable ✅
- Port 5000 is reachable ✅
- VM is running ✅

---

## Step 3: SSH into Azure VM

**Find your username first:**
```cmd
# Try common usernames:
ssh azureuser@20.217.84.100
# OR
ssh adminuser@20.217.84.100
# OR
ssh ubuntu@20.217.84.100
```

**✅ Verify:** Successfully connected to VM
```bash
# You should see something like:
azureuser@ALAapp:~$ 
```

---

## Step 4: Deploy Application on Azure VM

**Once SSH'd into the VM, run:**
```bash
# Make script executable
chmod +x azure/deploy-on-azure-vm.sh

# Run deployment script
./azure/deploy-on-azure-vm.sh
```

**OR deploy manually:**
```bash
# Find your project directory
cd /path/to/ala-improved

# Deploy containers
docker-compose -f azure/docker-compose.azure.yml down
docker-compose -f azure/docker-compose.azure.yml up -d --build
```

**✅ Verify:** Containers running on Azure VM
```bash
docker ps
# Should show: ala-frontend-azure, ala-api-azure, ala-db-azure
```

---

## Step 5: Test Connectivity

### Test from Azure VM (locally):
```bash
curl -I http://localhost:3000
curl -I http://localhost:5000
# Should return HTTP/1.1 200 OK responses
```

### Test from your phone:
- Open browser on phone
- Navigate to: **http://20.217.84.100:3000**
- Should load the ALA application interface

**✅ Verify:** Phone can access the application

---

## 🔍 Troubleshooting Checklist

### ❌ Problem: "Cannot SSH to VM"
**Solutions:**
- [ ] Check if VM is running in Azure Portal
- [ ] Try different usernames: `azureuser`, `adminuser`, `ubuntu`
- [ ] Check NSG allows SSH (port 22)
- [ ] Use PuTTY if Windows SSH doesn't work

### ❌ Problem: "Containers won't start"
**Check:**
```bash
# View container logs
docker-compose -f azure/docker-compose.azure.yml logs

# Check Docker service
sudo systemctl status docker

# Check disk space
df -h
```

### ❌ Problem: "Phone still can't connect"
**Verify:**
```bash
# From Azure VM - check if containers are running
docker ps | grep ala

# Test ports are bound
netstat -tlnp | grep -E ":(3000|5000)"

# Check from outside the VM
curl -I http://20.217.84.100:3000
```

### ❌ Problem: "Frontend loads but shows 'Cannot connect to server'"
**Fix:**
```bash
# Check backend is running
curl http://localhost:5000/api/health

# Restart containers
docker-compose -f azure/docker-compose.azure.yml restart

# Check environment variables
grep VITE_API_URL azure/.env.azure
```

---

## 📋 Final Verification Checklist

- [ ] **Local containers stopped** (on Windows machine)
- [ ] **SSH connection working** to 20.217.84.100
- [ ] **Project directory found** on Azure VM
- [ ] **Docker containers running** on Azure VM:
  - [ ] ala-frontend-azure (port 3000)
  - [ ] ala-api-azure (port 5000)  
  - [ ] ala-db-azure (port 5432)
- [ ] **Local connectivity working** on VM:
  - [ ] `curl http://localhost:3000` returns 200 OK
  - [ ] `curl http://localhost:5000` returns response
- [ ] **External connectivity working**:
  - [ ] Phone browser can load http://20.217.84.100:3000
  - [ ] Application interface appears
  - [ ] No "Cannot connect to server" errors

---

## 🎉 Success Criteria

✅ **Your phone shows the ALA application interface when visiting http://20.217.84.100:3000**

✅ **The application can connect to the backend API (no "server connection" errors)**

✅ **All containers are running on the Azure VM, not locally**

---

## 📞 Quick Commands Reference

### On Windows (before SSH):
```cmd
azure\stop-local-containers.bat
ssh azureuser@20.217.84.100
```

### On Azure VM (after SSH):
```bash
./azure/deploy-on-azure-vm.sh
docker ps
curl http://localhost:3000
```

### Testing URLs:
- **From phone**: http://20.217.84.100:3000
- **From VM**: http://localhost:3000
- **API health**: http://20.217.84.100:5000

Remember: The key is that containers must run **ON the Azure VM**, not on your local Windows machine!