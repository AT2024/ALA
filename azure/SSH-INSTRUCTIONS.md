# 🔑 SSH Instructions for Windows - Connect to Azure VM

## 🎯 Your Azure VM Details:
- **IP Address**: 20.217.84.100
- **Resource Group**: ATM-ISR-Docker
- **VM Name**: ALAapp

## 🪟 SSH from Windows

### Option 1: Windows Terminal / Command Prompt
```cmd
ssh your_username@20.217.84.100
```

### Option 2: PowerShell
```powershell
ssh your_username@20.217.84.100
```

### Option 3: PuTTY (if SSH client not available)
1. Download PuTTY from: https://www.putty.org/
2. Open PuTTY
3. Host Name: `20.217.84.100`
4. Port: `22`
5. Connection Type: SSH
6. Click "Open"

## 🔐 SSH Authentication

### If you have SSH key:
```cmd
ssh -i path\to\your\private_key.pem your_username@20.217.84.100
```

### If you need password authentication:
The SSH command will prompt for your password.

## 🚨 Common SSH Issues & Solutions

### Issue: "Permission denied"
```cmd
# Try with explicit user
ssh azureuser@20.217.84.100

# Or try with admin user
ssh adminuser@20.217.84.100
```

### Issue: "Host key verification failed"
```cmd
# Remove old host key and try again
ssh-keygen -R 20.217.84.100
ssh your_username@20.217.84.100
```

### Issue: "Connection timed out"
- Check if VM is running in Azure Portal
- Verify NSG rules allow SSH (port 22)
- Try from different network

## 🔍 Find Your Username

### Method 1: Azure Portal
1. Go to portal.azure.com
2. Navigate to Virtual Machines → ALAapp
3. Go to "Reset password" section
4. Your username will be shown there

### Method 2: Azure CLI
```cmd
az vm show --resource-group ATM-ISR-Docker --name ALAapp --query "osProfile.adminUsername" --output tsv
```

### Method 3: Common default usernames
Try these common Azure VM usernames:
- `azureuser`
- `adminuser` 
- `ubuntu` (for Ubuntu VMs)
- `centos` (for CentOS VMs)

## ✅ Once Connected to Azure VM

After successful SSH connection, you'll see something like:
```
Welcome to Ubuntu 20.04.x LTS (GNU/Linux ...)
azureuser@ALAapp:~$ 
```

### Navigate to your project:
```bash
# Find your project directory
ls -la
find . -name "ala-improved" -type d
cd /path/to/ala-improved
```

### Check if Docker is installed:
```bash
docker --version
docker-compose --version
```

### Run the deployment:
```bash
# Make sure you're in the right directory
pwd
ls -la

# Deploy the application
docker-compose -f azure/docker-compose.azure.yml down
docker-compose -f azure/docker-compose.azure.yml up -d --build

# Check status
docker ps
```

## 📋 Complete SSH to Deployment Process

### Step 1: Stop Local Containers (on Windows)
```cmd
cd C:\Users\amitaik\Desktop\ala-improved
azure\stop-local-containers.bat
```

### Step 2: SSH to Azure VM
```cmd
ssh your_username@20.217.84.100
```

### Step 3: Deploy on VM
```bash
cd /path/to/ala-improved
docker-compose -f azure/docker-compose.azure.yml up -d --build
```

### Step 4: Test
```bash
# Test locally on VM
curl http://localhost:3000
curl http://localhost:5000

# Check container logs
docker-compose -f azure/docker-compose.azure.yml logs -f
```

### Step 5: Test from Phone
Open browser on phone: `http://20.217.84.100:3000`

## 🆘 SSH Troubleshooting Commands

```cmd
# Test if SSH port is open
telnet 20.217.84.100 22

# Test with verbose output
ssh -v your_username@20.217.84.100

# Test with specific key
ssh -i "path\to\key.pem" -v your_username@20.217.84.100
```

## 📞 If SSH Still Doesn't Work

1. **Check VM is running**: Azure Portal → Virtual Machines → ALAapp
2. **Check NSG rules**: Azure Portal → Network Security Groups → ALAapp-nsg
3. **Try VM Serial Console**: Available in Azure Portal as backup access method
4. **Reset VM password**: Use Azure Portal's "Reset password" feature

Remember: The goal is to get SSH access to your Azure VM so you can deploy the containers **on the VM**, not locally on your Windows machine!