@echo off
setlocal enabledelayedexpansion

REM ALA Docker Security Scanner (Windows Version)
REM This script scans all ALA Docker images for security vulnerabilities

echo.
echo 🔍 ALA Docker Security Scanner
echo ==============================
echo.

REM Check if Trivy is installed
trivy --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Trivy is not installed. Please install it first:
    echo   choco install trivy
    exit /b 1
)

REM Create reports directory if it doesn't exist
if not exist "security-reports" mkdir security-reports

echo [INFO] Building Docker images...
docker-compose -f docker-compose.dev.yml build --no-cache

echo.
echo [INFO] Starting security scans...
echo.

set total_issues=0

REM Function to scan an image (simulated with goto)
call :scan_image "node:20.19.2-bookworm-slim" "nodejs-base"
call :scan_image "nginx:1.25.3-alpine3.18" "nginx-base"
call :scan_image "postgres:16.6-alpine" "postgres-base"
call :scan_image "ala-frontend-dev" "frontend"
call :scan_image "ala-api-dev" "backend"

echo.
echo [INFO] Security scan completed!

if !total_issues! equ 0 (
    echo [SUCCESS] All images passed security scans!
    exit /b 0
) else if !total_issues! lss 5 (
    echo [WARNING] Some images have vulnerabilities. Check reports in ./security-reports/
    exit /b 1
) else (
    echo [ERROR] Multiple critical vulnerabilities found! Immediate action required!
    exit /b 2
)

:scan_image
set image_name=%~1
set service_name=%~2

echo [INFO] Scanning %service_name% (%image_name%)...

REM Get current date for filename
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c%%a%%b)
set "mydate=%mydate: =%"

REM Run Trivy scan
trivy image --format table --severity HIGH,CRITICAL --output "./security-reports/%service_name%-scan-%mydate%.txt" %image_name%

REM Count vulnerabilities (simplified for Windows)
trivy image --format json --severity HIGH,CRITICAL %image_name% > temp_scan.json

REM Simple check for vulnerabilities (Windows doesn't have jq by default)
findstr /i "CRITICAL" temp_scan.json >nul
if not errorlevel 1 (
    echo [ERROR] %service_name% has CRITICAL vulnerabilities!
    set /a total_issues+=1
    goto :eof
)

findstr /i "HIGH" temp_scan.json >nul
if not errorlevel 1 (
    echo [WARNING] %service_name% has HIGH vulnerabilities
    set /a total_issues+=1
) else (
    echo [SUCCESS] %service_name% passed security scan!
)

del temp_scan.json >nul 2>&1
goto :eof
