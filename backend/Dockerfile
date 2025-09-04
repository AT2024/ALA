# =================================================================
# ALA Backend - Unified Multi-Stage Dockerfile
# =================================================================
# Supports both development and production builds through build stages
# Usage:
#   Development: docker build --target development .
#   Production:  docker build --target production . (default)

# =================================================================
# BASE STAGE - Common dependencies and setup
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
# DEVELOPMENT STAGE - For local development with hot reload
# =================================================================
FROM base AS development

# Install ALL dependencies (including dev dependencies)
RUN npm install && npm cache clean --force

# Install global development tools
RUN npm install -g nodemon ts-node

# Copy source code
COPY . .

# Change ownership to nodejs user
RUN chown -R nodejs:nodejs /usr/src/app

# Switch to non-root user
USER nodejs

# Expose development port
EXPOSE 5000

# Set environment variables
ENV NODE_ENV=development

# Add development health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Run development server with hot reload
CMD ["npm", "run", "dev"]

# =================================================================
# BUILD STAGE - Compile TypeScript for production
# =================================================================
FROM base AS build

# Install only production dependencies initially
RUN npm ci --only=production && npm cache clean --force

# Install development dependencies needed for build
RUN npm install --only=development && npm cache clean --force

# Copy source code
COPY . .

# Build TypeScript code
RUN npm run build

# Remove development dependencies after build
RUN npm prune --production && npm cache clean --force

# =================================================================
# PRODUCTION STAGE - Optimized runtime image
# =================================================================
FROM base AS production

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from build stage
COPY --from=build --chown=nodejs:nodejs /usr/src/app/dist ./dist
COPY --from=build --chown=nodejs:nodejs /usr/src/app/node_modules ./node_modules

# Copy only necessary files
COPY --chown=nodejs:nodejs package*.json ./

# Create logs directory
RUN mkdir -p logs && chown -R nodejs:nodejs logs

# Change ownership to nodejs user
RUN chown -R nodejs:nodejs /usr/src/app

# Switch to non-root user
USER nodejs

# Expose production port
EXPOSE 5000

# Set environment variables
ENV NODE_ENV=production

# Add production health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Run production server
CMD ["node", "dist/server.js"]