# CLAUDE.md

## 🚨 MANDATORY AUTOMATION RULES (FOLLOW IMMEDIATELY)

### MCP Judge System - USE FOR ACTUAL CODING
- **For NEW features, bug fixes, or code modifications** → Start with `mcp__mcp-as-a-judge__set_coding_task`
- **Skip for**: explanations, research, documentation, or read-only tasks
- Include task_title, task_description, and user_request parameters when using

### Task Management - USE AUTOMATICALLY
- **Tasks with 3+ steps** → Use `TodoWrite` to track progress automatically
- Mark tasks `in_progress` before starting, `completed` immediately after finishing
- Never batch completions - update after EACH individual task

### Automatic Tool Triggers - USE WITHOUT BEING ASKED
When these keywords appear in user requests, you MUST invoke tools IMMEDIATELY:
- **"test", "coverage", "jest"** → Use `Task` tool with `testing-specialist` subagent
  - For E2E/UI tests also use `mcp__playwright__*` tools for browser automation
- **"Priority", "OData", "applicator"** → Use `Task` tool with `priority-integration` subagent
- **"React", "component", "UI"** → Use `Task` tool with `frontend-ui` subagent
- **"deploy", "Azure", "Docker"** → Use `Task` tool with `deployment-azure` subagent
- **"database", "PostgreSQL", "migration"** → Use `Task` tool with `database-specialist` subagent
- **"security", "auth", "JWT"** → Use `Task` tool with `security-audit` subagent
- **"slow", "performance", "optimize"** → Use `Task` tool with `performance-optimization` subagent

### MCP Servers - USE AUTOMATICALLY
- **Library/framework questions** → Use `mcp__context7__resolve-library-id` then `mcp__context7__get-library-docs`
- **Complex multi-step problems** → Use `mcp__sequential__sequentialthinking`
- **UI testing or browser automation** → Use `mcp__playwright__*` tools

---

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
ssh azureuser@20.217.84.100 "cd ala-improved && ~/ala-improved/deployment/scripts/deploy.sh"  # Quick deployment
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

**HTTP Deployment (Stable):**
```bash
# Quick deployment (recommended)
ssh azureuser@20.217.84.100 "cd ala-improved && ~/ala-improved/deployment/scripts/deploy.sh"

# Manual deployment
ssh azureuser@20.217.84.100
cd ala-improved
git pull origin develop

# Ensure infrastructure exists (IMPORTANT)
docker network create azure_ala-network 2>/dev/null || true
docker volume create azure_ala-postgres-data-prod 2>/dev/null || true

# Deploy HTTP version
docker-compose -f deployment/azure/docker-compose.azure.yml --env-file deployment/azure/.env.azure up -d --build
```

**HTTPS Deployment (Self-Signed Certificate):**
```bash
# Automated HTTPS deployment with SSL certificate generation
ssh azureuser@20.217.84.100 "cd ala-improved && ~/ala-improved/deployment/scripts/deploy-https.sh"

# Manual HTTPS deployment
ssh azureuser@20.217.84.100
cd ala-improved
git pull origin develop

# Generate SSL certificates (if not exists)
bash scripts/generate-ssl-cert.sh 20.217.84.100

# Deploy HTTPS version
docker-compose -f deployment/azure/docker-compose.https.azure.yml --env-file deployment/azure/.env.azure up -d --build
```

**Container Management:**
```bash
ssh azureuser@20.217.84.100 "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"
ssh azureuser@20.217.84.100 "docker logs ala-api-azure --tail=50 -f"
ssh azureuser@20.217.84.100 "docker-compose -f deployment/azure/docker-compose.https.azure.yml ps"
```

### Recovery & Monitoring
```bash
# Automatic recovery (preserves data)
ssh azureuser@20.217.84.100 "~/ala-improved/deployment/azure/recover.sh"

# Start continuous monitoring with auto-recovery
ssh azureuser@20.217.84.100 "nohup ~/ala-improved/deployment/scripts/monitor-auto.sh > monitor.log 2>&1 &"

# Check monitoring status
ssh azureuser@20.217.84.100 "tail -f monitor.log"
```

### Deployment Files Structure
- `deployment/azure/docker-compose.azure.yml` - Container config (uses ../../backend context paths)
- `deployment/azure/.env.azure` - Production secrets (never commit!)
- `deployment/scripts/deploy.sh` - Automated deployment with rollback
- `deployment/azure/recover.sh` - Container recovery script
- `deployment/scripts/monitor-auto.sh` - Health monitoring with auto-recovery

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

## 🤖 Additional Notes
- For complex tasks spanning multiple domains, use MULTIPLE Task calls in ONE message
- Check MCP server status: `claude mcp list`

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

## Subagent Details
See `docs/development/CLAUDE-CODE-SUBAGENTS.md` for detailed agent capabilities and usage examples.
All agents configured in `.claude/agents/` directory with PROACTIVE triggers enabled.

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

# Azure VM (HTTP)
ssh azureuser@20.217.84.100 "docker ps && curl -s localhost:5000/api/health"
ssh azureuser@20.217.84.100 "docker logs ala-api-azure --tail=20"
curl http://20.217.84.100:3000 | grep -o "<title>[^<]*</title>"
curl http://20.217.84.100:5000/api/health

# Azure VM (HTTPS)
ssh azureuser@20.217.84.100 "docker ps && curl -k -s https://localhost:5000/api/health"
curl -k https://20.217.84.100:3000  # Frontend (self-signed cert)
curl -k https://20.217.84.100:5000/api/health  # API (self-signed cert)
curl -I http://20.217.84.100:3000  # Should redirect to HTTPS (301/302)
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

**HTTPS Certificate Issues:**
```bash
# Regenerate SSL certificates on Azure VM
ssh azureuser@20.217.84.100 "cd ~/ala-improved && rm -rf ssl-certs && bash scripts/generate-ssl-cert.sh 20.217.84.100"

# Verify certificate is mounted correctly
ssh azureuser@20.217.84.100 "docker exec ala-frontend-azure ls -la /etc/ssl/certs/ | grep certificate"

# Check nginx SSL configuration
ssh azureuser@20.217.84.100 "docker exec ala-frontend-azure nginx -t"
```

**HTTP to HTTPS Redirect Not Working:**
```bash
# Check nginx configuration
ssh azureuser@20.217.84.100 "docker exec ala-frontend-azure cat /etc/nginx/conf.d/default.conf | grep -A5 'listen 80'"

# Verify HTTPS environment variable
ssh azureuser@20.217.84.100 "cat ~/ala-improved/deployment/azure/.env.azure | grep USE_HTTPS"
```

**Containers Not Starting:**
```bash
# Local
docker-compose down -v && docker system prune -f && docker-compose up -d --build

# Azure VM (HTTP)
ssh azureuser@20.217.84.100 "cd ala-improved && docker-compose -f deployment/azure/docker-compose.azure.yml down && docker system prune -f"
ssh azureuser@20.217.84.100 "cd ala-improved && docker-compose -f deployment/azure/docker-compose.azure.yml --env-file deployment/azure/.env.azure up -d --build"

# Azure VM (HTTPS)
ssh azureuser@20.217.84.100 "cd ala-improved && docker-compose -f deployment/azure/docker-compose.https.azure.yml down && docker system prune -f"
ssh azureuser@20.217.84.100 "cd ala-improved && ~/ala-improved/deployment/scripts/deploy-https.sh"
```

**Database Container Missing (Critical Fix):**
```bash
# This recreates the database container with proper network configuration
ssh azureuser@20.217.84.100 "docker run -d \
  --name ala-db-azure \
  --network azure_ala-network \
  --network-alias db \
  -v azure_ala-postgres-data-prod:/var/lib/postgresql/data \
  -e POSTGRES_DB=ala_production \
  -e POSTGRES_USER=ala_user \
  -e POSTGRES_PASSWORD=AzureProd2024! \
  -p 5432:5432 \
  --restart=unless-stopped \
  postgres:16.6-alpine"

# Then restart API container to reconnect
ssh azureuser@20.217.84.100 "docker restart ala-api-azure"
```

**Deployment Script Line Ending Errors:**
```bash
# Fix Windows line endings on all scripts
ssh azureuser@20.217.84.100 "sed -i 's/\r$//' ~/ala-improved/deployment/scripts/*.sh ~/ala-improved/deployment/azure/*.sh"
```

### Recovery Commands
```bash
# Version recovery (if needed)
git fetch --tags && git checkout v1.0-working-production-2025-09-10

# Azure VM deployment recovery
ssh azureuser@20.217.84.100 "cd ala-improved && ~/ala-improved/deployment/scripts/deploy.sh"

# Database access
docker exec -it postgres psql -U admin -d medical_app  # Local
ssh azureuser@20.217.84.100 "docker exec -it ala-db-azure psql -U ala_user -d ala_production"  # Production
```

---

**Note**: This medical application prioritizes data accuracy and Priority system integration. Always validate against Priority API and maintain comprehensive error handling for production reliability.