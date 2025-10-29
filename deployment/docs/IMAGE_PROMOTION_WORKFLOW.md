# Image Promotion Workflow

Complete guide to the staging environment and image promotion workflow for ALA Medical Application.

## Overview

This workflow separates test data from production and enables fast, safe deployments using image promotion:

1. **Build once in staging** (5-10 minutes)
2. **Test thoroughly in staging**
3. **Promote tested images to production** (30 seconds)

### Benefits

✅ **50% faster deployments**: 20 min → 10.5 min total time
✅ **Guaranteed identical code**: Production runs exact staging-tested binary
✅ **Clear separation**: Impossible to confuse staging/production (visual warnings)
✅ **Safe testing**: Test data isolated, no production contamination
✅ **Medical compliance**: Full audit trail, rollback capability

---

## Architecture

```
┌─────────────────────────────────────────────┐
│ Local Development (Your Laptop)            │
│ - Fast iteration with test data            │
│ - No deployment needed                     │
│ - docker-compose up                        │
└──────────────┬──────────────────────────────┘
               │
               │ git push
               ↓
┌─────────────────────────────────────────────┐
│ Staging (Azure VM - Port 8080)             │
│ - Build and tag images                     │
│ - Test with test@example.com               │
│ - Real environment testing                  │
│ - Shareable URL for QA team                │
└──────────────┬──────────────────────────────┘
               │
               │ Promote images (30 sec)
               ↓
┌─────────────────────────────────────────────┐
│ Production (Azure VM - Port 443)           │
│ - Reuse staging-tested images             │
│ - No rebuild time                          │
│ - Guaranteed identical code                │
└─────────────────────────────────────────────┘
```

---

## Environment Separation

### Staging Environment

**URL**: `http://20.217.84.100:8080`
**Ports**: 8080 (HTTP), 5010 (API), 5433 (PostgreSQL)
**Test Data**: Enabled (`ENABLE_TEST_DATA=true`)
**Test User**: `test@example.com` (code: 123456)
**Visual**: Yellow/orange banner "🧪 STAGING - TEST DATA ONLY"

### Production Environment

**URL**: `https://ala-app.israelcentral.cloudapp.azure.com`
**Ports**: 443 (HTTPS), 5000 (API), 5432 (PostgreSQL)
**Test Data**: Disabled (`ENABLE_TEST_DATA=false`)
**Test User**: Returns 404 (security measure)
**Visual**: Green banner "✅ Production Environment"

---

## Daily Workflow

### Option 1: Standard Workflow (Recommended)

```bash
# 1. Local development (your laptop)
cd deployment
docker-compose up
# Make changes, test locally

# 2. Commit to git
git add .
git commit -m "feat: Add new feature"
git push

# 3. SSH to Azure VM
ssh azureuser@20.217.84.100

# 4. Deploy to staging
cd ~/ala-improved/deployment
./deploy-staging
# Time: ~5-10 minutes (build)

# 5. Test staging at http://20.217.84.100:8080
# - Login as test@example.com
# - Test all new features
# - Share URL with QA team if needed

# 6. If tests pass, promote to production
./promote-to-production
# OR
./deploy --from-staging
# Time: ~30 seconds (no rebuild!)
```

### Option 2: Rapid Iteration (Direct Docker)

For quick testing without git commits:

```bash
# 1. Build locally
docker build -t ala-api:test ./backend

# 2. Push to Azure VM directly
docker save ala-api:test | ssh azureuser@20.217.84.100 "docker load"

# 3. SSH to Azure VM
ssh azureuser@20.217.84.100

# 4. Tag and deploy to staging
docker tag ala-api:test ala-api:staging
cd ~/ala-improved/deployment
./deploy-staging --skip-build  # If script supports it

# 5. Once stable, commit to git for audit trail
```

⚠️ **Important**: Always commit to git before promoting to production (compliance requirement).

---

## Deployment Commands

### Staging Deployment

```bash
# On Azure VM
cd ~/ala-improved/deployment
./deploy-staging
```

**What it does**:
1. Pulls latest code from current git branch
2. Builds images with parallel builds (fast)
3. Tags images as `staging` and `staging-tested-TIMESTAMP`
4. Deploys to staging ports (8080/5010/5433)
5. Runs health checks
6. Reports staging URL

**Output**:
```
🧪 STAGING DEPLOYMENT - Test Environment Only
✅ Prerequisites OK
✅ Code updated
✅ Images built
✅ Images tagged: staging-tested-20251029-143022
✅ Containers started
✅ Backend healthy (port 5010)
✅ Frontend healthy (port 8080)

Frontend:  http://20.217.84.100:8080
Backend:   http://20.217.84.100:5010/api
```

### Production Promotion (Method 1)

```bash
# On Azure VM
cd ~/ala-improved/deployment
./promote-to-production
```

**What it does**:
1. Confirms production deployment (type "yes")
2. Backs up production database
3. Tags staging images as production
4. Restarts production with promoted images
5. Runs health checks
6. Rolls back on failure

**Confirmation prompt**:
```
⚠️  PRODUCTION DEPLOYMENT - Image Promotion
This will:
1. Promote staging-tested images to production
2. Deploy to PRODUCTION (https://ala-app.israelcentral.cloudapp.azure.com)
3. Restart production services with new images

⚠️  This affects REAL PATIENTS and LIVE DATA

Type 'yes' to confirm:
```

### Production Promotion (Method 2)

```bash
# On Azure VM
cd ~/ala-improved/deployment
./deploy --from-staging
```

**What it does**: Same as `./promote-to-production`

### Standard Production Deploy (No Promotion)

```bash
# On Azure VM
cd ~/ala-improved/deployment
./deploy
```

**What it does**: Builds from scratch (traditional method, slower)

---

## Configuration Files

### Staging Environment

**File**: `deployment/.env.staging` (create from template)

```bash
# Copy template
cp .env.staging.template .env.staging

# Key differences from production:
NODE_ENV=staging
ENABLE_TEST_DATA=true
VITE_API_URL=http://20.217.84.100:5010/api
CORS_ORIGIN=http://20.217.84.100:8080

# Separate database
POSTGRES_DB=ala_staging
POSTGRES_USER=ala_staging_user
DATABASE_URL=postgresql://ala_staging_user:PASSWORD@db:5432/ala_staging
```

### Production Environment

**File**: `deployment/.env` (already exists)

```bash
NODE_ENV=production
ENABLE_TEST_DATA=false  # CRITICAL: Test users disabled
VITE_API_URL=https://ala-app.israelcentral.cloudapp.azure.com/api
CORS_ORIGIN=https://ala-app.israelcentral.cloudapp.azure.com

# Production database
POSTGRES_DB=ala_production
POSTGRES_USER=ala_user
DATABASE_URL=postgresql://ala_user:PASSWORD@db:5432/ala_production
```

---

## Testing Checklist

### Staging Tests (Before Promotion)

- [ ] Application loads at http://20.217.84.100:8080
- [ ] Yellow banner shows "🧪 STAGING - TEST DATA ONLY"
- [ ] Browser tab shows "🧪 [STAGING] ALA Medical"
- [ ] Login with test@example.com (code: 123456) works
- [ ] Test data loads (orders, applicators)
- [ ] New features work as expected
- [ ] No errors in console logs
- [ ] Mobile testing (access from phone)

### Production Verification (After Promotion)

- [ ] Application loads at https://ala-app.israelcentral.cloudapp.azure.com
- [ ] Green banner shows "✅ Production Environment"
- [ ] Browser tab shows "ALA Medical System"
- [ ] test@example.com returns 404 (correct behavior)
- [ ] Real users (alexs@alphatau.com) can login
- [ ] Real patient data loads correctly
- [ ] All features work normally
- [ ] Health check passes: `/api/health`

---

## Troubleshooting

### Staging deployment fails

```bash
# Check logs
cd ~/ala-improved/deployment
docker-compose -f docker-compose.yml -f docker-compose.staging.yml logs

# Common issues:
# 1. .env.staging missing -> Copy from .env.staging.template
# 2. Port conflicts -> Stop other containers
# 3. Build errors -> Check backend/frontend code
```

### Production promotion fails

```bash
# Check if staging images exist
docker images | grep staging

# If not found:
./deploy-staging  # Build staging first

# Check production health
curl http://localhost:5000/api/health
```

### Visual banner not showing

```bash
# Check VITE_API_URL in .env files
# Staging should contain ":5010"
# Production should NOT contain ":5010"

# Rebuild frontend if changed
docker-compose build frontend
```

### test@example.com works in production

```bash
# CRITICAL: This should never happen!
# Check .env file:
cat deployment/.env | grep ENABLE_TEST_DATA

# Should be:
ENABLE_TEST_DATA=false

# If true, fix immediately:
sed -i 's/ENABLE_TEST_DATA=true/ENABLE_TEST_DATA=false/' deployment/.env
./deploy
```

---

## Git Branching Strategy

### Feature Development

```bash
# 1. Create feature branch
git checkout -b feature/my-new-feature

# 2. Deploy to staging from feature branch
ssh azureuser@20.217.84.100
cd ~/ala-improved
git fetch origin
git checkout feature/my-new-feature
cd deployment
./deploy-staging

# 3. Test in staging

# 4. Create PR when ready
# 5. After PR approval, merge to main
# 6. Deploy to production from main branch
```

### Hotfix Process

```bash
# 1. Create hotfix branch from main
git checkout -b hotfix/critical-bug main

# 2. Fix bug, commit
git commit -m "fix: Critical bug"

# 3. Test in staging
./deploy-staging

# 4. If tests pass, merge to main
git checkout main
git merge hotfix/critical-bug
git push

# 5. Promote to production
./promote-to-production
```

---

## Rollback Procedures

### Rollback Staging

```bash
# Staging can be rolled back freely
cd ~/ala-improved/deployment
git checkout main  # Or previous branch
./deploy-staging
```

### Rollback Production

```bash
# Option 1: Use backup
cd ~/ala-improved/deployment
./rollback  # If script exists

# Option 2: Manual rollback
# 1. Find previous working images
docker images | grep production

# 2. Tag old images as current
docker tag ala-api:production-old ala-api:production
docker tag ala-frontend:production-old ala-frontend:production

# 3. Restart
docker-compose restart
```

### Database Rollback

```bash
# Restore from backup (created before each promotion)
cd ~/ala-improved/backups
ls -lt backup-*.sql | head -5  # Find recent backups

# Restore
cat backup-TIMESTAMP.sql | docker-compose exec -T db psql -U ala_user ala_production
```

---

## Best Practices

### DO

✅ Always test in staging before production
✅ Use image promotion for production (fast + safe)
✅ Commit to git before promoting to production
✅ Keep .env.staging and .env separate and correct
✅ Share staging URL with QA team for testing
✅ Monitor health checks after deployment

### DON'T

❌ Never test in production directly
❌ Never enable test data in production
❌ Never skip staging for "quick fixes"
❌ Never commit .env files to git
❌ Never mix staging and production databases
❌ Never promote without health check verification

---

## Performance Metrics

### Traditional Workflow (Build Everywhere)

- Local → Production: ~20 minutes
  - Staging build: 10 min
  - Production build: 10 min

### Image Promotion Workflow (NEW)

- Local → Production: ~10.5 minutes (**50% faster**)
  - Staging build: 10 min
  - Production promotion: 30 sec

### Hotfix Deployment

- Traditional: 10 minutes (rebuild)
- Image promotion: 30 seconds (reuse staging)

---

## Support

### Common Questions

**Q: Can I test without deploying?**
A: Yes, run `docker-compose up` locally.

**Q: How do I share staging with QA team?**
A: Give them `http://20.217.84.100:8080` URL.

**Q: What if staging and production diverge?**
A: Rebuild both from main branch: `./deploy-staging && ./deploy`

**Q: Can I promote partial changes?**
A: No, promotion is all-or-nothing. Test everything in staging first.

**Q: How do I know which environment I'm in?**
A: Look at the banner color (yellow=staging, green=production).

### Getting Help

- Check logs: `docker-compose logs -f`
- Check health: `curl http://localhost:5000/api/health`
- Review docs: `deployment/README.md`
- Contact: Development team

---

## Appendix: File Reference

### Created Files

- `deployment/docker-compose.staging.yml` - Staging overrides
- `deployment/deploy-staging` - Staging deployment script
- `deployment/promote-to-production` - Image promotion script
- `deployment/.env.staging.template` - Staging config template
- `frontend/src/components/EnvironmentBanner.tsx` - Visual banner
- `deployment/docs/IMAGE_PROMOTION_WORKFLOW.md` - This document

### Modified Files

- `deployment/docker-compose.yml` - Added image tags
- `deployment/deploy` - Added `--from-staging` flag
- `frontend/src/App.tsx` - Integrated banner

### Configuration Files

- `deployment/.env` - Production secrets (git-ignored)
- `deployment/.env.staging` - Staging secrets (git-ignored)
- `deployment/.env.production.template` - Production template
- `deployment/.env.staging.template` - Staging template
