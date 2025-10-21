# ALA Medical Treatment Tracking System

## Project Context
Medical treatment tracking application for seed applicator procedures with Priority ERP integration.
- **Purpose**: Real-time tracking and validation of medical seed applicator treatments
- **Critical**: Patient safety system - accuracy and data integrity are paramount
- **Tech Stack**: React/TypeScript/Tailwind frontend, Express/TypeScript backend, PostgreSQL database
- **Key Integration**: Priority ERP for patient data, site access, and applicator validation

## Core Behavioral Guidelines

### Code Modification Approach
- **Substantial changes** (features, bugs, refactoring): Start with `mcp__mcp-as-a-judge__set_coding_task`
- **Multi-step tasks**: Use `TodoWrite` to track progress and maintain visibility
- **Complex analysis**: Consider `mcp__sequential__sequentialthinking` for thorough problem-solving
- Skip formal workflows for: explanations, research-only tasks, documentation reading

### Specialized Agent Usage

**Implementation Agents** (write code):
- **Testing tasks**: `testing-specialist` for test creation, debugging, coverage
- **Priority ERP issues**: `priority-integration` for OData, applicator validation
- **UI/React work**: `frontend-ui` for components, state management, Tailwind
- **Deployment**: `deployment-azure` for Docker, Azure VM, production issues
- **Database work**: `database-specialist` for PostgreSQL, migrations, Sequelize
- **Performance**: `performance-optimization` for bottlenecks, slow queries
- **Security**: `security-audit` for auth, JWT, vulnerability assessment

**Reviewer Agents** (review code quality):
- **Code quality**: `ala-code-reviewer` for standards, patterns, TypeScript best practices
- **Priority integration**: `priority-api-reviewer` for OData queries, applicator validation patterns
- **Medical safety**: `medical-safety-reviewer` for patient safety, data integrity, audit trails

### Priority Integration Context
- **Position Code 99**: Full admin access to all 100+ sites (e.g., alexs@alphatau.com)
- **Other users**: Site-restricted based on Priority PHONEBOOK authorization
- **Validation critical**: Always validate applicator reference chains and data integrity
- **Test mode**: Only use test data for test@example.com, never mix with production
- **Data source indicators**: 🧪 Test data, 🎯 Real API, ❌ Fallback

### When to Escalate or Clarify
- Ambiguous medical/safety requirements → always seek clarification
- Fundamental architecture changes → discuss approach first
- Priority API integration modifications → validate business logic
- Data integrity or patient safety concerns → raise immediately
- Missing foundational choices (framework, UI type, hosting) → use `raise_missing_requirements`

## System Architecture Essentials

### Data Flow
1. Authentication via Priority PHONEBOOK API
2. Treatment selection from Priority ORDERS
3. Applicator validation against Priority SIBD_APPLICATUSELIST
4. Real-time progress tracking in TreatmentContext
5. Persistence in PostgreSQL with Priority sync

### Key Files
- **Priority Service**: [backend/src/services/priorityService.ts](backend/src/services/priorityService.ts)
- **Applicator Logic**: [backend/src/services/applicatorService.ts](backend/src/services/applicatorService.ts)
- **Treatment State**: [frontend/src/contexts/TreatmentContext.tsx](frontend/src/contexts/TreatmentContext.tsx)
- **Scanner Component**: [frontend/src/components/Scanner.tsx](frontend/src/components/Scanner.tsx)

## Quick Reference
For detailed information, consult these specialized documents:
- **Deployment**: [docs/deployment/](docs/deployment/) - Azure VM and local setup
- **Troubleshooting**: [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) - Common issues and fixes
- **Priority API**: [docs/PRIORITY_INTEGRATION.md](docs/PRIORITY_INTEGRATION.md) - Integration rules and workflows
- **API Reference**: [docs/API_REFERENCE.md](docs/API_REFERENCE.md) - Endpoints and authentication
- **Development**: [docs/deployment/LOCAL_DEVELOPMENT.md](docs/deployment/LOCAL_DEVELOPMENT.md) - Local setup

## Environment Context
- **Production VM**: 20.217.84.100 (Azure)
- **Production URL**: https://ala-app.israelcentral.cloudapp.azure.com
- **Local Dev**: Docker Compose with hot reload
- **Test User**: test@example.com (code: 123456)
- **Admin User**: alexs@alphatau.com (Position 99)

## Critical Deployment Information

### Production Deployment (Azure VM)
**ALWAYS use the HTTPS environment file for production:**
```bash
cd ~/ala-improved/deployment/azure
docker-compose -f docker-compose.azure.yml --env-file .env.azure.https up -d --build
```

**Critical Configuration:**
- Environment file: `.env.azure.https` (ONLY file to use for production)
- Nginx config: `nginx.https.azure.conf` (ports 8080/8443 for non-root user)
- Port mappings: Host 80→Container 8080, Host 443→Container 8443
- Set `NGINX_CONFIG=nginx.https.azure.conf` in environment file
- Set port variables: `NGINX_HTTP_PORT=8080`, `NGINX_HTTPS_PORT=8443`

**DO NOT:**
- Use `.env.azure` - this file has been removed to prevent confusion
- Use `nginx.staging.conf` - this is for staging only (port 8080 only)
- Guess which environment file to use - always use `.env.azure.https`
- Modify port mappings without understanding nginx listen ports

---

# Compounding Engineering System

This section documents our self-improving development system where each task makes future work easier.

## Three-Lane Workflow Model

### 1. Planning Lane (mcp-as-a-judge)
**Purpose**: Validate requirements and create detailed plans before implementation

**Tools**:
- `set_coding_task` - Create task and get workflow guidance
- `judge_coding_plan` - Validate plan before implementation
- `raise_missing_requirements` - Clarify ambiguous requirements
- `raise_obstacle` - Involve user in critical decisions

**When to use**:
- Substantial features or refactoring
- Changes affecting patient safety
- Priority API integration modifications
- Database schema changes
- Authentication/authorization changes

### 2. Implementation Lane (Specialist Agents)
**Purpose**: Execute the planned work with domain expertise

**Parallel execution**: Run multiple agents simultaneously when tasks are independent
```
"Use database-specialist and frontend-ui agents in parallel to implement user preferences feature"
```

**Sequential execution**: One agent at a time when tasks depend on each other
```
1. database-specialist creates tables
2. frontend-ui builds components (needs tables first)
```

### 3. Review Lane (Reviewer Agents)
**Purpose**: Ensure quality before finalizing changes

**Review sequence**:
1. `ala-code-reviewer` - General code quality and patterns
2. `priority-api-reviewer` - Priority integration correctness (if applicable)
3. `medical-safety-reviewer` - Patient safety and data integrity (for critical features)
4. `judge_code_change` - Final validation gate

## Learning Loops

After completing each task, capture knowledge to make future work easier:

### 1. Bug Resolution Learning Loop
```
Bug Fixed → Document in docs/learnings/bugs/[date-description].md
         → Extract pattern to docs/patterns/ if reusable
         → Update reviewer agent to catch similar issues
         → Add prevention measure to CLAUDE.md if broadly applicable
         → Create test to prevent regression
```

### 2. Feature Implementation Learning Loop
```
Feature Complete → Document successful patterns in docs/patterns/
               → Note what worked well
               → Update CLAUDE.md if pattern should be default
               → Add to reviewer checklist if should be enforced
```

### 3. Production Error Learning Loop
```
Production Error → Investigate and document in docs/learnings/errors/
               → Create test that reproduces the error
               → Implement fix
               → Update monitoring/alerting
               → Document prevention in CLAUDE.md
               → Update medical-safety-reviewer if safety-related
```

## Decision Log

Document significant architectural and technical decisions here:

### Technology Choices
- **PostgreSQL for treatment data**: Reliable ACID compliance for medical data (see ADR-001)
- **Priority ERP integration**: Use OData API for patient data (see ADR-002)
- **JWT authentication**: Stateless auth with position-based authorization (see ADR-003)
- **Azure VM deployment**: Docker Compose on single VM (see ADR-004)
- **React + TypeScript frontend**: Type safety for medical UI (see ADR-005)

### Integration Patterns
- **Position Code 99 = Admin**: Full site access without site restrictions
- **Test data isolation**: Only test@example.com uses test data
- **Data source indicators**: 🧪 Test, 🎯 Real API, ❌ Fallback
- **Applicator validation**: Complete reference chain required (no shortcuts)

### Deployment Strategy
- **Production**: Azure VM 20.217.84.100 with Docker Compose
- **HTTPS**: Handled by frontend configuration
- **Health checks**: `/api/health` endpoint monitored
- **Rollback**: Docker image versioning for quick rollback

_For full context, see [Architectural Decision Records](docs/architecture/adr/)_

## Known Pitfalls & Solutions

### Priority API Integration
**Pitfall**: OData query syntax errors causing silent failures
- **Solution**: Always test queries with Postman first
- **Prevention**: Use priority-api-reviewer for all OData queries
- **Pattern**: [Priority OData patterns](docs/patterns/integration/priority-odata-queries.md)

**Pitfall**: Incomplete applicator validation (skipping chain steps)
- **Solution**: Follow complete validation checklist
- **Prevention**: medical-safety-reviewer enforces complete chain
- **Critical**: All 7 steps must be validated, no shortcuts

**Pitfall**: Mixing test and production data
- **Solution**: Strict environment-based data loading
- **Prevention**: Test data ONLY for test@example.com
- **Critical**: Never mix 🧪 and 🎯 data sources

### Frontend State Management
**Pitfall**: Treatment state getting out of sync with backend
- **Solution**: Use TreatmentContext with proper invalidation
- **Prevention**: ala-code-reviewer checks state consistency
- **Pattern**: [Treatment state patterns](docs/patterns/frontend/treatment-state-management.md)

**Pitfall**: Scanner component not handling errors gracefully
- **Solution**: Implement proper error boundaries and fallbacks
- **Prevention**: medical-safety-reviewer checks critical path error handling

### Database Operations
**Pitfall**: Missing transactions for multi-step operations
- **Solution**: Always use Sequelize transactions for related updates
- **Prevention**: medical-safety-reviewer enforces transaction boundaries
- **Critical**: Treatment data changes must be atomic

**Pitfall**: Migration failures in production
- **Solution**: Test migrations locally with production-like data first
- **Prevention**: Database-specialist reviews all migrations
- **Critical**: Always have rollback plan

### Deployment Issues
**Pitfall**: Using wrong environment file or nginx configuration
- **Root Cause**: Multiple environment files causing confusion, wrong nginx config in Docker cache
- **Symptoms**: Site not accessible (ERR_CONNECTION_REFUSED), containers unhealthy, wrong ports
- **Solution**: ALWAYS use `.env.azure.https` for production HTTPS deployment
- **Prevention**: Removed confusing `.env.azure` file, documented correct config in CLAUDE.md
- **Critical**: Nginx uses ports 8080/8443 (non-root), Docker maps 80→8080, 443→8443
- **Fix**: Set `NGINX_CONFIG=nginx.https.azure.conf`, `NGINX_HTTP_PORT=8080`, `NGINX_HTTPS_PORT=8443`
- **Lesson**: Never change deployment without understanding current state, verify port mappings match nginx config

**Pitfall**: Container startup failures due to missing env vars
- **Solution**: Validate .env file before deployment
- **Prevention**: deployment-azure agent checks configuration
- **Pattern**: [Deployment checklist](docs/deployment/DEPLOYMENT_CHECKLIST.md)

**Pitfall**: Database connection failures after deployment
- **Solution**: Verify DATABASE_URL format and network access
- **Prevention**: Health check endpoint monitors DB connectivity

**Pitfall**: Nginx config change not taking effect after env var update
- **Root Cause**: Nginx config is BAKED into Docker image at build time (Dockerfile line 120: `COPY ${NGINX_CONFIG}`)
- **Symptoms**: Environment says `NGINX_CONFIG=nginx.https.azure.conf` but container runs HTTP-only config
- **Example**: Changing from HTTP to HTTPS by updating `.env.azure.https` without rebuilding image
- **Solution**: ALWAYS rebuild frontend image after changing nginx config: `docker-compose build --no-cache frontend`
- **Prevention**: Pre-deployment validation script to verify config file exists and nginx syntax is valid
- **Critical**: Image caches old config - must rebuild to bake in new config
- **Detection**: Check running container config: `docker exec ala-frontend-azure cat /etc/nginx/conf.d/default.conf`
- **Recovery**: Rebuild with correct config, restart container with new image
- **Lesson**: Docker ARG values are resolved at BUILD time, not RUN time - config changes require image rebuild
- **Date**: 2025-10-21 - Production HTTPS outage due to missing image rebuild after nginx config update

_Document new pitfalls in [docs/learnings/](docs/learnings/) as they're discovered_

## Testing Patterns

### Critical Path Coverage Required
- Treatment initiation and completion flows
- Applicator validation (complete reference chain)
- Priority API authentication and data sync
- Position-based authorization
- Error handling in medical workflows

### Test Data Strategy
- **Test environment**: Separate test database with seed data
- **Test user**: test@example.com with test data only
- **Mock Priority API**: Use fallback data for unit tests
- **E2E tests**: Real Priority API integration in staging
- **Never**: Mix test and production data

### Test Organization
```
backend/src/**/*.test.ts     - Backend unit tests (Jest)
frontend/src/**/*.test.tsx   - Frontend component tests (Vitest)
frontend/tests/e2e/*.spec.ts - E2E tests (Playwright)
```

### Coverage Targets
- **Overall**: > 80% code coverage
- **Critical paths**: 100% coverage required
- **Medical workflows**: Integration test coverage
- **Priority API**: Mock-based unit tests + staging E2E tests

_Document successful test patterns in [docs/patterns/testing/](docs/patterns/testing/)_

## Quality Gates

Every substantial change must pass through these gates:

### Gate 1: Planning Review
- Tool: `judge_coding_plan`
- Validates: Requirements clear, design sound, risks identified
- Blocker: Critical missing requirements or design flaws

### Gate 2: Implementation
- Agents: Specialist agents implement with domain expertise
- Parallel: Use multiple agents when tasks are independent
- Documentation: Update relevant docs as you code

### Gate 3: Code Review
- Agents: `ala-code-reviewer`, `priority-api-reviewer`, `medical-safety-reviewer`
- Validates: Code quality, patterns, safety requirements
- Blocker: Critical safety issues or major quality problems

### Gate 4: Code Change Validation
- Tool: `judge_code_change`
- Validates: Implementation matches plan, quality standards met
- Requires: Git diff of all changes
- Blocker: Data integrity issues, safety violations

### Gate 5: Testing Validation
- Tool: `judge_testing_implementation`
- Validates: Test quality, coverage, execution results
- Requires: Test files list + test execution output
- Blocker: Insufficient coverage of critical paths

### Gate 6: Completion Validation
- Tool: `judge_coding_task_completion`
- Validates: All requirements met, quality gates passed
- Final check before deployment
- Blocker: Incomplete implementation or failed validations

## Success Metrics

Track these metrics to measure system improvement:

### Development Velocity
- Time from task start to completion (should decrease over time)
- Number of iterations needed for approval (should decrease)
- Context switching frequency (should decrease)

### Quality Improvements
- Production bugs per release (should decrease)
- Test coverage percentage (should increase)
- Code review iterations (should decrease)

### Knowledge Capture
- Documented patterns count (should increase)
- Documented learnings count (should increase)
- ADRs created (should grow steadily)

### System Self-Improvement
- Reviewer agent updates (indicates learning)
- CLAUDE.md enhancements (indicates captured knowledge)
- Pattern reuse frequency (indicates compounding effect)