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