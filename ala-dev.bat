@echo off
setlocal enabledelayedexpansion

echo =====================================================
echo    Accountability Log Application (ALA) Dev Tools
echo =====================================================
echo.

:menu
cls
echo Choose an option:
echo.
echo [1] Start Development Environment
echo [2] Stop Development Environment
echo [3] Restart Development Environment
echo [4] View Logs
echo [5] Run Diagnostics
echo [6] Open Application in Browser
echo [0] Exit
echo.
set /p choice="Enter your choice (0-6): "

if "%choice%"=="1" goto start
if "%choice%"=="2" goto stop
if "%choice%"=="3" goto restart
if "%choice%"=="4" goto logs
if "%choice%"=="5" goto diagnostics
if "%choice%"=="6" goto openapp
if "%choice%"=="0" goto end

echo Invalid choice! Please try again.
timeout /t 2 >nul
goto menu

:start
echo.
echo Starting development environment...
echo.
docker-compose -f docker-compose.dev.yml up -d --build
echo.
echo Development environment started!
echo.
echo Frontend: http://localhost:3000
echo Backend API: http://localhost:5000
echo.
pause
goto menu

:stop
echo.
echo Stopping development environment...
echo.
docker-compose -f docker-compose.dev.yml down
echo.
echo Development environment stopped.
echo.
pause
goto menu

:restart
echo.
echo Restarting development environment...
echo.
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml up -d
echo.
echo Development environment restarted!
echo.
pause
goto menu

:logs
echo.
echo Viewing logs (press Ctrl+C to return to menu)...
echo.
docker-compose -f docker-compose.dev.yml logs -f
goto menu

:diagnostics
echo.
echo Running system diagnostics...
echo.

:: Check if Node.js is installed
node --version >nul 2>&1
if !ERRORLEVEL! NEQ 0 (
  echo ERROR: Node.js is not installed or not in PATH
  echo Please install Node.js and try again
) else (
  echo Node.js is installed and in PATH
)

:: Check if Docker is installed
docker --version >nul 2>&1
if !ERRORLEVEL! NEQ 0 (
  echo ERROR: Docker is not installed or not in PATH
  echo Please install Docker Desktop and try again
) else (
  echo Docker is installed and in PATH
)

:: Check if Docker Compose is installed
docker-compose --version >nul 2>&1
if !ERRORLEVEL! NEQ 0 (
  echo ERROR: Docker Compose is not installed or not in PATH
  echo Please ensure Docker Compose is installed with Docker Desktop
) else (
  echo Docker Compose is installed and in PATH
)

:: Check if containers are running
echo.
echo Current container status:
docker-compose -f docker-compose.dev.yml ps

:: Check backend health
echo.
echo Checking backend API health...
curl -s http://localhost:5000/api/health || echo Backend API is not responding

echo.
echo Diagnostics complete!
echo.
pause
goto menu

:openapp
echo.
echo Opening application in browser...
start "" http://localhost:3000
goto menu

:end
echo.
echo Exiting ALA Dev Tools...
echo.
endlocal
exit /b
