# Build stage
FROM node:20.13-alpine AS build

WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:stable-alpine

# Copy built assets from the build stage
COPY --from=build /usr/src/app/dist /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Expose port 80
EXPOSE 80

# Use environment variables in nginx config
ENV NGINX_ENVSUBST_TEMPLATE_DIR=/etc/nginx/templates
ENV NGINX_ENVSUBST_OUTPUT_DIR=/etc/nginx/conf.d

CMD ["nginx", "-g", "daemon off;"]
