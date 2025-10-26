# Blue-Green Deployment Guide

## Overview

This document describes the zero-downtime blue-green deployment system for the ALA Medical Application.

## What is Blue-Green Deployment?

Blue-green deployment is a release management strategy that reduces downtime and risk by running two identical production environments called "blue" and "green":

- **Blue Environment**: Currently active, serving all traffic
- **Green Environment**: Inactive, ready for new deployment
- **Nginx Proxy**: Sits in front, switches traffic between blue/green

When deploying:
1. Deploy new version to inactive environment (green)
2. Test green environment while blue serves traffic
3. Switch traffic from blue to green (zero downtime)
4. Blue becomes the new inactive environment

## Architecture

```
                    ┌─────────────────┐
                    │  Azure Load     │
                    │  Balancer       │
                    │  (ports 80/443) │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Nginx Proxy    │
                    │  (ala-proxy)    │
                    │  Traffic Switch │
                    └────────┬────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
   ┌──────▼──────┐    ┌──────▼──────┐         │
   │ Blue Env    │    │ Green Env   │         │
   │             │    │             │         │
   │ api-blue    │    │ api-green   │         │
   │ frontend-   │    │ frontend-   │         │
   │   blue      │    │   green     │         │
   └──────┬──────┘    └──────┬──────┘         │
          │                  │                 │
          └──────────────────┼─────────────────┘
                             │
                    ┌────────▼────────┐
                    │  PostgreSQL     │
                    │  (ala-db)       │
                    │  Shared DB      │
                    └─────────────────┘
```

### Key Components

1. **Nginx Reverse Proxy** (`ala-proxy`)
   - Always running
   - Handles SSL termination
   - Routes traffic to active environment (blue or green)
   - Zero-downtime traffic switching via config reload

2. **Blue Environment** (`api-blue`, `frontend-blue`)
   - Complete application stack
   - Either active (serving traffic) or standby

3. **Green Environment** (`api-green`, `frontend-green`)
   - Identical to blue
   - Either active (serving traffic) or standby

4. **Shared Database** (`ala-db`)
   - Single PostgreSQL instance
   - Used by both blue and green environments
   - Enables expand-contract migration pattern

## Quick Start

### First-Time Setup

1. **SSH to Azure VM**
   ```bash
   ssh azureuser@20.217.84.100
   cd ~/ala-improved/deployment
   ```

2. **Configure Environment**
   ```bash
   # Copy template and edit
   cp .env.production.template .env
   vim .env

   # Required variables:
   # - POSTGRES_PASSWORD
   # - JWT_SECRET
   # - PRIORITY_API_* credentials
   ```

3. **Initialize Blue-Green Deployment**
   ```bash
   ./init-bluegreen
   ```

   This will:
   - Start database and proxy
   - Deploy to blue environment
   - Run health checks
   - Activate blue environment
   - Create state file tracking active environment

### Normal Deployment

For all subsequent deployments:

```bash
cd ~/ala-improved/deployment
./deploy-zero-downtime
```

This will:
1. Determine current environment (e.g., blue is active)
2. Back up database
3. Pull latest code
4. Deploy to inactive environment (green)
5. Run health checks on green
6. Run smoke tests on green
7. Prompt to switch traffic
8. Switch traffic from blue to green (zero downtime)
9. Stop blue environment

**Result**: Green is now active, blue is stopped and ready for next deployment.

### Rollback

If issues are discovered after deployment:

```bash
./rollback
```

This will:
1. Start previous environment if not running
2. Run health checks
3. Switch traffic back (zero downtime)
4. Optionally stop failed environment

**Result**: Traffic instantly switched back to previous working version.

## Deployment Workflows

### Standard Deployment

```bash
# 1. Deploy (with confirmation)
./deploy-zero-downtime

# Output:
# [1/8] Determining deployment target...
# Current environment: blue
# Target environment: green
#
# [2/8] Backing up database... ✓
# [3/8] Pulling latest code... ✓
# [4/8] Building and starting green environment... ✓
# [5/8] Running health checks on green... ✓
# [6/8] Running smoke tests on green... ✓
# [7/8] Ready to switch traffic to green
#
# All tests passed!
# Switch traffic to green? [y/N]: y
#
# [8/8] Stopping blue environment... ✓
# ✓ Deployment Complete!
```

### Automated Deployment (CI/CD)

For fully automated deployments without confirmation:

```bash
./deploy-zero-downtime --auto-switch
```

### Skip Tests (Not Recommended)

Only for emergency deployments:

```bash
./deploy-zero-downtime --skip-tests --auto-switch
```

### Rollback

```bash
./rollback

# Output:
# [1/4] Determining rollback target...
# Current environment: green
# Rolling back to: blue
#
# Continue with rollback? [y/N]: y
#
# [2/4] Ensuring blue environment is running... ✓
# [3/4] Switching traffic to blue... ✓
# [4/4] Managing green environment...
# Stop green environment? [Y/n]: y
#
# ✓ Rollback Complete!
```

### Force Rollback (No Confirmations)

```bash
./rollback --force
```

## Scripts Reference

### Main Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `init-bluegreen` | First-time setup | `./init-bluegreen` |
| `deploy-zero-downtime` | Deploy new version | `./deploy-zero-downtime [--skip-tests] [--auto-switch]` |
| `rollback` | Roll back to previous version | `./rollback [--force]` |

### Helper Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `scripts/health-check.sh` | Comprehensive health checks | `./scripts/health-check.sh <env> [timeout]` |
| `scripts/smoke-test.sh` | Critical path testing | `./scripts/smoke-test.sh <env>` |
| `scripts/switch-traffic.sh` | Traffic switching | `./scripts/switch-traffic.sh <env>` |

## Health Checks

The health check script performs 5 levels of validation:

1. **Container Status**: Containers exist and running
2. **Docker Health Checks**: Docker healthcheck passing
3. **API Health Endpoint**: `/api/health` responds with `status: ok`
4. **Database Connection**: Database connectivity verified
5. **Frontend Accessibility**: Frontend serves HTML

## Smoke Tests

The smoke test script validates critical paths:

1. **API Authentication Endpoint**: `/api/auth/request-code` works
2. **Test User Login Flow**: Full login flow with test user
3. **Frontend Page Load**: Frontend HTML loads correctly
4. **CORS Configuration**: CORS headers present

## State Management

### State File

The file `.current-env` tracks the currently active environment:

```bash
# Check current environment
cat .current-env
# Output: blue or green
```

### Environment Identification

Each container has `ENVIRONMENT_NAME` environment variable:

```bash
# Check which environment is serving
docker exec ala-api-blue printenv ENVIRONMENT_NAME
# Output: blue
```

## Database Management

### Shared Database Pattern

Both blue and green environments share a single PostgreSQL database. This enables:

- Zero-downtime schema changes via expand-contract pattern
- No data migration needed during deployment
- Simpler architecture for single-VM deployment

### Database Backups

Automatic backups are created before each deployment:

```bash
ls -lt deployment/backups/
# db-backup-20251026-123456.sql
# db-backup-20251026-110203.sql
# ... (keeps last 5 backups)
```

### Manual Backup

```bash
cd deployment
docker exec ala-db pg_dump -U ala_user ala_production > manual-backup.sql
```

### Restore from Backup

```bash
cd deployment
cat backups/db-backup-YYYYMMDD-HHMMSS.sql | \
  docker exec -i ala-db psql -U ala_user ala_production
```

## Troubleshooting

### Deployment Fails at Health Checks

```bash
# Check container logs
docker-compose -f docker-compose.bluegreen.yml logs api-green
docker-compose -f docker-compose.bluegreen.yml logs frontend-green

# Check container health status
docker inspect --format='{{.State.Health.Status}}' ala-api-green

# Run health check manually
./scripts/health-check.sh green
```

### Deployment Fails at Smoke Tests

```bash
# Run smoke tests manually for detailed output
./scripts/smoke-test.sh green

# Check API logs
docker-compose -f docker-compose.bluegreen.yml logs api-green

# Test API directly
docker exec ala-api-green wget -q -O- http://localhost:5000/api/health
```

### Traffic Switch Fails

```bash
# Check proxy status
docker-compose -f docker-compose.bluegreen.yml logs proxy

# Check nginx configuration
docker exec ala-proxy nginx -t

# Check current upstream configuration
docker exec ala-proxy cat /etc/nginx/conf.d/upstream-active.conf

# Manual traffic switch
./scripts/switch-traffic.sh green
```

### Environment Won't Stop

```bash
# Force stop
docker-compose -f docker-compose.bluegreen.yml stop api-blue frontend-blue

# Or force remove
docker-compose -f docker-compose.bluegreen.yml rm -f api-blue frontend-blue
```

### Both Environments Running (Confused State)

```bash
# Determine which should be active
cat .current-env

# Stop the inactive one
# If blue is active:
docker-compose -f docker-compose.bluegreen.yml stop api-green frontend-green

# If green is active:
docker-compose -f docker-compose.bluegreen.yml stop api-blue frontend-blue
```

### Need to Start Fresh

```bash
# Stop everything except database
docker-compose -f docker-compose.bluegreen.yml stop api-blue frontend-blue api-green frontend-green proxy

# Re-initialize
./init-bluegreen
```

## Monitoring

### Check Active Environment

```bash
cat .current-env
```

### Check All Container Status

```bash
docker-compose -f docker-compose.bluegreen.yml ps
```

### Check Health of All Environments

```bash
# Blue
./scripts/health-check.sh blue

# Green
./scripts/health-check.sh green
```

### Watch Deployment Logs

```bash
# In one terminal
docker-compose -f docker-compose.bluegreen.yml logs -f api-green

# In another terminal
./deploy-zero-downtime
```

## Security Considerations

1. **SSL Certificates**: Stored in `~/ala-improved/ssl-certs/` (outside repository)
2. **Environment Variables**: `.env` file is git-ignored
3. **Database Credentials**: Never committed to git
4. **JWT Secret**: Must be consistent across blue/green for session continuity

## Performance Considerations

### Resource Usage

- **Normal Operation**: One environment active + shared database + proxy
- **During Deployment**: Both environments + shared database + proxy (temporary)
- **After Deployment**: One environment active + shared database + proxy

### Disk Space

Each environment requires ~500MB for Docker images. Keep 5 backups = ~100MB.

Total: ~1.5GB for blue-green system.

## Maintenance

### Clean Up Old Docker Images

```bash
docker image prune -a
```

### Clean Up Old Backups

```bash
# Keep only last 3 backups
ls -t deployment/backups/db-backup-*.sql | tail -n +4 | xargs rm
```

### Update Docker Images

```bash
# Pull latest base images
docker-compose -f docker-compose.bluegreen.yml pull postgres nginx

# Rebuild with --no-cache
./deploy-zero-downtime
```

## Migration from Current System

### Current System (Simple Deploy)

```bash
cd ~/ala-improved/deployment
./deploy
```

### Migrating to Blue-Green

1. **Backup current deployment**
   ```bash
   cd ~/ala-improved/deployment
   ./deploy  # Ensure current system working
   docker exec ala-db pg_dump -U ala_user ala_production > pre-migration-backup.sql
   ```

2. **Initialize blue-green**
   ```bash
   ./init-bluegreen
   ```

3. **Verify system working**
   ```bash
   curl -I https://ala-app.israelcentral.cloudapp.azure.com
   ```

4. **Future deployments use new system**
   ```bash
   ./deploy-zero-downtime
   ```

### Rollback to Simple Deploy

If you need to go back to the simple deployment system:

```bash
# Stop blue-green system
docker-compose -f docker-compose.bluegreen.yml down

# Use original deployment
docker-compose -f docker-compose.yml up -d
```

## Best Practices

1. **Always Review Changes**: Check git diff before deploying
2. **Test in Staging**: If possible, test on staging environment first
3. **Monitor Logs**: Watch logs during deployment
4. **Verify After Switch**: Test application after traffic switch
5. **Keep Rollback Ready**: Don't stop old environment immediately
6. **Database Backups**: Always taken automatically, but verify they exist
7. **Low-Traffic Windows**: Deploy during low-traffic times when possible
8. **Gradual Rollout**: Consider adding canary deployment for critical changes

## FAQ

### Q: Can I deploy during business hours?
**A**: Yes! That's the whole point. Zero-downtime means no user interruption.

### Q: What if deployment fails halfway through?
**A**: Old environment keeps serving traffic. Nothing breaks.

### Q: How long does deployment take?
**A**: ~5-10 minutes including building, testing, and switching.

### Q: Can I skip the confirmation prompt?
**A**: Yes, use `--auto-switch` flag for CI/CD pipelines.

### Q: What happens to database during deployment?
**A**: Nothing. Single shared database, no migration needed.

### Q: Can I have both environments running?
**A**: Yes, during testing. But only one serves production traffic.

### Q: How much extra disk space needed?
**A**: ~500MB for second environment (temporary during deployment).

### Q: What if I need to roll back after hours?
**A**: Run `./rollback --force` for instant rollback with zero downtime.

##  Support

For issues or questions:
1. Check [Troubleshooting](#troubleshooting) section above
2. Check deployment logs: `docker-compose -f docker-compose.bluegreen.yml logs`
3. Review [../docs/TROUBLESHOOTING.md](../docs/TROUBLESHOOTING.md)
4. Contact: AlphaTau Medical DevOps Team
