# Local Development Guide

## Quick Start

### Interactive Development Menu (Recommended)
```bash
npm run dev
```
This opens an interactive menu with options for:
- Starting all services
- Backend only
- Frontend only
- Database management
- Health checks

### Basic Commands
```bash
docker-compose up -d              # Start all services in background
docker-compose up -d --build      # Rebuild and start all services
docker-compose restart backend    # Restart backend service
docker-compose down              # Stop all services
```

## Development Workflow

### Backend Development
```bash
cd backend

# Development with hot reload
npm run dev

# Build TypeScript
npm run build

# Run linting with auto-fix
npm run lint

# Run tests
npm test

# Check TypeScript compilation
npm run type-check
```

### Frontend Development
```bash
cd frontend

# Start Vite development server
npm run dev

# Build for production
npm run build

# Run E2E tests with Playwright
npm run test:e2e

# Run unit tests
npm test

# Type checking
npm run type-check
```

### Database Management
```bash
# Access PostgreSQL CLI
docker exec -it postgres psql -U admin -d medical_app

# Reset database
docker-compose down -v
docker volume rm ala-improved_postgres-data
docker-compose up -d

# View database logs
docker-compose logs -f db
```

## Debugging Tools

### Unified Debug Tool
```bash
node scripts/debug-unified.js
```
Interactive menu for:
- Health checks
- Log viewing
- Container management
- Database queries
- API testing

### Quick Health Check
```bash
node scripts/debug-unified.js health
```

### Container Monitoring
```bash
# View all containers
docker ps

# Follow backend logs
docker-compose logs -f backend

# Follow frontend logs
docker-compose logs -f frontend

# View all logs
docker-compose logs -f
```

## Environment Configuration

### Environment Files
| File | Purpose | Location |
|------|---------|----------|
| `.env.docker` | Docker Compose variables | Root directory |
| `backend/.env` | Backend application config | backend/ |
| `frontend/.env` | Frontend application config | frontend/ |

### Test Users
| Email | Code | Purpose |
|-------|------|---------|
| `test@example.com` | `123456` | Development testing |
| `test@bypass.com` | Any code | Emergency bypass |
| `alexs@alphatau.com` | Via email | Production admin (Position 99) |

### API Endpoints (Local)
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- API Health: http://localhost:5000/api/health
- PostgreSQL: localhost:5432

## Common Development Tasks

### Adding a New Feature
1. Create UI components in `frontend/src/components/`
2. Add business logic in `backend/src/services/`
3. Create API endpoints in `backend/src/controllers/`
4. Update API client in `frontend/src/services/api.ts`
5. Add state management in `frontend/src/contexts/TreatmentContext.tsx` if needed

### Running Tests
```bash
# Backend tests
cd backend && npm test

# Frontend unit tests
cd frontend && npm test

# Frontend E2E tests
cd frontend && npm run test:e2e

# Run all tests
npm run test:all
```

### TypeScript Issues
```bash
# Fix TypeScript errors in backend
cd backend
rm -rf dist/ node_modules/.cache/
npm run build

# Fix TypeScript errors in frontend
cd frontend
rm -rf dist/ node_modules/.cache/
npm run build
```

## Troubleshooting

### Container Not Starting
```bash
# Complete reset
docker-compose down -v
docker system prune -f
docker-compose up -d --build
```

### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Find process using port 5000
lsof -i :5000  # macOS/Linux
netstat -ano | findstr :5000  # Windows

# Kill the process or change ports in .env.docker
```

### Database Connection Issues
```bash
# Check database is running
docker ps | grep postgres

# Check database logs
docker-compose logs db

# Restart database
docker-compose restart db

# Verify connection
docker exec -it postgres psql -U admin -d medical_app -c '\l'
```

### Backend Not Responding
```bash
# Check backend logs
docker-compose logs backend --tail=50

# Restart backend
docker-compose restart backend

# Rebuild backend
docker-compose up -d --build backend
```

### Frontend Build Issues
```bash
# Clear cache and rebuild
cd frontend
rm -rf node_modules dist .vite
npm install
npm run dev
```

## Development Best Practices

### Git Workflow
1. Always work on feature branches
2. Branch from `develop` for new features
3. Create PRs to `develop`, never directly to `main`
4. Run tests before committing

### Code Quality
1. Run linting before commits: `npm run lint`
2. Ensure TypeScript compiles: `npm run build`
3. Write tests for new features
4. Keep components small and focused

### Priority API Development
1. Always use test data for `test@example.com`
2. Log API calls with emoji indicators (🧪 Test, 🎯 Real, ❌ Error)
3. Validate reference chains for order data
4. Never mix test and production data

### Security Considerations
1. Never commit `.env` files
2. Use environment variables for sensitive data
3. Validate all user input
4. Sanitize data before database operations

## Useful Scripts

### Full Development Reset
```bash
#!/bin/bash
# Save as reset-dev.sh
docker-compose down -v
docker system prune -f
rm -rf backend/dist backend/node_modules/.cache
rm -rf frontend/dist frontend/node_modules/.cache
docker-compose up -d --build
echo "Development environment reset complete!"
```

### Quick Status Check
```bash
#!/bin/bash
# Save as status.sh
echo "=== Container Status ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo -e "\n=== API Health ==="
curl -s http://localhost:5000/api/health | jq .
echo -e "\n=== Recent Logs ==="
docker-compose logs --tail=5
```

## Additional Resources

- [Main README](../../README.md) - Project overview
- [API Reference](../API_REFERENCE.md) - Detailed API documentation
- [Priority Integration](../PRIORITY_INTEGRATION.md) - Priority ERP details
- [Troubleshooting](../TROUBLESHOOTING.md) - Extended troubleshooting guide