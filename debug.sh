#!/bin/bash

echo "Running ALA Application Debug Script..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
  echo "Error: Node.js is not installed or not in PATH"
  echo "Please install Node.js and try again"
  exit 1
fi

# Create logs directory if it doesn't exist
mkdir -p logs

# Install axios if not already installed
echo "Checking for required packages..."
if ! npm list axios --json &> /dev/null; then
  echo "Installing axios package..."
  npm install axios --no-save
fi

// Run the debug script
echo "Starting debug checks..."
node scripts/debug.js

echo ""
echo "Debug complete. Log file created at logs/debug.log"
echo ""
echo "NEXT STEPS:"
echo "1. Check the Docker containers are running:  docker ps"
echo "2. View container logs:                     docker-compose -f docker-compose.dev.yml logs -f"
echo "3. Access frontend at:                      http://localhost:3000"
echo "4. Check backend health at:                 http://localhost:5000/api/health"
echo ""

# Make the script executable
chmod +x debug.sh
