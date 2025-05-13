@echo off
REM Script to create a new hotfix branch from main
REM Usage: new-hotfix.bat hotfix-description

if "%~1"=="" (
  echo Error: You must provide a hotfix description!
  echo Usage: new-hotfix.bat hotfix-description
  exit /b 1
)

set HOTFIX_NAME=%~1

REM Make sure we're on the main branch first
git checkout main

REM Pull the latest changes from main
git pull origin main

REM Create and switch to the new hotfix branch
git checkout -b "hotfix/%HOTFIX_NAME%"

echo Created and switched to branch 'hotfix/%HOTFIX_NAME%'
echo Fix the issue and then use: git add . ^&^& git commit -m "Description"
echo When ready, push with: git push -u origin hotfix/%HOTFIX_NAME%
echo Then create a pull request from hotfix/%HOTFIX_NAME% to main
echo After merging to main, don't forget to merge back to develop:
echo git checkout develop ^&^& git pull ^&^& git merge hotfix/%HOTFIX_NAME% ^&^& git push
