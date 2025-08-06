# ALA Application - Docker Guide

## Quick Start

### Interactive Runner (Recommended)
```bash
# Start the interactive runner
node run.js
# or
npm start

# Follow the menu prompts:
# [1] Development Mode (with hot reload)
# [4] Production Mode (optimized)
# [7] Stop containers
# [11] View logs
```

### Direct Commands
```bash
# Development (default - simplified)
docker-compose up -d                    # Start development with hot reload
docker-compose logs -f                  # View logs

# Production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Management
docker-compose down                     # Stop containers
docker-compose down -v --remove-orphans # Clean everything
```

## Architecture

### Multi-Stage Dockerfiles
Both frontend and backend use optimized multi-stage builds:

**Backend** (`backend/Dockerfile`):
- `base`: Common Node.js Alpine setup
- `development`: Hot reload with nodemon/ts-node
- `build`: TypeScript compilation
- `production`: Optimized runtime

**Frontend** (`frontend/Dockerfile`):
- `base`: Common Node.js Alpine setup  
- `development`: Vite dev server with HMR
- `build`: Static asset compilation
- `production`: Nginx serving optimized assets

### Compose System (Simplified)
- **docker-compose.yml**: Development-focused configuration (default)
- **docker-compose.prod.yml**: Production overrides only

## Environment Configuration

### File Hierarchy
```
environments/
├── .env.docker          # Docker-specific config
├── .env.development     # Development settings
├── .env.production      # Production settings
├── .env.example         # Template
└── azure.env           # Azure deployment

.env.local              # Personal overrides (git-ignored)
```

### Loading Order
1. Docker Compose environment section (dev-focused)
2. `env_file` directives (docker + development)
3. Production overrides (when using prod compose file)
4. `.env.local` personal overrides

## Security Features

### Base Images
- **Node.js**: `node:20.19.2-alpine` (updated for security)
- **Nginx**: `nginx:1.27.3-alpine` (latest stable)
- Alpine Linux for minimal attack surface

### Container Security
- Non-root users (nodejs:1001, nginx-app:1001)
- Read-only filesystems where possible
- Minimal package installations
- Security update automation

### Network Security
- Internal Docker network isolation
- Database not exposed in production
- Health checks for all services

## Development Workflow

### Hot Reload Setup
```bash
# Start development environment
node run.js
# Choose option [1]

# Services available:
# Frontend: http://localhost:3000 (Vite HMR)
# Backend:  http://localhost:5000 (Nodemon)
# Database: localhost:5432 (direct access)
```

### Volume Mounts (Built-in)
Development mode (default) automatically mounts source code:
- `./backend:/usr/src/app` (API source with hot reload)
- `./frontend:/usr/src/app` (Frontend source with HMR)
- `node_modules` preserved in containers for performance

## Production Deployment

### Optimized Build
```bash
# Production deployment
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Features:
# - Multi-stage optimized builds
# - No source code mounts (immutable)
# - Nginx static file serving
# - Database port not exposed
# - Production environment variables
```

### Resource Optimization
- **Frontend**: Static files served by Nginx
- **Backend**: Compiled JavaScript (no TypeScript runtime)
- **Database**: Persistent volumes with health checks
- **Logging**: Structured production logs

## Monitoring & Debugging

### Health Checks
All services have health checks:
- **API**: `GET /api/health`
- **Frontend**: HTTP availability check
- **Database**: `pg_isready` connection test

### Log Management
```bash
# View all logs
docker-compose logs -f

# Service-specific logs
docker-compose logs -f api        # Backend only
docker-compose logs -f frontend   # Frontend only
docker-compose logs -f db         # Database only

# Recent logs
docker-compose logs --tail=50
```

### Container Access
```bash
# Backend shell
docker-compose exec api sh

# Database access
docker-compose exec db psql -U postgres -d ala_db

# Frontend container (production)
docker-compose exec frontend sh
```

## Troubleshooting

### Common Issues

**Port Conflicts**:
```bash
# Check what's using ports
sudo lsof -i :3000
sudo lsof -i :5000
sudo lsof -i :5432

# Stop conflicting services
docker-compose down
```

**Permission Issues**:
```bash
# Fix file permissions
sudo chown -R $USER:$USER .
```

**Build Failures**:
```bash
# Clean rebuild
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

**Database Connection Issues**:
```bash
# Reset database
docker-compose down -v
docker volume rm ala-postgres-data-dev
docker-compose up -d
```

### Performance Optimization

**Development**:
- Use `.dockerignore` to exclude unnecessary files
- Preserve `node_modules` volumes for faster rebuilds
- Enable BuildKit for faster builds: `DOCKER_BUILDKIT=1`

**Production**:
- Multi-stage builds minimize image size
- Alpine base images reduce attack surface
- Nginx serves static files efficiently
- Database uses persistent volumes

## Security Scanning

The project includes automated security scanning:
```bash
# Run security scan
node scripts/security-scan.js

# Manual Docker scan
docker scout cves ala-improved-api
docker scout cves ala-improved-frontend
```

## Backup & Recovery

### Database Backup
```bash
# Create backup
docker-compose exec db pg_dump -U postgres ala_db > backup.sql

# Restore backup
docker-compose exec -T db psql -U postgres ala_db < backup.sql
```

### Volume Management
```bash
# List volumes
docker volume ls | grep ala

# Backup volume
docker run --rm -v ala-postgres-data-prod:/data -v $(pwd):/backup alpine tar czf /backup/db-backup.tar.gz /data

# Restore volume
docker run --rm -v ala-postgres-data-prod:/data -v $(pwd):/backup alpine tar xzf /backup/db-backup.tar.gz -C /
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Docker Build
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build and test
        run: |
          docker-compose build
          docker-compose up -d
          # Run tests
          docker-compose down
```

### Deployment Pipeline
1. **Build**: Multi-stage Docker builds
2. **Test**: Automated testing in containers
3. **Scan**: Security vulnerability scanning
4. **Deploy**: Production deployment with overrides

---

## Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Node.js Docker Best Practices](https://nodejs.org/docs/latest/api/)
- [Nginx Configuration Guide](https://nginx.org/en/docs/)
- [Alpine Linux Security](https://alpinelinux.org/about/)

For help with the interactive runner: `node run.js` and choose option [q] for quit or [r] for refresh.