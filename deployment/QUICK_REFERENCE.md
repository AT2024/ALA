# Quick Deployment Reference

## One-Command Deployment

```bash
ssh azureuser@20.217.84.100 "cd ~/ala-improved/deployment && ./deploy"
```

That's it. Everything else is automated.

## What Happens Automatically

1. ✅ Database backup to `~/ala-improved/backups/`
2. ✅ Pull latest code from git
3. ✅ Build containers with `--no-cache`
4. ✅ Start services with health checks
5. ✅ Wait 60 seconds for health verification
6. ✅ Check backend `/api/health` endpoint
7. ✅ **Automatic rollback if anything fails**
8. ✅ Keep last 10 backups, delete older ones

**Downtime:** ~2-3 minutes
**Risk:** Minimal (automatic rollback on failure)

## Common Operations

### View Logs
```bash
ssh azureuser@20.217.84.100 "cd ~/ala-improved/deployment && docker-compose logs -f"
```

### Check Status
```bash
ssh azureuser@20.217.84.100 "cd ~/ala-improved/deployment && docker-compose ps"
```

### Health Check
```bash
curl https://ala-app.israelcentral.cloudapp.azure.com/api/health
```

### Restart Service
```bash
ssh azureuser@20.217.84.100 "cd ~/ala-improved/deployment && docker-compose restart api"
```

## Production Environment

- **VM IP**: 20.217.84.100
- **Production URL**: https://ala-app.israelcentral.cloudapp.azure.com
- **Backend API**: https://ala-app.israelcentral.cloudapp.azure.com/api/health
- **Container Names**: ala-frontend, ala-api, ala-db

## Emergency Recovery

### Rollback to Previous Version
```bash
ssh azureuser@20.217.84.100 "cd ~/ala-improved && git checkout <commit-hash> && cd deployment && ./deploy"
```

### Restore from Backup
```bash
ssh azureuser@20.217.84.100
cd ~/ala-improved/backups
ls -lt backup-*.sql | head -5  # List recent backups
cat backup-YYYYMMDD-HHMMSS.sql | docker exec -i ala-db psql -U ala_user ala_production
```

### Full System Reset
```bash
ssh azureuser@20.217.84.100 "cd ~/ala-improved/deployment && docker-compose down && docker system prune -f && ./deploy"
```

## Configuration Files

- **Environment**: `deployment/.env` (production secrets, never commit)
- **Compose**: `deployment/docker-compose.yml` (container definitions)
- **Deploy Script**: `deployment/deploy` (deployment automation)
- **Template**: `deployment/.env.production.template` (template for new setups)

## Troubleshooting

### Deployment Failed
The deploy script automatically rolls back on failure. Check logs:
```bash
ssh azureuser@20.217.84.100 "cd ~/ala-improved/deployment && docker-compose logs --tail=50"
```

### Container Unhealthy
```bash
ssh azureuser@20.217.84.100 "docker ps"  # Check status
ssh azureuser@20.217.84.100 "docker logs ala-api --tail=20"  # Check logs
```

### Database Issues
```bash
ssh azureuser@20.217.84.100 "docker exec -it ala-db psql -U ala_user ala_production"
```

## First-Time Setup

If setting up a new server, see [README.md](README.md) for complete first-time setup instructions including:
- Docker installation
- Git repository cloning
- Environment configuration
- SSL certificate setup

## Philosophy

**"Deployment should be boring"** - DHH

The simplified deployment system prioritizes:
- **Simplicity**: One command, no confusion
- **Safety**: Automatic backups and rollbacks
- **Reliability**: Health checks before declaring success
- **Maintainability**: 120 lines of code, not 1,500+

---

**Last Updated:** October 2025
**System Version:** Radically Simplified v3.0
