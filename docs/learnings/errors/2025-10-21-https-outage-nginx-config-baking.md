# Production HTTPS Outage - October 21, 2025

## Incident Summary
- **Date**: October 21, 2025
- **Duration**: ~1 hour
- **Severity**: Critical (site completely inaccessible via HTTPS)
- **Impact**: Users unable to access production site
- **Root Cause**: Docker image built with wrong nginx configuration

## Timeline

### 15:00 - Incident Detected
- User reported site not working: "THE APP ON THE WEB IS NOT WORKING NOW"
- Initial assumption: Recent code changes broke the build

### 15:05 - Initial Investigation
- Checked container status: All containers healthy ✅
- Checked API health: Responding correctly ✅
- Checked HTTPS access: Connection refused ❌

### 15:10 - Root Cause Identified
- Environment file specified: `NGINX_CONFIG=nginx.https.azure.conf`
- Container running HTTP-only nginx config (port 8080 only, no 8443 listener)
- Discovery: Nginx config is BAKED into Docker image at build time
- Image was built before nginx.https.azure.conf was properly configured

### 15:15 - Recovery Started
1. Rebuilt frontend image with correct HTTPS config
2. Restarted frontend container with new image
3. Verified HTTPS working on both IP and domain

### 15:25 - Recovery Complete
- HTTPS site accessible ✅
- Both ports 8080 (HTTP) and 8443 (HTTPS) working correctly
- HTTP properly redirecting to HTTPS

## Root Cause Analysis

### Why It Happened
The Dockerfile contains this line (line 120):
```dockerfile
COPY --chown=nginx-app:nginx-app ${NGINX_CONFIG} /etc/nginx/conf.d/default.conf
```

This `COPY` command runs at **BUILD TIME**, not at runtime. The `NGINX_CONFIG` ARG value is resolved when the image is built, and the specified config file is permanently baked into the image.

### The Critical Misunderstanding
- **Incorrect Assumption**: Changing `NGINX_CONFIG` in `.env.azure.https` would change the running nginx config
- **Reality**: The environment variable only affects the BUILD process
- **Result**: Old HTTP-only config was still running in the container

### What Went Wrong
1. `.env.azure.https` was configured with `NGINX_CONFIG=nginx.https.azure.conf`
2. Frontend image was built (possibly weeks ago) with a different config
3. Container was restarted with `docker-compose up -d`
4. Docker reused the OLD image (didn't rebuild)
5. HTTPS listener was never configured in the running nginx

## Prevention Measures

### 1. Pre-Deployment Validation Script
Create `deployment/azure/validate-deployment.sh`:
```bash
#!/bin/bash
set -e

echo "Validating deployment configuration..."

# Check nginx config file exists
if [ -n "$NGINX_CONFIG" ] && [ ! -f "../../frontend/$NGINX_CONFIG" ]; then
    echo "ERROR: Nginx config file not found: $NGINX_CONFIG"
    exit 1
fi

# Validate nginx syntax (if possible)
echo "✓ Nginx config file exists"

# Check for HTTPS requirements
if [ "$USE_HTTPS" = "true" ]; then
    if ! grep -q "listen.*443" "../../frontend/$NGINX_CONFIG" 2>/dev/null; then
        echo "WARNING: HTTPS enabled but config doesn't have port 443 listener"
    fi
fi

echo "✓ Validation complete"
```

### 2. Updated Deployment Documentation
Updated `CLAUDE.md` with pitfall documentation including:
- Root cause explanation
- Symptoms to watch for
- Recovery procedure
- Prevention measures

### 3. Mandatory Image Rebuild Checklist
Before deploying nginx config changes:
- [ ] Verify config file exists at path specified in `NGINX_CONFIG`
- [ ] Test nginx syntax: `nginx -t -c <config-file>`
- [ ] Rebuild frontend image: `docker-compose build --no-cache frontend`
- [ ] Verify config in built image before deployment
- [ ] Test locally if possible

### 4. Runtime Config Verification
Add to deployment checklist:
```bash
# Verify running config matches expected
docker exec ala-frontend-azure cat /etc/nginx/conf.d/default.conf | head -20

# Check for HTTPS listener
docker exec ala-frontend-azure cat /etc/nginx/conf.d/default.conf | grep -A2 "listen.*443"
```

## Lessons Learned

### Technical Lessons
1. **Docker ARG vs ENV**: ARG values are resolved at build time, ENV at runtime
2. **COPY is permanent**: Files copied during build are baked into the image
3. **Image reuse**: Docker Compose reuses images unless explicitly rebuilt
4. **Config verification**: Always verify running config matches expected config

### Process Lessons
1. **Deploy checklist**: Need automated validation before deployment
2. **Config visibility**: Make it obvious when config is baked vs. mounted
3. **Testing**: Test HTTPS functionality after any nginx config changes
4. **Documentation**: Critical deployment patterns must be documented in CLAUDE.md

## Related Issues

### Build Errors (Secondary Issue)
During recovery, discovered TypeScript build errors:
- Missing `@testing-library/jest-dom` type definitions
- References to non-existent files (Scanner.tsx, performance.ts)
- These were already commented out in main.tsx
- Fixed by installing missing dependencies

### Orphaned Files
- `frontend/build-output.txt` - Build error log (removed)
- `mobile-optimization-changes.diff` - Uncommitted changes (removed)

## Action Items

- [x] Rebuild frontend with correct HTTPS nginx config
- [x] Verify HTTPS site accessible
- [x] Document pitfall in CLAUDE.md
- [x] Create error recovery documentation
- [ ] Create pre-deployment validation script
- [ ] Add deployment checklist to docs/deployment/
- [ ] Test HTTPS deployment locally to verify process
- [ ] Create monitoring alert for HTTPS accessibility

## References
- [CLAUDE.md - Deployment Pitfalls](../../CLAUDE.md#known-pitfalls--solutions)
- [Frontend Dockerfile](../../frontend/Dockerfile) (line 120)
- [Docker Compose Azure](../../deployment/azure/docker-compose.azure.yml)
- [Nginx HTTPS Config](../../frontend/nginx.https.azure.conf)
