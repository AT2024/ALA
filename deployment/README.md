# ALA Medical Application - Deployment

> **Deployment should be boring.** - DHH

---

## 🎉 Docker Swarm - Zero-Downtime Deployments

**TRUE zero-downtime deployments are now available!**

### What This Means

- **Deploy anytime**: No downtime windows, no user interruptions
- **Deploy monthly**: Simple enough for infrequent updates
- **Deploy safely**: Automatic rollback on health check failures
- **Deploy worldwide**: 24/7 uptime for global users

### Quick Start

```bash
# SSH to Azure VM
ssh azureuser@20.217.84.100

# Deploy new version (ZERO downtime!)
cd ~/ala-improved/deployment
./swarm-deploy

# That's it! Rolling update happens automatically.
```

### What Happens During Deployment

1. Pulls latest code from GitHub
2. Builds new Docker images with timestamp version
3. **Starts new API replica** (users still use old replicas)
4. Waits for new API health check to pass
5. **Removes old API replica** (users now use new replica)
6. Repeats for second API replica
7. Same process for frontend replicas
8. **Users experience ZERO downtime** throughout entire process

**Time**: 5-10 minutes
**Downtime**: 0 seconds
**User impact**: None

### Architecture

- **API + Frontend**: Run in Docker Swarm (2 replicas each, rolling updates)
- **Database**: Runs in Docker Compose (stability for medical data)
- **Network**: Overlay network connects Swarm and Compose services
- **Update strategy**: `order: start-first` ensures new containers start before old stop

### Documentation

- **Operations Guide**: [SWARM_OPERATIONS.md](SWARM_OPERATIONS.md) - Daily operations, monitoring, troubleshooting
- **Migration Guide**: [SWARM_MIGRATION.md](SWARM_MIGRATION.md) - Step-by-step migration from current deployment

### Files

```
deployment/
├── docker-stack.yml           # Swarm configuration (API + Frontend)
├── docker-compose.db.yml      # Database configuration (PostgreSQL)
├── swarm-deploy               # Single deployment script
├── SWARM_OPERATIONS.md        # Operations guide
├── SWARM_MIGRATION.md         # Migration guide
├── .env                      # Your secrets (git-ignored)
└── .env.production.template  # Template for creating .env
```

**That's all you need for zero-downtime.**

---

## Current Simple Deployment (Pre-Swarm)

**This section describes the current deployment method. After Swarm migration (see [SWARM_MIGRATION.md](SWARM_MIGRATION.md)), you'll use `./swarm-deploy` instead.**

### Production Deployment

```bash
# SSH to Azure VM
ssh azureuser@20.217.84.100

# Deploy
cd ~/ala-improved/deployment
./deploy
```

That's it. The script automatically:
- ✅ Backs up the database
- ✅ Pulls latest code
- ✅ Builds containers
- ✅ Verifies health
- ✅ Rolls back on failure

**Downtime**: ~60 seconds (acceptable until Swarm migration)

### First Time Setup

```bash
# On Azure VM
cd ~/ala-improved/deployment

# Copy environment template
cp .env.production.template .env

# Edit with your secrets
vim .env
# Fill in: POSTGRES_PASSWORD, JWT_SECRET, Priority API credentials

# Deploy
./deploy
```

### Local Development

```bash
# On your laptop
cd deployment

# Create local environment
cp .env.production.template .env
# Edit for local settings (localhost URLs, etc.)

# Start services
docker-compose up

# Access at http://localhost
```

---

## Migration Path

### Current State

- Production running on Azure VM with Docker Compose
- `./deploy` script works but has ~60 seconds downtime
- Monthly deployments (sometimes more frequent in beta)

### Target State

- API and Frontend services in Docker Swarm
- Database remains in Docker Compose
- `./swarm-deploy` script provides zero-downtime deployments
- Same simplicity, zero user interruption

### Timeline

**Phase 1** (30 min): Deploy patient name changes (current deploy method)
**Phase 2** (15 min): Clean up broken systems
**Phase 3** (45 min): Swarm migration during scheduled maintenance
**Phase 4** (15 min): Verify zero-downtime deployments

**Total**: ~2 hours, one-time ~5 minute downtime for migration

**See**: [SWARM_MIGRATION.md](SWARM_MIGRATION.md) for detailed step-by-step guide

---

## What Happened to Staging/Blue-Green?

**Archived in `archive/broken-configs/`:**
- `deploy-staging` - Staging environment broken, couldn't run
- `promote-to-production` - Image promotion fundamentally flawed
- Blue-green deployment files - Caused October 27, 2025 production outage
- Staging configs, nginx configs, azure configs

**Why archived?**
1. Image promotion doesn't work when staging/production have different build-time configs
2. Testing deployment infrastructure on production is dangerous (learned the hard way)
3. Docker Swarm rolling updates are simpler and more reliable than blue-green
4. Zero-downtime achieved by `order: start-first`, not complex infrastructure

**See**: [archive/broken-configs/README.md](archive/broken-configs/README.md) for full explanation and lessons learned

---

## Troubleshooting

### Deployment Fails (Current Simple Deployment)

```bash
# Check logs
cd deployment
docker-compose logs

# Common issues:
# 1. Missing .env file
cp .env.production.template .env
vim .env

# 2. Database password mismatch
# Edit .env, make sure POSTGRES_PASSWORD matches DATABASE_URL

# 3. Health check timeout
# Deploy script waits 60s - if services take longer, extend the sleep time
```

### Need to Rollback? (Current Simple Deployment)

The deploy script automatically rolls back on failure. For manual rollback:

```bash
# List backups
ls -lht ../backups/

# Restore from backup
docker-compose exec -T db psql -U ala_user ala_production < ../backups/backup-TIMESTAMP.sql
```

### Swarm Troubleshooting

After Swarm migration, see [SWARM_OPERATIONS.md](SWARM_OPERATIONS.md) for comprehensive troubleshooting:
- Service won't start
- Service stuck at 1/2 replicas
- Deployment hangs
- Database connection failures
- SSL certificate issues
- Emergency procedures

---

## Philosophy

### Why So Simple?

**The Problem (Before):**
- 5+ deployment scripts
- 7+ environment files
- Staging/blue-green infrastructure that broke production
- Constant confusion: "Which script do I use?"
- Regular deployment failures
- 30+ minutes to understand deployment

**The Solution (Now):**
- 1 deployment script (`./deploy` or `./swarm-deploy`)
- 1 docker-compose file (or Swarm: docker-stack.yml + docker-compose.db.yml)
- 1 environment template
- Zero confusion: only one of each exists
- 5 minutes to understand deployment

**The Result:**
- Deployments that work
- Zero-downtime for worldwide users (with Swarm)
- Time spent building features, not maintaining infrastructure
- Sleep at night

### But What About...

**Q: What about blue-green deployment?**
A: Tried it, broke production on October 27, 2025. Docker Swarm rolling updates are simpler and actually provide zero-downtime.

**Q: What about staging?**
A: Tried it, broke both staging AND production with image promotion. Your laptop is staging. Test locally, deploy to production with Swarm's rolling updates.

**Q: What about deployment history?**
A: `git log` shows what was deployed when. Backups show data state. Docker images tagged with timestamps. That's sufficient.

**Q: What about comprehensive monitoring?**
A: Docker/Swarm healthchecks + manual checks are sufficient. Add more monitoring when it becomes necessary, not before.

**Q: Isn't this too simple?**
A: **Simple is the point.** This is a medical application. Reliability matters. Simple code is reliable code.

---

## Medical Application Safety

This deployment system includes all safety features required for medical applications:

1. **Database Backup**: Automatic before every deploy
2. **Health Checks**: Verifies API and database after deploy
3. **Automatic Rollback**: If health checks fail, automatically rolls back
4. **Zero Downtime**: Users never experience service interruption (with Swarm)
5. **Audit Trail**: Git shows what was deployed, backups show data state
6. **Idempotency**: Can run deploy multiple times safely

Everything else is ceremony. This is all you need.

---

## What's Next?

### Current Users (Pre-Swarm)

1. Continue using `./deploy` for monthly updates (~60 sec downtime)
2. Schedule Swarm migration when ready (see [SWARM_MIGRATION.md](SWARM_MIGRATION.md))
3. After migration: Use `./swarm-deploy` for zero-downtime deployments

### Post-Swarm Migration

1. Deploy anytime with `./swarm-deploy` (no downtime windows needed)
2. Monitor with `docker service ls` and `docker service logs`
3. Rollback instantly with `docker service rollback` if needed
4. See [SWARM_OPERATIONS.md](SWARM_OPERATIONS.md) for daily operations

**Want to improve this system?**

1. Read `archive/broken-configs/README.md` to understand why staging/blue-green were archived
2. Read [SWARM_OPERATIONS.md](SWARM_OPERATIONS.md) to understand Swarm operations
3. Ask: "Does this solve a problem I actually have?"
4. If no: Keep it simple
5. If yes: Still keep it simple, just add the one thing you need

**The best deployment system is one you don't think about.**

---

**Deployment Simplified**: October 2025
**Swarm Migration Ready**: November 2025
**Philosophy**: Boring deployments are reliable deployments
