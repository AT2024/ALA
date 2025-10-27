# ALA Medical Application - Deployment

> **Deployment should be boring.** - DHH

---

## 🆕 **NEW: Blue-Green Deployment Available**

**Zero-downtime deployments with instant rollback** are now available on a feature branch!

- **Branch**: `feature/blue-green-deployment`
- **Documentation**: [BLUE_GREEN_DEPLOYMENT.md](./BLUE_GREEN_DEPLOYMENT.md)
- **Status**: Ready for testing, not yet merged to main

### ⚠️ **CRITICAL: Testing Requirements**

**NEVER test blue-green deployment on production without completing local testing first.**

**Required before production deployment:**
1. ✅ Complete local testing with docker-compose
2. ✅ All containers start successfully
3. ✅ Health checks passing in local environment
4. ✅ Zero-downtime traffic switching verified locally
5. ✅ Rollback procedure tested and working
6. ✅ Application fully functional after switch

**Incident**: On 2025-10-27, testing blue-green on production caused a 30-minute outage. See [incident report](../docs/learnings/errors/2025-10-27-blue-green-production-outage.md) for details.

**To use** (ONLY after completing local testing):
```bash
# First: Test everything locally
git checkout feature/blue-green-deployment
cd deployment
docker-compose -f docker-compose.bluegreen.yml up

# Then: Deploy to production (ONLY if local tests pass)
ssh azureuser@20.217.84.100
cd ~/ala-improved/deployment
git checkout feature/blue-green-deployment
./init-bluegreen          # First time setup
./deploy-zero-downtime    # Zero-downtime deployment
./rollback                # Instant rollback
```

**Current main branch continues using simple deployment below.**

---

This is a radically simplified deployment system. One command deploys to production.

## Quick Start

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

## Files

```
deployment/
├── docker-compose.yml          # Single compose file (production-ready)
├── deploy                      # Single deployment script (120 lines)
├── .env                       # Your secrets (git-ignored)
├── .env.production.template   # Template for creating .env
└── README.md                  # This file
```

**That's all you need.**

## What Happened to the Other Files?

**Archived in `archive/`:**
- 5 deployment scripts (1,500+ lines) → Replaced by 1 script (120 lines)
- 7 environment files → Replaced by 1 template
- Multiple docker-compose files → Replaced by 1 file

**Why?** Too complex for a solo developer. Simple deploys reliably.

See `archive/README.md` for the full story.

## Troubleshooting

### Deployment Fails

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

### Need to Rollback?

The deploy script automatically rolls back on failure. If you need manual rollback:

```bash
# List backups
ls -lht ../backups/

# Restore from backup
docker-compose exec -T db psql -U ala_user ala_production < ../backups/backup-TIMESTAMP.sql
```

### Container Won't Start?

```bash
# Check container status
docker-compose ps

# View logs for specific service
docker-compose logs db
docker-compose logs api
docker-compose logs frontend

# Restart services
docker-compose restart

# Rebuild from scratch
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## Philosophy

### Why So Simple?

**The Problem (Before):**
- 5+ deployment scripts
- 7+ environment files
- Constant confusion: "Which script do I use?"
- Regular deployment failures
- 30+ minutes to understand deployment

**The Solution (Now):**
- 1 deployment script
- 1 docker-compose file
- 1 environment template
- Zero confusion: only one of each exists
- 5 minutes to understand deployment

**The Result:**
- Deployments that work
- Time spent building features, not maintaining infrastructure
- Sleep at night

### But What About...

**Q: What about blue-green deployment?**
A: We don't have it and don't need it. We stop old containers, start new ones, verify they work. That's sufficient.

**Q: What about deployment history?**
A: `git log` shows what was deployed when. Backups show what data looked like when. That's sufficient.

**Q: What about staging?**
A: Your laptop is staging. Test locally, deploy to production. If you need staging on the VM:
```bash
docker-compose -p staging up -d  # Different ports, same file
```

**Q: What about comprehensive monitoring?**
A: Docker healthchecks + manual checks are sufficient. Add more monitoring when it becomes necessary, not before.

**Q: Isn't this too simple?**
A: **Simple is the point.** This is a medical application. Reliability matters. Simple code is reliable code.

## Medical Application Safety

This deployment system includes all safety features required for medical applications:

1. **Database Backup**: Automatic before every deploy
2. **Health Checks**: Verifies API and database after deploy
3. **Automatic Rollback**: If health checks fail, automatically rolls back
4. **Audit Trail**: Git shows what was deployed, backups show data state
5. **Idempotency**: Can run deploy multiple times safely

Everything else is ceremony. This is all you need.

## What's Next?

**Want to improve this system?**

1. Read `archive/README.md` to understand why it was simplified
2. Ask: "Does this solve a problem I actually have?"
3. If no: Keep it simple
4. If yes: Still keep it simple, just add the one thing you need

**The best deployment system is one you don't think about.**

---

**Deployment Simplified**: October 2025
**Philosophy**: Boring deployments are reliable deployments
