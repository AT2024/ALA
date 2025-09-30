#!/bin/bash

# Let's Encrypt SSL Setup Script for ALA Application
# This script sets up automatic SSL certificates using Let's Encrypt

set -e

DOMAIN=${1}
EMAIL=${2:-"admin@alphataumedical.com"}

if [ -z "$DOMAIN" ]; then
    echo "❌ Error: Domain name is required"
    echo "Usage: $0 <domain> [email]"
    echo "Example: $0 ala-medical.com admin@company.com"
    exit 1
fi

echo "🔐 Setting up Let's Encrypt SSL for domain: $DOMAIN"

# Check if domain resolves to current server
SERVER_IP=$(curl -s ifconfig.me)
DOMAIN_IP=$(dig +short $DOMAIN | tail -n1)

if [ "$SERVER_IP" != "$DOMAIN_IP" ]; then
    echo "⚠️  Warning: Domain $DOMAIN resolves to $DOMAIN_IP but server IP is $SERVER_IP"
    echo "Please ensure DNS is correctly configured before continuing."
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Create directories
mkdir -p ssl-certs/letsencrypt/live ssl-certs/letsencrypt/renewal

# Stop services that might be using ports 80/443
echo "🛑 Stopping existing services..."
docker-compose -f deployment/azure/docker-compose.azure.yml down 2>/dev/null || true

# Install certbot if not present
if ! command -v certbot &> /dev/null; then
    echo "📦 Installing certbot..."
    if [ -f /etc/debian_version ]; then
        sudo apt update && sudo apt install -y certbot
    elif [ -f /etc/redhat-release ]; then
        sudo yum install -y certbot
    else
        echo "❌ Please install certbot manually for your system"
        exit 1
    fi
fi

# Generate certificate using standalone mode
echo "🎫 Requesting SSL certificate from Let's Encrypt..."
sudo certbot certonly --standalone \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    -d "$DOMAIN" \
    --cert-path ssl-certs/letsencrypt/live/$DOMAIN/cert.pem \
    --key-path ssl-certs/letsencrypt/live/$DOMAIN/private.pem \
    --fullchain-path ssl-certs/letsencrypt/live/$DOMAIN/fullchain.pem

# Copy certificates to our directory structure
echo "📂 Setting up certificate files..."
sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem ssl-certs/certs/certificate.crt
sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem ssl-certs/private/private.key

# Set ownership and permissions
sudo chown -R $(whoami):$(whoami) ssl-certs/
chmod 644 ssl-certs/certs/certificate.crt
chmod 600 ssl-certs/private/private.key

# Create renewal script
cat > ssl-certs/renew-cert.sh << 'EOF'
#!/bin/bash
set -e

DOMAIN=$1
if [ -z "$DOMAIN" ]; then
    echo "Usage: $0 <domain>"
    exit 1
fi

# Renew certificate
sudo certbot renew --quiet

# Copy renewed certificates
sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem ssl-certs/certs/certificate.crt
sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem ssl-certs/private/private.key

# Set permissions
sudo chown $(whoami):$(whoami) ssl-certs/certs/certificate.crt ssl-certs/private/private.key
chmod 644 ssl-certs/certs/certificate.crt
chmod 600 ssl-certs/private/private.key

# Restart containers to use new certificates
docker-compose -f deployment/azure/docker-compose.azure.yml restart frontend

echo "✅ SSL certificate renewed successfully!"
EOF

chmod +x ssl-certs/renew-cert.sh

# Add to crontab for automatic renewal
(crontab -l 2>/dev/null; echo "0 3 * * 0 cd $(pwd) && ./ssl-certs/renew-cert.sh $DOMAIN") | crontab -

echo "✅ Let's Encrypt SSL certificate setup complete!"
echo ""
echo "📂 Certificate files:"
echo "  - Certificate: ssl-certs/certs/certificate.crt"
echo "  - Private Key: ssl-certs/private/private.key"
echo ""
echo "🔄 Auto-renewal:"
echo "  - Added to crontab (runs weekly on Sundays at 3 AM)"
echo "  - Manual renewal: ./ssl-certs/renew-cert.sh $DOMAIN"
echo ""
echo "🚀 Next steps:"
echo "  1. Update .env.azure with USE_HTTPS=true and DOMAIN=$DOMAIN"
echo "  2. Deploy with: ./deployment/scripts/deploy.sh"
echo "  3. Access https://$DOMAIN:3000"
echo ""
echo "Certificate valid until: $(openssl x509 -enddate -noout -in ssl-certs/certs/certificate.crt | cut -d= -f2)"