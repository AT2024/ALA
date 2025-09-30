# Domain Migration Guide: Azure DNS → Custom Domain

## Overview
This guide helps you migrate from Azure DNS (`*.cloudapp.azure.com`) to a custom domain seamlessly.

---

## Current Setup (Azure DNS)

### What You Have Now
- **Azure DNS**: `ala-medical.westeurope.cloudapp.azure.com` (or similar)
- **SSL Certificate**: Let's Encrypt (trusted, no browser warnings)
- **Access**: `https://ala-medical.westeurope.cloudapp.azure.com`

### Infrastructure Ready for Migration
✅ Configuration uses `DOMAIN` variable for flexibility
✅ Nginx supports any domain via `server_name _`
✅ Let's Encrypt setup script accepts any domain
✅ Docker Compose mounts flexible SSL certificates

---

## Migration to Custom Domain

### Prerequisites
1. **Domain Purchased** (or access to company domain DNS)
2. **DNS Management Access** (to create A records)
3. **5-10 minutes downtime** (for certificate generation)

---

## Step-by-Step Migration

### Option A: New Subdomain (Recommended)
**Example**: `ala.alphataumedical.com` or `medical.yourcompany.com`

#### 1. Configure DNS A Record
In your DNS provider (GoDaddy, Namecheap, Azure DNS Zone, etc.):

```
Type: A
Host: ala (or your subdomain)
Value: 20.217.84.100
TTL: 300 (5 minutes)
```

#### 2. Verify DNS Propagation (wait 5-60 minutes)
```bash
nslookup ala.alphataumedical.com
# Should return: 20.217.84.100

# Or use online tool: https://www.whatsmydns.net/
```

#### 3. SSH to Azure VM
```bash
ssh azureuser@20.217.84.100
cd ~/ala-improved
```

#### 4. Stop Current Containers
```bash
docker-compose -f deployment/azure/docker-compose.https.azure.yml down
```

#### 5. Generate New Let's Encrypt Certificate
```bash
# Replace with your actual domain
bash scripts/setup-letsencrypt.sh ala.alphataumedical.com admin@alphataumedical.com
```

This will:
- Request certificate from Let's Encrypt
- Validate domain ownership (HTTP-01 challenge)
- Install certificate to `ssl-certs/` directory
- Set up auto-renewal cron job

#### 6. Update Environment Configuration
```bash
# Edit .env.azure
nano deployment/azure/.env.azure

# Change these lines:
DOMAIN=ala.alphataumedical.com  # Update this
USE_HTTPS=true
CORS_ORIGIN=https://ala.alphataumedical.com  # Update this
VITE_API_URL=https://ala.alphataumedical.com/api  # Update this
```

#### 7. Redeploy with New Domain
```bash
bash deployment/scripts/deploy-https.sh
```

#### 8. Verify New Domain
```bash
# Should return 200 OK with no certificate warnings
curl -I https://ala.alphataumedical.com

# Test API
curl https://ala.alphataumedical.com/api/health
```

#### 9. Update Access URLs
Update any bookmarks, documentation, or integrations:
- Old: `https://ala-medical.westeurope.cloudapp.azure.com`
- New: `https://ala.alphataumedical.com`

---

### Option B: Apex Domain (Advanced)
**Example**: `alphataumedical.com` (root domain)

**⚠️ Considerations:**
- Some DNS providers don't support A records on apex domains
- May require ALIAS or ANAME records (provider-dependent)
- Email services (MX records) may be affected

**Recommended**: Use a subdomain instead (Option A)

---

## Rollback Plan

If something goes wrong, rollback to Azure DNS:

```bash
# SSH to VM
ssh azureuser@20.217.84.100
cd ~/ala-improved

# Restore Azure DNS in .env.azure
nano deployment/azure/.env.azure
# Change DOMAIN back to: ala-medical.westeurope.cloudapp.azure.com

# Regenerate Azure DNS certificate
bash scripts/setup-letsencrypt.sh ala-medical.westeurope.cloudapp.azure.com admin@alphataumedical.com

# Redeploy
bash deployment/scripts/deploy-https.sh
```

---

## Certificate Management

### Auto-Renewal
Let's Encrypt certificates expire after 90 days but auto-renew weekly:

**Check Renewal Cron Job:**
```bash
crontab -l | grep renew-cert
# Should show: 0 3 * * 0 cd /home/azureuser/ala-improved && ./ssl-certs/renew-cert.sh <domain>
```

**Manual Renewal:**
```bash
cd ~/ala-improved
./ssl-certs/renew-cert.sh ala.alphataumedical.com
```

### Certificate Verification
```bash
# Check expiration date
openssl x509 -enddate -noout -in ~/ala-improved/ssl-certs/certs/certificate.crt

# Verify domain in certificate
openssl x509 -text -noout -in ~/ala-improved/ssl-certs/certs/certificate.crt | grep -A1 "Subject Alternative Name"
```

---

## Multi-Domain Support (Advanced)

To support both Azure DNS AND custom domain simultaneously:

### 1. Get Certificate with Multiple SANs
```bash
bash scripts/setup-letsencrypt.sh ala.alphataumedical.com \
  -d ala-medical.westeurope.cloudapp.azure.com
```

### 2. Update Nginx Configuration
```nginx
server {
    listen 443 ssl;
    http2 on;
    server_name ala.alphataumedical.com ala-medical.westeurope.cloudapp.azure.com;
    # ... rest of config
}
```

---

## Troubleshooting

### DNS Not Resolving
```bash
# Check DNS propagation
nslookup ala.alphataumedical.com

# If not resolving, check DNS provider TTL (may take up to 48 hours)
```

### Let's Encrypt Fails
```bash
# Common issues:
# 1. Domain not pointing to server IP
# 2. Ports 80/443 blocked by firewall
# 3. Existing web server using port 80

# Verify port 80 is accessible:
curl -I http://ala.alphataumedical.com/.well-known/acme-challenge/test
```

### Certificate Not Loading
```bash
# Check file permissions
ls -la ~/ala-improved/ssl-certs/certs/
ls -la ~/ala-improved/ssl-certs/private/

# Should be:
# certificate.crt: 644 (readable by all)
# private.key: 644 (readable by nginx container)
```

### Browser Still Shows Warning
```bash
# Clear browser cache and force reload (Ctrl+Shift+R)
# Verify certificate is for correct domain:
openssl s_client -connect ala.alphataumedical.com:443 -showcerts
```

---

## Cost Comparison

| Solution | Setup Time | Annual Cost | Maintenance |
|----------|-----------|-------------|-------------|
| **Azure DNS** | 5 mins | FREE | Auto-renew |
| **Custom Domain (existing)** | 15 mins | FREE | Auto-renew |
| **Custom Domain (new)** | 15 mins + DNS | $10-15 | Auto-renew |

---

## Best Practices

### 1. Testing Before Production
Always test custom domain migration on staging environment first.

### 2. DNS TTL Management
- Lower TTL to 300 seconds (5 min) before migration
- Allows faster rollback if needed
- Increase TTL to 3600+ after stable

### 3. Communication
Notify users of URL change:
- Email notification
- Redirect from old URL (if possible)
- Update documentation

### 4. Monitoring
After migration, monitor for:
- Certificate expiration (should auto-renew)
- DNS resolution issues
- API connectivity from frontend

---

## Quick Reference

### Current Domain Check
```bash
echo $DOMAIN
cat deployment/azure/.env.azure | grep DOMAIN
```

### Active Certificate Check
```bash
openssl x509 -text -noout -in ~/ala-improved/ssl-certs/certs/certificate.crt | grep "Subject:"
```

### Container Status
```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

### Access URLs
```bash
# Frontend
echo "https://$(cat deployment/azure/.env.azure | grep '^DOMAIN=' | cut -d= -f2)"

# API Health
curl -s https://$(cat deployment/azure/.env.azure | grep '^DOMAIN=' | cut -d= -f2)/api/health | jq
```

---

## Support

For issues during migration:
1. Check logs: `docker logs ala-frontend-azure`
2. Verify DNS: `nslookup <your-domain>`
3. Test SSL: `curl -vI https://<your-domain>`
4. Review this guide's troubleshooting section

**Rollback is always available** - you can return to Azure DNS at any time.