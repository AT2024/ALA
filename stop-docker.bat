@REM @echo off
@REM echo Accountability Log Application Docker Shutdown
@REM echo =============================================
@REM echo.
@REM echo Please select which environment to stop:
@REM echo.
@REM echo 1) Development Environment
@REM echo 2) Production Environment
@REM echo 3) Stop ALL running environments
@REM echo.

@REM choice /c 123 /n /m "Enter your choice (1, 2, or 3): "

@REM if errorlevel 3 (
@REM     echo.
@REM     echo Stopping ALL environments...
@REM     docker-compose -f docker-compose.dev.yml down
@REM     docker-compose -f docker-compose.prod.yml down
@REM     echo All environments stopped successfully.
@REM ) else if errorlevel 2 (
@REM     echo.
@REM     echo Stopping Production Environment...
@REM     docker-compose -f docker-compose.prod.yml down
@REM     echo Production environment stopped successfully.
@REM ) else (
@REM     echo.
@REM     echo Stopping Development Environment...
@REM     docker-compose -f docker-compose.dev.yml down
@REM     echo Development environment stopped successfully.
@REM )

@REM echo.
@REM pause
