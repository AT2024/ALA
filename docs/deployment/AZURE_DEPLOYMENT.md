# Azure VM Production Deployment Guide

⚠️ **UPDATED May 2026** — CI deploy is currently architecturally blocked
(see [CI_ARCHITECTURE.md](CI_ARCHITECTURE.md)). Production deploys are
**manual via `swarm-deploy`** until the build-push-pull pipeline ships.

## Deploying when CI is unavailable (current state)

The canonical zero-downtime deploy is `swarm-deploy`. It does a Docker Swarm
rolling update with two replicas per service, so users in active sessions
don't see downtime.

```bash
# Prereqs (one-time per laptop):
#   - NSG inbound rule for tcp/22 from your current IP (Azure Portal → VM →
#     Networking → Add inbound port rule). Delete the rule after deploy.
#   - SSH key authorized on VM (use Azure Portal → VM → Help → Reset password
#     → "Add SSH public key" if you have no working SSH yet).

ssh -i ~/.ssh/ala_ci_deploy azureuser@20.217.84.100 \
    "cd ~/ala-improved/deployment && ./swarm-deploy"
```

If either prereq is missing, see
[../TROUBLESHOOTING.md#azure-vm-access-issues](../TROUBLESHOOTING.md#azure-vm-access-issues).

### Production environment specifics

- **VM**: `20.217.84.100` (hostname `ALAapp`)
- **SSH user**: `azureuser`, home at `/home/azureuser`
- **Project root on VM**: `~/ala-improved`
- **Deploy script**: `~/ala-improved/deployment/swarm-deploy`
- **Public app**: <https://ala-app.israelcentral.cloudapp.azure.com>
- **Public health**: <https://ala-app.israelcentral.cloudapp.azure.com/api/health>
- **Swarm services**: `ala_api` (2 replicas, port 5000), `ala_frontend`
  (2 replicas, ports 80→8080 and 443→8443)
- **Database container** (`ala-db`): runs outside the swarm stack — must be
  up before swarm-deploy runs.

### Verify after deploy

```bash
curl -sk https://ala-app.israelcentral.cloudapp.azure.com/api/health
ssh azureuser@20.217.84.100 \
    "cd ~/ala-improved && git log -1 --oneline && docker service ls --filter name=ala"
```

### Rollback

The swarm-deploy script auto-rolls-back on health failure. To roll back
manually:

```bash
ssh azureuser@20.217.84.100 \
    "docker service rollback ala_api && docker service rollback ala_frontend"
```

## Older path: `./deploy` (~60 s downtime)

The pre-Swarm path uses `docker-compose down/up` and incurs a brief outage.
Kept for emergencies; prefer `swarm-deploy` whenever Swarm is healthy on the
VM.

```bash
ssh azureuser@20.217.84.100
cd ~/ala-improved/deployment
./deploy
```

## What It Does Automatically

1. ✅ Checks disk space and warns if > 85% full
2. ✅ Backs up the database to `~/ala-improved/backups/`
3. ✅ Pulls latest code from git
4. ✅ Builds containers with `--no-cache`
5. ✅ Starts services with health checks
6. ✅ Waits 60 seconds for health verification
7. ✅ Checks backend `/api/health` endpoint
8. ✅ **Cleans up old Docker images and build cache (saves 1-3GB)**
9. ✅ **Automatically rolls back if any step fails**
10. ✅ Keeps last 10 backups, deletes older ones

**Downtime:** ~2-3 minutes | **Risk:** Minimal (automatic rollback)

### Automated Disk Space Management

Both production and staging deployment scripts automatically:

- **Monitor disk usage** before deployment (warns if > 85%)
- **Clean up after successful deployment**:
  - `docker image prune -f` - Removes dangling images (`<none>` tagged)
  - `docker builder prune -f --keep-storage 1GB` - Clears old build cache
- **Show disk usage** before and after cleanup
- **Preserve**: Active containers, volumes (postgres-data), and tagged images for both environments

**Impact**:

- Production deployments: Saves 1-3GB per deployment
- Staging deployments: Saves 200-500MB per deployment
- Total: 1-3.5GB freed per full deployment cycle

This prevents disk space issues that previously required manual intervention. The cleanup logic is intentionally duplicated in both scripts for simplicity and reliability.

See [../../deployment/README.md](../../deployment/README.md) for complete documentation.

## Environment Details

- **VM IP**: 20.217.84.100 (ATM-ISR-Docker resource group)
- **SSH Access**: `ssh azureuser@20.217.84.100`
- **Production URL**: https://ala-app.israelcentral.cloudapp.azure.com
- **Backend API**: https://ala-app.israelcentral.cloudapp.azure.com/api/health
- **Container Names**: ala-frontend-azure, ala-api-azure, ala-db-azure
- **HTTPS Status**: ✅ Enabled with SSL certificates
- **Test User**: test@example.com (code: 123456)

---

## Legacy Documentation (Archived - October 2025)

⚠️ **The sections below describe the OLD deployment system (before simplification).**

They are preserved for historical reference only. **Do not use these methods.**

For current deployment, use `cd ~/ala-improved/deployment && ./deploy` as shown above.

---

### Old Automated Deployment (DEPRECATED)

```bash
# OLD METHOD - DO NOT USE
# Deploy with HTTPS enabled
ssh azureuser@20.217.84.100 "cd ala-improved && bash deployment/azure/deploy-https.sh"
```

## HTTP Deployment

### Manual HTTP Deployment

```bash
# Connect to Azure VM
ssh azureuser@20.217.84.100

# Navigate to project
cd ala-improved

# Pull latest changes
git pull origin develop

# Ensure infrastructure exists (IMPORTANT)
docker network create azure_ala-network 2>/dev/null || true
docker volume create azure_ala-postgres-data-prod 2>/dev/null || true

# Deploy HTTP version
docker-compose -f deployment/azure/docker-compose.azure.yml --env-file deployment/azure/.env.azure up -d --build
```

## HTTPS Deployment Options

### Option 1: Azure DNS with Let's Encrypt (Recommended for Production)

**Azure DNS Name**: `ala-app.israelcentral.cloudapp.azure.com`

This setup provides trusted SSL certificates via Let's Encrypt with automatic renewal.

#### Prerequisites

1. Configure Azure DNS name label in Azure Portal:
   - Navigate to VM → Configuration → DNS name label
   - Set label (e.g., "ala-app")
   - Full FQDN will be: `ala-app.israelcentral.cloudapp.azure.com`

2. Open required ports in Network Security Group:
   - HTTP (80): For Let's Encrypt validation
   - HTTPS (443): For secure traffic

#### Automated Setup

```bash
# 1. SSH to Azure VM
ssh azureuser@20.217.84.100

# 2. Update .env.azure with DNS name
cd ~/ala-improved/deployment/azure
cat > .env.azure <<'EOF'
# Use the template from .env.azure.https.template
DOMAIN=ala-app.israelcentral.cloudapp.azure.com
VITE_API_URL=https://${DOMAIN}/api
CORS_ORIGIN=https://${DOMAIN}
USE_HTTPS=true
# ... (copy other settings from template)
EOF

# 3. Install acme.sh for certificate management
curl https://get.acme.sh | sh -s email=your-email@example.com
source ~/.bashrc

# 4. Generate Let's Encrypt certificate
cd ~/ala-improved
mkdir -p webroot ssl-certs/certs ssl-certs/private

# Start temporary nginx for ACME challenge
docker run -d --name acme-nginx -p 80:80 -v ~/ala-improved/webroot:/usr/share/nginx/html:ro nginx:alpine
sleep 3

# Issue certificate
~/.acme.sh/acme.sh --issue -d ala-app.israelcentral.cloudapp.azure.com \
  -w ~/ala-improved/webroot --server letsencrypt --force

# Stop temporary nginx
docker stop acme-nginx && docker rm acme-nginx

# Install certificate
~/.acme.sh/acme.sh --install-cert -d ala-app.israelcentral.cloudapp.azure.com \
  --cert-file ~/ala-improved/ssl-certs/certs/certificate.crt \
  --key-file ~/ala-improved/ssl-certs/private/private.key \
  --fullchain-file ~/ala-improved/ssl-certs/certs/fullchain.crt \
  --reloadcmd "docker restart ala-frontend-azure 2>/dev/null || true"

# Set proper permissions
chmod 644 ~/ala-improved/ssl-certs/private/private.key
chmod 644 ~/ala-improved/ssl-certs/certs/*.crt

# 5. Deploy HTTPS application
~/ala-improved/deployment/scripts/deploy-https.sh
```

#### Certificate Auto-Renewal

The certificate expires every 90 days but renews automatically:

```bash
# Verify auto-renewal is configured (should show cron job)
crontab -l | grep acme.sh

# Expected output (runs daily at 11:48 UTC):
# 48 11 * * * "/home/azureuser/.acme.sh"/acme.sh --cron --home "/home/azureuser/.acme.sh" > /dev/null

# Test renewal manually (dry run)
~/.acme.sh/acme.sh --renew -d ala-app.israelcentral.cloudapp.azure.com --force

# Check certificate expiry
openssl x509 -in ~/ala-improved/ssl-certs/certs/certificate.crt -noout -dates
```

#### Verification

```bash
# 1. Verify SSL certificate is trusted
openssl s_client -connect ala-app.israelcentral.cloudapp.azure.com:443 -servername ala-app.israelcentral.cloudapp.azure.com </dev/null 2>/dev/null | grep "Verify return code"
# Expected: Verify return code: 0 (ok)

# 2. Test HTTPS access
curl -I https://ala-app.israelcentral.cloudapp.azure.com
# Should return 200 OK with no SSL warnings

# 3. Verify HTTP redirects to HTTPS
curl -I http://ala-app.israelcentral.cloudapp.azure.com
# Should return 301 or 302 redirect to HTTPS

# 4. Check in browser - should show green padlock with "Connection is secure"
```

#### Migrating to Custom Domain

When ready to use a custom domain (e.g., `ala.alphataumedical.com`):

- See [DOMAIN-MIGRATION-GUIDE.md](DOMAIN-MIGRATION-GUIDE.md) for complete migration steps
- Process takes ~10 minutes with zero downtime
- No code changes required - only DNS and certificate updates

---

### Option 2: Self-Signed Certificate (Development/Testing Only)

**Warning**: Self-signed certificates show browser warnings and should only be used for development.

#### Automated HTTPS Deployment

```bash
# Deploy with self-signed SSL certificate generation
ssh azureuser@20.217.84.100 "cd ala-improved && ~/ala-improved/deployment/scripts/deploy-https.sh"
```

#### Manual HTTPS Deployment

```bash
# Connect to Azure VM
ssh azureuser@20.217.84.100

# Navigate to project
cd ala-improved

# Pull latest changes
git pull origin develop

# Generate SSL certificates (if not exists)
bash scripts/generate-ssl-cert.sh 20.217.84.100

# Deploy HTTPS version
docker-compose -f deployment/azure/docker-compose.https.azure.yml --env-file deployment/azure/.env.azure up -d --build
```

## Container Management

### Monitoring Commands

```bash
# View running containers with formatted output
ssh azureuser@20.217.84.100 "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"

# Follow API container logs
ssh azureuser@20.217.84.100 "docker logs ala-api-azure --tail=50 -f"

# Check HTTPS compose status
ssh azureuser@20.217.84.100 "docker-compose -f deployment/azure/docker-compose.https.azure.yml ps"
```

### Health Checks

```bash
# HTTPS health check (production)
curl https://ala-app.israelcentral.cloudapp.azure.com/api/health

# Check frontend
curl -I https://ala-app.israelcentral.cloudapp.azure.com

# Check from within VM
ssh azureuser@20.217.84.100 "docker ps && curl -s localhost:5000/api/health"
```

## Recovery & Monitoring

### Automatic Recovery

```bash
# Run recovery script (preserves data)
ssh azureuser@20.217.84.100 "~/ala-improved/deployment/azure/recover.sh"
```

### Continuous Monitoring

```bash
# Start monitoring with auto-recovery
ssh azureuser@20.217.84.100 "nohup ~/ala-improved/deployment/scripts/monitor-auto.sh > monitor.log 2>&1 &"

# Check monitoring status
ssh azureuser@20.217.84.100 "tail -f monitor.log"

# Stop monitoring
ssh azureuser@20.217.84.100 "pkill -f monitor-auto.sh"
```

## Troubleshooting

### HTTPS Certificate Issues

```bash
# Regenerate SSL certificates
ssh azureuser@20.217.84.100 "cd ~/ala-improved && rm -rf ssl-certs && bash scripts/generate-ssl-cert.sh 20.217.84.100"

# Verify certificate mount
ssh azureuser@20.217.84.100 "docker exec ala-frontend-azure ls -la /etc/ssl/certs/ | grep certificate"

# Check nginx SSL configuration
ssh azureuser@20.217.84.100 "docker exec ala-frontend-azure nginx -t"
```

### HTTP to HTTPS Redirect Issues

```bash
# Check nginx configuration
ssh azureuser@20.217.84.100 "docker exec ala-frontend-azure cat /etc/nginx/conf.d/default.conf | grep -A5 'listen 80'"

# Verify HTTPS environment variable
ssh azureuser@20.217.84.100 "cat ~/ala-improved/deployment/azure/.env.azure | grep USE_HTTPS"
```

### Container Startup Issues

#### HTTP Version

```bash
# Clean restart for HTTP
ssh azureuser@20.217.84.100 "cd ala-improved && docker-compose -f deployment/azure/docker-compose.azure.yml down"
ssh azureuser@20.217.84.100 "docker system prune -f"
ssh azureuser@20.217.84.100 "cd ala-improved && docker-compose -f deployment/azure/docker-compose.azure.yml --env-file deployment/azure/.env.azure up -d --build"
```

#### HTTPS Version

```bash
# Clean restart for HTTPS
ssh azureuser@20.217.84.100 "cd ala-improved && docker-compose -f deployment/azure/docker-compose.https.azure.yml down"
ssh azureuser@20.217.84.100 "docker system prune -f"
ssh azureuser@20.217.84.100 "cd ala-improved && ~/ala-improved/deployment/scripts/deploy-https.sh"
```

### Database Container Recovery

```bash
# Recreate database container with proper configuration
ssh azureuser@20.217.84.100 "docker run -d \
  --name ala-db-azure \
  --network azure_ala-network \
  --network-alias db \
  -v azure_ala-postgres-data-prod:/var/lib/postgresql/data \
  -e POSTGRES_DB=ala_production \
  -e POSTGRES_USER=ala_user \
  -e POSTGRES_PASSWORD=AzureProd2024! \
  -p 5432:5432 \
  --restart=unless-stopped \
  postgres:16.6-alpine"

# Restart API to reconnect
ssh azureuser@20.217.84.100 "docker restart ala-api-azure"
```

### Script Line Ending Issues

```bash
# Fix Windows line endings on deployment scripts
ssh azureuser@20.217.84.100 "sed -i 's/\r$//' ~/ala-improved/deployment/scripts/*.sh ~/ala-improved/deployment/azure/*.sh"
```

## Emergency Recovery

### Version Rollback

```bash
# Rollback to stable version
git fetch --tags && git checkout v1.0-working-production-2025-09-10

# Redeploy
ssh azureuser@20.217.84.100 "cd ala-improved && ~/ala-improved/deployment/scripts/deploy.sh"
```

### Database Access

```bash
# Direct database access for debugging
ssh azureuser@20.217.84.100 "docker exec -it ala-db-azure psql -U ala_user -d ala_production"
```

## Deployment Files Reference

| File                                              | Purpose                                          |
| ------------------------------------------------- | ------------------------------------------------ |
| `deployment/azure/docker-compose.azure.yml`       | HTTP container configuration                     |
| `deployment/azure/docker-compose.https.azure.yml` | HTTPS container configuration                    |
| `deployment/azure/.env.azure`                     | Production environment variables (never commit!) |
| `deployment/scripts/deploy.sh`                    | Automated deployment with rollback               |
| `deployment/scripts/deploy-https.sh`              | HTTPS deployment with SSL setup                  |
| `deployment/azure/recover.sh`                     | Container recovery script                        |
| `deployment/scripts/monitor-auto.sh`              | Health monitoring with auto-recovery             |

## Security Notes

- Production passwords are stored in `deployment/azure/.env.azure`
- This file should NEVER be committed to version control
- SSL certificates are self-signed for development/testing
- For production, use proper SSL certificates from a trusted CA
