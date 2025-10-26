# Nginx reverse proxy for blue-green deployment
FROM nginx:1.27.5-alpine

# Install required packages for health checks and updates
RUN apk update && apk upgrade && \
    apk add --no-cache \
    ca-certificates \
    wget \
    bash && \
    rm -rf /var/cache/apk/*

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf
COPY upstream-blue.conf /etc/nginx/conf.d/upstream-blue.conf
COPY upstream-green.conf /etc/nginx/conf.d/upstream-green.conf

# Create symlink to blue by default (initial deployment)
RUN ln -sf /etc/nginx/conf.d/upstream-blue.conf /etc/nginx/conf.d/upstream-active.conf

# Create directory for Let's Encrypt challenges
RUN mkdir -p /var/www/certbot

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
