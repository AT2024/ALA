# Azure Parity Validation

Compare Local vs Azure configurations before deployment.

## Pre-Deployment Checklist

### 1. Check Latest Design Log
Read `docs/design-logs/` for any pending or recent changes that affect Azure.

### 2. Environment Variable Parity
Compare `.env` variables with Azure secrets:

```bash
# Local variables
cat deployment/.env | grep -v '^#' | sort

# Check what's deployed (from Azure VM)
ssh azureuser@20.217.84.100 "docker config ls"
```

### 3. Docker Configuration Parity

| Local File | Azure File | Check |
|------------|------------|-------|
| `docker-compose.yml` | `docker-stack.yml` | Service definitions match |
| `docker-compose.db.yml` | Integrated in stack | DB config consistent |

Key differences to verify:
- [ ] Port mappings match expected values
- [ ] Volume mounts are equivalent
- [ ] Environment variables are set
- [ ] Network configuration is correct

### 4. Health Check

```bash
# Local health
curl http://localhost:5000/api/health

# Azure health
curl -f https://ala-app.israelcentral.cloudapp.azure.com/api/health
```

### 5. Recent Changes Impact

Before deploying, verify:
- [ ] No database migrations pending without backup plan
- [ ] No breaking API changes without client updates
- [ ] No new environment variables missing from Azure

## Quick Deploy (After Validation)

```bash
ssh azureuser@20.217.84.100 "cd ~/ala-improved/deployment && ./swarm-deploy"
```

## Rollback Plan

If deployment fails:
```bash
ssh azureuser@20.217.84.100 "docker service rollback ala_backend && docker service rollback ala_frontend"
```

## Report Discrepancies

If you find parity gaps:
1. Document in `docs/design-logs/2026-01-environment-alignment.md`
2. Update the "Key Parity Gaps" table
3. Create a fix plan before proceeding
