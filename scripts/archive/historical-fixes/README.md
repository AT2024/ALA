# Historical Fix Scripts

These scripts were used to resolve specific deployment issues and are preserved for historical reference.

## Scripts

- **fix-https-deployment.sh**: Fixed HTTPS deployment configuration issues (Oct 2025)
  - Addressed wrong nginx config and environment file confusion
  - Helped identify the need for `.env.azure.https` clarity

- **setup-azure-dns-https.sh**: DNS-based HTTPS setup (superseded by IP-based approach)
  - Original attempt using custom domain with Azure DNS
  - Current deployment uses IP-based SSL certificates

- **setup-letsencrypt.sh**: Let's Encrypt automation (not currently used)
  - Automated SSL certificate generation via Let's Encrypt
  - Not implemented in production (using self-signed certs)

- **rollback.sh**: Manual rollback script (now built into deploy.sh)
  - Standalone rollback functionality
  - Features now integrated into main deployment scripts with better safety

- **restore-working-version.sh**: Git-based version restore
  - Emergency recovery to tagged working versions
  - Git tag workflow now documented in deployment guides

## Why Archived

These scripts are no longer part of the active deployment workflow but are preserved for:
1. **Understanding historical deployment issues** - Provides context for why current approach exists
2. **Reference if similar problems occur** - Solutions to past problems may help with future issues
3. **Medical application safety** - Preserve all recovery knowledge and institutional memory
4. **Compliance and audit trail** - Document all significant operational changes

## Context: The HTTPS Deployment Issue (Oct 2025)

The most significant issue these scripts address is documented in:
- `docs/learnings/bugs/2025-10-21-https-deployment-wrong-env-file.md`
- `CLAUDE.md` (Known Pitfalls section)

**Problem**: Multiple environment files (`.env.azure`, `.env.azure.https`) and nginx configs caused deployment confusion and failures.

**Solution**:
- Simplified to ONE production path: `.env.azure.https` + `nginx.https.azure.conf`
- Removed confusing duplicate files (this cleanup)
- Documented in CLAUDE.md as critical deployment information

## If You Need These

If you encounter similar issues:
1. Review these scripts for insights into the problem-solving approach
2. Consider updating them to work with current deployment architecture
3. Test thoroughly in staging before production use
4. Document any new patterns in CLAUDE.md and create ADRs

## Current Deployment Approach

**Production Deployment**:
```bash
# Location: deployment/scripts/deploy-production.sh
# Features: Safety checks, automatic backup, rollback support
cd ~/ala-improved
./deployment/scripts/deploy-production.sh
```

**Configuration**:
- Environment: `deployment/azure/.env.azure.https`
- Compose: `deployment/azure/docker-compose.azure.yml`
- Nginx: `frontend/nginx.https.azure.conf`

## Related Documentation

- [CLAUDE.md](../../../CLAUDE.md) - Current deployment best practices
- [Azure Deployment Guide](../../../docs/deployment/AZURE_DEPLOYMENT.md)
- [Troubleshooting Guide](../../../docs/TROUBLESHOOTING.md)
- [Known Pitfalls](../../../CLAUDE.md#known-pitfalls--solutions)

---

**Last Updated**: October 2025
**Maintained By**: Development Team
**Status**: Archived (historical reference only)
