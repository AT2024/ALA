# Docker Swarm Operations Guide
# ALA Medical Application

## Table of Contents
1. [Daily Operations](#daily-operations)
2. [Zero-Downtime Deployment](#zero-downtime-deployment)
3. [Monitoring & Health Checks](#monitoring--health-checks)
4. [Rollback Procedures](#rollback-procedures)
5. [Troubleshooting](#troubleshooting)
6. [Database Operations](#database-operations)
7. [Emergency Procedures](#emergency-procedures)

---

## Daily Operations

### Standard Deployment (Monthly Updates)

**Simple, zero-downtime deployment:**

```bash
# 1. SSH to Azure VM
ssh azureuser@20.217.84.100

# 2. Deploy new version
cd ~/ala-improved/deployment
./swarm-deploy

# That's it! Rolling update happens automatically with zero downtime.
```

**What happens during deployment:**
1. Pulls latest code from GitHub
2. Builds new Docker images with timestamp version
3. Starts new API replica (users still use old replicas)
4. Waits for new API health check to pass
5. Removes old API replica (users now use new replica)
6. Repeats for second API replica
7. Same process for frontend replicas
8. **Users experience ZERO downtime** throughout entire process

**Time**: 5-10 minutes
**Downtime**: 0 seconds
**User impact**: None

### Fast Deployment (Skip Build)

If you only changed code and didn't modify dependencies:

```bash
./swarm-deploy --skip-build
```

Uses existing images, faster deployment (~2 minutes).

### Deploy Specific Version

```bash
./swarm-deploy --version 20241112-143000
```

Useful for promoting from test/staging or rolling back to known good version.

---

## Zero-Downtime Deployment

### How It Works

**Key configuration** (in [docker-stack.yml](docker-stack.yml)):

```yaml
deploy:
  replicas: 2                    # Run 2 copies of each service
  update_config:
    parallelism: 1               # Update 1 replica at a time
    delay: 30s                   # Wait 30s between updates
    order: start-first           # KEY: Start new before stopping old
    failure_action: rollback     # Auto-rollback on failure
```

**Update sequence for API service:**

```
Before:  [API Replica 1 (old)] [API Replica 2 (old)]
         ↓
Step 1:  [API Replica 1 (old)] [API Replica 2 (old)] [API Replica 3 (new)]
         Wait for health check on Replica 3...
         ↓
Step 2:  [API Replica 2 (old)] [API Replica 3 (new)]
         Wait 30 seconds (delay)...
         ↓
Step 3:  [API Replica 2 (old)] [API Replica 3 (new)] [API Replica 4 (new)]
         Wait for health check on Replica 4...
         ↓
Step 4:  [API Replica 3 (new)] [API Replica 4 (new)]
         ↓
Done:    2 replicas running new version, ZERO downtime!
```

**At any point during deployment:**
- At least 2 replicas are running
- Users are load-balanced across healthy replicas
- If new replica fails health check → automatic rollback
- Zero service interruption

### Restart Policy (Local vs Azure Parity Gap #5)

**Azure Swarm restart policy** (in docker-stack.yml):
```yaml
restart_policy:
  condition: on-failure     # Only restart if container fails
  delay: 5s                 # Wait 5s between restarts
  max_attempts: 3           # Maximum 3 restart attempts
  window: 120s              # Reset counter after 120s window
```

**Local Docker Compose restart policy** (in docker-compose.yml):
```yaml
restart: always             # Always restart, no limit
```

**Why the difference?**
- **Azure (Production)**: Uses circuit breaker pattern - if a container fails 3 times in 2 minutes, stop retrying to prevent cascading failures and allow investigation
- **Local (Development)**: Always restart for convenience during development cycles

**Impact:**
- In production, persistent failures will be surfaced instead of silently restarting
- Check `docker service ps ala_api` to see failed task history
- After fixing the issue, services will resume normal operation

See `docs/design-logs/2026-01-environment-alignment.md` for complete parity gap documentation.

---

## Monitoring & Health Checks

### View All Services

```bash
docker service ls
```

**Expected output:**
```
NAME           REPLICAS   IMAGE                    PORTS
ala_api        2/2        ala-api:latest          *:5000->5000/tcp
ala_frontend   2/2        ala-frontend:latest     *:80->8080/tcp, *:443->8443/tcp
```

- `2/2` = 2 replicas running, 2 replicas desired (healthy)
- `1/2` = Only 1 replica running (unhealthy, investigate!)
- `0/2` = Service down (critical!)

### View Service Details

```bash
# View API service details
docker service ps ala_api

# View frontend service details
docker service ps ala_frontend
```

**Output shows:**
- Task ID (unique identifier for each replica)
- Node (which VM it's running on)
- Desired state vs current state
- Error messages if failed

**Example output:**
```
NAME            IMAGE              NODE      DESIRED STATE   CURRENT STATE
ala_api.1       ala-api:latest    ALAapp    Running         Running 2 minutes ago
ala_api.2       ala-api:latest    ALAapp    Running         Running 2 minutes ago
```

### View Logs

```bash
# Follow API logs (real-time)
docker service logs -f ala_api

# Follow frontend logs
docker service logs -f ala_frontend

# View last 100 lines
docker service logs --tail 100 ala_api

# View logs from specific timestamp
docker service logs --since 30m ala_api
```

### Health Check Endpoints

```bash
# Backend health
curl http://localhost:5000/api/health

# Frontend health
curl http://localhost:80

# Production HTTPS
curl https://ala-app.israelcentral.cloudapp.azure.com/api/health
```

**Expected response:**
```json
{
  "status": "ok",
  "timestamp": "2024-11-12T14:30:00.000Z",
  "database": "connected",
  "priority": "reachable"
}
```

### Verifying Deployment Success

**IMPORTANT: Always verify after running swarm-deploy**

#### 1. Check Service Image Tags

```bash
# Both services should show matching timestamped versions
docker service inspect ala_api --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}'
docker service inspect ala_frontend --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}'
```

**Expected**: Both show same version tag (e.g., `ala-api:20251113-140140` and `ala-frontend:20251113-140140`)

**If mismatched**: One service failed to deploy and rolled back - investigate!

#### 2. Check for Failed Tasks

```bash
# Look for recent deployment failures
docker service ps ala_frontend --format 'table {{.Name}}\t{{.Image}}\t{{.CurrentState}}\t{{.Error}}'
docker service ps ala_api --format 'table {{.Name}}\t{{.Image}}\t{{.CurrentState}}\t{{.Error}}'
```

**Look for**:
- "Failed" in CurrentState column
- Error messages like "task: non-zero exit (1)"
- Recent timestamps (within last few minutes)

**If found**: Deployment failed and rolled back - check logs and fix issue

#### 3. Check Running Containers

```bash
# Verify all containers are healthy with current version
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
```

**Expected**:
- All containers show latest version tag
- Status shows "(healthy)"
- No containers in "restarting" or "unhealthy" state

#### 4. Test Application

**Best real-world verification:**
1. Open application in browser: https://ala-app.israelcentral.cloudapp.azure.com
2. Log in with test account
3. Verify new features work
4. Open browser DevTools → Network tab
5. Check asset filenames (e.g., `TreatmentSelection-<hash>.js`)
6. Hash should change with each deployment

### Understanding Tag Mismatches

**Situation**: Service shows old tag (e.g., `cors-fixed`) but app works fine

**What happened**:
- Latest deployment failed and rolled back
- Service stayed on previous successful tag
- That "old tag" may contain recent code from earlier deployment

**How to verify**:
```bash
# Check when image was actually built
docker image inspect ala-frontend:cors-fixed --format '{{.Created}}'
# If recent (< 1 week) → contains recent code

# Check actual assets in running container
docker exec $(docker ps -q --filter name=ala_frontend.1) \
  ls -la /usr/share/nginx/html/assets/ | grep Treatment
# Check file modification dates
```

**Action**:
- If app works correctly: Not urgent, fix deployment issue when convenient
- If features missing: Investigate error, fix, and redeploy immediately

**See [TAG_TRACKING.md](./TAG_TRACKING.md) for comprehensive guide on tag vs. code distinction**

### Resource Usage

```bash
# View resource usage by service
docker stats

# View detailed service info
docker service inspect ala_api --pretty
```

---

## Rollback Procedures

### Automatic Rollback

**Swarm automatically rolls back if:**
- New replica fails health checks
- New replica crashes repeatedly
- Update timeout exceeded

**What happens:**
1. Swarm detects failure
2. Stops rolling out new version
3. Reverts to previous version
4. Logs error message

**Check rollback logs:**
```bash
docker service ps ala_api | grep -i failed
```

### Manual Rollback

**Instant rollback to previous version:**

```bash
# Rollback API service
docker service rollback ala_api

# Rollback frontend service
docker service rollback ala_frontend

# Rollback both
docker service rollback ala_api && docker service rollback ala_frontend
```

**Rollback happens with zero downtime** (same rolling update process, just in reverse).

### Rollback to Specific Version

If you know the version you want to rollback to:

```bash
# Rollback to specific version
docker service update --image ala-api:20241112-143000 ala_api
docker service update --image ala-frontend:20241112-143000 ala_frontend
```

### Complete System Rollback

**Emergency: Revert to Docker Compose (pre-Swarm):**

```bash
# 1. Remove Swarm stack
docker stack rm ala

# 2. Wait for services to stop
sleep 30

# 3. Leave Swarm mode
docker swarm leave --force

# 4. Restore database from backup (if needed)
cat ~/backups/backup-pre-swarm-YYYYMMDD.sql | \
    docker exec -i ala-db psql -U ala_user -d ala_production

# 5. Start with old docker-compose.yml
cd ~/ala-improved/deployment
docker-compose up -d
```

---

## Troubleshooting

### Service Won't Start

**Symptom:** `docker service ls` shows `0/2` replicas

**Diagnosis:**
```bash
# Check recent tasks
docker service ps ala_api

# Check for error messages
docker service logs --tail 50 ala_api

# Inspect service configuration
docker service inspect ala_api
```

**Common causes:**
1. **Health check failing**: Check `/api/health` endpoint manually
2. **Database not running**: Start database first
3. **Image not found**: Check `docker images` for correct image tag
4. **Port conflict**: Check `docker ps` for conflicting containers
5. **Network issue**: Verify `ala-network` exists

**Fix:**
```bash
# Restart service
docker service update --force ala_api

# Or remove and redeploy
docker stack rm ala
docker stack deploy -c docker-stack.yml ala
```

### Service Stuck at `1/2` Replicas

**Symptom:** One replica running, one replica constantly restarting

**Diagnosis:**
```bash
# Check which replica is failing
docker service ps ala_api

# View logs from failing replica
docker service logs ala_api | grep ERROR
```

**Common causes:**
1. **Resource exhaustion**: VM running out of memory/CPU
2. **Port already in use**: Second replica can't bind to port
3. **Health check failing intermittently**: Timing issue

**Fix:**
```bash
# Check VM resources
free -h
df -h

# Scale down to 1 replica temporarily
docker service scale ala_api=1

# Investigate and fix issue

# Scale back to 2 replicas
docker service scale ala_api=2
```

### Deployment Hangs

**Symptom:** Deployment starts but never completes

**Diagnosis:**
```bash
# Check deployment progress
docker service ps ala_api

# Look for tasks stuck in "Preparing" or "Starting"
docker service ps ala_api | grep -E "Preparing|Starting"
```

**Common causes:**
1. **Image pull timeout**: Large images take time to pull
2. **Health check timeout**: New container fails health check
3. **Resource limits**: Not enough memory/CPU to start new container

**Fix:**
```bash
# Cancel stuck deployment
docker service update --rollback ala_api

# Or force update
docker service update --force ala_api
```

### Database Connection Failures

**Symptom:** API logs show "Cannot connect to database"

**Diagnosis:**
```bash
# Check if database is running
docker ps | grep ala-db

# Check database health
docker exec ala-db pg_isready -U ala_user -d ala_production

# Check if API can reach database
docker exec $(docker ps -q --filter name=ala_api) ping -c 3 ala-db
```

**Fix:**
```bash
# Restart database
cd ~/ala-improved/deployment
docker-compose -f docker-compose.db.yml restart db

# Wait for database to be healthy
sleep 10

# Restart API service
docker service update --force ala_api
```

### SSL Certificate Issues

**Symptom:** Frontend shows "Certificate expired" or HTTPS not working

**Diagnosis:**
```bash
# Check certificate expiry
docker exec $(docker ps -q --filter name=ala_frontend) \
    openssl x509 -in /etc/ssl/certs/fullchain.crt -noout -dates

# Check if certificate files exist on host
ls -lh ~/ala-improved/ssl-certs/certs/fullchain.crt
ls -lh ~/ala-improved/ssl-certs/private/private.key
```

**Fix:**
```bash
# Renew certificates (if expired)
# See certificate renewal documentation

# After renewal, restart frontend
docker service update --force ala_frontend
```

---

## Database Operations

**Database runs in Docker Compose (not Swarm)** for stability.

### Backup Database

```bash
# Manual backup
docker exec ala-db pg_dump -U ala_user ala_production > \
    ~/backups/ala_db_$(date +%Y%m%d_%H%M%S).sql

# Verify backup file
ls -lh ~/backups/ala_db_*.sql | tail -1
```

### Restore Database

```bash
# Stop API service (prevents connections during restore)
docker service scale ala_api=0

# Restore from backup
cat ~/backups/ala_db_YYYYMMDD_HHMMSS.sql | \
    docker exec -i ala-db psql -U ala_user -d ala_production

# Restart API service
docker service scale ala_api=2
```

### Run Migration

```bash
# Copy migration to container
docker cp ~/ala-improved/backend/src/migrations/FILE.sql ala-db:/tmp/

# Run migration
docker exec -it ala-db psql -U ala_user -d ala_production -f /tmp/FILE.sql

# Verify migration
docker exec -it ala-db psql -U ala_user -d ala_production -c "\d TABLE_NAME"
```

### Database Shell Access

```bash
# PostgreSQL shell
docker exec -it ala-db psql -U ala_user -d ala_production

# Common commands in psql:
# \dt          - List tables
# \d TABLE     - Describe table
# \l           - List databases
# \q           - Quit
```

---

## Emergency Procedures

### Complete System Down

**Symptom:** Nothing works, application completely unavailable

**Recovery:**

```bash
# 1. Check if VM is reachable
ping 20.217.84.100

# 2. SSH to VM
ssh azureuser@20.217.84.100

# 3. Check Docker daemon
sudo systemctl status docker

# 4. Restart Docker if needed
sudo systemctl restart docker

# 5. Start database
cd ~/ala-improved/deployment
docker-compose -f docker-compose.db.yml up -d

# 6. Deploy Swarm services
docker stack deploy -c docker-stack.yml ala

# 7. Wait for services to start (2-3 minutes)
docker service ls

# 8. Verify health
curl http://localhost:5000/api/health
```

### VM Reboot Recovery

**After VM reboot, Docker Swarm services auto-restart, but verify:**

```bash
# 1. SSH to VM after reboot
ssh azureuser@20.217.84.100

# 2. Check Swarm status
docker info | grep Swarm

# 3. Check database (may not auto-start)
docker ps | grep ala-db

# 4. Start database if needed
cd ~/ala-improved/deployment
docker-compose -f docker-compose.db.yml up -d

# 5. Check Swarm services
docker service ls

# 6. Services should auto-recover within 2-3 minutes
# If not, redeploy:
docker stack deploy -c docker-stack.yml ala
```

### Corrupted Database

**Symptom:** Database won't start, data corruption errors

**Recovery:**

```bash
# 1. Stop all services
docker service scale ala_api=0
docker-compose -f docker-compose.db.yml down

# 2. Backup corrupted data (just in case)
sudo cp -r /var/lib/docker/volumes/deployment_postgres-data \
    ~/corrupted-db-backup-$(date +%Y%m%d)

# 3. Remove corrupted data
docker volume rm deployment_postgres-data

# 4. Recreate volume
docker volume create deployment_postgres-data

# 5. Restore from latest backup
docker-compose -f docker-compose.db.yml up -d
sleep 30
cat ~/backups/ala_db_LATEST.sql | \
    docker exec -i ala-db psql -U ala_user -d ala_production

# 6. Restart services
docker service scale ala_api=2
```

### Security Incident Response

**Immediate actions if compromised:**

```bash
# 1. Scale down all public-facing services
docker service scale ala_frontend=0
docker service scale ala_api=0

# 2. Backup database
docker exec ala-db pg_dump -U ala_user ala_production > \
    ~/emergency-backup-$(date +%Y%m%d_%H%M%S).sql

# 3. Check for unauthorized changes
docker service ps ala_api
docker service ps ala_frontend
docker ps -a

# 4. Review logs
docker service logs ala_api | grep -E "ERROR|WARNING|UNAUTHORIZED"

# 5. Contact security team / cloud provider
# 6. Restore from known-good backup after investigation
```

---

## Best Practices

### Daily Operations
- ✅ Deploy during low-traffic windows (if possible, though not required)
- ✅ Monitor logs for 10 minutes after deployment
- ✅ Keep last 3 versions of images (for easy rollback)
- ✅ Backup database before major changes

### Monthly Maintenance
- ✅ Review and clean old Docker images: `docker image prune -a`
- ✅ Check disk space: `df -h`
- ✅ Review logs for errors: `docker service logs ala_api | grep ERROR`
- ✅ Verify backups are working: restore to test environment

### Monitoring
- ✅ Set up health check monitoring (external service)
- ✅ Alert on service count != 2/2
- ✅ Alert on database connection failures
- ✅ Monitor disk space (database growth)

### Security
- ✅ Keep Docker up to date: `sudo apt update && sudo apt upgrade docker-ce`
- ✅ Rotate secrets regularly (JWT_SECRET, POSTGRES_PASSWORD)
- ✅ Review access logs for unauthorized access attempts
- ✅ Keep SSL certificates renewed

---

## Quick Reference

### Common Commands

```bash
# Deployment
./swarm-deploy                              # Deploy new version
./swarm-deploy --skip-build                 # Fast deployment
docker service rollback ala_api             # Rollback API

# Monitoring
docker service ls                           # View all services
docker service ps ala_api                   # View API replicas
docker service logs -f ala_api              # Follow API logs

# Scaling (future use)
docker service scale ala_api=3              # Scale to 3 replicas
docker service scale ala_api=2              # Scale back to 2

# Database
docker exec ala-db pg_dump -U ala_user ala_production > backup.sql
docker exec -it ala-db psql -U ala_user -d ala_production
docker-compose -f docker-compose.db.yml restart db

# Emergency
docker stack rm ala                         # Remove all Swarm services
docker swarm leave --force                  # Exit Swarm mode
docker-compose up -d                        # Fallback to Compose
```

---

## Support & Contact

**For deployment issues:**
- Check this guide first
- Review logs: `docker service logs`
- Check troubleshooting section

**For emergency:**
- Complete system down → Follow emergency procedures
- Security incident → Scale down first, investigate second
- Database corruption → Restore from backup

**Documentation:**
- Migration guide: [SWARM_MIGRATION.md](SWARM_MIGRATION.md)
- Stack configuration: [docker-stack.yml](docker-stack.yml)
- Database config: [docker-compose.db.yml](docker-compose.db.yml)
