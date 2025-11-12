# Docker Swarm Migration Guide
# ALA Medical Application

## Overview

This guide walks through the complete migration from Docker Compose to Docker Swarm for zero-downtime deployments.

**Current State:**
- Production running on Azure VM with Docker Compose
- `./deploy` script works but has ~60 seconds downtime
- Staging environment broken (blue-green promotion failed)

**Target State:**
- API and Frontend services in Docker Swarm (zero-downtime rolling updates)
- Database remains in Docker Compose (stability for medical data)
- Single `./swarm-deploy` command for all future deployments
- Automatic rollback on health check failures

**Timeline:**
- Phase 1 (30 min): Deploy patient name changes (current deploy method)
- Phase 2 (15 min): Clean up broken systems
- Phase 3 (45 min): Swarm migration during scheduled maintenance
- Phase 4 (15 min): Verify zero-downtime deployments

**Total Time:** ~2 hours (includes verification steps)

---

## Prerequisites

**Before starting:**

1. SSH access to Azure VM (20.217.84.100)
2. Database backup recent (automated daily backups exist)
3. Scheduled maintenance window (or accept one-time downtime for migration)
4. Git repository up to date

**Verify prerequisites:**

```bash
# 1. SSH to Azure VM
ssh azureuser@20.217.84.100

# 2. Check current deployment
cd ~/ala-improved/deployment
docker-compose ps

# Expected output:
# NAME        IMAGE                      STATUS
# ala-api     ala-api:production        Up (healthy)
# ala-db      postgres:15-alpine        Up (healthy)
# ala-frontend ala-frontend:production   Up (healthy)

# 3. Check disk space (need at least 5GB free for migration)
df -h

# 4. Verify database backup
ls -lh ~/ala-improved/backups/ | tail -5
```

---

## Phase 1: Deploy Patient Name Changes

**Purpose:** Deploy the patient name field changes using current deployment method before migrating to Swarm.

**Downtime:** ~60 seconds (acceptable for this one-time deployment)

**Steps:**

### 1.1 Verify Patient Name Changes Are in Code

```bash
# SSH to Azure VM
ssh azureuser@20.217.84.100

cd ~/ala-improved

# Verify commits are in main branch
git log --oneline | head -10

# Should show these commits:
# c08ceb6 feat(frontend): Add patient name display and update dependencies
# 8419179 feat(priority): Add patient name mapping from Priority API
# 551b654 feat(database): Add patient name migration and model support
```

### 1.2 Check if Migration Needed

```bash
# Check if patient_name column exists
docker exec -it ala-db psql -U ala_user -d ala_production -c "\d treatments"

# Look for patient_name column in output
# If it exists, skip to 1.4
# If it doesn't exist, continue to 1.3
```

### 1.3 Apply Database Migration (If Needed)

```bash
cd ~/ala-improved/backend/src/migrations

# Copy migration to database container
docker cp 20251111000000-add-patient-name.sql ala-db:/tmp/

# Apply migration
docker exec -it ala-db psql -U ala_user -d ala_production -f /tmp/20251111000000-add-patient-name.sql

# Expected output:
# ALTER TABLE

# Verify column was added
docker exec -it ala-db psql -U ala_user -d ala_production -c "\d treatments"

# Should show:
# patient_name | character varying(255) | | |
```

### 1.4 Deploy Patient Name Code

```bash
cd ~/ala-improved/deployment

# Pull latest code (includes patient name commits)
cd ~/ala-improved
git pull origin main

# Deploy using current method
cd ~/ala-improved/deployment
./deploy

# This will:
# 1. Backup database
# 2. Pull latest code
# 3. Build new images
# 4. Restart services (~60 seconds downtime)
# 5. Verify health checks
# 6. Clean up old images

# Wait for completion (5-10 minutes)
```

### 1.5 Verify Patient Name Feature

```bash
# Check API health
curl http://localhost:5000/api/health

# Expected output:
# {"status":"ok","timestamp":"2024-11-12T...","database":"connected","priority":"reachable"}

# Check frontend
curl http://localhost:80

# Should return HTML (200 OK)

# Test patient name in UI:
# 1. Open browser: https://ala-app.israelcentral.cloudapp.azure.com
# 2. Login with test account or admin account
# 3. Navigate to treatment tracking
# 4. Verify patient name displays correctly
```

**Phase 1 Complete!** Patient name feature is now in production.

---

## Phase 2: Clean Up Broken Systems

**Purpose:** Remove broken staging and blue-green deployment files before Swarm migration.

**Downtime:** None (file cleanup only)

**Steps:**

### 2.1 Identify Broken Files

```bash
cd ~/ala-improved/deployment

# List all deployment-related files
ls -lh

# Look for these broken files:
# - deploy-staging (broken staging script)
# - promote-to-production (broken promotion script)
# - docker-compose.staging.yml (broken staging config)
# - docs/IMAGE_PROMOTION_WORKFLOW.md (incorrect documentation)
# - azure/ directory (if exists, may contain old blue-green configs)
```

### 2.2 Archive Broken Files

```bash
cd ~/ala-improved/deployment

# Create archive directory
mkdir -p archive/broken-configs

# Move broken files to archive (preserves for reference)
# Note: Only move files that actually exist

# If deploy-staging exists:
[ -f deploy-staging ] && mv deploy-staging archive/broken-configs/

# If promote-to-production exists:
[ -f promote-to-production ] && mv promote-to-production archive/broken-configs/

# If docker-compose.staging.yml exists:
[ -f docker-compose.staging.yml ] && mv docker-compose.staging.yml archive/broken-configs/

# If IMAGE_PROMOTION_WORKFLOW.md exists:
[ -f docs/IMAGE_PROMOTION_WORKFLOW.md ] && mv docs/IMAGE_PROMOTION_WORKFLOW.md archive/broken-configs/

# If azure/ directory exists with old configs:
if [ -d azure ] && [ "$(ls -A azure)" ]; then
    mv azure archive/broken-configs/
fi

# Create README in archive explaining why these were archived
cat > archive/broken-configs/README.md << 'EOF'
# Archived: Broken Deployment Configurations

These files were archived on $(date +%Y-%m-%d) during Docker Swarm migration.

## Why Archived

1. **deploy-staging** - Staging environment broken, couldn't run
2. **promote-to-production** - Image promotion workflow fundamentally flawed
   - Attempted to tag staging images for production
   - Failed because staging/production have different build-time configs
   - Broke both staging AND production on October 27, 2025
3. **docker-compose.staging.yml** - Staging config incompatible with production
4. **IMAGE_PROMOTION_WORKFLOW.md** - Documentation for broken workflow
5. **azure/** - Old blue-green deployment configs that caused production outage

## What Replaced Them

Docker Swarm with rolling updates provides TRUE zero-downtime:
- No need for staging environment as separate infrastructure
- No image promotion (build fresh for each deployment)
- Automatic health checks and rollback
- See: SWARM_OPERATIONS.md, SWARM_MIGRATION.md

## Lessons Learned

1. Image promotion doesn't work when configs differ between environments
2. Never test deployment infrastructure on production
3. Simplicity wins - Swarm rolling updates are simpler and more reliable
4. Zero-downtime is achieved by starting new containers before stopping old ones
EOF
```

### 2.3 Stop Any Orphaned Staging Containers

```bash
# Check for any running staging containers
docker ps -a | grep staging

# If any exist, stop and remove them
docker ps -a | grep staging | awk '{print $1}' | xargs -r docker stop
docker ps -a | grep staging | awk '{print $1}' | xargs -r docker rm

# Clean up any staging images
docker images | grep staging | awk '{print $3}' | xargs -r docker rmi

# Clean up any blue-green containers (if they exist)
docker ps -a | grep -E 'blue|green' | awk '{print $1}' | xargs -r docker stop
docker ps -a | grep -E 'blue|green' | awk '{print $1}' | xargs -r docker rm
```

### 2.4 Commit and Push Archive Changes

```bash
cd ~/ala-improved

# Stage archive directory and removed files
git add deployment/archive/
git status  # Verify only archive files are staged

# Commit the cleanup
git commit -m "chore(deployment): Archive broken staging and promotion configs

- Moved broken staging deployment scripts to archive
- Moved broken image promotion workflow to archive
- Added README explaining why configs were archived
- Preparing for Docker Swarm migration with zero-downtime deployments

Archived files:
- deploy-staging (staging environment broken)
- promote-to-production (image promotion fundamentally flawed)
- docker-compose.staging.yml (staging config incompatible)
- IMAGE_PROMOTION_WORKFLOW.md (documentation for broken workflow)
- azure/ (old blue-green configs that caused October 27 outage)

See: deployment/SWARM_MIGRATION.md for migration plan"

# Push to GitHub
git push origin main
```

**Phase 2 Complete!** Broken files archived and cleaned up.

---

## Phase 3: Docker Swarm Migration

**Purpose:** Migrate API and Frontend to Docker Swarm for zero-downtime deployments.

**Downtime:** ~5 minutes during initial Swarm setup (one-time only)

**Important:** This phase requires scheduled maintenance window.

### 3.1 Backup Everything

```bash
cd ~/ala-improved/deployment

# Backup database
docker exec ala-db pg_dump -U ala_user ala_production > \
    ~/ala-improved/backups/backup-pre-swarm-$(date +%Y%m%d-%H%M%S).sql

# Verify backup size (should be several MB)
ls -lh ~/ala-improved/backups/backup-pre-swarm-*.sql | tail -1

# Backup current .env file
cp .env .env.backup-pre-swarm

# Document current running state
docker-compose ps > ~/current-state-pre-swarm.txt
docker ps >> ~/current-state-pre-swarm.txt
```

### 3.2 Pull Latest Swarm Configuration

```bash
cd ~/ala-improved

# Pull latest code (includes Swarm configs from this migration)
git pull origin main

# Verify Swarm files exist
ls -lh deployment/docker-stack.yml
ls -lh deployment/docker-compose.db.yml
ls -lh deployment/swarm-deploy
ls -lh deployment/SWARM_OPERATIONS.md
ls -lh deployment/SWARM_MIGRATION.md

# Make swarm-deploy executable
chmod +x deployment/swarm-deploy
```

### 3.3 Stop Current Production Containers

**⚠️ DOWNTIME BEGINS HERE (~5 minutes)**

```bash
cd ~/ala-improved/deployment

# Stop API and Frontend (keep database running!)
docker-compose stop api frontend

# Verify only database is running
docker ps

# Expected output:
# CONTAINER ID   IMAGE                  STATUS
# <id>           postgres:15-alpine     Up (ala-db)

# Remove stopped containers
docker-compose rm -f api frontend
```

### 3.4 Initialize Docker Swarm

```bash
# Get VM's IP address
VM_IP=$(hostname -I | awk '{print $1}')
echo "VM IP: $VM_IP"

# Initialize Swarm
docker swarm init --advertise-addr $VM_IP

# Expected output:
# Swarm initialized: current node (abc123...) is now a manager.

# Verify Swarm is active
docker info | grep Swarm

# Expected output:
# Swarm: active
#  NodeID: abc123...
#  Is Manager: true
```

### 3.5 Create Overlay Network

```bash
# Create overlay network for Swarm services
docker network create --driver overlay --attachable ala-network

# Verify network was created
docker network ls | grep ala-network

# Expected output:
# abc123...  ala-network  overlay  swarm
```

### 3.6 Reconnect Database to Overlay Network

```bash
cd ~/ala-improved/deployment

# Stop database (data persists in volume)
docker-compose -f docker-compose.db.yml down

# Start database with overlay network
docker-compose -f docker-compose.db.yml up -d

# Verify database is healthy
docker ps | grep ala-db

# Wait for database to be ready
sleep 10
docker exec ala-db pg_isready -U ala_user -d ala_production

# Expected output:
# /var/run/postgresql:5432 - accepting connections
```

### 3.7 Deploy Swarm Services (First Time)

```bash
cd ~/ala-improved/deployment

# First deployment (builds images and creates services)
./swarm-deploy

# This will:
# 1. Check prerequisites (Swarm active, network exists, database running)
# 2. Pull latest code
# 3. Build API and Frontend images with timestamp version
# 4. Deploy to Swarm with 2 replicas each
# 5. Monitor deployment progress
# 6. Verify health checks
# 7. Report success or failure

# Wait for completion (5-10 minutes for first deployment)

# Expected output at end:
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ✅ 🎉 DEPLOYMENT SUCCESSFUL - ZERO DOWNTIME!
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**⚠️ DOWNTIME ENDS HERE**

### 3.8 Verify Swarm Services

```bash
# Check all services are running
docker service ls

# Expected output:
# NAME            REPLICAS   IMAGE                    PORTS
# ala_api         2/2        ala-api:latest          *:5000->5000/tcp
# ala_frontend    2/2        ala-frontend:latest     *:80->8080/tcp, *:443->8443/tcp

# Check API service details
docker service ps ala_api

# Expected output shows 2 running replicas:
# NAME         IMAGE           NODE     DESIRED STATE   CURRENT STATE
# ala_api.1    ala-api:latest  ALAapp   Running         Running 2 minutes ago
# ala_api.2    ala-api:latest  ALAapp   Running         Running 2 minutes ago

# Check frontend service details
docker service ps ala_frontend

# View API logs
docker service logs --tail 50 ala_api

# View frontend logs
docker service logs --tail 50 ala_frontend
```

### 3.9 Verify Application Health

```bash
# Check backend health
curl http://localhost:5000/api/health

# Expected output:
# {"status":"ok","timestamp":"2024-11-12T...","database":"connected","priority":"reachable"}

# Check frontend
curl http://localhost:80

# Should return HTML (200 OK)

# Check HTTPS
curl https://localhost:443

# Should return HTML with valid SSL

# Test from browser:
# 1. Open: https://ala-app.israelcentral.cloudapp.azure.com
# 2. Login with test account
# 3. Navigate through all major features
# 4. Verify patient name displays correctly
# 5. Test treatment tracking workflow
# 6. Check Priority API integration (applicator validation)
```

### 3.10 Document Migration Completion

```bash
cd ~/ala-improved/deployment

# Create migration completion record
cat > SWARM_MIGRATED.txt << EOF
Docker Swarm Migration Completed: $(date)

Migration Details:
- Migrated from: Docker Compose (docker-compose.yml)
- Migrated to: Docker Swarm (docker-stack.yml)
- Database: Remains in Docker Compose (docker-compose.db.yml)
- Deployment script: ./swarm-deploy

Services in Swarm:
- ala_api (2 replicas)
- ala_frontend (2 replicas)

Services in Compose:
- ala-db (postgres:15-alpine)

Pre-migration backup:
$(ls -lh ~/ala-improved/backups/backup-pre-swarm-*.sql | tail -1)

Verification:
- Health checks: PASSED
- Frontend accessible: YES
- Backend API accessible: YES
- Database connectivity: OK
- Priority API integration: OK
- Patient name feature: WORKING

Next deployment will use: ./swarm-deploy (zero-downtime rolling update)

Operations guide: deployment/SWARM_OPERATIONS.md
EOF

# Display migration summary
cat SWARM_MIGRATED.txt
```

**Phase 3 Complete!** Docker Swarm migration successful.

---

## Phase 4: Verify Zero-Downtime Deployments

**Purpose:** Test that future deployments have zero downtime.

**Downtime:** ZERO (that's the point!)

**Steps:**

### 4.1 Make a Test Change

```bash
cd ~/ala-improved

# Make a trivial change to backend (add comment)
cat >> backend/src/index.ts << 'EOF'

// Test comment for zero-downtime deployment verification
EOF

# Commit the test change
git add backend/src/index.ts
git commit -m "test: Verify zero-downtime deployment (will revert)"
git push origin main
```

### 4.2 Deploy Test Change

```bash
cd ~/ala-improved/deployment

# Deploy using swarm-deploy
./swarm-deploy

# Watch the deployment process:
# 1. Pulls latest code
# 2. Builds new images with timestamp version
# 3. Starts NEW API replica (now 3 replicas running!)
# 4. Waits for health check on new replica
# 5. Removes OLD API replica (back to 2 replicas)
# 6. Waits 30 seconds
# 7. Repeats for second API replica
# 8. Same process for Frontend replicas
# 9. All done - ZERO user interruption!

# Monitor during deployment (in separate terminal):
watch -n 2 'docker service ls'

# You'll see replicas go 2/2 -> 3/2 -> 2/2 -> 3/2 -> 2/2
# This proves zero-downtime: always at least 2 healthy replicas!
```

### 4.3 Verify Zero Downtime

**Option 1: Manual browser testing**

```bash
# During deployment, keep browser open to:
# https://ala-app.israelcentral.cloudapp.azure.com

# Continuously click through pages:
# - Login page
# - Dashboard
# - Treatment tracking
# - Scanner

# You should NOT see any errors or interruptions!
```

**Option 2: Automated monitoring**

```bash
# In separate terminal, run continuous health checks
while true; do
    curl -s http://localhost:5000/api/health > /dev/null && echo "✅ $(date +%H:%M:%S) API healthy" || echo "❌ $(date +%H:%M:%S) API DOWN"
    sleep 1
done

# During deployment, this should show continuous ✅ with no ❌
# If you see any ❌, deployment is NOT zero-downtime (investigate!)
```

### 4.4 Revert Test Change

```bash
cd ~/ala-improved

# Revert the test commit
git revert HEAD --no-edit
git push origin main

# Deploy the revert (also zero-downtime!)
cd deployment
./swarm-deploy

# Verify still zero downtime during revert deployment
```

### 4.5 Test Automatic Rollback

**Create an intentionally broken change to verify automatic rollback:**

```bash
cd ~/ala-improved/backend/src

# Break the health endpoint
cp routes/healthRoute.ts routes/healthRoute.ts.backup

cat > routes/healthRoute.ts << 'EOF'
import { Router, Request, Response } from 'express';
const router = Router();

// Intentionally broken - always returns 500
router.get('/health', (req: Request, res: Response) => {
  res.status(500).json({ status: 'error' });
});

export default router;
EOF

# Commit the broken change
cd ~/ala-improved
git add backend/src/routes/healthRoute.ts
git commit -m "test: Intentionally break health check to verify rollback"
git push origin main
```

**Deploy the broken change:**

```bash
cd ~/ala-improved/deployment

# Deploy broken version
./swarm-deploy

# Watch what happens:
# 1. Builds new image with broken health endpoint
# 2. Starts new replica
# 3. Health check FAILS (returns 500 instead of 200)
# 4. Swarm detects failure
# 5. AUTOMATIC ROLLBACK to previous version
# 6. Old healthy replicas keep running throughout!

# Expected output:
# ⚠️  ala_api did not reach 2/2 replicas within timeout
# ❌ Deployment may have failed - check logs: docker service logs ala_api

# Check rollback happened
docker service ps ala_api

# You'll see:
# - New replica with "Failed" or "Rejected" state
# - Old replicas still "Running"

# Verify app still works (rollback succeeded!)
curl http://localhost:5000/api/health

# Expected output:
# {"status":"ok",...}  <- OLD version still running!
```

**Restore working version:**

```bash
cd ~/ala-improved/backend/src/routes

# Restore original health route
mv healthRoute.ts.backup healthRoute.ts

# Commit fix
cd ~/ala-improved
git add backend/src/routes/healthRoute.ts
git commit -m "fix: Restore working health endpoint after rollback test"
git push origin main

# Deploy working version
cd deployment
./swarm-deploy

# This time it should succeed (health checks pass)
```

### 4.6 Document Verification Results

```bash
cd ~/ala-improved/deployment

# Add verification results to migration record
cat >> SWARM_MIGRATED.txt << EOF

Zero-Downtime Verification Completed: $(date)

Test 1: Test Change Deployment
- Deployment time: ~2 minutes
- User interruption: ZERO
- API health checks: Continuous ✅
- Frontend accessibility: Continuous ✅

Test 2: Revert Deployment
- Deployment time: ~2 minutes
- User interruption: ZERO
- Rollback to previous version: SUCCESS

Test 3: Automatic Rollback
- Intentionally broke health endpoint
- Swarm detected failure
- Automatic rollback: SUCCESS
- Old version kept running: YES
- User interruption: ZERO

Conclusion:
✅ Zero-downtime deployments VERIFIED
✅ Automatic rollback VERIFIED
✅ Rolling update strategy WORKING
✅ Production ready for monthly deployments

Next deployment: Simply run ./swarm-deploy
EOF

cat SWARM_MIGRATED.txt
```

**Phase 4 Complete!** Zero-downtime deployments verified and tested.

---

## Post-Migration

### Daily Operations

From now on, deployments are simple:

```bash
# SSH to Azure VM
ssh azureuser@20.217.84.100

# Deploy new version (zero downtime!)
cd ~/ala-improved/deployment
./swarm-deploy

# That's it! No downtime, automatic rollback on failure.
```

**For detailed operations, see:** [SWARM_OPERATIONS.md](SWARM_OPERATIONS.md)

### Monitoring Commands

```bash
# View all services
docker service ls

# View API replicas
docker service ps ala_api

# View logs
docker service logs -f ala_api
docker service logs -f ala_frontend

# Database logs (still in Compose)
docker-compose -f docker-compose.db.yml logs -f
```

### Rollback Commands

```bash
# Instant rollback to previous version
docker service rollback ala_api
docker service rollback ala_frontend

# Rollback to specific version
docker service update --image ala-api:20241112-143000 ala_api
```

### Cleanup Old Files

After migration is stable (e.g., after 1 week), you can remove old deployment files:

```bash
cd ~/ala-improved/deployment

# Remove old deploy script (replaced by swarm-deploy)
rm deploy

# Remove old docker-compose.yml (replaced by docker-stack.yml + docker-compose.db.yml)
rm docker-compose.yml

# Keep archive/ for reference
# Keep backups/ directory
# Keep .env and .env.production.template
```

---

## Troubleshooting

### Migration Failed at Phase 3.7 (First Swarm Deployment)

**Symptom:** `./swarm-deploy` fails with error

**Diagnosis:**

```bash
# Check Swarm status
docker info | grep Swarm

# Check network
docker network ls | grep ala-network

# Check database
docker ps | grep ala-db
docker exec ala-db pg_isready -U ala_user -d ala_production

# Check logs
docker service logs ala_api
docker service logs ala_frontend
```

**Common causes:**

1. **Network not created:** Run `docker network create --driver overlay --attachable ala-network`
2. **Database not running:** Run `docker-compose -f docker-compose.db.yml up -d`
3. **Swarm not initialized:** Run `docker swarm init --advertise-addr $(hostname -I | awk '{print $1}')`
4. **Image build failed:** Check build logs, fix errors, retry

**Recovery:**

```bash
# Remove failed stack
docker stack rm ala

# Wait for cleanup
sleep 30

# Fix the issue (network, database, etc.)

# Retry deployment
./swarm-deploy
```

### Rollback to Pre-Swarm State

**If migration fails completely and you need to rollback:**

```bash
# 1. Remove Swarm stack
docker stack rm ala

# Wait for services to stop
sleep 30

# 2. Leave Swarm mode
docker swarm leave --force

# 3. Remove overlay network
docker network rm ala-network

# 4. Restore database from backup (if needed)
cat ~/ala-improved/backups/backup-pre-swarm-YYYYMMDD-HHMMSS.sql | \
    docker exec -i ala-db psql -U ala_user -d ala_production

# 5. Start with old docker-compose.yml
cd ~/ala-improved/deployment
git checkout HEAD~1 -- docker-compose.yml  # Get old compose file
docker-compose up -d

# 6. Verify health
curl http://localhost:5000/api/health
```

### Service Stuck During Deployment

**Symptom:** Deployment hangs, replicas stuck at 1/2 or 0/2

**Diagnosis:**

```bash
# Check service tasks
docker service ps ala_api

# Look for "Rejected" or "Failed" tasks
# Check error messages in CURRENT STATE column

# View detailed logs
docker service logs --tail 100 ala_api
```

**Fix:**

```bash
# Force update to retry
docker service update --force ala_api

# Or rollback
docker service rollback ala_api

# Or remove and redeploy
docker stack rm ala
sleep 30
./swarm-deploy
```

### Health Checks Failing

**Symptom:** New replicas fail health checks, automatic rollback occurs

**Diagnosis:**

```bash
# Check health endpoint manually
curl http://localhost:5000/api/health

# If it fails, check why:
docker service logs --tail 50 ala_api

# Common causes:
# - Database connection failed
# - Environment variables missing
# - Port conflict
# - Nginx config issue (frontend)
```

**Fix based on error:**

```bash
# Database connection: Verify .env has correct credentials
cat .env | grep POSTGRES

# Port conflict: Check nothing else using ports 5000, 80, 443
netstat -tulpn | grep -E '5000|80|443'

# Environment variables: Verify .env file complete
diff .env .env.production.template
```

---

## Validation Checklist

After completing all phases, verify everything is working:

### ✅ Phase 1 Validation
- [ ] Patient name field appears in UI
- [ ] Patient name column exists in database
- [ ] Treatment tracking shows patient names correctly
- [ ] API health check passes
- [ ] Frontend loads without errors

### ✅ Phase 2 Validation
- [ ] Broken staging files archived to `archive/broken-configs/`
- [ ] No orphaned staging containers running
- [ ] Archive README explains why files were removed
- [ ] Changes committed to Git

### ✅ Phase 3 Validation
- [ ] Docker Swarm initialized and active
- [ ] Overlay network `ala-network` exists
- [ ] Database running in Docker Compose
- [ ] `docker service ls` shows `ala_api` and `ala_frontend` with 2/2 replicas
- [ ] API health check passes: `curl http://localhost:5000/api/health`
- [ ] Frontend accessible: `curl http://localhost:80`
- [ ] HTTPS works: `curl https://localhost:443`
- [ ] Browser access works: https://ala-app.israelcentral.cloudapp.azure.com

### ✅ Phase 4 Validation
- [ ] Test deployment completed with zero downtime
- [ ] Continuous health checks showed no interruptions
- [ ] Revert deployment completed with zero downtime
- [ ] Automatic rollback test succeeded (broken health check detected and rolled back)
- [ ] Old version kept running during rollback
- [ ] Final health checks pass

### ✅ Post-Migration Validation
- [ ] `./swarm-deploy` script works
- [ ] Monthly deployment workflow documented
- [ ] Monitoring commands tested
- [ ] Rollback commands tested
- [ ] Operations guide reviewed: `SWARM_OPERATIONS.md`
- [ ] Migration record created: `SWARM_MIGRATED.txt`

---

## Migration Timeline

**Estimated timeline for each phase:**

| Phase | Duration | Downtime | Can be scheduled? |
|-------|----------|----------|-------------------|
| Phase 1: Patient Name Deployment | 30 min | ~60 sec | Yes, any time |
| Phase 2: Cleanup | 15 min | None | Yes, any time |
| Phase 3: Swarm Migration | 45 min | ~5 min | Requires maintenance window |
| Phase 4: Verification | 15 min | None | Immediately after Phase 3 |
| **Total** | **~2 hours** | **~6 minutes** | - |

**Recommended schedule:**

1. **Week 1:** Phase 1 + Phase 2 (no maintenance window needed)
   - Deploy patient name changes (60 sec downtime acceptable)
   - Clean up broken files (no downtime)

2. **Week 2:** Phase 3 + Phase 4 (schedule maintenance window)
   - Announce 10-minute maintenance window to users
   - Perform Swarm migration (~5 min actual downtime)
   - Verify zero-downtime deployments work
   - Future deployments = zero downtime!

---

## Success Criteria

Migration is successful when:

1. ✅ All services running in Docker Swarm (except database)
2. ✅ `docker service ls` shows 2/2 replicas for API and Frontend
3. ✅ Application accessible and fully functional
4. ✅ Patient name feature working correctly
5. ✅ `./swarm-deploy` completes successfully with zero downtime
6. ✅ Test deployment verified zero user interruption
7. ✅ Automatic rollback tested and working
8. ✅ Health checks passing consistently
9. ✅ Monitoring commands documented and tested
10. ✅ Rollback procedures documented and tested

---

## Next Steps After Migration

1. **Monitor for 1 week:** Ensure stability before declaring migration complete
2. **Schedule next deployment:** Test monthly deployment workflow
3. **Document any issues:** Add to SWARM_OPERATIONS.md troubleshooting section
4. **Remove old files:** After stable, clean up old deployment scripts
5. **Update documentation:** Ensure all guides reference new deployment method

---

## Support

**For migration issues:**
- Check troubleshooting section above
- Review SWARM_OPERATIONS.md for detailed operations guide
- Check service logs: `docker service logs ala_api`
- Verify prerequisites: Swarm active, network exists, database running

**For emergency rollback:**
- Follow "Rollback to Pre-Swarm State" section above
- Restore from backup: `~/ala-improved/backups/backup-pre-swarm-*.sql`
- Contact: Check Azure VM SSH access, verify backups exist

**Documentation:**
- Operations guide: [SWARM_OPERATIONS.md](SWARM_OPERATIONS.md)
- Stack configuration: [docker-stack.yml](docker-stack.yml)
- Database config: [docker-compose.db.yml](docker-compose.db.yml)
- Deployment script: [swarm-deploy](swarm-deploy)
