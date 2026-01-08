# DL-001: System-Wide Optimization & Environment Alignment

**Status**: Implemented
**Created**: 2026-01-07
**Author**: Team
**Stakeholders**: Development Team

## Context

The ALA project runs in two environments:
- **Local Development**: Docker Compose with direct file access
- **Azure Production**: Docker Swarm on Azure VM (20.217.84.100)

Maintaining parity between these environments is critical for:
- Predictable deployments
- Reduced "works on my machine" issues
- Consistent debugging experience

## Design Questions

- [x] What are the key differences between Local and Azure configs?
- [ ] How do we ensure environment variables stay synchronized?
- [ ] What deployment checks should be automated?
- [ ] How do we handle secrets differently per environment?

## Environment Comparison

### Local Development

| Component | Configuration |
|-----------|---------------|
| Orchestration | Docker Compose |
| Config Files | `docker-compose.yml`, `docker-compose.db.yml` |
| Environment | `.env` (local), `.env.production.template` |
| Frontend Port | 3000 |
| Backend Port | 5000 |
| Database | Local PostgreSQL container |

### Azure Production

| Component | Configuration |
|-----------|---------------|
| Orchestration | Docker Swarm |
| Config Files | `docker-stack.yml` |
| Deployment | `swarm-deploy` script |
| URL | https://ala-app.israelcentral.cloudapp.azure.com |
| Database | PostgreSQL in Swarm |
| SSL | Traefik with Let's Encrypt |

## Comprehensive Parity Gap Analysis

### Critical Gaps (12 Total)

| # | Gap | Local Config | Azure Config | Risk | Status |
|---|-----|--------------|--------------|------|--------|
| 1 | **Uploads Volume Missing** | `uploads-data:/usr/src/app/uploads` | Not defined in docker-stack.yml | Data loss on container recreate | FIXED |
| 2 | **Entrypoint Override** | `dumb-init` in Dockerfile | Manual `node dist/app/src/server.js` | Signal handling differs | Documented |
| 3 | **DATABASE_URL Hostname** | `@db:5432` | `@ala-db:5432` | Config not portable | Documented |
| 4 | **Backend Proxy Name** | `http://api:5000` | `http://ala_api:5000` | nginx config env-specific | Documented |
| 5 | **Restart Policy** | `always` | `on-failure (max 3)` | Different recovery behavior | Documented |
| 6 | **Network Architecture** | Default bridge | External overlay (`ala-network`) | Service discovery differs | Documented |
| 7 | **Env Template Conflicts** | Dev values in .env | Prod placeholders | Cannot share config | FIXED |
| 8 | **Azure-specific Vars** | Not present | Email/PDF vars | Features differ locally | FIXED |
| 9 | **SSL Cert Paths** | `~/ala-improved/...` | `/home/azureuser/...` | Hardcoded paths | Documented |
| 10 | **Nginx Config Selection** | `nginx.http-local.conf` | `nginx.https.azure.conf` | Build-time decision | Documented |
| 11 | **VITE_API_URL** | `/api` (relative) | Hardcoded domain | Image not portable | FIXED |
| 12 | **Versioning Strategy** | `:production` tag | `:${VERSION}` tag | Promotion differs | Documented |

### Gap Details

#### Gap 1: Uploads Volume Missing in Azure (CRITICAL)
- **Local**: `docker-compose.yml` line 62 defines `uploads-data:/usr/src/app/uploads`
- **Azure**: `docker-stack.yml` had no volume for uploads
- **Impact**: Applicator file uploads lost when Swarm recreates containers
- **Fix Applied**: Added `uploads-data` volume to `docker-stack.yml`

#### Gap 2: Entrypoint Override (Alpine 3.23 Workaround)
- **Local**: Uses `dumb-init` from Dockerfile for proper signal handling
- **Azure**: Overrides entrypoint to bypass dumb-init compatibility issue
- **Impact**: Graceful shutdown behavior may differ between environments
- **Documentation**: Comment added to `docker-stack.yml` explaining workaround

#### Gap 3: DATABASE_URL Hostname
- **Local**: Database service named `db` in docker-compose
- **Azure**: Database container named `ala-db` in swarm network
- **Impact**: Environment-specific DATABASE_URL required
- **Workaround**: Each environment uses its own .env file

#### Gap 4: Backend Proxy Naming
- **Local nginx**: `proxy_pass http://api:5000`
- **Azure nginx**: `set $backend_api "ala_api:5000"` (Swarm adds stack prefix)
- **Impact**: Separate nginx config files required per environment

#### Gap 5: Restart Policy Difference
- **Local**: `restart: always` - infinite restart attempts
- **Azure**: `on-failure` with max 3 attempts in 120s window
- **Rationale**: Production needs circuit breaker; local dev can restart forever

#### Gap 6: Network Architecture
- **Local**: Default Docker bridge network
- **Azure**: External overlay network `ala-network` for Swarm service mesh
- **Impact**: Service discovery and DNS resolution differ fundamentally

#### Gap 7: Environment Template (.env.example created)
- **Problem**: .env had development values, .env.production.template had production
- **Fix Applied**: Created `.env.example` documenting all variables without secrets

#### Gap 8: Azure-specific Variables
- **Azure-only**: `AZURE_COMMUNICATION_CONNECTION_STRING`, `AZURE_EMAIL_SENDER_ADDRESS`, `PDF_RECIPIENT_EMAIL`, `BYPASS_PRIORITY_EMAILS`
- **Fix Applied**: Added placeholders to `.env.production.template`

#### Gap 9: SSL Certificate Paths
- **Local**: `~/ala-improved/ssl-certs/...` (relative to user home)
- **Azure**: `/home/azureuser/ala-improved/ssl-certs/...` (absolute path)
- **Note**: Documented in deployment README

#### Gap 10: Nginx Config Selection
- **Local Build**: `NGINX_CONFIG=nginx.http-local.conf`
- **Azure Build**: `NGINX_CONFIG=nginx.https.azure.conf`
- **Note**: Build-time decision, images are environment-specific

#### Gap 11: VITE_API_URL (Fixed)
- **Problem**: Azure used hardcoded `https://ala-app.israelcentral.cloudapp.azure.com/api`
- **Fix Applied**: Changed to `/api` (relative URL) for image portability

#### Gap 12: Versioning Strategy
- **Local**: Static `:production` tag
- **Azure**: Dynamic `:${VERSION:-latest}` with timestamp versioning
- **Note**: Documented in TAG_TRACKING.md

### Key Parity Gaps Summary

| Area | Local | Azure | Risk |
|------|-------|-------|------|
| SSL | HTTP (port 80) | HTTPS (Let's Encrypt) | Auth cookies may differ |
| Secrets | `.env` file | `.env` file (same) | Use .env.example as template |
| Networking | Bridge network | Overlay network | Service naming differs |
| Persistence | Named volumes | Named volumes (now aligned) | ✅ Fixed |
| Uploads | Volume mounted | Volume mounted (now aligned) | ✅ Fixed |

## Proposed Safeguards

### Option A: Manual Checklist
- Maintain a deployment checklist in docs
- Developers verify before each deploy
- Pros: Simple, no tooling needed
- Cons: Human error, checklist drift

### Option B: Automated Validation (Recommended)
- `/azure-check` command validates parity
- CI/CD step compares configs
- Pros: Consistent, catches drift
- Cons: Initial setup effort

## Decision

**Selected: Option B - Automated Validation**

Rationale:
- Patient safety system requires high reliability
- Automated checks scale with team
- Reduces cognitive load on developers

## Implementation Notes

Key files to keep synchronized:

| Local File | Azure Equivalent | Sync Concern |
|------------|------------------|--------------|
| `docker-compose.yml` | `docker-stack.yml` | Service definitions |
| `.env` | Docker secrets | Environment variables |
| `Dockerfile` | Same | Build consistency |

### Commands Created
- `/design` - Start a new design log entry
- `/azure-check` - Validate Azure parity before deployment

## Results

**Implementation Date**: 2026-01-07

### Outcome

All 12 parity gaps have been documented and addressed:

**Fixed (Code Changes):**
1. ✅ **Gap #1**: Added `uploads-data` volume to `docker-stack.yml`
2. ✅ **Gap #7**: Created `.env.example` with all variables documented
3. ✅ **Gap #8**: Added Azure-specific variable placeholders
4. ✅ **Gap #11**: Changed `VITE_API_URL` to relative URL `/api` for image portability

**Documented (Comments/Guides Added):**
5. ✅ **Gap #2**: Added comment in `docker-stack.yml` explaining dumb-init workaround
6. ✅ **Gap #3, #4, #6**: Documented service naming differences
7. ✅ **Gap #5**: Added restart policy documentation to `SWARM_OPERATIONS.md`
8. ✅ **Gap #9, #10, #12**: Documented in this design log

**Files Modified:**
- `deployment/docker-stack.yml` - Added uploads volume, parity comments
- `deployment/.env.example` - New file with complete variable documentation
- `deployment/.env.production.template` - Fixed VITE_API_URL, added references
- `.claude/settings.md` - Added exclusions and environment safety rules
- `deployment/SWARM_OPERATIONS.md` - Added restart policy documentation

### Lessons Learned

1. **Image Portability**: Using relative URLs (`/api`) instead of hardcoded domains allows the same Docker image to work in any environment
2. **Volume Alignment**: Azure Swarm requires explicit volume definitions that match Local compose files
3. **Circuit Breaker Pattern**: Production should use limited restart attempts to surface persistent failures rather than masking them
4. **Documentation as Code**: Inline comments in deployment files (referencing this design log) help future developers understand parity decisions
