# Troubleshooting Guide

## Quick Diagnostics

### Local Environment
```bash
# Check all services status
docker ps && node scripts/debug-unified.js health

# View backend logs
docker-compose logs -f backend

# Restart backend service
docker-compose restart backend

# Full status check
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### Azure Production (HTTPS)
```bash
# Check services and health
ssh azureuser@20.217.84.100 "docker ps && curl -s localhost:5000/api/health"

# View recent logs
ssh azureuser@20.217.84.100 "docker logs ala-api-azure --tail=20"

# Check frontend
curl https://ala-app.israelcentral.cloudapp.azure.com | grep -o "<title>[^<]*</title>"

# Check API health
curl https://ala-app.israelcentral.cloudapp.azure.com/api/health

# Verify HTTP to HTTPS redirect
curl -I http://ala-app.israelcentral.cloudapp.azure.com  # Should return 301 redirect
```


## Common Issues and Solutions

### Localhost Not Working (Windows/WSL)

#### Symptoms
- `http://localhost:3000` fails with connection reset
- Frontend loads but API calls fail
- Docker containers are healthy but can't access application
- Works with `127.0.0.1:3000` but not `localhost:3000`

#### Root Cause
Windows resolves `localhost` to IPv6 `::1`, and WSLrelay.exe intercepts IPv6 connections on port 3000, causing connection resets.

#### Solutions

**Quick Fix (Immediate):**
Use IP address instead of hostname:
- `http://127.0.0.1` (if using port 80)
- `http://127.0.0.1:3000` (if using port 3000)

**Permanent Fix (Recommended):**
Use port 80 for local development (avoids WSLrelay interference):

```bash
# In deployment/docker-compose.yml
ports:
  - "80:8080"     # Use port 80, not 3000
  - "443:8443"

# Rebuild containers
cd deployment
docker-compose down
docker-compose up --build -d

# Access via http://localhost (no port needed)
```

**Alternative Fix:**
Check Windows hosts file (`C:\Windows\System32\drivers\etc\hosts`):
```
127.0.0.1 localhost
```

**Diagnostic Commands:**
```bash
# Check which process is using port 3000
netstat -ano | findstr :3000

# Test IPv4 vs IPv6
curl http://127.0.0.1:3000     # Should work
curl http://localhost:3000     # May fail due to IPv6

# Verify container health
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

**Why Port 80 Works Better:**
- Standard HTTP port (cleaner URLs)
- No WSLrelay interference
- No need to specify port in browser
- Matches production port mapping philosophy

### Priority API Issues

#### Empty Results from Priority API
**Symptoms:**
- No patients showing in list
- Empty applicator validation results
- API returns empty arrays

**Solutions:**
1. **Check date format in OData queries:**
   ```bash
   # Look for date filter format in logs
   docker-compose logs backend | grep "OData query"
   # Should be: SIBD_TREATDAY ge datetime'YYYY-MM-DDTHH:MM:SS'
   ```

2. **Verify data source indicators in logs:**
   - 🧪 = Test data (development mode)
   - 🎯 = Real Priority API
   - ❌ = Fallback/Error

3. **Check authentication token:**
   ```bash
   # Verify token exists and is valid
   docker-compose logs backend | grep "Priority API token"
   ```

4. **Validate API endpoint:**
   ```bash
   # Test Priority API directly
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        "https://priority.api.endpoint/ORDERS?$filter=..."
   ```

#### Reference Chain Issues
**Symptoms:**
- Duplicate patients in list
- Wrong patient count
- Orders with seedQty = 0 appearing

**Solutions:**
1. Check reference chain validation in logs
2. Verify filtering logic for root orders
3. Look for circular reference warnings

### Applicator Validation Issues

#### Validation Failures
**Symptoms:**
- Valid applicators being rejected
- "Not allowed" errors for legitimate applicators

**Troubleshooting Steps:**
1. **Already scanned?**
   - Check if applicator was already used in current treatment
   - Review treatment context state

2. **Wrong treatment type?**
   - Verify insertion vs removal treatment selection
   - Check applicator assignment in Priority

3. **Marked as "no use"?**
   - Check Priority SIBD_APPLICATUSELIST status
   - Look for SIBD_NOUSE flag

4. **Not in allowed list?**
   - Verify site-specific applicator permissions
   - Check user's position code (99 = full access)

5. **Should be valid?**
   - Review all validation scenarios
   - Check fuzzy matching logic for similar names

### TypeScript Compilation Errors

#### Backend Compilation Fails
```bash
# Clean and rebuild backend
cd backend
rm -rf dist/ node_modules/.cache/
npm run build

# If persists, check for type errors
npm run type-check
```

#### Frontend Compilation Fails
```bash
# Clean and rebuild frontend
cd frontend
rm -rf dist/ node_modules/.cache/
npm run build

# Check for specific errors
npm run type-check
```

### Container Issues

#### Containers Not Starting (Local)
```bash
# Complete reset
docker-compose down -v
docker system prune -f
docker-compose up -d --build

# Check for port conflicts
lsof -i :3000  # Frontend port
lsof -i :5000  # Backend port
lsof -i :5432  # Database port
```

#### Containers Not Starting (Azure HTTP)
```bash
# Clean restart
ssh azureuser@20.217.84.100 "cd ala-improved && \
  docker-compose -f deployment/azure/docker-compose.azure.yml down && \
  docker system prune -f"

ssh azureuser@20.217.84.100 "cd ala-improved && \
  docker-compose -f deployment/azure/docker-compose.azure.yml \
  --env-file deployment/azure/.env.azure up -d --build"
```

#### Containers Not Starting (Azure Production)
```bash
# Clean restart (uses simplified deployment system)
ssh azureuser@20.217.84.100 "cd ~/ala-improved/deployment && \
  docker-compose down && \
  docker system prune -f"

ssh azureuser@20.217.84.100 "cd ~/ala-improved/deployment && ./deploy"
```

#### Disk Space Full (Azure VM)

**⚠️ RESOLVED**: As of November 2025, the deployment script automatically cleans up disk space. This section is for reference only.

**Symptoms:**
- Deployment fails with "no space left on device"
- Docker build fails
- VM disk usage > 90%

**Automatic Prevention (Current):**
Both `deployment/deploy` and `deployment/deploy-staging` scripts now automatically:
- Warn if disk usage > 85% before deployment
- Clean up after successful deployment:
  - `docker image prune -f` (removes dangling images)
  - `docker builder prune -f --keep-storage 1GB` (clears build cache)
- Show disk usage before/after cleanup
- Save 1-3GB per production deployment, 200-500MB per staging deployment

**Note**: Cleanup code is intentionally duplicated in both scripts for simplicity.

**Manual Check (if needed):**
```bash
# Check disk usage
ssh azureuser@20.217.84.100 "df -h /"

# Check Docker disk usage
ssh azureuser@20.217.84.100 "docker system df"

# Manual cleanup (emergency only - deployment handles this now)
ssh azureuser@20.217.84.100 "docker system prune -f"
```

**What Gets Cleaned:**
- ✅ Dangling images (`<none>` tagged) - old build artifacts
- ✅ Unused build cache beyond 1GB
- ❌ Active containers (preserved)
- ❌ Volumes with medical data (preserved)
- ❌ Tagged images for staging/rollback (preserved)

**Root Cause (Historical):**
Each `docker-compose build --no-cache` created 1-2GB of new images. Old images accumulated as dangling (`<none>`) images but weren't automatically removed. Fixed in deployment script update (2025-11-10).

### Database Issues

#### Database Container Missing (Critical)
```bash
# Recreate database container on Azure
ssh azureuser@20.217.84.100 "docker run -d \
  --name ala-db-azure \
  --network azure_ala-network \
  --network-alias db \
  -v azure_ala-postgres-data-prod:/var/lib/postgresql/data \
  -e POSTGRES_DB=ala_production \
  -e POSTGRES_USER=ala_user \
  -e POSTGRES_PASSWORD=AzureProd2024! \
  -p 5432:5432 \
  --restart=unless-stopped \
  postgres:16.6-alpine"

# Restart API to reconnect
ssh azureuser@20.217.84.100 "docker restart ala-api-azure"
```

#### Database Connection Failed (Local)
```bash
# Check database is running
docker ps | grep postgres

# View database logs
docker-compose logs db --tail=50

# Test connection
docker exec -it postgres psql -U admin -d medical_app -c '\l'

# Reset database completely
docker-compose down -v
docker volume rm ala-improved_postgres-data
docker-compose up -d
```

### HTTPS/SSL Issues

#### Certificate Problems
```bash
# Regenerate SSL certificates on Azure
ssh azureuser@20.217.84.100 "cd ~/ala-improved && \
  rm -rf ssl-certs && \
  bash scripts/generate-ssl-cert.sh 20.217.84.100"

# Verify certificate is mounted
ssh azureuser@20.217.84.100 "docker exec ala-frontend-azure \
  ls -la /etc/ssl/certs/ | grep certificate"

# Check nginx SSL configuration
ssh azureuser@20.217.84.100 "docker exec ala-frontend-azure nginx -t"
```

#### HTTP to HTTPS Redirect Not Working
```bash
# Check nginx configuration
ssh azureuser@20.217.84.100 "docker exec ala-frontend-azure \
  cat /etc/nginx/conf.d/default.conf | grep -A5 'listen 80'"

# Verify HTTPS environment variable
ssh azureuser@20.217.84.100 "cat ~/ala-improved/deployment/azure/.env.azure | grep USE_HTTPS"
```

### Deployment Script Issues

#### Line Ending Errors (Windows)
```bash
# Fix Windows line endings on all scripts
ssh azureuser@20.217.84.100 "sed -i 's/\r$//' \
  ~/ala-improved/deployment/scripts/*.sh \
  ~/ala-improved/deployment/azure/*.sh"
```

#### Permission Denied
```bash
# Make scripts executable
ssh azureuser@20.217.84.100 "chmod +x \
  ~/ala-improved/deployment/scripts/*.sh \
  ~/ala-improved/deployment/azure/*.sh"
```

### Docker Swarm Deployment Issues

#### Service Shows Old Tag But App Works Fine

**Symptom**:
```bash
docker service ls
# Shows: ala_frontend: ala-frontend:cors-fixed
# Expected: ala_frontend: ala-frontend:20251113-140140 (or similar timestamp)
```

**What it means**:
- Latest deployment attempt failed and rolled back
- Service stayed on previous successful tag
- That "old tag" may already contain recent code from earlier deployment
- **Application is still working** - zero downtime maintained

**Verification steps**:
```bash
# 1. Check when the image was actually built
docker image inspect ala-frontend:cors-fixed --format '{{.Created}}'
# If recent (< 1 week) → contains recent code

# 2. Check actual assets in running container
docker exec $(docker ps -q --filter name=ala_frontend.1) \
  ls -la /usr/share/nginx/html/assets/ | grep Treatment
# Look for recent file modification dates

# 3. Test application
# Open browser, check features work, verify asset hashes in DevTools
```

**Resolution**:
- **If app works correctly**: Not urgent - code is current despite old tag name
- **If features are missing**: Investigate deployment failure and redeploy
  ```bash
  # Check for failed tasks
  docker service ps ala_frontend | grep Failed

  # Review error logs
  docker service logs ala_frontend --since 30m | grep -i error

  # Fix issue and redeploy
  cd ~/ala-improved/deployment && ./swarm-deploy
  ```

**See**: [deployment/TAG_TRACKING.md](../deployment/TAG_TRACKING.md) for full explanation of tag vs. code distinction

#### Deployment Fails with "task: non-zero exit (1)"

**Symptom**:
```bash
docker service ps ala_frontend
# Shows: Failed  ... "task: non-zero exit (1)"
```

**Common causes**:

1. **SSL Certificate Path Mismatch** (most common):
   ```bash
   # Check nginx error in logs
   docker service logs ala_frontend | grep -i "cannot load certificate"

   # Fix: Ensure nginx config matches mounted cert paths
   # nginx.https.local.conf should reference: /etc/ssl/certs/fullchain.crt
   # docker-stack.yml mounts to: /etc/ssl/certs/fullchain.crt
   ```

2. **Missing Environment Variables**:
   ```bash
   # Check .env file exists and has all required variables
   ssh azureuser@20.217.84.100 "cat ~/ala-improved/deployment/.env | grep -E 'POSTGRES_|JWT_|PRIORITY_'"
   ```

3. **Health Check Failures**:
   ```bash
   # Check health check endpoint
   curl -f http://localhost:8080/health  # Frontend
   curl -f http://localhost:5000/api/health  # API

   # If health check fails, container is removed and deployment rolls back
   ```

**Resolution**:
1. Identify root cause from logs
2. Fix the issue
3. Commit and push changes
4. Redeploy: `cd ~/ala-improved/deployment && ./swarm-deploy`

#### Mismatched Service Tags After Deployment

**Symptom**:
```bash
docker service inspect ala_api --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}'
# Output: ala-api:20251113-140140

docker service inspect ala_frontend --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}'
# Output: ala-frontend:cors-fixed  (different!)
```

**What it means**:
- API deployment succeeded
- Frontend deployment failed and rolled back
- Users may see old frontend with new API (potential compatibility issues)

**Immediate action**:
```bash
# 1. Check for frontend failures
docker service ps ala_frontend | grep Failed

# 2. Review error logs
docker service logs ala_frontend --since 30m | grep -i error

# 3. Fix issue and redeploy to align versions
```

**Prevention**:
- Always check both service tags after deployment
- Fix deployment failures promptly to keep versions aligned
- Monitor health checks during deployment

### Authentication Issues

#### Login Code Not Received
1. Check email configuration in backend
2. Verify Priority PHONEBOOK API is accessible
3. Check for rate limiting
4. Use test user: `test@example.com` with code `123456`

#### Invalid Code Error
1. Check code expiration (5 minutes)
2. Verify code format (6 digits)
3. Check for typos or spaces
4. Use bypass user: `test@bypass.com` with any code

### Performance Issues

#### Slow API Responses
```bash
# Check backend memory usage
docker stats ala-api-azure

# Review slow queries
docker-compose logs backend | grep "slow query"

# Check database performance
docker exec -it postgres psql -U admin -d medical_app \
  -c "SELECT * FROM pg_stat_activity WHERE state != 'idle';"
```

#### Frontend Loading Slowly
1. Check network tab in browser DevTools
2. Look for failed or slow API calls
3. Check bundle size: `cd frontend && npm run build -- --analyze`
4. Verify CDN/static asset loading

## Recovery Procedures

### Emergency Rollback
```bash
# Rollback to known stable version
git fetch --tags
git checkout v1.0-working-production-2025-09-10

# Redeploy on Azure (uses simplified deployment system)
ssh azureuser@20.217.84.100 "cd ~/ala-improved/deployment && ./deploy"
```

### Database Recovery
```bash
# Local database access
docker exec -it postgres psql -U admin -d medical_app

# Production database access
ssh azureuser@20.217.84.100 "docker exec -it ala-db-azure \
  psql -U ala_user -d ala_production"

# Backup database (Production)
ssh azureuser@20.217.84.100 "docker exec ala-db-azure \
  pg_dump -U ala_user ala_production > backup_$(date +%Y%m%d).sql"

# Restore database (Production)
ssh azureuser@20.217.84.100 "docker exec -i ala-db-azure \
  psql -U ala_user ala_production < backup_file.sql"
```

### Full System Recovery
```bash
# Run recovery script on Azure
ssh azureuser@20.217.84.100 "~/ala-improved/deployment/azure/recover.sh"

# If script fails, manual recovery:
ssh azureuser@20.217.84.100
cd ~/ala-improved
docker-compose -f deployment/azure/docker-compose.azure.yml down
docker system prune -f
docker network create azure_ala-network 2>/dev/null || true
docker volume create azure_ala-postgres-data-prod 2>/dev/null || true
docker-compose -f deployment/azure/docker-compose.azure.yml \
  --env-file deployment/azure/.env.azure up -d --build
```

## Monitoring and Logging

### Enable Continuous Monitoring
```bash
# Start monitoring with auto-recovery
ssh azureuser@20.217.84.100 "nohup ~/ala-improved/deployment/scripts/monitor-auto.sh > monitor.log 2>&1 &"

# Check monitoring status
ssh azureuser@20.217.84.100 "tail -f monitor.log"

# Stop monitoring
ssh azureuser@20.217.84.100 "pkill -f monitor-auto.sh"
```

### Log Analysis
```bash
# Search for errors in backend logs
docker-compose logs backend | grep -i error

# Find specific user activity
docker-compose logs backend | grep "user@example.com"

# Check Priority API calls
docker-compose logs backend | grep "Priority API"

# Monitor real-time logs
docker-compose logs -f --tail=100
```

## Contact and Escalation

### When to Escalate
- Database corruption or data loss
- Security breaches or vulnerabilities
- Complete system failure after recovery attempts
- Priority API integration breaking changes
- Patient safety concerns

### Escalation Path
1. Check this troubleshooting guide
2. Review logs for specific error messages
3. Attempt recovery procedures
4. Document the issue with:
   - Error messages
   - Steps to reproduce
   - Attempted solutions
   - System state/logs
5. Contact development team with documentation

## Quick Reference Commands

### Health Checks
```bash
# Local
curl http://localhost:5000/api/health

# Azure HTTP
curl http://20.217.84.100:5000/api/health

# Azure HTTPS
curl -k https://20.217.84.100:5000/api/health
```

### Service Restarts
```bash
# Local
docker-compose restart backend
docker-compose restart frontend
docker-compose restart db

# Azure
ssh azureuser@20.217.84.100 "docker restart ala-api-azure"
ssh azureuser@20.217.84.100 "docker restart ala-frontend-azure"
ssh azureuser@20.217.84.100 "docker restart ala-db-azure"
```

### Clean Restart
```bash
# Local
docker-compose down && docker-compose up -d --build

# Azure (uses simplified deployment system)
ssh azureuser@20.217.84.100 "cd ~/ala-improved/deployment && ./deploy"
```

---

## Known Pitfalls & Solutions

### Priority API Integration

**Pitfall**: OData query syntax errors causing silent failures
- **Solution**: Always test queries with Postman first
- **Prevention**: Use priority-api-reviewer for all OData queries
- **Pattern**: See [Priority OData patterns](patterns/integration/priority-odata-queries.md)

**Pitfall**: Incomplete applicator validation (skipping chain steps)
- **Solution**: Follow complete validation checklist
- **Prevention**: medical-safety-reviewer enforces complete chain
- **Critical**: All 7 steps must be validated, no shortcuts

**Pitfall**: Mixing test and production data
- **Solution**: Strict environment-based data loading
- **Prevention**: Test data ONLY for test@example.com
- **Critical**: Never mix 🧪 and 🎯 data sources

### Frontend State Management

**Pitfall**: Treatment state getting out of sync with backend
- **Solution**: Use TreatmentContext with proper invalidation
- **Prevention**: ala-code-reviewer checks state consistency
- **Pattern**: See frontend patterns documentation

**Pitfall**: Scanner component not handling errors gracefully
- **Solution**: Implement proper error boundaries and fallbacks
- **Prevention**: medical-safety-reviewer checks critical path error handling

### Database Operations

**Pitfall**: Missing transactions for multi-step operations
- **Solution**: Always use Sequelize transactions for related updates
- **Prevention**: medical-safety-reviewer enforces transaction boundaries
- **Critical**: Treatment data changes must be atomic

**Pitfall**: Migration failures in production
- **Solution**: Test migrations locally with production-like data first
- **Prevention**: Database-specialist reviews all migrations
- **Critical**: Always have rollback plan

### Deployment Issues

**October 2025: Deployment System Radically Simplified**
- **Old Problem**: 5+ deployment scripts, 7+ env files, constant confusion
- **Solution**: ONE deploy script, ONE docker-compose.yml, ONE .env template
- **Result**: Impossible to use wrong script/config (only one of each exists)

**Pitfall**: Missing or misconfigured .env file
- **Symptom**: Deployment fails with "POSTGRES_PASSWORD not set" or similar
- **Solution**: Copy `.env.production.template` to `.env` and fill in secrets
- **Prevention**: deploy script checks for `.env` file existence before proceeding
- **Quick Fix**: `cd deployment && cp .env.production.template .env && vim .env`

**Pitfall**: Container startup failures
- **Symptom**: Health checks fail, deployment rolls back automatically
- **Solution**: Check logs: `cd deployment && docker-compose logs`
- **Common Causes**: Database password mismatch, incorrect API URLs
- **Prevention**: Docker health checks catch issues early, automatic rollback prevents bad deployments

**Pitfall**: Nginx config not taking effect
- **Root Cause**: Nginx config is baked into Docker image at build time
- **Solution**: The deploy script always rebuilds with `--no-cache`, so nginx config changes take effect
- **Manual Rebuild**: `cd deployment && docker-compose build --no-cache frontend`
- **Lesson**: Accept Docker's immutability - rebuild instead of fighting it

**Pitfall**: Testing deployment system changes on production (2025-10-27 CRITICAL INCIDENT)
- **Symptom**: Production outage while testing "zero-downtime" blue-green deployment
- **Root Cause**: Tested deployment infrastructure changes directly on live system without local verification
- **Solution**: ALWAYS test deployment changes locally FIRST with complete workflow verification
- **Prevention**: Pre-deployment checklist enforcement - see [incident report](learnings/errors/2025-10-27-blue-green-production-outage.md)
- **Critical**: Production is NEVER a test environment, especially for deployment infrastructure

**Pitfall**: Azure VM disk space fills up over time (RESOLVED 2025-11-10)
- **Symptom**: Disk space fills up causing deployment failures and production issues
- **Root Cause**: Docker images accumulate with each build (1-2GB per production deployment)
- **Solution**: Automated cleanup added to deploy scripts - runs after successful deployment
- **Prevention**: Disk usage warning shows before deployment, automatic cleanup frees 1-3.5GB per deployment cycle
- **Manual cleanup**: `docker system prune -f` if emergency space needed

### Worktree npm Issues

#### Error: Cannot find module @rollup/rollup-win32-x64-msvc

**Symptom**: When running `npm run dev` in a worktree, you get:
```
Error: Cannot find module @rollup/rollup-win32-x64-msvc
```

**Cause**: Worktree was created with `--quick` flag (or the old `--skip-install` default), and platform-specific native modules weren't installed properly by npm.

**Fix**:
```bash
# In the worktree directory
cd .worktrees/<worker-name>/frontend
rm -rf node_modules package-lock.json
npm install

cd ../backend
rm -rf node_modules package-lock.json
npm install
```

**Prevention**: Use `/worker create <name>` without the `--quick` flag. The default now runs npm install which properly resolves platform-specific dependencies.