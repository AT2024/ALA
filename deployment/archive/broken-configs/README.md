# Archived: Broken Deployment Configurations

These files were archived on 2025-11-12 during Docker Swarm migration.

## Why Archived

1. **deploy-staging** - Staging environment broken, couldn't run
2. **promote-to-production** - Image promotion workflow fundamentally flawed
   - Attempted to tag staging images for production
   - Failed because staging/production have different build-time configs (nginx, env vars)
   - Broke both staging AND production on October 27, 2025
3. **docker-compose.staging.yml** - Staging config incompatible with production
4. **docker-compose.bluegreen.yml** - Blue-green deployment config
5. **deploy-zero-downtime** - Zero-downtime script that actually caused downtime
6. **init-bluegreen** - Blue-green initialization script
7. **rollback** - Blue-green rollback script
8. **test-green-deployment.sh** - Testing script for green deployment
9. **BLUE_GREEN_DEPLOYMENT.md** - Documentation for broken blue-green workflow
10. **GREEN-TESTING-CHECKLIST.md** - Testing checklist for green deployment
11. **DEPLOYMENT_TRANSITION.md** - Transition documentation
12. **.env.staging.template** - Staging environment template
13. **azure/** - Old Azure-specific deployment configs
14. **nginx/** - Old nginx configurations (now baked into Docker images)
15. **scripts/** - Old deployment utility scripts

## What Replaced Them

Docker Swarm with rolling updates provides TRUE zero-downtime:
- No need for staging environment as separate infrastructure
- No image promotion (build fresh for each deployment)
- Automatic health checks and rollback
- See: [SWARM_OPERATIONS.md](../../SWARM_OPERATIONS.md), [SWARM_MIGRATION.md](../../SWARM_MIGRATION.md)

## Lessons Learned

1. **Image promotion doesn't work when configs differ between environments**
   - Nginx configs are baked into Docker images at build time
   - Can't "promote" an image with staging config to production
   - Tagging images doesn't change their contents

2. **Never test deployment infrastructure on production**
   - October 27, 2025: Tested blue-green directly on production
   - Result: 30-minute production outage
   - Lesson: Always test locally first

3. **Simplicity wins**
   - Swarm rolling updates are simpler and more reliable
   - No need for complex blue-green infrastructure
   - Single script (`./swarm-deploy`) handles everything

4. **Zero-downtime is achieved by starting new before stopping old**
   - `order: start-first` in Swarm config
   - 2 replicas ensure one is always available
   - Health checks validate before removing old containers

## Production Outage Incident - October 27, 2025

**What happened:**
- Tested blue-green deployment directly on production VM
- Ran `docker-compose down` thinking it would swap environments
- Instead, it took down ALL production services
- 30-minute outage while manually restoring from main branch

**Root cause:**
- Testing deployment infrastructure changes on live system
- Misunderstanding of blue-green deployment mechanics
- No local testing before production trial

**Prevention:**
- Docker Swarm migration done during scheduled maintenance window
- All deployment changes tested locally first
- Clear separation: Database in Compose (stable), API/Frontend in Swarm (updatable)

## When to Use These Files

**Never.** They are archived for historical reference only.

If you need zero-downtime deployments:
- Use `./swarm-deploy` script
- See [SWARM_OPERATIONS.md](../../SWARM_OPERATIONS.md) for operations
- See [SWARM_MIGRATION.md](../../SWARM_MIGRATION.md) for migration guide

## Archive Contents

```
archive/broken-configs/
├── deploy-staging              # Broken staging deployment script
├── promote-to-production       # Broken image promotion script
├── docker-compose.staging.yml  # Staging environment config
├── docker-compose.bluegreen.yml # Blue-green config
├── deploy-zero-downtime        # Zero-downtime script that failed
├── init-bluegreen              # Blue-green initialization
├── rollback                    # Blue-green rollback
├── test-green-deployment.sh    # Green deployment testing
├── BLUE_GREEN_DEPLOYMENT.md    # Blue-green documentation
├── GREEN-TESTING-CHECKLIST.md  # Testing checklist
├── DEPLOYMENT_TRANSITION.md    # Transition docs
├── .env.staging.template       # Staging env template
├── azure/                      # Azure-specific configs
├── nginx/                      # Old nginx configs
├── scripts/                    # Old deployment scripts
└── README.md                   # This file
```

## Future Improvements

With Docker Swarm in place, future improvements could include:
- Multi-node Swarm cluster for geographic redundancy
- Automated health monitoring and alerts
- Integration with CI/CD pipeline (GitHub Actions)
- Automated database backups to cloud storage
- Load balancer for multi-node deployments

But for now, single-node Swarm with rolling updates is simple, reliable, and provides true zero-downtime.
