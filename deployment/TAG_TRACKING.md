# Understanding Docker Image Tags in Swarm Deployments

## Key Concept

**Image tags are labels, not versions.**

An image tag like `cors-fixed` can be updated with new code while keeping the same name. What matters is the **actual code inside the container**, not the tag name.

## How Swarm Updates Work

### Successful Deployment Example

```bash
# November 13, 2025 - 14:01:40
./swarm-deploy

# What happens:
1. Build new images:
   - ala-api:20251113-140140
   - ala-frontend:20251113-140140

2. Deploy to Swarm:
   - docker stack deploy triggers rolling update
   - Service specs update to new tags

3. Rolling update:
   - New container starts (replica 1)
   - Health checks pass
   - Old container stops
   - Repeat for replica 2

4. Result:
   docker service ls shows:
   - ala_api: ala-api:20251113-140140 ✅
   - ala_frontend: ala-frontend:20251113-140140 ✅
```

### Failed Deployment Example

```bash
# November 13, 2025 - 14:01:40
./swarm-deploy

# What happens:
1. Build new images:
   - ala-api:20251113-140140 ✅
   - ala-frontend:20251113-140140 ✅

2. Deploy to Swarm:
   - API rolling update starts
   - Frontend rolling update starts

3. API update succeeds:
   - New container starts
   - Health checks pass ✅
   - Old container stops
   - Service spec: ala-api:20251113-140140

4. Frontend update FAILS:
   - New container starts
   - Health check fails (e.g., nginx can't load SSL cert) ❌
   - Container exits with code 1
   - Swarm's failure_action: rollback kicks in
   - Service spec reverts to: ala-frontend:cors-fixed
   - Old containers keep running (no downtime!)

5. Result:
   docker service ls shows:
   - ala_api: ala-api:20251113-140140 ✅
   - ala_frontend: ala-frontend:cors-fixed ⚠️ (rolled back)
```

**Key Point**: The `cors-fixed` tag may already contain recent code from a previous successful deployment!

## Real-World Example from November 2025

### Timeline

**November 12, 16:44** - Deploy with tag `cors-fixed`
- Pancreas combined treatment feature code included
- Deployment succeeds
- Tag: `cors-fixed`
- Code: Pancreas feature ✅

**November 13, 14:01** - Try to deploy with tag `20251113-140140`
- API deployment succeeds → tag updates
- Frontend deployment fails (SSL cert path mismatch)
- Frontend rolls back to `cors-fixed`
- Tag: Still `cors-fixed`
- Code: **Still has pancreas feature from Nov 12** ✅

**Result**:
- Application works perfectly
- New features are live
- Tag just didn't update (cosmetic issue)

## How to Verify What Code Is Actually Running

### Method 1: Check Service Image Tags

```bash
# Quick check - what tag is deployed?
docker service inspect ala_frontend --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}'
# Output: ala-frontend:cors-fixed

# Is this the latest deployment?
# NO if your deployment script showed a different tag
# But the code may still be recent - check further!
```

### Method 2: Check Image Creation Time

```bash
# When was this image actually built?
docker image inspect ala-frontend:cors-fixed --format '{{.Created}}'
# Output: 2025-11-12T16:44:10.187799869Z

# If recent (within last few days) → contains recent code
# If old (weeks/months ago) → genuinely old code
```

### Method 3: Check Asset Files in Container

```bash
# What files are actually served?
docker exec $(docker ps -q --filter name=ala_frontend.1) \
  ls -la /usr/share/nginx/html/assets/ | grep Treatment

# Output:
# -rwxr-xr-x  1 nginx-app nginx-app  49567 Nov 12 16:13 TreatmentDocumentation-Bi_U_eZm.js
# -rwxr-xr-x  1 nginx-app nginx-app 106114 Nov 12 16:13 TreatmentSelection-CZAYAnFg.js

# File modification dates show when code was built
# Recent dates = recent code, regardless of tag name
```

### Method 4: Browser Console (BEST for End-Users)

```bash
# Best real-world verification:
1. Open application in browser
2. Open DevTools → Network tab
3. Reload page
4. Look for asset filenames: TreatmentSelection-<hash>.js

# Asset hash changes with every build
# If hash is new → code is new
# If hash is old → code is old

# Example hashes:
# Old build:  TreatmentSelection-ABC123.js
# New build:  TreatmentSelection-CZAYAnFg.js  ← Different hash = new code
```

### Method 5: Check for Failed Tasks

```bash
# Did the latest deployment actually succeed?
docker service ps ala_frontend --format 'table {{.Name}}\t{{.Image}}\t{{.CurrentState}}\t{{.Error}}'

# Look for:
# - "Failed" in CurrentState
# - Error messages like "task: non-zero exit (1)"
# - Recent timestamp

# If you see recent failures → deployment rolled back
# Old tag is serving, but may have recent code from earlier deployment
```

## When Tags Matter vs. When They Don't

### Tags Matter For:

1. **Rollback Operations**
   ```bash
   # Need to revert to specific version
   docker service update ala_frontend --image ala-frontend:20251112-143955
   ```

2. **Audit Trails**
   - "What version was deployed on Nov 13?"
   - Timestamped tags provide clear timeline
   - Can track deployment history

3. **Debugging**
   - "Is the bug in the latest build or older?"
   - Tags help identify which build is running
   - Can compare different tagged versions

4. **Deployment Verification**
   - Quick sanity check: Did deployment succeed?
   - Mismatched tags = investigate further

### Tags DON'T Matter For:

1. **Current Functionality**
   - Code in container is what matters
   - Tag is just metadata
   - App works based on actual code, not tag label

2. **Zero-Downtime Operation**
   - Mechanism works regardless of tag names
   - Rolling updates based on container health, not tags
   - Failure rollback independent of tag strategy

3. **User Experience**
   - Users never see Docker tags
   - Browser loads actual assets from container
   - Features work if code is correct, regardless of tag

## Best Practices

### 1. Always Use Timestamped Tags for New Deployments

```bash
# Good - timestamp in tag
VERSION=$(date +%Y%m%d-%H%M%S)
docker build -t ala-frontend:$VERSION ./frontend

# Avoid - reusing generic tags
docker build -t ala-frontend:latest ./frontend  # Tag may be misleading
```

### 2. Verify Deployment Success

```bash
# After deployment, check both services show same version
API_TAG=$(docker service inspect ala_api --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}')
FRONTEND_TAG=$(docker service inspect ala_frontend --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}')

echo "API: $API_TAG"
echo "Frontend: $FRONTEND_TAG"

# If mismatched → one service failed to deploy
```

### 3. Check for Failed Tasks After Deployment

```bash
# Quick check for failures
docker service ps ala_frontend --filter "desired-state=shutdown" --format 'table {{.Name}}\t{{.CurrentState}}\t{{.Error}}'

# If recent failures → investigate and fix
```

### 4. Test Application Functionality

**Most important**: Does the app work?

```bash
# 1. API health check
curl -f http://localhost:5000/api/health

# 2. Frontend loads
curl -k -f https://localhost/

# 3. Log in and test features
# 4. Check browser console for asset hashes
```

### 5. Keep Deployment Log

Document deployments with actual versions and outcomes:

```bash
# deployment/deployment-log.txt
2025-11-12 16:44 | SUCCESS | ala-frontend:cors-fixed | Pancreas feature
2025-11-13 14:01 | PARTIAL | API:20251113-140140, Frontend:rollback | SSL cert issue
```

## Common Questions

### Q: Tag shows old version but app works fine - is this a problem?

**A**: No! Functionality is what matters. The old tag may contain recent code from a previous deployment. Verify with:
- Image creation date (should be recent)
- Asset file timestamps in container
- Browser console asset hashes

### Q: How do I know if latest code is actually deployed?

**A**: Multi-point verification:
1. Check service tags (should match deployment version)
2. Check for failed tasks (no recent failures)
3. Test application features (do new features work?)
4. Browser console asset hashes (do they match latest build?)

### Q: Should I always fix tag mismatches?

**A**: Depends:
- **If app works correctly**: Not urgent, fix when convenient
- **If features are missing**: Yes, investigate and redeploy
- **If audit trail needed**: Yes, redeploy with fixed config for proper versioning

### Q: Can I manually update service tags?

**A**: Yes, but not recommended:
```bash
# Possible but avoid
docker service update ala_frontend --image ala-frontend:20251113-140140

# Better: Fix issue and run proper deployment
./swarm-deploy
```

## Troubleshooting Decision Tree

```
Tag shows old version after deployment?
  │
  ├─ Check image creation date
  │  │
  │  ├─ Recent (< 1 week)?
  │  │  └─ Code is probably current
  │  │     └─ Test features → Works? → No action needed
  │  │                                 └─ Broken? → Redeploy
  │  │
  │  └─ Old (> 1 week)?
  │     └─ Check for failed tasks
  │        └─ Found failures? → Fix error and redeploy
  │                            └─ No failures? → Investigate image history
```

## Summary

**Remember**:
1. **Tags are labels** - convenient for tracking, not the source of truth
2. **Container content is truth** - what code is actually running
3. **Verify functionality first** - does the app work?
4. **Then verify tags** - do they match for tracking purposes?
5. **Fix deployment failures** - but understand rollback keeps app running

**When in doubt**: Test the application. If features work, code is current regardless of tag name.
