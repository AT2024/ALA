# Quick Fix for HTTPS - Direct Commands

Run these commands directly in your SSH session:

## Step 1: Fix Line Endings (if needed)
```bash
sed -i 's/\r$//' ~/fix-https-deployment.sh
```

## Step 2: OR Run These Commands Directly

Copy and paste this entire block into your SSH session:

```bash
# Set domain
DOMAIN="ala-app.israelcentral.cloudapp.azure.com"

# Stop existing containers
cd ~/ala-improved
docker stop ala-frontend-azure ala-api-azure ala-db-azure
docker rm ala-frontend-azure ala-api-azure ala-db-azure

# Update the environment file
cat > ~/ala-improved/deployment/azure/.env.azure.https << EOF
# HTTPS Configuration
USE_HTTPS=true
DOMAIN=${DOMAIN}

# Backend Configuration
DATABASE_URL=postgresql://ala_user:AzureProd2024!@db:5432/ala_production
POSTGRES_PASSWORD=AzureProd2024!
PORT=5000
NODE_ENV=production
LOG_LEVEL=info

# JWT
JWT_SECRET=rN3kL9vZ8mQ7wX2cF6hS5dA1pU4yB0tE9rI8oP3qW7eN2mL6vK5jH4gF9dS8aX7cV1bN6mK9qR3wE8tY7uI2oP4lK3jH6gF5dS8aQ2wE7rT9yU1iO3pL6kJ4hG7fD9sA2xC5vB8nM1qW4eR7tY0uI3oP6lK9jH2gF5dS8aZ3xC6vB9nM2qW5eR8tY1uI4oP7lK0jH3gF6dS9aX4cV7bN2mQ5wE8rT1yU4iO7pL0kJ3hG6fD9sA5xC8vB1nM4qW7eR0tY3uI6oP9lK2jH5gF8dS1aX7cV0bN5mQ8wE1rT4yU7iO0pL3kJ6hG9fD2sA8xC1vB4nM7qW0eR3tY6uI9oP2lK5jH8gF1dS4aX0cV3bN8mQ1wE4rT7yU0iO3pL6kJ9hG2fD5sA1xC4vB7nM0qW3eR6tY9uI2oP5lK8jH1gF4dS7aX3cV6bN1mQ4wE7rT0yU3iO6pL9kJ2hG5fD8sA4xC7vB0nM3qW6eR9tY2uI5oP8lK1jH4gF7dS0aX6cV9bN4mQ7wE0rT3yU6iO9pL2kJ5hG8fD1sA7xC0vB3nM6qW9eR2tY5uI8oP1lK4jH7gF0dS3aX9cV2bN7mQ0wE3rT6yU9iO2pL5kJ8hG1fD4sA0xC3vB6nM9qW2eR5tY8uI1oP4lK7jH0gF3dS6aX2cV5bN0mQ3wE6rT9yU2iO5pL8kJ1hG4fD7sA3xC6vB9nM2qW5eR8tY1uI4oP7lK0jH3gF6dS9aX5cV8bN3mQ6wE9rT2yU5iO8pL1kJ4hG7fD0sA6xC9vB2nM5qW8eR1tY4uI7oP0lK3jH6gF9dS2aX8cV1bN6mQ9wE2rT5yU8iO1pL4kJ7hG0fD3sA9xC2vB5nM8qW1eR4tY7uI0oP3lK6jH9gF2dS5aX1cV4bN9mQ2wE5rT8yU1iO4pL7kJ0hG3fD6sA2xC5vB8nM1qW4eR7tY0uI3oP6lK9jH2gF5dS8aZ3xC6vB9nM2qW5eR8tY1uI4oP7lK0jH3gF6dS9aX
JWT_EXPIRES_IN=24h

# Priority Integration
PRIORITY_URL=https://t.eu.priority-connect.online/odata/Priority/tabbtbc6.ini/test24
PRIORITY_USERNAME=API
PRIORITY_PASSWORD=Ap@123456
ENABLE_PRIORITY_APPLICATOR_SAVE=true
SYNC_WITH_PRIORITY=true
PRIORITY_MOCK=false

# Frontend Configuration
VITE_API_URL=https://${DOMAIN}/api
VITE_PRIORITY_API_URL=https://t.eu.priority-connect.online/odata/Priority/tabbtbc6.ini/test24
VITE_ENVIRONMENT=production
VITE_USE_HTTPS=true
VITE_OFFLINE_STORAGE=true

# Security Settings
RATE_LIMIT_ENABLED=true
CORS_ORIGIN=https://${DOMAIN}
TRUST_PROXY=true
HSTS_ENABLED=true
EOF

# Deploy with Docker Compose V1 syntax
docker-compose -f ~/ala-improved/deployment/azure/docker-compose.https.azure.yml \
  --env-file ~/ala-improved/deployment/azure/.env.azure.https \
  up -d --build

# Wait for services to start
echo "Waiting for services to start..."
sleep 20

# Check status
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Test HTTPS
echo "Testing HTTPS..."
curl -I https://${DOMAIN}
```

## Step 3: Verify

After running the above commands, check:

1. **Browser**: Go to https://ala-app.israelcentral.cloudapp.azure.com
2. **API Health**: `curl https://ala-app.israelcentral.cloudapp.azure.com/api/health`

## If Still Issues

The problem might be with the nginx configuration. Run:

```bash
# Check frontend logs
docker logs ala-frontend-azure

# Check if nginx is listening on correct ports
docker exec ala-frontend-azure netstat -tlpn

# Rebuild just the frontend with correct build args
docker-compose -f ~/ala-improved/deployment/azure/docker-compose.https.azure.yml \
  build --build-arg VITE_API_URL=https://ala-app.israelcentral.cloudapp.azure.com/api \
  --build-arg VITE_USE_HTTPS=true \
  frontend

# Then restart
docker-compose -f ~/ala-improved/deployment/azure/docker-compose.https.azure.yml \
  --env-file ~/ala-improved/deployment/azure/.env.azure.https \
  up -d frontend
```