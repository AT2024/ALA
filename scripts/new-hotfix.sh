#!/bin/bash
# Script to create a new hotfix branch from main
# Usage: ./new-hotfix.sh hotfix-description

set -e

# Check if hotfix description was provided
if [ -z "$1" ]; then
  echo "Error: You must provide a hotfix description!"
  echo "Usage: ./new-hotfix.sh hotfix-description"
  exit 1
fi

HOTFIX_NAME=$1

# Make sure we're on the main branch first
git checkout main

# Pull the latest changes from main
git pull origin main

# Create and switch to the new hotfix branch
git checkout -b "hotfix/$HOTFIX_NAME"

echo "Created and switched to branch 'hotfix/$HOTFIX_NAME'"
echo "Fix the issue and then use: git add . && git commit -m 'Description'"
echo "When ready, push with: git push -u origin hotfix/$HOTFIX_NAME"
echo "Then create a pull request from hotfix/$HOTFIX_NAME to main"
echo "After merging to main, don't forget to merge back to develop:"
echo "git checkout develop && git pull && git merge hotfix/$HOTFIX_NAME && git push"
