# Blue-Green Deployment: SSL Termination Architecture

**Date**: 2025-10-27
**Context**: Explains why HTTPS frontend configs cause redirect loops in blue-green deployment

## Overview

The ALA Medical Application uses **different SSL/HTTPS architectures** for simple vs blue-green deployments. Understanding this difference is critical to preventing redirect loops.

## Simple Deployment Architecture

```
┌─────────┐
│  User   │
│(Browser)│
└────┬────┘
     │ HTTPS (443)
     │
┌────▼──────────────┐
│  Frontend         │
│  Container        │
│  (nginx)          │
│                   │
│  - Listen 443 SSL │
│  - SSL certs      │
│  - Redirect 80→443│
└────┬──────────────┘
     │ HTTP (5000)
┌────▼──────────────┐
│  Backend          │
│  Container        │
└───────────────────┘
```

**Key Points**:
- Frontend container handles HTTPS directly
- Frontend has SSL certificates
- Frontend redirects HTTP → HTTPS
- Configuration: `frontend/nginx.https.azure.conf`

---

## Blue-Green Deployment Architecture

```
┌─────────┐
│  User   │
│(Browser)│
└────┬────┘
     │ HTTPS (443)
     │
┌────▼──────────────────────┐
│  Proxy Container          │
│  (nginx)                  │
│                           │
│  - Listen 443 SSL         │
│  - SSL certificates       │
│  - Redirect 80→443        │
│  - SSL TERMINATION HERE   │
│  - Routes to blue/green   │
└─────┬─────────────────────┘
      │ HTTP (forwards internally)
      │
      ├─────────────┬─────────────┐
      │             │             │
┌─────▼────┐  ┌─────▼────┐  ┌────▼─────┐
│Frontend  │  │Frontend  │  │ Database │
│Blue      │  │Green     │  │          │
│          │  │          │  │          │
│HTTP ONLY │  │HTTP ONLY │  │          │
│Port 8080 │  │Port 8080 │  │          │
└─────┬────┘  └─────┬────┘  └──────────┘
      │             │
┌─────▼────┐  ┌─────▼────┐
│Backend   │  │Backend   │
│Blue      │  │Green     │
│Port 5000 │  │Port 5000 │
└──────────┘  └──────────┘
```

**Key Points**:
- **Proxy container** handles HTTPS (SSL termination)
- **Frontend containers** serve HTTP ONLY (no HTTPS, no redirects)
- Proxy forwards HTTP requests internally to frontends
- Configuration: `frontend/nginx.http-bluegreen.conf`

---

## Why Redirect Loops Happen

### The Wrong Configuration (Causes Redirect Loop)

```
User (HTTPS)
    ↓
Proxy (handles HTTPS, forwards HTTP to frontend)
    ↓ HTTP
Frontend (using nginx.https.azure.conf)
    ↓ Sees HTTP request
    ↓ Redirects to HTTPS (301)
    ↓
Browser follows redirect
    ↓ HTTPS
Proxy (handles HTTPS, forwards HTTP to frontend)
    ↓ HTTP
Frontend (redirects to HTTPS again)
    ↓ 301 → HTTPS
    ↓
INFINITE LOOP ❌
```

**Error**: `ERR_TOO_MANY_REDIRECTS`

### The Correct Configuration

```
User (HTTPS)
    ↓
Proxy (handles HTTPS, forwards HTTP to frontend)
    ↓ HTTP
Frontend (using nginx.http-bluegreen.conf)
    ↓ Serves content on HTTP (no redirect)
    ↓ Returns HTTP 200 OK
    ↓
Proxy forwards response
    ↓
User sees HTTPS ✅
```

**Result**: HTTP 200 OK, user sees HTTPS

---

## Configuration Files

### Simple Deployment: nginx.https.azure.conf

**Location**: `frontend/nginx.https.azure.conf`

**Key Features**:
- HTTP server on port 80 (redirects to HTTPS)
- HTTPS server on port 443 (SSL certificates)
- Frontend handles own HTTPS

**Snippet**:
```nginx
# HTTP server - redirect to HTTPS
server {
    listen 80;
    server_name _;

    # Redirect all HTTP traffic to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl;
    server_name _;

    # SSL configuration
    ssl_certificate /etc/ssl/certs/fullchain.crt;
    ssl_certificate_key /etc/ssl/private/private.key;

    # Serve React app
    location / {
        # ...
    }
}
```

---

### Blue-Green Deployment: nginx.http-bluegreen.conf

**Location**: `frontend/nginx.http-bluegreen.conf`

**Key Features**:
- HTTP server on port 8080 ONLY
- NO HTTPS server block
- NO HTTP → HTTPS redirect
- Proxy handles SSL termination

**Snippet**:
```nginx
# HTTP-only nginx configuration for blue-green deployment
# This configuration is used by frontend containers in blue-green architecture
# where the proxy handles HTTPS termination and forwards HTTP to frontend containers

# HTTP server - serve React app directly (no HTTPS redirect)
server {
    listen 8080;  # Non-privileged port for HTTP
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    # Handle single page application
    location / {
        try_files $uri $uri/ /index.html;
    }

    # NO HTTPS redirect
    # NO SSL configuration
}
```

---

### Proxy Configuration: nginx.conf

**Location**: `deployment/nginx/nginx.conf`

**Key Features**:
- Handles SSL termination
- Includes upstream configuration via symlink
- Routes to blue or green frontend

**Snippet**:
```nginx
events {
    worker_connections 1024;
}

http {
    # Include active upstream configuration (blue or green)
    include /etc/nginx/conf.d/upstream-active.conf;

    # HTTP server - redirect to HTTPS
    server {
        listen 80;
        server_name _;

        location / {
            return 301 https://$host$request_uri;
        }
    }

    # HTTPS server - SSL TERMINATION
    server {
        listen 443 ssl;
        http2 on;
        server_name _;

        # SSL configuration
        ssl_certificate /etc/ssl/certs/fullchain.crt;
        ssl_certificate_key /etc/ssl/private/private.key;

        # Forward to frontend (HTTP)
        location / {
            proxy_pass http://frontend/;  # ← HTTP (not HTTPS!)
            proxy_http_version 1.1;
            proxy_set_header X-Forwarded-Proto https;
            # ... other headers
        }
    }
}
```

---

## How to Prevent Redirect Loops

### 1. Use Correct nginx Config for Each Deployment Type

| Deployment Type | Frontend nginx Config |
|-----------------|----------------------|
| Simple (no proxy) | `nginx.https.azure.conf` |
| Blue-Green (with proxy) | `nginx.http-bluegreen.conf` |

### 2. Configure .env File Correctly

**deployment/.env**:
```bash
# For simple deployment
NGINX_CONFIG=nginx.https.azure.conf

# For blue-green deployment
NGINX_CONFIG=nginx.http-bluegreen.conf  # ← CRITICAL!
```

### 3. Verify Configuration

```bash
# Check which config frontend is using
docker exec ala-frontend-blue cat /etc/nginx/conf.d/default.conf | head -5

# Should show for blue-green:
# "HTTP-only nginx configuration for blue-green deployment"

# Should NOT show:
# "HTTPS-enabled nginx configuration"
```

---

## Troubleshooting Decision Tree

```
User reports: ERR_TOO_MANY_REDIRECTS
│
├─ Check deployment type
│  └─ Blue-Green?
│     ├─ YES → Check frontend config
│     │  └─ Using nginx.http-bluegreen.conf?
│     │     ├─ NO  → PROBLEM! Fix .env file
│     │     └─ YES → Check .env for overrides
│     │
│     └─ NO (simple) → Different issue
│
└─ Check .env file
   └─ NGINX_CONFIG=nginx.http-bluegreen.conf?
      ├─ NO  → Fix and rebuild
      └─ YES → Check proxy forwarding
```

---

## Key Principles

### 1. SSL Termination = One Place Only

In blue-green deployment:
- ✅ Proxy handles HTTPS (SSL termination)
- ❌ Frontend does NOT handle HTTPS
- ❌ Frontend does NOT redirect to HTTPS

### 2. Environment Variable Precedence

`.env` file **ALWAYS** overrides docker-compose.yml defaults:

```yaml
# docker-compose.bluegreen.yml
args:
  - NGINX_CONFIG=${NGINX_CONFIG:-nginx.http-bluegreen.conf}  # Default

# deployment/.env overrides this!
NGINX_CONFIG=nginx.https.azure.conf  # ← Takes precedence
```

### 3. Architecture Determines Configuration

| If you have... | Then use... |
|----------------|-------------|
| Single frontend container | nginx.https.azure.conf |
| Proxy + frontend containers | nginx.http-bluegreen.conf |
| Proxy but forgot to change config | ERR_TOO_MANY_REDIRECTS |

---

## References

- **Incident Report**: [2025-10-27 Blue-Green Production Outage](../learnings/errors/2025-10-27-blue-green-production-outage.md)
- **Deployment Guide**: [Blue-Green Deployment Guide](../../deployment/BLUE_GREEN_DEPLOYMENT.md)
- **Troubleshooting**: [TROUBLESHOOTING.md](../TROUBLESHOOTING.md#blue-green-deployment-issues)
- **nginx Configs**:
  - Simple: [frontend/nginx.https.azure.conf](../../frontend/nginx.https.azure.conf)
  - Blue-Green: [frontend/nginx.http-bluegreen.conf](../../frontend/nginx.http-bluegreen.conf)
  - Proxy: [deployment/nginx/nginx.conf](../../deployment/nginx/nginx.conf)

---

## Summary

**Simple Deployment**: Frontend handles HTTPS directly
**Blue-Green Deployment**: Proxy handles HTTPS, frontends serve HTTP only
**Never Mix**: Using HTTPS config in blue-green = guaranteed redirect loop

The difference is architectural: SSL termination happens at different layers. Understanding this prevents hours of debugging redirect loops.
