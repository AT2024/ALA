@echo off
REM Script to create a new feature branch from develop
REM Usage: new-feature.bat feature-name

if "%~1"=="" (
  echo Error: You must provide a feature name!
  echo Usage: new-feature.bat feature-name
  exit /b 1
)

set FEATURE_NAME=%~1

REM Make sure we're on the develop branch first
git checkout develop

REM Pull the latest changes from develop
git pull origin develop

REM Create and switch to the new feature branch
git checkout -b "feature/%FEATURE_NAME%"

echo Created and switched to branch 'feature/%FEATURE_NAME%'
echo Make your changes and then use: git add . ^&^& git commit -m "Description"
echo When ready, push with: git push -u origin feature/%FEATURE_NAME%
echo Then create a pull request from feature/%FEATURE_NAME% to develop
