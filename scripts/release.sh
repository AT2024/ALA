#!/bin/bash
# Script to promote code from develop to main (production)
# Usage: ./release.sh [version]

set -e

# Optional version parameter
VERSION=$1
if [ -z "$VERSION" ]; then
  VERSION=$(date "+%Y.%m.%d")
fi

echo "Preparing release version $VERSION..."

# Make sure develop branch is up to date
git checkout develop
git pull origin develop

# Run tests
echo "Running tests on develop branch..."
cd ../backend && npm test
cd ../frontend && npm test
cd ../scripts

# If tests pass, switch to main and merge
git checkout main
git pull origin main

echo "Merging develop into main..."
git merge develop

# Create a version tag
echo "Creating version tag v$VERSION..."
git tag -a "v$VERSION" -m "Release version $VERSION"

# Push changes
echo "Pushing changes to remote repository..."
git push origin main
git push origin "v$VERSION"

echo "Release v$VERSION successfully created and pushed to main."
echo "The production deployment workflow should start automatically."
echo "Don't forget to switch back to the develop branch with: git checkout develop"
