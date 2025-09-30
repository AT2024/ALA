#!/bin/bash

# Generate SSL Certificate Script for ALA Application
# This script creates self-signed SSL certificates for testing HTTPS locally

set -e

# Configuration
DOMAIN=${1:-"20.217.84.100"}
CERT_DIR="ssl-certs"
DAYS=365

echo "🔐 Generating SSL certificate for domain: $DOMAIN"

# Create certificate directories
mkdir -p "$CERT_DIR/certs" "$CERT_DIR/private"

# Generate private key
echo "📝 Generating private key..."
openssl genrsa -out "$CERT_DIR/private/private.key" 2048

# Generate certificate signing request
echo "📄 Generating certificate signing request..."
openssl req -new -key "$CERT_DIR/private/private.key" -out "$CERT_DIR/private/certificate.csr" \
  -subj "/C=IL/ST=Tel Aviv/L=Tel Aviv/O=AlphaTau Medical/OU=IT Department/CN=$DOMAIN"

# Generate self-signed certificate
echo "🎫 Generating self-signed certificate..."
openssl x509 -req -days $DAYS -in "$CERT_DIR/private/certificate.csr" \
  -signkey "$CERT_DIR/private/private.key" \
  -out "$CERT_DIR/certs/certificate.crt" \
  -extensions v3_req -extfile <(cat << EOF
[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
IP.1 = $DOMAIN
DNS.1 = localhost
DNS.2 = ala-medical.local
EOF
)

# Set proper permissions
chmod 600 "$CERT_DIR/private/private.key"
chmod 644 "$CERT_DIR/certs/certificate.crt"

echo "✅ SSL certificate generated successfully!"
echo ""
echo "📂 Certificate files created:"
echo "  - Certificate: $CERT_DIR/certs/certificate.crt"
echo "  - Private Key: $CERT_DIR/private/private.key"
echo ""
echo "⚠️  This is a self-signed certificate - browsers will show security warnings"
echo "💡 For production, use Let's Encrypt or a commercial certificate"
echo ""
echo "🔍 Certificate details:"
openssl x509 -in "$CERT_DIR/certs/certificate.crt" -text -noout | grep -E "(Subject|Validity|DNS|IP)"

echo ""
echo "🚀 Next steps:"
echo "  1. Update docker-compose.yml to mount SSL certificates"
echo "  2. Configure nginx to use HTTPS with these certificates"
echo "  3. Set USE_HTTPS=true in environment variables"
echo "  4. Access https://$DOMAIN:3000 (accept security warning)"