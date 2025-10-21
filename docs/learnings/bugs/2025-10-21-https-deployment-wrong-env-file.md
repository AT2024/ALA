# HTTPS Deployment Failure - Wrong Environment File and Nginx Config

**Date**: 2025-10-21
**Severity**: Critical (Production Down)
**Time to Resolve**: ~2 hours (with multiple false starts)
**Root Cause Category**: Configuration Management / Documentation Gap

## Problem Summary

Production site (https://ala-app.israelcentral.cloudapp.azure.com) became inaccessible with `ERR_CONNECTION_REFUSED` error. User tamig@alphatau.com reported 500 error when trying to authenticate.

## Symptoms

1. Domain resolved correctly to IP 20.217.84.100
2. Ports 80 and 443 were listening on the host
3. Frontend container showed as "unhealthy"
4. Browser showed "This site can't be reached - ERR_CONNECTION_REFUSED"
5. Original error also included CORS issues and database connection failures

## Root Cause Analysis

### Primary Issues
1. **Wrong Environment File**: Used `.env.azure` instead of `.env.azure.https` for HTTPS deployment
2. **Wrong Nginx Config**: Docker cache used `nginx.staging.conf` (port 8080 only) instead of `nginx.https.azure.conf` (ports 8080 + 8443)
3. **Port Mapping Mismatch**: Docker mapped 80→80, 443→443 but nginx listened on 8080/8443
4. **Multiple Confusing Files**: 13 environment files existed, causing confusion about which to use

### Why It Happened
- Deployment scripts (`deploy-https.sh`) referenced outdated file paths
- Multiple backup files (`.env.azure.backup*`) cluttered the directory
- No clear documentation about which environment file to use
- Docker build cache prevented nginx config changes from being applied
- Made changes without understanding current working state

## Investigation Process (with mistakes)

### What Went Wrong in Investigation
1. ❌ Changed deployment config multiple times without understanding baseline
2. ❌ Switched between environment files without checking what was actually working
3. ❌ Kept rebuilding containers hoping it would fix itself
4. ❌ Didn't verify port mappings matched nginx configuration
5. ❌ Ran in circles making changes without systematic analysis

### What Finally Worked
1. ✅ Stopped and analyzed the actual current state
2. ✅ Checked git history to understand HTTPS deployment evolution
3. ✅ Identified nginx config mismatch (8080/8443 vs 80/443)
4. ✅ Found correct environment file (`.env.azure.https`)
5. ✅ Manually replaced nginx config to bypass Docker cache
6. ✅ Verified port mappings: 80→8080, 443→8443

## Solution

### Immediate Fix
```bash
# 1. Update environment file with correct nginx config and ports
ssh azureuser@20.217.84.100
cd ~/ala-improved/deployment/azure
cat >> .env.azure.https << 'EOF'
NGINX_CONFIG=nginx.https.azure.conf
NGINX_HTTP_PORT=8080
NGINX_HTTPS_PORT=8443
HTTP_PORT=80
HTTPS_PORT=443
EOF

# 2. Copy correct nginx config into running container (bypass cache)
docker cp ~/ala-improved/frontend/nginx.https.azure.conf ala-frontend-azure:/etc/nginx/conf.d/default.conf

# 3. Reload nginx
docker exec ala-frontend-azure sh -c 'nginx -s reload'

# 4. Restart frontend with correct port mappings
docker-compose -f docker-compose.azure.yml --env-file .env.azure.https up -d frontend
```

### Long-term Preventions
1. **Cleaned up environment files**: Removed 11 confusing files, kept only 2:
   - `.env.azure.https` - Production HTTPS environment (active)
   - `.env.azure.https.template` - Template for creating new environments

2. **Updated CLAUDE.md** with critical deployment information:
   - Clear instruction: ALWAYS use `.env.azure.https` for production
   - Documented port configuration: nginx 8080/8443, Docker maps 80→8080, 443→8443
   - Added to "Known Pitfalls & Solutions" section

3. **Added to deployment checklist**:
   - Verify environment file before deployment
   - Check nginx config matches expected ports
   - Verify port mappings in docker-compose match nginx listen ports

## Technical Details

### Nginx Configuration
```nginx
# nginx.https.azure.conf - CORRECT for production
server {
    listen 8080;  # Non-privileged port for HTTP
    # HTTP to HTTPS redirect
}

server {
    listen 8443 ssl;  # Non-privileged port for HTTPS
    # SSL configuration
}
```

### Docker Port Mappings
```yaml
# docker-compose.azure.yml - CORRECT configuration
ports:
  - "${HTTP_PORT:-80}:${NGINX_HTTP_PORT:-8080}"   # Host 80 → Container 8080
  - "${HTTPS_PORT:-443}:${NGINX_HTTPS_PORT:-8443}" # Host 443 → Container 8443
```

### Environment Variables Required
```bash
NGINX_CONFIG=nginx.https.azure.conf  # Use Azure HTTPS nginx config
NGINX_HTTP_PORT=8080                 # Internal nginx HTTP port
NGINX_HTTPS_PORT=8443                # Internal nginx HTTPS port
HTTP_PORT=80                          # External HTTP port
HTTPS_PORT=443                        # External HTTPS port
```

## Lessons Learned

### Critical Lessons
1. **NEVER change deployment config without understanding current state**
   - First: Check what's running, what ports are listening, what config is loaded
   - Then: Make ONE change at a time and verify
   - Don't run in circles making multiple changes

2. **Verify port mappings match nginx configuration**
   - Nginx listens on 8080/8443 (non-root user requirement)
   - Docker must map host 80→container 8080, 443→container 8443
   - Mismatch = connection refused

3. **Clean up confusing files immediately**
   - 13 environment files caused massive confusion
   - Keep only what's necessary
   - Remove old backups and templates

4. **Docker build cache can be problematic**
   - `--build` flag doesn't always bypass cache for build args
   - Use `--no-cache` when changing build args like `NGINX_CONFIG`
   - OR manually replace files in running container for faster fix

5. **Document the correct configuration prominently**
   - Update CLAUDE.md immediately after fixing
   - Add to "Known Pitfalls"
   - Make it impossible to make the same mistake

### Process Improvements
- Added "Critical Deployment Information" section to CLAUDE.md
- Created environment file naming convention (only `.env.azure.https` for production)
- Documented nginx port requirements clearly
- Added port mapping verification to deployment checklist

## Prevention Checklist

Before deploying to production:
- [ ] Verify using `.env.azure.https` (not any other env file)
- [ ] Check `NGINX_CONFIG=nginx.https.azure.conf` in env file
- [ ] Verify port variables: `NGINX_HTTP_PORT=8080`, `NGINX_HTTPS_PORT=8443`
- [ ] Confirm docker-compose port mappings: `80:8080`, `443:8443`
- [ ] Test locally if possible before deploying to production
- [ ] Check nginx config file exists in frontend directory
- [ ] Have rollback plan ready

## Related Documentation
- [CLAUDE.md - Critical Deployment Information](../../CLAUDE.md#critical-deployment-information)
- [CLAUDE.md - Known Pitfalls - Deployment Issues](../../CLAUDE.md#deployment-issues)
