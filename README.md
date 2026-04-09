# Accountability Log Application (ALA) - Improved

A comprehensive medical treatment tracking system for real-time source applicator management with Priority ERP integration. Deployed and running in production on Azure VM.

## 🏥 Overview

This application tracks medical treatments using source applicators with real-time validation against the Priority system. It handles insertion and removal procedures, progress tracking, and comprehensive documentation with PDF/JSON export capabilities.

**Production Status**: ✅ Deployed at https://ala-app.israelcentral.cloudapp.azure.com

## 🚀 Quick Start

### Development

```bash
# Start development environment
npm run dev                          # Interactive menu (recommended)
docker-compose up -d                 # Direct Docker start
node scripts/debug-unified.js health # Health check

# Backend development
cd backend && npm run dev            # Start with nodemon
cd backend && npm run build          # TypeScript compilation

# Frontend development
cd frontend && npm run dev           # Vite dev server
cd frontend && npm run test:e2e      # Playwright E2E tests
```

### Production (Azure VM)

```bash
# Quick deployment (radically simplified - October 2025)
ssh azureuser@20.217.84.100 "cd ~/ala-improved/deployment && ./deploy"

# Health check
curl https://ala-app.israelcentral.cloudapp.azure.com/api/health

# Test access
# Frontend: https://ala-app.israelcentral.cloudapp.azure.com
# Test user: test@example.com (code: 123456)
```

See [deployment/README.md](deployment/README.md) for complete deployment guide.

## 📁 Project Structure

```
ala-improved/
├── .env.local                       # Local environment variables
├── .github/workflows/               # CI/CD pipelines
│   ├── azure-deploy.yml
│   ├── deploy-develop.yml
│   ├── deploy-staging.yml
│   ├── docker-security.yml
│   └── test-and-build.yml
├── backend/                         # Express/TypeScript API
│   ├── src/
│   │   ├── controllers/             # Request handlers
│   │   │   ├── applicatorController.ts
│   │   │   ├── authController.ts
│   │   │   ├── priorityController.ts
│   │   │   └── treatmentController.ts
│   │   ├── services/                # Business logic
│   │   │   ├── applicatorService.ts
│   │   │   ├── priorityService.ts
│   │   │   └── treatmentService.ts
│   │   ├── routes/                  # API routes
│   │   │   ├── applicatorRoutes.ts
│   │   │   ├── authRoutes.ts
│   │   │   ├── healthRoutes.ts
│   │   │   ├── priorityRoutes.ts
│   │   │   └── treatmentRoutes.ts
│   │   ├── models/                  # Database models
│   │   ├── middleware/              # Express middleware
│   │   └── config/                  # Database configuration
├── frontend/                        # React/TypeScript UI
│   ├── src/
│   │   ├── components/              # Reusable components
│   │   │   ├── DevErrorBoundary.tsx
│   │   │   ├── Dialogs/             # Modal dialogs
│   │   │   ├── Layout.tsx
│   │   │   ├── ProgressTracker.tsx  # Real-time progress tracking
│   │   │   └── ProtectedRoute.tsx
│   │   ├── pages/
│   │   │   ├── Auth/                # Login & verification
│   │   │   ├── Treatment/           # Treatment workflow
│   │   │   │   ├── ApplicatorInformation.tsx
│   │   │   │   ├── SeedRemoval.tsx
│   │   │   │   ├── TreatmentDocumentation.tsx # PDF/JSON export
│   │   │   │   ├── TreatmentSelection.tsx
│   │   │   │   └── UseList.tsx
│   │   │   └── Admin/               # Admin dashboard
│   │   ├── contexts/                # React Context state
│   │   │   ├── AuthContext.tsx
│   │   │   └── TreatmentContext.tsx # Global treatment state
│   │   └── services/                # API clients
├── deployment/                      # Deployment configurations
│   ├── azure/                       # Azure VM production
│   │   ├── docker-compose.azure.yml
│   │   ├── .env.azure              # Production secrets
│   │   ├── deploy.sh
│   │   └── vm-initial-setup.sh
│   ├── docker/                      # Environment-specific configs
│   │   ├── docker-compose.dev.yml
│   │   ├── docker-compose.prod.yml
│   │   └── docker-compose.staging.yml
│   ├── scripts/                     # Deployment automation
│   │   ├── deploy.sh
│   │   ├── deploy-production.sh
│   │   └── monitor.sh
│   └── environments/               # Environment templates
├── docs/                           # Organized documentation
│   ├── analysis/                   # Codebase analysis
│   ├── database/                   # Database design docs
│   ├── deployment/                 # Deployment guides
│   ├── development/                # Development guides
│   ├── features/                   # Feature documentation
│   └── git/                        # Git workflows
├── scripts/                        # Utility scripts
│   ├── debug-unified.js            # Interactive debugging tool
│   ├── git-workflow.js             # Git workflow automation
│   ├── security-scan.js            # Security scanning
│   └── setup.js                    # Environment setup
├── docker-compose.yml              # Main Docker config (development)
└── package.json                    # Root package configuration
```

## ✨ Features

### Medical Treatment Tracking

- **Real-time Progress Tracking**: Live calculation of treatment completion percentages
- **Applicator Validation**: 5-scenario validation against Priority system
  - Already scanned, wrong treatment type, no use, not allowed, valid
- **Source Management**: Track Full use, Faulty, and No use applicators
- **Treatment Documentation**: Generate PDF and JSON treatment reports
- **Barcode Scanning**: Html5QrcodeScanner integration for applicator identification

### Priority ERP Integration

- **Real-time Data Sync**: Live queries to Priority PHONEBOOK, ORDERS, and PARTS
- **Reference Chain Validation**: Handle complex order relationships
- **Site-based Permissions**: Position Code 99 for full access, others site-restricted
- **Date-filtered Queries**: Optimized OData queries with server-side filtering
- **Fallback Support**: Graceful degradation with test data

### Security & Authentication

- **Verification Code Login**: SMS/email-based authentication
- **JWT Token Management**: Secure session handling
- **Site-based Access Control**: Restricted access based on user permissions
- **Input Validation**: Comprehensive data validation and sanitization
- **Container Security**: Non-root execution (UID/GID: 1001)

### Production Features

- **Azure VM Deployment**: Running at 20.217.84.100
- **Health Monitoring**: Comprehensive health checks
- **Container Management**: Docker-based deployment with health checks
- **Automated Security Scanning**: Trivy integration in CI/CD
- **Zero-downtime Deployment**: Production deployment scripts

## 🛠️ Technology Stack

### Backend

- **Node.js 20.x**: Latest LTS with Express framework
- **TypeScript**: Full type safety with strict configuration
- **PostgreSQL 16.6**: Primary database with Sequelize ORM
- **JWT Authentication**: Secure token-based authentication
- **Winston Logging**: Structured logging with emoji indicators

### Frontend

- **React 18**: Modern React with hooks and Context API
- **TypeScript**: Complete type coverage
- **Tailwind CSS**: Utility-first styling with responsive design
- **Vite**: Fast build tool with hot module replacement
- **Html5QrcodeScanner**: Barcode scanning capabilities
- **jsPDF**: PDF generation for treatment reports

### DevOps & Deployment

- **Docker & Docker Compose**: Containerized deployment
- **Azure VM**: Production hosting (20.217.84.100)
- **GitHub Actions**: CI/CD pipelines with security scanning
- **Trivy**: Automated vulnerability scanning
- **Playwright**: End-to-end testing framework

### Priority Integration

- **OData API**: RESTful queries to Priority system
- **Reference Chain Handling**: Complex order relationship management
- **Date Filtering**: Server-side date filtering for performance
- **Error Handling**: Comprehensive fallback mechanisms

## 🏃‍♂️ Development Workflow

### Local Development

```bash
# Start development environment
npm run dev                         # Interactive menu
docker-compose up -d                # Start all services

# Backend development
cd backend
npm run dev                         # Start with hot reload
npm run build                       # TypeScript compilation
npm run lint                        # ESLint with auto-fix
npm run test                        # Jest testing suite

# Frontend development
cd frontend
npm run dev                         # Vite dev server
npm run build                       # Production build
npm run test:e2e                    # Playwright E2E tests
npm run test:e2e:seed-removal       # Specific workflow tests

# Health checks
node scripts/debug-unified.js health
docker-compose logs -f api          # Backend logs
docker-compose logs -f frontend     # Frontend logs
```

### Environment Management

- **Development**: `docker-compose.yml` (default)
- **Production**: `deployment/azure/.env.azure` on Azure VM
- **Staging**: `deployment/docker/docker-compose.staging.yml`

## 🚀 Production Deployment

### Azure VM Environment

- **VM IP**: 20.217.84.100 (ATM-ISR-Docker resource group)
- **SSH Access**: `ssh azureuser@20.217.84.100`
- **Frontend**: http://20.217.84.100:3000
- **Backend API**: http://20.217.84.100:5000/api/health
- **Containers**: ala-frontend-azure, ala-api-azure, ala-db-azure

### Deployment Commands

```bash
# Quick deployment (recommended)
ssh azureuser@20.217.84.100 "cd ala-improved && ~/deployment/scripts/deploy.sh"

# Manual deployment
ssh azureuser@20.217.84.100
cd ala-improved
git pull origin main
docker-compose -f deployment/azure/docker-compose.azure.yml --env-file deployment/azure/.env.azure up -d --build

# Health monitoring
curl http://20.217.84.100:5000/api/health
ssh azureuser@20.217.84.100 "docker ps"
ssh azureuser@20.217.84.100 "docker logs ala-api-azure --tail=20"
```

## 🎯 Priority API Integration

### Core Endpoints

- **PHONEBOOK**: User authentication and site permissions
- **ORDERS**: Treatment and patient data
- **PARTS/SIBD_APPLICATUSELIST**: Applicator validation
- **CUSTOMERS**: Site information for Position Code 99 users

### Key Features

- **Reference Chain Validation**: Handle complex order relationships
- **Date-optimized Queries**: `SIBD_TREATDAY` filtering at API level
- **Site-based Access**: Position Code 99 = all sites, others restricted
- **Real-time Validation**: Live applicator validation during scanning
- **Fallback Support**: Test data fallback for development

### Test Users

- **alexs@alphatau.com**: Position Code 99 (Full Admin Access)
- **test@bypass.com**: Emergency bypass user
- **test@example.com**: Development mode (fixed code: 123456)

## 📜 Scripts & Automation

### Available Scripts

```bash
# Interactive debugging and management
node scripts/debug-unified.js       # Main debugging tool
node scripts/debug-unified.js health # Quick health check

# Git workflow automation
node scripts/git-workflow.js feature # Create feature branch
node scripts/git-workflow.js hotfix  # Create hotfix branch

# Security and quality
node scripts/security-scan.js       # Security vulnerability scan
node scripts/setup.js               # Environment setup and validation

# Deployment automation
deployment/scripts/deploy.sh        # Production deployment
deployment/scripts/monitor.sh       # Production monitoring
```

### CI/CD Pipelines

- **test-and-build.yml**: Run tests and build on PR
- **deploy-develop.yml**: Auto-deploy to development
- **deploy-staging.yml**: Deploy to staging environment
- **azure-deploy.yml**: Production deployment to Azure VM
- **docker-security.yml**: Security scanning with Trivy

## 🏗️ Architecture

### Data Flow

1. **Authentication**: Priority PHONEBOOK API verification
2. **Treatment Selection**: Auto-populate from Priority ORDERS
3. **Applicator Processing**: Real-time validation against Priority
4. **Progress Tracking**: Live calculations in TreatmentContext
5. **Documentation**: PDF/JSON export with treatment summary

### State Management

- **TreatmentContext**: Global treatment state with progress calculations
- **AuthContext**: User session and site permissions
- **Local Storage**: Offline support and Priority data caching

### Error Handling

- **Multi-layer Validation**: Frontend, backend, and Priority API validation
- **Graceful Degradation**: Fallback to test data on API failures
- **User-friendly Messages**: Clear error messages with actionable guidance
- **Comprehensive Logging**: Structured logs with emoji indicators (🧪 🎯 ❌)

## 📚 Documentation

### Organized Documentation

- **`docs/analysis/`**: Codebase analysis and architecture reviews
- **`docs/database/`**: Database design and implementation guides
- **`docs/deployment/`**: Deployment procedures and Docker configurations
- **`docs/development/`**: Development workflows and Claude Code integration
- **`docs/features/`**: Feature documentation and implementation guides
- **`docs/git/`**: Git workflows and branch management

### Key Documents

- **`CLAUDE.md`**: Claude Code integration and workflow guidance
- **`docs/database/DATABASE_DESIGN_GUIDE.md`**: Database schema and relationships
- **`docs/deployment/DOCKER.md`**: Docker configuration and deployment
- **`docs/analysis/gemini-analysis.md`**: Comprehensive codebase analysis

## 🔒 Security

### Security Features

- **Container Security**: Non-root execution, minimal attack surface
- **Authentication**: JWT-based with verification codes
- **Input Validation**: Comprehensive validation and sanitization
- **API Security**: Rate limiting, CORS configuration, helmet middleware
- **Vulnerability Scanning**: Automated Trivy scans in CI/CD

### Security Versions

- **Node.js**: Latest LTS with security patches
- **PostgreSQL**: 16.6-alpine with security updates
- **Dependencies**: Regular updates and vulnerability monitoring

## 🧪 Testing

### Test Coverage

- **Backend**: Jest unit and integration tests
- **Frontend**: Vitest component tests
- **E2E Testing**: Playwright for full workflow testing
- **API Testing**: Comprehensive endpoint testing
- **Security Testing**: Automated vulnerability scanning

### Test Commands

```bash
# Backend testing
cd backend && npm run test
cd backend && npm run test:coverage

# Frontend testing
cd frontend && npm run test
cd frontend && npm run test:e2e
cd frontend && npm run test:e2e:seed-removal

# Security testing
node scripts/security-scan.js
```

## 📈 Monitoring & Health

### Health Endpoints

- **Backend**: `GET /api/health` - API status and database connectivity
- **Priority**: `GET /api/priority/health` - Priority API connectivity

### Monitoring

```bash
# Production health checks
curl http://20.217.84.100:5000/api/health
ssh azureuser@20.217.84.100 "docker ps"
ssh azureuser@20.217.84.100 "docker logs ala-api-azure"

# Local development health
node scripts/debug-unified.js health
docker-compose logs -f
```

## 🔧 Troubleshooting

### Common Issues

- **Priority API Empty Results**: Check date format, authentication, logs (🎯 vs ❌)
- **Applicator Validation Failing**: Verify 5-scenario validation logic
- **Container Issues**: Use `docker-compose down -v && docker-compose up -d --build`
- **TypeScript Errors**: Run `cd backend && npm run build`

### Recovery

```bash
# Version recovery
git fetch --tags && git checkout v1.0-working-production-2025-09-10

# Production recovery
ssh azureuser@20.217.84.100 "cd ala-improved && ~/deployment/scripts/deploy.sh"
```

## 📄 License

Proprietary - All rights reserved. This medical application is designed for healthcare environments with strict reliability and validation requirements.

---

**Note**: This application prioritizes medical data accuracy and real-time Priority system integration. Always validate against Priority API and maintain comprehensive error handling for production reliability.
