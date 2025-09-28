@echo off
REM =================================================================
REM Quick Deploy to Azure VM - Windows Helper
REM =================================================================
REM This script helps you deploy to Azure VM from Windows

title Quick Deploy to Azure VM

echo ==================================================================
echo ALA Application - Quick Deploy to Azure VM
echo ==================================================================
echo.
echo This will guide you through deploying to your Azure VM
echo VM IP: 20.217.84.100
echo.

echo Step 1: SSH to your Azure VM
echo ------------------------------
echo Run this command in a new terminal:
echo.
echo   ssh azureuser@20.217.84.100
echo.
echo If SSH doesn't work, you may need to reset the password:
echo   az vm user update --resource-group ATM-ISR-Docker --name ALAapp --username azureuser --password YourNewPassword123!
echo.
pause

echo.
echo Step 2: Once connected to the VM, run these commands:
echo ------------------------------------------------------
echo.
echo # Download and run the setup script (first time only):
echo curl -O https://raw.githubusercontent.com/AT2024/ALA/main/azure/vm-initial-setup.sh
echo bash vm-initial-setup.sh
echo.
echo # For updates, just run:
echo ~/deploy.sh
echo.
echo ------------------------------------------------------
echo.
echo Step 3: Test the deployment
echo ----------------------------
echo Open your browser or phone and go to:
echo   http://20.217.84.100:3000
echo.
pause

echo.
echo ==================================================================
echo Optional: Push your local changes to GitHub first
echo ==================================================================
echo.
echo If you have local changes, commit and push them:
echo.
echo   git add .
echo   git commit -m "Update application"
echo   git push origin main
echo.
echo Then the VM can pull these changes when you run deploy.sh
echo.
pause