@REM @echo off
@REM echo Accountability Log Application Docker Launcher
@REM echo =============================================
@REM echo.
@REM echo Please select an environment to launch:
@REM echo.
@REM echo 1) Development (Hot-reloading, source mounted, for active development)
@REM echo 2) Production (Optimized build, for testing production deployment)
@REM echo.

@REM set /p choice=Enter your choice (1 or 2): 

@REM if "%choice%"=="1" (
@REM     echo.
@REM     echo Starting Development Environment...
@REM     docker-compose -f docker-compose.dev.yml up -d --build
@REM     echo Development environment started!
@REM     echo Frontend: http://localhost:3000
@REM     echo Backend API: http://localhost:5000
@REM     echo.
@REM     echo Press any key to view logs ^(Ctrl^+C to exit logs^)
@REM     pause > nul
@REM     docker-compose -f docker-compose.dev.yml logs -f
@REM     goto :eof
@REM )

@REM if "%choice%"=="2" (
@REM     echo.
@REM     echo Starting Production Environment...
@REM     docker-compose -f docker-compose.prod.yml up -d --build
@REM     echo Production environment started!
@REM     echo Frontend: http://localhost
@REM     echo Backend API: http://localhost:5000
@REM     echo.
@REM     echo Press any key to view logs ^(Ctrl^+C to exit logs^)
@REM     pause > nul
@REM     docker-compose -f docker-compose.prod.yml logs -f
@REM     goto :eof
@REM )

@REM echo.
@REM echo Invalid choice. Please run the script again and select 1 or 2.
@REM pause
@REM call "%~f0"
