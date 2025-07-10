# Build stage
FROM node:20.19.2-bookworm-slim AS build

WORKDIR /usr/src/app

# Install security updates and necessary packages
RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y --no-install-recommends \
    ca-certificates && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd --gid 1001 --system nodejs && \
    useradd --uid 1001 --system --gid nodejs --shell /bin/bash nodejs

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy the rest of the code
COPY . .

# Change ownership to nodejs user
RUN chown -R nodejs:nodejs /usr/src/app
USER nodejs

# Build the application
RUN npm run build

# Production stage - Use secure nginx base
FROM nginx:1.25.3-alpine3.18

# Production stage - Use secure nginx base
FROM nginx:1.25.3-alpine3.18

# Install security updates
RUN apk update && apk upgrade && \
    apk add --no-cache ca-certificates && \
    rm -rf /var/cache/apk/*

# Create non-root user for nginx
RUN addgroup -g 1001 -S nginx-app && \
    adduser -S -D -H -u 1001 -h /var/cache/nginx -s /sbin/nologin -G nginx-app -g nginx-app nginx-app

# Copy built assets from the build stage
COPY --from=build --chown=nginx-app:nginx-app /usr/src/app/dist /usr/share/nginx/html

# Copy custom nginx config
COPY --chown=nginx-app:nginx-app nginx.conf /etc/nginx/templates/default.conf.template

# Set proper permissions
RUN chmod -R 755 /usr/share/nginx/html && \
    chown -R nginx-app:nginx-app /usr/share/nginx/html

# Use non-root user
USER nginx-app

# Expose port 80
EXPOSE 80

# Use environment variables in nginx config
ENV NGINX_ENVSUBST_TEMPLATE_DIR=/etc/nginx/templates
ENV NGINX_ENVSUBST_OUTPUT_DIR=/etc/nginx/conf.d

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80 || exit 1

CMD ["nginx", "-g", "daemon off;"]
