@echo off
REM Script to promote code from develop to main (production)
REM Usage: release.bat [version]

REM Optional version parameter
set VERSION=%~1
if "%VERSION%"=="" (
  for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (
    set VERSION=%%c.%%a.%%b
  )
)

echo Preparing release version %VERSION%...

REM Make sure develop branch is up to date
git checkout develop
git pull origin develop

REM Run tests
echo Running tests on develop branch...
cd ..\backend && npm test
cd ..\frontend && npm test
cd ..\scripts

REM If tests pass, switch to main and merge
git checkout main
git pull origin main

echo Merging develop into main...
git merge develop

REM Create a version tag
echo Creating version tag v%VERSION%...
git tag -a "v%VERSION%" -m "Release version %VERSION%"

REM Push changes
echo Pushing changes to remote repository...
git push origin main
git push origin "v%VERSION%"

echo Release v%VERSION% successfully created and pushed to main.
echo The production deployment workflow should start automatically.
echo Don't forget to switch back to the develop branch with: git checkout develop
