#!/bin/bash
# Script to create a new feature branch from develop
# Usage: ./new-feature.sh feature-name

set -e

# Check if feature name was provided
if [ -z "$1" ]; then
  echo "Error: You must provide a feature name!"
  echo "Usage: ./new-feature.sh feature-name"
  exit 1
fi

FEATURE_NAME=$1

# Make sure we're on the develop branch first
git checkout develop

# Pull the latest changes from develop
git pull origin develop

# Create and switch to the new feature branch
git checkout -b "feature/$FEATURE_NAME"

echo "Created and switched to branch 'feature/$FEATURE_NAME'"
echo "Make your changes and then use: git add . && git commit -m 'Description'"
echo "When ready, push with: git push -u origin feature/$FEATURE_NAME"
echo "Then create a pull request from feature/$FEATURE_NAME to develop"
