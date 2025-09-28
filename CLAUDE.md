# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this medical treatment tracking application.

## Quick Start & Overview

### Project Overview
- **Application**: Medical Treatment Tracking System
- **Purpose**: Real-time tracking of seed applicator treatments with Priority ERP integration
- **Tech Stack**: React/TypeScript/Tailwind + Express/TypeScript/PostgreSQL
- **Key Integration**: Priority API for patient data and applicator validation

### Essential Commands

**Local Development:**
```bash
npm run dev                      # Interactive menu (recommended)
node scripts/debug-unified.js health # Quick health check
cd backend && npm run build      # Fix TypeScript errors
docker-compose restart backend   # Restart backend service
```

**Azure VM Production:**
```bash
ssh azureuser@20.217.84.100 "cd ala-improved && ~/deployment/scripts/deploy.sh"  # Quick deployment
ssh azureuser@20.217.84.100 "docker ps"                                          # Check containers
curl http://20.217.84.100:5000/api/health                                        # Backend health
```

### Critical Files
- `backend/src/services/priorityService.ts` - Priority API integration
- `backend/src/services/applicatorService.ts` - Applicator validation logic
- `frontend/src/contexts/TreatmentContext.tsx` - Global treatment state
- `frontend/src/components/Scanner.tsx` - Barcode scanner component

---

## Production Deployment (Azure VM)

### Environment Details
- **VM IP**: 20.217.84.100 (ATM-ISR-Docker resource group)
- **SSH**: `ssh azureuser@20.217.84.100`
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

# Container management
ssh azureuser@20.217.84.100 "docker logs ala-api-azure --tail=20"
ssh azureuser@20.217.84.100 "docker restart ala-frontend-azure"
```

---

## Architecture & Tech Stack

### System Components
- **Backend**: Express/TypeScript with Priority API integration, JWT auth, PostgreSQL
- **Frontend**: React/TypeScript with Tailwind, Html5QrcodeScanner, TreatmentContext state
- **Database**: PostgreSQL with health checks and persistent volumes
- **Security**: Non-root containers (UID 1001), JWT tokens, input validation

### Data Flow
1. **Authentication** → Priority PHONEBOOK API verification
2. **Treatment Selection** → Auto-populate from Priority ORDERS
3. **Applicator Processing** → Real-time validation against Priority SIBD_APPLICATUSELIST
4. **Progress Tracking** → Live calculations in TreatmentContext
5. **Data Persistence** → Local PostgreSQL + Priority system sync

### MCP Servers (Available)
- **Context7**: Documentation & best practices (✅ Connected)
- **Sequential**: Complex problem solving (✅ Connected)
- **Playwright**: Browser automation & testing (✅ Connected)
- **GitHub**: Repository integration (❌ Failed - use `gh` CLI instead)

Quick status: `claude mcp list`

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

### Error Handling Strategy
- Comprehensive validation at multiple layers (frontend, backend, Priority API)
- Graceful degradation for offline scenarios
- User-friendly error messages with actionable guidance
- Fallback mechanisms for Priority API failures

---

## Development Workflow

### Local Development
```bash
npm run dev                                    # Interactive menu
docker-compose up -d                           # Start development
docker-compose up -d --build                   # Rebuild and start
node scripts/debug-unified.js                  # Interactive debug tool

# Backend
cd backend
npm run dev                                    # Development with nodemon
npm run build                                  # TypeScript compilation
npm run lint                                   # ESLint with auto-fix

# Frontend
cd frontend
npm run dev                                    # Vite development server
npm run build                                  # Production build
npm run test:e2e                              # Playwright E2E tests
```

### Environment Management
- **Development**: `.env.docker` with hot reload
- **Production**: `deployment/azure/.env.azure` on VM
- **Testing**: Fixed code `123456` for `test@example.com`

---

## Common Tasks

### Adding a New Feature
1. UI components in `frontend/src/components/`
2. Business logic in `backend/src/services/`
3. API endpoint in `backend/src/controllers/`
4. Update `frontend/src/services/api.ts` for API calls
5. Add to `TreatmentContext` if state management needed

### Debugging Priority API Issues
1. Check `backend/src/services/priorityService.ts`
2. Look for emoji indicators in logs (🧪 🎯 ❌)
3. Verify OData query format and date filtering
4. Validate reference chains

### Updating Applicator Validation
1. Modify `backend/src/services/applicatorService.ts`
2. Update validation scenarios (5 types)
3. Test with barcode scanner
4. Verify Priority API integration

---

## API Endpoints

### Authentication
- **Request Code**: `POST /api/auth/request-code` - Body: `{"identifier": "email@example.com"}`
- **Verify Code**: `POST /api/auth/verify` - Body: `{"identifier": "email", "code": "123456"}`
- **Health Check**: `GET /api/health` - Server status and database connection

### Test Users
- **alexs@alphatau.com**: Position Code 99 (Full Admin) - Access to all 100+ sites
- **test@bypass.com**: Emergency bypass user
- **test@example.com**: Development mode test user (code: 123456)

---

## Troubleshooting

### Quick Diagnostics
```bash
# Local environment
docker ps && node scripts/debug-unified.js health
docker-compose logs -f backend
docker-compose restart backend

# Azure VM
ssh azureuser@20.217.84.100 "docker ps && curl -s localhost:5000/api/health"
ssh azureuser@20.217.84.100 "docker logs ala-api-azure --tail=20"

# External access test
curl http://20.217.84.100:3000 | grep -o "<title>[^<]*</title>"
curl http://20.217.84.100:5000/api/health
```

### Common Issues

**Priority API Empty Results:**
- Check date format in OData queries
- Look for 🎯 vs ❌ in logs
- Verify authentication token

**Applicator Validation Failing:**
1. Already scanned in current treatment?
2. Wrong treatment type (insertion vs removal)?
3. Marked as "no use" in Priority?
4. Not in allowed list for site?
5. Valid - should proceed

**TypeScript Compilation Errors:**
```bash
cd backend && rm -rf dist/ node_modules/.cache/ && npm run build
```

**Containers Not Starting:**
```bash
# Local
docker-compose down -v && docker system prune -f && docker-compose up -d --build

# Azure VM
ssh azureuser@20.217.84.100 "cd ala-improved && docker-compose -f deployment/azure/docker-compose.azure.yml down && docker system prune -f"
ssh azureuser@20.217.84.100 "cd ala-improved && docker-compose -f deployment/azure/docker-compose.azure.yml --env-file deployment/azure/.env.azure up -d --build"
```

### Recovery Commands
```bash
# Version recovery (if needed)
git fetch --tags && git checkout v1.0-working-production-2025-09-10

# Azure VM deployment recovery
ssh azureuser@20.217.84.100 "cd ala-improved && ~/deployment/scripts/deploy.sh"

# Database access
docker exec -it postgres psql -U admin -d medical_app  # Local
ssh azureuser@20.217.84.100 "docker exec -it ala-db-azure psql -U ala_user -d ala_production"  # Production
```

---

**Note**: This medical application prioritizes data accuracy and Priority system integration. Always validate against Priority API and maintain comprehensive error handling for production reliability.