# Archived Deployment Files

## Why These Files Were Archived

**Date**: October 22, 2025
**Reason**: Radical simplification of deployment system

### The Problem
The deployment system had become overly complex:
- 5+ deployment scripts with overlapping functionality
- Confusion about which script to use
- 7+ environment configuration files
- Deployment failures due to complexity
- Solo developer spending time maintaining deployment infrastructure instead of shipping features

### The Solution
Replaced everything with 3 simple files:
1. `deployment/docker-compose.yml` - Single production compose file
2. `deployment/deploy` - Single 120-line deployment script
3. `deployment/.env.production.template` - Single environment template

### Philosophy
**"Deployment should be boring"** - DHH

Simple deploys reliably. Complex deploys fail mysteriously. For a solo developer working on a medical application, reliability beats sophistication.

## Archived Files

### Old Deployment Scripts (old-scripts/)

#### deploy-production.sh (392 lines)
- Comprehensive production deployment with safety checks
- Branch verification, staging checks, backup, rollback
- **Why archived**: Too complex for solo developer, most features now built into new deploy script

#### deploy-https.sh
- HTTPS-specific deployment with SSL certificate generation
- **Why archived**: HTTPS config now handled in docker-compose.yml and nginx config

#### deploy-improved.sh
- Unknown purpose (legacy)
- **Why archived**: Functionality unclear, not referenced in docs

#### deploy.sh (233 lines)
- Main deployment script with recovery and validation
- Health checks, snapshots, rollback
- **Why archived**: Replaced by simpler 120-line deploy script

#### deploy-safe.sh (552 lines)
- Most comprehensive script with blue-green deployment
- JSON deployment history, lock files, extensive health checks
- **Why archived**: Over-engineered for solo developer needs, key features preserved in new script

### What Was Kept

**From deploy-safe.sh** (the best parts):
- ✅ Pre-deployment database backup
- ✅ Health check verification
- ✅ Automatic rollback on failure
- ✅ Clear progress messages

**What was removed** (unnecessary complexity):
- ❌ JSON deployment history (git log is sufficient)
- ❌ Lock file management (not needed for single-user deployment)
- ❌ Blue-green deployment theater (we don't have true blue-green on single VM)
- ❌ Extensive pre-flight checks (Docker healthchecks handle this)
- ❌ 500+ lines of ceremony

### Old Environment Files (moved/consolidated)

**Before:**
- `deployment/azure/.env.azure.template`
- `deployment/azure/.env.azure.https.template`
- `deployment/azure/.env.staging.template`
- `deployment/environments/.env.example`
- `deployment/environments/.env.development`

**After:**
- `deployment/.env.production.template` (single source of truth)

### Monitoring Scripts

**Kept in deployment/scripts/**:
- `monitor.sh` - Still useful for manual monitoring
- `monitor-auto.sh` - Still useful for automated monitoring

These are utility scripts, not deployment scripts, so they remain.

## Migration Path

If you need to reference the old deployment logic:

1. Check `old-scripts/deploy-safe.sh` for the most comprehensive version
2. Check `old-scripts/deploy-production.sh` for production-specific safety checks
3. All key safety features have been preserved in the new `deployment/deploy` script

## Lessons Learned

### What Caused the Complexity

1. **Multiple attempts at HTTPS deployment** → Created multiple conflicting configs
2. **Nginx config baking issues** → Led to workarounds and special scripts
3. **Environment file confusion** → Multiple files led to wrong file being used
4. **Premature optimization** → Built for imaginary scale problems

### What We Learned

1. **One file per concern** → docker-compose.yml, deploy script, .env template
2. **Accept Docker's constraints** → Rebuild images when config changes, don't fight it
3. **Simple beats sophisticated** → 120 lines that work > 500 lines that sometimes work
4. **Solo developer != Enterprise** → Don't build enterprise infrastructure for solo use

### Pitfall Documentation

These issues are now documented in `CLAUDE.md` under "Known Pitfalls & Solutions":
- Environment file confusion
- Nginx configuration baking
- Deployment script proliferation

## Future Reference

If you ever think "I need a more complex deployment system":

1. Read this README
2. Remember why we simplified
3. Ask: "Does this solve a problem I actually have?"
4. If no: Keep it simple
5. If yes: Still keep it simple, just add the one thing you need

**The best deployment system is one you don't think about.**

---

**Archived by**: Radical deployment simplification
**Date**: October 22, 2025
**Commit**: feature/simplify-deployment-radical
