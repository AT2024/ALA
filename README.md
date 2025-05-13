# Accountability Log Application (ALA)

This is an improved implementation of the Accountability Log Application, designed for tracking treatment data, applicator usage, and seed management.

## Project Structure

The application is organized into separate frontend and backend components for better maintainability:

- `frontend/` - React-based user interface built with Vite, TypeScript and Tailwind CSS
- `backend/` - Node.js Express API server with PostgreSQL database
- `docs/` - Project documentation
- `azure/` - Azure deployment configuration and scripts

## Features

- **Authentication**: Secure verification code-based login via SMS or email
- **Treatment Management**: Select, track and document treatments
- **Barcode Scanning**: Scan applicator barcodes with validation
- **Offline Support**: Continue working without network connectivity
- **Reporting**: Generate treatment reports in CSV/PDF formats
- **Admin Dashboard**: Monitor system usage and manage configurations

## Running the Application

You can run the application either locally with Node.js, using Docker, or deploy to Azure cloud.

### Option 1: Local Development Setup

#### Prerequisites

- Node.js 18.x or later
- PostgreSQL 15.x or later
- npm package manager

#### Installation & Setup

1. Clone the repository:

```bash
git clone <repository-url>
cd ala-improved
```

2. Install dependencies for both frontend and backend:

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

3. Set up environment variables:

```bash
# Backend environment setup
cd backend
cp .env.example .env
# Edit .env with your database credentials and other settings

# Frontend environment setup
cd ../frontend
cp .env.development.example .env.development
# Edit .env.development with your API URL and other settings
```

4. Set up the database:

```bash
# Create PostgreSQL database
createdb ala_db

# Run database migrations (using the backend application)
cd backend
npm run dev
```

5. Start the development servers:

```bash
# Start backend server
cd backend
npm run dev

# In a new terminal, start frontend server
cd frontend
npm run dev
```

### Option 2: Docker Setup (Recommended)

#### Prerequisites

- Docker and Docker Compose installed
- Git

#### Running with Docker

1. Clone the repository:

```bash
git clone <repository-url>
cd ala-improved
```

2. Start the application using our interactive launcher:

```bash
# On Windows
run-docker-app.bat
```

This will present you with two options:
- **Development Mode**: For local development with hot-reloading and debugging capabilities
- **Production Mode**: For testing the production configuration locally

The launcher will:
- Build the appropriate Docker images for your selected environment
- Start PostgreSQL database with proper configuration
- Set up networking between containers
- Configure environment variables based on your selection
- Expose the application on http://localhost

3. To stop the application:

```bash
# On Windows
stop-docker-app.bat

# On Linux/macOS
docker-compose down
```

#### Environment Configuration

Our Docker setup includes three configuration files:

1. **docker-compose.yml**: Base configuration shared between environments
2. **docker-compose.dev.yml**: Development-specific settings with source code mounting for hot-reloading
3. **docker-compose.prod.yml**: Production-ready configuration with security and performance optimizations

For advanced users who prefer the command line:

```bash
# Development mode
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

# Production mode (requires environment variables to be set)
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

### Option 3: Azure Cloud Deployment

For deploying to Azure cloud, follow the instructions in the [Azure Deployment Guide](azure/README.md).

## Development

### Branching Strategy

This project uses a structured branching strategy:

- `main` - Production-ready code
- `ui-development` - UI/frontend development branch
- `backend-development` - Backend API development branch
- `integration` - For integrating UI and backend changes before production

For feature development:
- UI features: Create branches from `ui-development` with format `ui/feature-name`
- Backend features: Create branches from `backend-development` with format `backend/feature-name`

### Building for Production

```bash
# Build backend
cd backend
npm run build

# Build frontend
cd frontend
npm run build
```

## Technology Stack

- **Frontend**:
  - React 18
  - TypeScript
  - Tailwind CSS
  - Vite
  - Zustand for state management
  - React Router for navigation
  - Axios for API requests

- **Backend**:
  - Node.js with Express
  - TypeScript
  - Sequelize ORM
  - PostgreSQL
  - JWT authentication
  - Winston for logging

- **DevOps**:
  - Docker and Docker Compose
  - Azure Container Registry
  - Azure App Service
  - Azure Database for PostgreSQL
  - ESLint and Prettier for code quality
  - Jest for testing

## License

Proprietary - All rights reserved
