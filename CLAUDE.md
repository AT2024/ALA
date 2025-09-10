# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Table of Contents
1. [Azure VM Production Deployment](#azure-vm-production-deployment)
2. [Quick Reference](#quick-reference)
3. [Tool Usage Guidelines](#tool-usage-guidelines)
4. [Development Workflow](#development-workflow)
5. [Architecture Overview](#architecture-overview)
6. [Business Logic & Workflows](#business-logic--workflows)
7. [Priority API Integration Rules](#priority-api-integration-rules)
8. [Common Tasks](#common-tasks)
9. [Troubleshooting](#troubleshooting)

---

## Azure VM Production Deployment

### 🚀 Production Environment
- **VM IP Address**: 20.217.84.100
- **Resource Group**: ATM-ISR-Docker
- **VM Name**: ALAapp
- **SSH User**: azureuser
- **Status**: ✅ DEPLOYED AND RUNNING

### 📊 Current Production Status
```
✅ Frontend: http://20.217.84.100:3000 (Accountability Log Application)
✅ Backend API: http://20.217.84.100:5000/api/health (Status: OK)
✅ PostgreSQL Database: Connected and healthy
✅ Priority API: Configured with credentials
```

### 🐳 Running Containers
- **ala-frontend-azure**: nginx (port 3000 → 80)
- **ala-api-azure**: Node.js Express API (port 5000)  
- **ala-db-azure**: PostgreSQL 16.6 (port 5432)

### 🔧 Production Management
```bash
# Quick deployment update
ssh azureuser@20.217.84.100
cd ala-improved
~/deploy.sh

# Manual deployment
ssh azureuser@20.217.84.100
cd ala-improved
docker-compose -f azure/docker-compose.azure.yml --env-file azure/.env.azure up -d --build

# Health checks
curl http://20.217.84.100:3000          # Frontend
curl http://20.217.84.100:5000/api/health # Backend API
```

### 🔑 SSH Access
```bash
# Standard connection
ssh azureuser@20.217.84.100

# Execute commands remotely
ssh azureuser@20.217.84.100 "docker ps"
ssh azureuser@20.217.84.100 "cd ala-improved && docker logs ala-api-azure --tail=10"
```

### 📁 VM File Structure
```
/home/azureuser/
├── ala-improved/           # Main application repository  
│   ├── azure/              # Azure-specific configs
│   │   └── .env.azure      # Production environment variables
│   ├── frontend/           # React application
│   ├── backend/            # Express API
│   └── docker-compose.azure.yml
├── deploy.sh              # Quick deployment script
└── vm-initial-setup.sh    # Initial VM setup script
```

---

## Quick Reference

### Project Overview
- **Application**: Medical Treatment Tracking System
- **Purpose**: Real-time tracking of seed applicator treatments with Priority ERP integration
- **Tech Stack**: React/TypeScript/Tailwind (Frontend) + Express/TypeScript/PostgreSQL (Backend)
- **Key Integration**: Priority API for patient data and applicator validation

### Essential Commands

#### Local Development
```bash
# Start development
npm run dev                          # Interactive menu (recommended)
node scripts/debug-unified.js health # Check system health

# Quick fixes
cd backend && npm run build          # Fix TypeScript errors
docker-compose restart backend       # Restart backend service
docker-compose logs -f backend       # View backend logs
```

#### Azure VM Production
```bash
# Connect to production VM
ssh azureuser@20.217.84.100

# Quick deployment
ssh azureuser@20.217.84.100 "cd ala-improved && ~/deploy.sh"

# Check production status
ssh azureuser@20.217.84.100 "docker ps"
ssh azureuser@20.217.84.100 "docker logs ala-api-azure --tail=20"
```

### Critical Files
- `backend/src/services/priorityService.ts` - Priority API integration
- `backend/src/services/applicatorService.ts` - Applicator validation logic
- `frontend/src/contexts/TreatmentContext.tsx` - Global treatment state
- `frontend/src/components/Scanner.tsx` - Barcode scanner component

---

## Tool Usage Guidelines

### 1. Gemini CLI Analysis
**Location**: `gemini-analysis.md`

**When to use**:
- **Analyze Large Codebases**: Examining entire directories or multiple large files
- **Implementation Status Checks**: Verify Phase completion against roadmap
- **Architecture Verification**: Understand service interactions and integration points
- **Cross-Service Analysis**: Check dependencies between services and components
- **Performance Assessment**: Identify blocking operations and optimization opportunities
- **Security Auditing**: Verify safety measures and error handling
- **Integration Testing**: Validate end-to-end workflows and API compatibility

### 2. MCP Servers
**Location**: `~/mcp-servers-global/`

#### Context7 MCP - Documentation & Best Practices
- **Use for**: API documentation, framework best practices, coding patterns
- **Examples**: JWT authentication in Express, React Context patterns

#### Sequential MCP - Complex Problem Solving
- **Use for**: Breaking down complex features, architectural decisions, debugging workflows
- **Examples**: Multi-phase implementations, complex bug troubleshooting

#### Magic MCP - UI Component Generation
- **Use for**: React components, Tailwind styling, responsive design
- **Examples**: Medical data tables, progress tracker UI

#### Playwright MCP - Browser Automation & Testing
- **Use for**: E2E testing, UI testing, browser automation
- **Examples**: Treatment workflow testing, barcode scanner validation

#### MCP Management Commands
```bash
cd ~/mcp-servers-global && docker-compose up -d    # Start all servers
cd ~/mcp-servers-global && docker-compose down     # Stop all servers
docker ps --filter "name=mcp"                      # Check status
```

---

## Development Workflow

### Application Management

#### Local Development
```bash
# Recommended start method
npm run dev                                         # Interactive menu
node run.js                                         # Alternative runner

# Docker operations
docker-compose up -d                                # Start development
docker-compose up -d --build                        # Rebuild and start
docker-compose down                                 # Stop all services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d  # Production

# Debugging
node scripts/debug-unified.js                       # Interactive debug tool
node scripts/debug-unified.js health                # Quick health check
node scripts/debug-unified.js start                 # Start development
```

#### Azure VM Production Management
```bash
# Quick deployment (recommended)
ssh azureuser@20.217.84.100 "cd ala-improved && ~/deploy.sh"

# Manual deployment steps
ssh azureuser@20.217.84.100
cd ala-improved
git pull origin main
docker-compose -f azure/docker-compose.azure.yml --env-file azure/.env.azure down
docker-compose -f azure/docker-compose.azure.yml --env-file azure/.env.azure up -d --build

# Container management on VM
ssh azureuser@20.217.84.100 "docker ps"                    # Check running containers
ssh azureuser@20.217.84.100 "docker logs ala-api-azure"    # View backend logs
ssh azureuser@20.217.84.100 "docker logs ala-frontend-azure" # View frontend logs
ssh azureuser@20.217.84.100 "docker logs ala-db-azure"     # View database logs

# Health monitoring
ssh azureuser@20.217.84.100 "curl http://localhost:5000/api/health"  # Backend health
ssh azureuser@20.217.84.100 "curl http://localhost:3000"             # Frontend check
```

### Backend Development
```bash
cd backend
npm run dev                                         # Development with nodemon
npm run build                                       # TypeScript compilation
npm run lint                                        # ESLint with auto-fix
npm run test                                        # Jest tests
npm run db:init                                     # Initialize database
```

### Frontend Development
```bash
cd frontend
npm run dev                                         # Vite development server
npm run build                                       # Production build
npm run lint                                        # ESLint check
npm run format                                      # Prettier formatting
npm run test                                        # Vitest tests
npm run test:e2e                                    # Playwright E2E tests
```

---

## Architecture Overview

### System Components

#### Backend (Node.js/Express/TypeScript)
- **Priority System Integration**: Connects to external Priority API for patient/treatment data
- **Authentication**: Verification code-based login (SMS/email) with JWT tokens
- **Data Models**: Treatment, Applicator, and User entities with PostgreSQL storage
- **Controllers**: Handle Priority API proxying, applicator validation, treatment management
- **Services**: Business logic for treatment workflow, applicator validation, Priority synchronization

#### Frontend (React/TypeScript/Tailwind)
- **Treatment Context**: Global state management for current treatment and applicator data
- **Progress Tracking**: Real-time calculation of treatment completion and seed usage
- **QR Code Scanner**: Html5QrcodeScanner integration for applicator barcode scanning
- **Responsive UI**: Tailwind-based design with mobile-first approach

### Technical Stack

#### Data Flow
1. **Authentication** → User verification through Priority PHONEBOOK API
2. **Treatment Selection** → Patient data auto-populated from Priority ORDERS
3. **Applicator Processing** → Real-time validation against Priority SIBD_APPLICATUSELIST
4. **Progress Tracking** → Live calculations in TreatmentContext with completion metrics
5. **Data Persistence** → Dual storage (local PostgreSQL + Priority system sync)

#### State Management
- **React Context**: TreatmentContext manages treatment state and progress calculations
- **Authentication Context**: User session and site permissions
- **Local Storage**: Offline support and caching for Priority data

#### Docker Configuration
- **Development**: Hot reload with volume mounts for both frontend and backend
- **Production**: Multi-stage builds with security hardening
- **Database**: PostgreSQL with health checks and persistent volumes
- **Environment**: Separate configurations for dev/prod with Priority API endpoints

#### Security Features
- Non-root container execution (UID/GID: 1001)
- JWT-based authentication with verification codes
- Input validation and sanitization
- Health checks and monitoring
- Automated security scanning with Trivy

---

## Business Logic & Workflows

### Treatment Workflow
1. **User selects** treatment type (insertion/removal) and patient
2. **System validates** against Priority API for authorized sites and patients
3. **User scans/enters** applicator serial numbers with real-time validation
4. **System tracks** seed usage with three types: Full use, Faulty, No use
5. **Progress tracking** shows completion percentage and remaining applicators/seeds

### Applicator Validation System
- **5-scenario validation**: already scanned, wrong treatment, no use, not allowed, valid
- **Day-before/day-after validation** for manual entry
- **Fuzzy matching** for similar applicator names
- **Priority API integration** for real-time validation

### Priority Integration Features
- **Position code '99'** grants access to all sites, others are site-restricted
- **Real-time querying** of PHONEBOOK, ORDERS, and PARTS tables
- **Automatic import** of applicator data from recent treatments (24-hour window)

### Key Integration Points
- **Priority API**: External medical system for patient/treatment data
- **Barcode Scanner**: Html5QrcodeScanner for applicator identification
- **Real-time Validation**: Immediate feedback during applicator entry
- **Progress Tracking**: Live updates as applicators are processed

### Error Handling Strategy
- Comprehensive validation at multiple layers (frontend, backend, Priority API)
- Graceful degradation for offline scenarios
- User-friendly error messages with actionable guidance
- Fallback mechanisms for Priority API failures

---

## Priority API Integration Rules

### 1. Reference Chain Validation Rules
- **Always validate** reference chains before displaying patient lists
- **Filter out** orders with `seedQty = 0` that have reference values pointing to other orders
- **Only show** root orders (no reference OR seedQty > 0) as valid patients
- **Detect and handle** circular references in order chains to prevent infinite loops
- **Log** reference chain traversal with clear indicators when debugging

### 2. Query Optimization Rules
- **Always include** date filtering in Priority API OData queries
- **Never filter** dates in backend memory - use API-level filtering
- **Use** `SIBD_TREATDAY` as primary date field for treatment scheduling
- **Format** OData date filters as: `SIBD_TREATDAY ge datetime'YYYY-MM-DDTHH:MM:SS'`
- **Pass** date parameters from controller to service layer
- **Log** data source with emoji indicators:
  - 🧪 Test data
  - 🎯 Real API
  - ❌ Fallback

### 2.1. CUSTOMERS Endpoint for Site Retrieval
- **Use** `/CUSTOMERS` endpoint to retrieve ALL sites (100+ sites) for AlphaTau employees
- **Include** `$top: 500` parameter to capture all customers 
- **Select** only required fields: `CUSTNAME,CUSTDES`
- **Order** results by `CUSTNAME` for consistency
- **Success confirmed**: Works in production for alexs@alphatau.com (Position Code 99)

### 3. Data Source Management Rules
- **Use test data** only in development mode with `test@example.com` user
- **Apply** same filtering logic to both test data and real API responses
- **Implement** graceful fallback from Priority API to test data on failure
- **Never mix** test data with real Priority data without clear logging

### 4. Performance & Debugging Rules
- **Avoid** retrieving all historical orders when only current date is needed
- **Run** TypeScript compilation check after modifying Priority service files
- **Check** for duplicate orders by ORDNAME before processing
- **Log** Priority API filter parameters and response counts

### 5. Common Pitfall Prevention
- **Validate** order counts make business sense before trusting display logic
- **Check** reference chain integrity when orders appear incorrect
- **Verify** data source (test vs real) when investigating unexpected data
- **Always log** complete OData query being sent to Priority API

---

## Common Tasks

### Adding a New Feature
1. Start with `frontend/src/components/` for UI components
2. Add business logic in `backend/src/services/`
3. Create API endpoint in `backend/src/controllers/`
4. Update `frontend/src/services/api.ts` for API calls
5. Add to `TreatmentContext` if needed for state management

### Debugging Priority API Issues
1. Check `backend/src/services/priorityService.ts`
2. Look for emoji indicators in logs (🧪 🎯 ❌)
3. Verify OData query format
4. Check date filtering is at API level, not memory
5. Validate reference chains

### Updating Applicator Validation
1. Modify `backend/src/services/applicatorService.ts`
2. Update validation scenarios (5 types)
3. Test with barcode scanner
4. Verify Priority API integration

---

## API Endpoints Reference

### Authentication Endpoints
- **Request Verification Code**: `POST /api/auth/request-code`
  - Body: `{"identifier": "email@example.com"}` or `{"identifier": "phone-number"}`
  - Returns: User data with available sites and verification code requirement

- **Verify Code**: `POST /api/auth/verify`
  - Body: `{"identifier": "email@example.com", "code": "123456"}`
  - Returns: JWT token and user session data

- **Resend Code**: `POST /api/auth/resend-code`
  - Body: `{"identifier": "email@example.com"}`

### System Health Endpoints
- **Backend Health**: `GET /api/health`
  - Returns: Server status, database connection, version info

- **Priority API Health**: `GET /api/priority/health`
  - Returns: Priority API connectivity status

### Testing Commands

#### Local Development
```bash
# Request verification code
curl -X POST http://localhost:3001/api/auth/request-code \
  -H "Content-Type: application/json" \
  -d '{"identifier":"test@example.com"}'

# Verify with fixed code (always 123456)
curl -X POST http://localhost:3001/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"identifier":"test@example.com","code":"123456"}'
```

#### Production (Azure VM)
```bash
# Test AlphaTau employee with access to all sites
curl -X POST http://20.217.84.100:5000/api/auth/request-code \
  -H "Content-Type: application/json" \
  -d '{"identifier":"alexs@alphatau.com"}'

# Test regular user (site-specific access)
curl -X POST http://20.217.84.100:5000/api/auth/request-code \
  -H "Content-Type: application/json" \
  -d '{"identifier":"user@hospital.com"}'
```

### Bypass Users for Testing
- **alexs@alphatau.com**: Position Code 99 (Full Admin) - Access to all 100+ sites
- **test@bypass.com**: Emergency bypass user
- **test@example.com**: Development mode test user

---

## Troubleshooting

### Quick Diagnostics

#### Local Environment
```bash
# Check if all services are running
docker ps
node scripts/debug-unified.js health

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f db

# Restart specific service
docker-compose restart backend
docker-compose restart frontend
```

#### Azure VM Production
```bash
# Check VM connectivity
ssh azureuser@20.217.84.100 "echo 'VM is accessible'"

# Check all containers on VM
ssh azureuser@20.217.84.100 "docker ps"

# Quick health check
ssh azureuser@20.217.84.100 "curl -s http://localhost:5000/api/health | grep status"

# Check container logs
ssh azureuser@20.217.84.100 "docker logs ala-api-azure --tail=20"
ssh azureuser@20.217.84.100 "docker logs ala-frontend-azure --tail=20"
ssh azureuser@20.217.84.100 "docker logs ala-db-azure --tail=20"

# External accessibility test
curl -s http://20.217.84.100:3000 | grep -o "<title>[^<]*</title>"  # Frontend
curl -s http://20.217.84.100:5000/api/health                        # Backend API
```

#### Container Recovery Procedures (Azure VM)
```bash
# Quick container restart (if containers are stopped)
ssh azureuser@20.217.84.100 "cd ala-improved && docker-compose -f azure/docker-compose.azure.yml --env-file azure/.env.azure up -d"

# Force rebuild containers (if there are build issues)
ssh azureuser@20.217.84.100 "cd ala-improved && docker-compose -f azure/docker-compose.azure.yml --env-file azure/.env.azure up -d --build"

# Check container status with ports
ssh azureuser@20.217.84.100 "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"

# Stop and cleanup before restart (if needed)
ssh azureuser@20.217.84.100 "cd ala-improved && docker-compose -f azure/docker-compose.azure.yml down"
ssh azureuser@20.217.84.100 "docker system prune -f"

# Container-specific restarts
ssh azureuser@20.217.84.100 "docker restart ala-api-azure"        # Backend only
ssh azureuser@20.217.84.100 "docker restart ala-frontend-azure"   # Frontend only
ssh azureuser@20.217.84.100 "docker restart ala-db-azure"         # Database only
```

### Common Issues

#### Priority API Returns Empty Results
- **Check**: API connectivity with health endpoint
- **Verify**: Date format in OData queries
- **Ensure**: Authentication token is valid
- **Look for**: 🎯 vs ❌ in logs

#### Applicator Validation Failing
Check validation scenarios in order:
1. Already scanned in current treatment?
2. Wrong treatment type (insertion vs removal)?
3. Marked as "no use" in Priority?
4. Not in allowed list for site?
5. Valid - should proceed

#### TypeScript Compilation Errors
```bash
cd backend
rm -rf dist/ node_modules/.cache/
npm run build
npx tsc --noEmit  # Check for type issues
```

#### Docker Containers Not Starting
```bash
# Local environment
docker-compose down -v
docker system prune -f
docker-compose up -d --build

# Azure VM
ssh azureuser@20.217.84.100
cd ala-improved
docker-compose -f azure/docker-compose.azure.yml down -v
docker system prune -f
docker-compose -f azure/docker-compose.azure.yml --env-file azure/.env.azure up -d --build
```

#### Azure VM Deployment Issues
```bash
# SSH connection fails
ssh-keygen -R 20.217.84.100  # Remove old host key
ssh -v azureuser@20.217.84.100  # Verbose connection attempt

# VM not accessible externally
# Check Azure NSG rules in portal (ports 3000, 5000, 22 should be open)
# Verify VM is running in Azure Portal

# Containers not starting on VM
ssh azureuser@20.217.84.100
cd ala-improved
# Check if .env.azure exists and has proper values
ls -la azure/.env.azure
# Check if Docker has permission issues
sudo docker ps
sudo docker-compose -f azure/docker-compose.azure.yml up -d --build

# Priority API connection issues from VM
ssh azureuser@20.217.84.100 "curl -v https://t.eu.priority-connect.online/odata/Priority/tabbtbc6.ini/test24"
```

#### Application Not Accessible Externally
```bash
# Test from local machine
curl -v http://20.217.84.100:3000  # Should return HTML
curl -v http://20.217.84.100:5000/api/health  # Should return JSON

# If timeout, check:
# 1. VM is running (Azure Portal)
# 2. NSG rules allow ports 3000, 5000
# 3. Containers are running on VM
ssh azureuser@20.217.84.100 "docker ps | grep -E 'ala-(frontend|api)-azure'"
```

### Debug Commands Reference

#### Local Environment
```bash
# Database access
docker exec -it postgres psql -U admin -d medical_app

# API testing
curl http://localhost:3001/health
curl -X POST http://localhost:3001/api/auth/request-code \
  -H "Content-Type: application/json" \
  -d '{"identifier":"test@example.com"}'

# Check Priority API
curl -X GET "$PRIORITY_API_URL/health"
```

#### Azure VM Production
```bash
# Database access on VM
ssh azureuser@20.217.84.100 "docker exec -it ala-db-azure psql -U ala_user -d ala_production"

# API testing on VM (local)
ssh azureuser@20.217.84.100 "curl http://localhost:5000/api/health"
ssh azureuser@20.217.84.100 "curl -X POST http://localhost:5000/api/auth/request-code -H 'Content-Type: application/json' -d '{\"identifier\":\"test@example.com\"}'"

# External API testing
curl http://20.217.84.100:5000/api/health
curl -X POST http://20.217.84.100:5000/api/auth/request-code \
  -H "Content-Type: application/json" \
  -d '{"identifier":"test@example.com"}'

# Priority API from VM
ssh azureuser@20.217.84.100 "curl 'https://t.eu.priority-connect.online/odata/Priority/tabbtbc6.ini/test24/PHONEBOOK?$top=1'"

# Container inspection
ssh azureuser@20.217.84.100 "docker inspect ala-api-azure"
ssh azureuser@20.217.84.100 "docker exec ala-api-azure env | grep -E '(PRIORITY|DB)'"

# VM system resources
ssh azureuser@20.217.84.100 "free -h && df -h && top -bn1 | head -10"
```

---

## HTTPS/SSL Production Setup (Future Implementation)

### 🔒 Security Upgrade Plan - Nginx Reverse Proxy with Let's Encrypt

**Current Status**: Application runs on HTTP-only (temporary). This section documents the plan for secure HTTPS implementation.

#### Architecture
```
Users (HTTPS:443) → Nginx Reverse Proxy → Backend (HTTP:5000)
                                        → Frontend (HTTP:3000)
```

#### Implementation Steps

**1. Prerequisites**
```bash
# Connect to Azure VM
ssh azureuser@20.217.84.100

# Update system
sudo apt update && sudo apt upgrade -y

# Install Nginx and Certbot
sudo apt install nginx certbot python3-certbot-nginx -y
```

**2. Domain Configuration**
```bash
# Option 1: Use Azure VM DNS name
# Format: [vm-name].[region].cloudapp.azure.com
# Example: alaapp.eastus.cloudapp.azure.com

# Option 2: Configure custom domain
# Point your domain's A record to: 20.217.84.100
```

**3. Nginx Configuration**
Create `/etc/nginx/sites-available/ala-app`:
```nginx
server {
    listen 80;
    server_name your-domain.com;  # Replace with actual domain
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    # Frontend proxy
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Backend API proxy
    location /api {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS headers
        add_header Access-Control-Allow-Origin $http_origin;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
        add_header Access-Control-Allow-Headers "Content-Type, Authorization";
        add_header Access-Control-Allow-Credentials true;
    }
}
```

**4. SSL Certificate Setup**
```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/ala-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

**5. Firewall Configuration**
```bash
# Allow HTTPS traffic
sudo ufw allow 'Nginx Full'

# Block direct access to app ports (security)
sudo ufw deny 3000
sudo ufw deny 5000

# Keep SSH access
sudo ufw allow ssh
sudo ufw enable
```

**6. Backend Configuration Updates**
Update `backend/src/middleware/securityMiddleware.ts`:
```typescript
// Enable HTTPS redirect when behind proxy
export const httpsRedirect = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.HTTPS_ENABLED === 'true' && !req.secure && req.get('x-forwarded-proto') !== 'https') {
    return res.redirect(301, `https://${req.get('host')}${req.url}`);
  }
  next();
};
```

Add to `azure/.env.azure`:
```env
HTTPS_ENABLED=true
```

**7. Monitoring & Maintenance**
```bash
# Check certificate status
sudo certbot certificates

# Manual renewal (automatic renewal is set up)
sudo certbot renew

# Check Nginx status
sudo systemctl status nginx

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

#### Benefits of This Setup
- ✅ **Free SSL certificates** (Let's Encrypt)
- ✅ **Automatic certificate renewal** (90-day cycle)
- ✅ **Security headers** and DDoS protection
- ✅ **Single entry point** (port 443 only)
- ✅ **Easy maintenance** and monitoring
- ✅ **Professional setup** used by thousands of production apps

#### Rollback Plan
If issues occur, revert to direct access:
```bash
sudo ufw allow 3000
sudo ufw allow 5000
sudo systemctl stop nginx
```

---

**Note**: This application is designed for medical environments requiring reliability, real-time data validation, and seamless integration with existing Priority systems. Always prioritize data accuracy and validation over performance optimizations.

**Production Environment**: The application is currently deployed and running on Azure VM (20.217.84.100) with full Priority API integration. Use SSH access for production management and monitoring.

**Security Note**: Current deployment uses HTTP-only for testing. Implement the HTTPS setup above before handling real medical data.
- keep what works correctly in the process for better result in the future
- Root Cause Identification

  - Recognized that crypto.randomUUID() requires HTTPS/localhost (secure context)
  - Azure VM runs on HTTP (http://20.217.84.100) which doesn't provide secure context
  - The fallback in the original code wasn't being triggered properly

  2. Simple, Robust Solution

  - Removed crypto.randomUUID entirely instead of trying complex detection
  - Used only Math.random() based UUID generation - works everywhere
  - No browser detection or environment checking needed

  3. Effective Deployment Strategy

  # What worked:
  1. git pull on VM to get updated code
  2. Stop and remove old container
  3. Start fresh container (docker-compose up -d frontend)

  4. Quick Recovery Methods

  - Using docker-compose restart frontend for quick restarts
  - Stopping and recreating containers when rebuild takes too long
  - Background builds with & to avoid timeout issues

  Key Success Factors:

  1. Simplicity Over Complexity: Instead of complex crypto detection, just use Math.random()    
   everywhere
  2. HTTP Compatibility: Always consider HTTP environments when using browser APIs
  3. Fast Iteration: Stop/remove/recreate containers vs waiting for full rebuilds
  4. Git-based Deployment: Pull code changes directly on VM for immediate updates

  For Future UUID/Crypto Issues:

  Always use this pattern for HTTP compatibility:
  // DON'T use crypto.randomUUID - requires HTTPS
  // DO use Math.random() based UUID - works everywhere
  export function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }