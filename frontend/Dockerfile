# =================================================================
# ALA Frontend - Unified Multi-Stage Dockerfile
# =================================================================
# Supports development and production builds through build stages
# Usage:
#   Development: docker build --target development .
#   Production:  docker build --target production . (default)

# =================================================================
# BASE STAGE - Common Node.js setup
# =================================================================
FROM node:20-alpine AS base

# Install security updates and necessary packages
RUN apk update && apk upgrade && \
    apk add --no-cache \
    ca-certificates \
    wget \
    dumb-init && \
    rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S -D -H -u 1001 -h /usr/src/app -s /bin/sh -G nodejs -g nodejs nodejs

# Set working directory
WORKDIR /usr/src/app

# Copy package files for better caching
COPY package*.json ./

# =================================================================
# DEVELOPMENT STAGE - Vite dev server with HMR
# =================================================================
FROM base AS development

# Install ALL dependencies (including dev dependencies)
RUN npm install && npm cache clean --force

# Copy source code
COPY . .

# Change ownership to nodejs user
RUN chown -R nodejs:nodejs /usr/src/app

# Switch to non-root user
USER nodejs

# Expose development port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=development

# Add development health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Run Vite development server with HMR
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# =================================================================
# BUILD STAGE - Compile and build assets
# =================================================================
FROM base AS build

# Accept build arguments for environment variables
ARG VITE_API_URL=http://localhost:5000/api
ARG VITE_ENVIRONMENT=development
ARG VITE_PRIORITY_API_URL
ARG VITE_OFFLINE_STORAGE=true

# Set environment variables from build args
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_ENVIRONMENT=${VITE_ENVIRONMENT}
ENV VITE_PRIORITY_API_URL=${VITE_PRIORITY_API_URL}
ENV VITE_OFFLINE_STORAGE=${VITE_OFFLINE_STORAGE}

# Install ALL dependencies needed for build
RUN npm install && npm cache clean --force

# Copy source code
COPY . .

# Change ownership to nodejs user
RUN chown -R nodejs:nodejs /usr/src/app

# Switch to non-root user for build
USER nodejs

# Build the application for production
RUN npm run build

# =================================================================
# PRODUCTION STAGE - Nginx with optimized assets
# =================================================================
FROM nginx:1.27.5-alpine AS production

# Accept build argument for nginx configuration
ARG NGINX_CONFIG=nginx.staging.conf

# Install security updates
RUN apk update && apk upgrade && \
    apk add --no-cache \
    ca-certificates \
    wget && \
    rm -rf /var/cache/apk/*

# Create non-root user for nginx
RUN addgroup -g 1001 -S nginx-app && \
    adduser -S -D -H -u 1001 -h /var/cache/nginx -s /sbin/nologin -G nginx-app -g nginx-app nginx-app

# Copy built assets from build stage
COPY --from=build --chown=nginx-app:nginx-app /usr/src/app/dist /usr/share/nginx/html

# Copy SSL certificates for HTTPS (from host's Let's Encrypt directory)
COPY --chown=nginx-app:nginx-app ../ssl-certs/certs/fullchain.crt /etc/ssl/certs/fullchain.crt
COPY --chown=nginx-app:nginx-app ../ssl-certs/private/private.key /etc/ssl/private/private.key

# Copy nginx configuration (configurable via NGINX_CONFIG ARG)
COPY --chown=nginx-app:nginx-app ${NGINX_CONFIG} /etc/nginx/conf.d/default.conf

# Create custom nginx configuration with pid file in writable location
RUN echo "pid /var/cache/nginx/nginx.pid;" > /etc/nginx/nginx.conf && \
    echo "worker_processes auto;" >> /etc/nginx/nginx.conf && \
    echo "error_log /var/log/nginx/error.log warn;" >> /etc/nginx/nginx.conf && \
    echo "events { worker_connections 1024; }" >> /etc/nginx/nginx.conf && \
    echo "http {" >> /etc/nginx/nginx.conf && \
    echo "    include /etc/nginx/mime.types;" >> /etc/nginx/nginx.conf && \
    echo "    default_type application/octet-stream;" >> /etc/nginx/nginx.conf && \
    echo "    sendfile on;" >> /etc/nginx/nginx.conf && \
    echo "    keepalive_timeout 65;" >> /etc/nginx/nginx.conf && \
    echo "    include /etc/nginx/conf.d/*.conf;" >> /etc/nginx/nginx.conf && \
    echo "}" >> /etc/nginx/nginx.conf

# Create necessary directories and set permissions
RUN mkdir -p /var/cache/nginx/client_temp && \
    mkdir -p /var/cache/nginx/proxy_temp && \
    mkdir -p /var/cache/nginx/fastcgi_temp && \
    mkdir -p /var/cache/nginx/uwsgi_temp && \
    mkdir -p /var/cache/nginx/scgi_temp && \
    chown -R nginx-app:nginx-app /var/cache/nginx && \
    chown -R nginx-app:nginx-app /usr/share/nginx/html && \
    chown -R nginx-app:nginx-app /etc/nginx/conf.d && \
    chmod -R 755 /usr/share/nginx/html

# Create nginx.pid file directory
RUN mkdir -p /var/run/nginx && \
    chown -R nginx-app:nginx-app /var/run/nginx

# Switch to non-root user
USER nginx-app

# Expose HTTP port
EXPOSE 8080

# Environment variables for production
ENV NODE_ENV=production

# Add production health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080 || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]