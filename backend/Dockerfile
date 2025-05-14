FROM node:20.13-alpine

WORKDIR /usr/src/app

# Copy package.json and package-lock.json first for better cache
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the code
COPY . .

# Build TypeScript code
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# Expose the application port
EXPOSE 5000

# Set environment variables
ENV NODE_ENV=production

# Run the application
CMD ["node", "dist/server.js"]
