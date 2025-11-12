# ALA Medical Treatment Tracking System

## Project Context
Medical treatment tracking application for seed applicator procedures with Priority ERP integration.
- **Purpose**: Real-time tracking and validation of medical seed applicator treatments
- **Critical**: Patient safety system - accuracy and data integrity are paramount
- **Tech Stack**: React/TypeScript/Tailwind frontend, Express/TypeScript backend, PostgreSQL database
- **Key Integration**: Priority ERP for patient data, site access, and applicator validation

## Quick Decision Framework

⚠️ **Evaluate before responding to ANY request**

### Pattern Matching (check in order):

1. **Is this codebase exploration?**
   - Keywords: "where is", "how does", "find", "show me structure", "explain the architecture"
   - Action: Use `Task` tool with `subagent_type=Explore`
   - Skip: Known file path ("show me src/app.ts" → use Read directly)

2. **Does it match a specialist agent domain?**
   - Database, testing, deployment, Priority API, frontend, performance, security
   - Action: Use the matching specialist agent (see list below)
   - Examples: "fix failing tests" → testing-specialist, "deployment failing" → deployment-azure

3. **Is this multi-file or high-risk?**
   - Multi-file features, database schema changes, auth changes, medical features
   - Action: Start with `set_coding_task`, then use specialist agents
   - Skip: One-line changes, typos, simple comments

4. **Is this complex analysis?**
   - Architectural decisions, trade-offs, "should we use X or Y?"
   - Action: Use `mcp__sequential__sequentialthinking`
   - Skip: Simple questions with obvious answers

5. **Is this simple and direct?**
   - Known file, single-line change, direct question
   - Action: Handle directly with Read, Edit, explain

### Critical Paths (MANDATORY agents - no exceptions):

- **Medical/patient safety** → medical-safety-reviewer (bug cost >> agent cost)
- **Database schema** → database-specialist (prevents data integrity issues)
- **Priority API** → priority-integration + priority-api-reviewer
- **Production deployment** → deployment-azure (prevents downtime)

## Core Behavioral Guidelines

### Code Modification Approach

**Task Classification:**
- **Simple** (direct tools): Known file, one-line change, typo fix, add comment
- **Complex** (use agents): Multi-file, unknown location, specialized domain
- **Critical** (mandatory workflow): Medical features, database schema, auth, deployment

**Guidelines:**
- **Multi-file features** → `set_coding_task` → specialist agents (database, frontend, etc.)
- **Codebase exploration** → `Explore` agent (saves search iterations)
- **Specialized domains** → Match to specialist agent (see Quick Decision Framework)
- **Complex reasoning** → `sequential thinking` (transparent logic for trade-offs)
- **Simple/direct tasks** → Handle directly with Read, Edit, explain (don't over-engineer)
- **Multi-step tasks** → Use `TodoWrite` to track progress and maintain visibility

**Critical Paths (MANDATORY workflow - no shortcuts):**
- Medical/safety features → `set_coding_task` + `medical-safety-reviewer`
- Database schema changes → `database-specialist` (prevents data integrity issues)
- Priority API modifications → `priority-integration` + `priority-api-reviewer`
- Production deployment → `deployment-azure` (prevents downtime)

### Specialized Agent Usage

**Anthropic Best Practice:** "Only delegate to subagents when the task clearly benefits from a separate agent with a new context window"

**How it works:** Agent descriptions use "PROACTIVELY handle" to signal when they should be auto-invoked. When user request matches those keywords, use that agent immediately.

**Decision rule:**
- ✅ Use agents for: Multi-file coordination, unknown locations, specialized domains, critical paths
- ❌ Skip agents for: Single file with known path, trivial changes, simple direct questions

**Implementation Agents** (write code):

- **testing-specialist** - PROACTIVELY handle test creation, failures, coverage
  - Auto-triggers: "test", "coverage", "Jest", "Vitest", "Playwright", "mock", "E2E", "failing test"
  - Example: "Fix failing tests" → Immediately use testing-specialist

- **priority-integration** - PROACTIVELY handle Priority ERP integration, OData API
  - Auto-triggers: "Priority", "OData", "applicator", "PHONEBOOK", "ORDERS", "SIBD"
  - Example: "Applicator not validating" → Immediately use priority-integration

- **frontend-ui** - PROACTIVELY handle React components, TypeScript, Tailwind, state management
  - Auto-triggers: "React", "component", "UI", "frontend", "Tailwind", "state", "hooks"
  - Example: "Add user preferences component" → Immediately use frontend-ui

- **deployment-azure** - PROACTIVELY handle Azure VM, Docker, production deployment
  - Auto-triggers: "deploy", "Azure", "Docker", "production", "container", "VM", "SSH"
  - Example: "Deployment failing" → Immediately use deployment-azure

- **database-specialist** - PROACTIVELY handle PostgreSQL, Sequelize, migrations, schema
  - Auto-triggers: "database", "PostgreSQL", "Sequelize", "migration", "schema", "table", "query"
  - Example: "Add new database table" → Immediately use database-specialist

- **performance-optimization** - PROACTIVELY handle bottlenecks, slow queries, optimization
  - Auto-triggers: "slow", "performance", "bottleneck", "optimize", "memory leak", "latency"
  - Example: "API endpoint is slow" → Immediately use performance-optimization

- **security-audit** - PROACTIVELY handle auth, JWT, vulnerabilities, input validation
  - Auto-triggers: "security", "vulnerability", "auth", "JWT", "validation", "CORS", "XSS"
  - Example: "Check for security issues" → Immediately use security-audit

**Reviewer Agents** (review code quality - use AFTER implementation):

- **ala-code-reviewer** - General code quality, standards, TypeScript best practices
  - Use after: Any significant code changes for quality check

- **priority-api-reviewer** - OData queries, applicator validation patterns
  - Use after: Any Priority API integration changes

- **medical-safety-reviewer** - Patient safety, data integrity, audit trails
  - MANDATORY after: Any medical/treatment workflow changes

### MCP Tool Guidance

**set_coding_task (mcp-as-a-judge):**
- **When to use:** Multi-file features, high-risk changes, database schema, auth, medical features
- **Why:** Validation gates prevent rework (saves 50,000+ tokens debugging mistakes)
- **Cost:** ~2000 tokens | **ROI:** Highly positive for substantial changes
- **Skip:** Trivial changes (typos, comments, documentation-only)

**sequential thinking:**
- **When to use:** Complex analysis, architectural decisions, multiple trade-offs
- **Why:** Transparent reasoning prevents wrong decisions
- **Cost:** ~800 tokens | **ROI:** Positive for genuinely complex questions
- **Skip:** Simple questions with obvious answers

**Context7 (library docs):**
- **When to use:** External library documentation needed
- **Example YES:** "How to use React Query?" → Use Context7 for latest docs
- **Example NO:** "How does TreatmentContext work?" → Read the file instead (internal code)

**Explore agent:**
- **When to use:** "where is X?", "how does Y work?", "find Z pattern", "explain structure"
- **Why:** Saves 3-5 manual search iterations
- **Cost:** ~500-1000 tokens | **ROI:** Positive for open-ended exploration
- **Skip:** Known file paths ("show me src/app.ts" → use Read directly)

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

## Deployment (Radically Simplified - October 2025)

### Production Deployment (Azure VM)
**One command. That's it.**
```bash
cd ~/ala-improved/deployment
./deploy
```

**What it does automatically:**
- ✅ Backs up database
- ✅ Pulls latest code
- ✅ Builds and starts containers
- ✅ Verifies health checks
- ✅ Cleans up old Docker images and build cache (saves 1-3GB per deployment)
- ✅ Rolls back on any failure

### Setup (First Time Only)
1. SSH to Azure VM: `ssh azureuser@20.217.84.100`
2. Copy environment template: `cp deployment/.env.production.template deployment/.env`
3. Edit `.env` file and fill in your secrets (database password, JWT secret, Priority API credentials)
4. Deploy: `cd deployment && ./deploy`

### Local Development
Same docker-compose.yml, just create `.env` with local settings:
```bash
cd deployment
cp .env.production.template .env
# Edit .env for local URLs (localhost instead of production domain)
docker-compose up
```

### Files You Need
```
deployment/
├── docker-compose.yml          # Single compose file
├── deploy                      # Single deployment script
├── .env                       # Your secrets (git-ignored)
└── .env.production.template   # Template for .env
```

**That's it.** No azure/, no scripts/, no multiple configs. Simple.

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

## Agent Behavior and Training

### How Agents Learn New Methods

Claude AI agents learn deployment and operational methods from documentation files:

**Primary Learning Sources:**
1. **CLAUDE.md** (this file) - Core project context and behavioral guidelines
2. **.claude/agents/*.md** - Individual agent instructions (e.g., `deployment-azure.md`)
3. **Documentation files** - README.md, TROUBLESHOOTING.md, deployment guides

**Important:** When deployment methods change, you must update ALL documentation files that reference the old method. Agents will continue using old methods until their documentation is updated.

### Deployment Agent Configuration

The `deployment-azure` agent reads its instructions from [.claude/agents/deployment-azure.md](.claude/agents/deployment-azure.md).

**Current deployment method (October 2025):**
```bash
ssh azureuser@20.217.84.100 "cd ~/ala-improved/deployment && ./deploy"
```

**If an agent uses an old deployment command**, it means the documentation hasn't been updated. Update these files:
- `CLAUDE.md` (lines 78-118)
- `README.md` (production deployment section)
- `docs/deployment/AZURE_DEPLOYMENT.md`
- `docs/TROUBLESHOOTING.md` (deployment commands)
- `.claude/agents/deployment-azure.md` (agent instructions)
- `deployment/azure/*.md` (add deprecation notices)

### Documentation-Driven Behavior

Agents don't have memory between sessions. They rely on:
- **Project instructions** (CLAUDE.md) for core behavior
- **Agent-specific instructions** (.claude/agents/*.md) for specialized tasks
- **Documentation files** for operational procedures
- **Code comments** for implementation details

**Best practices:**
- Document important decisions in CLAUDE.md
- Update agent instructions when workflows change
- Keep documentation consistent across all files
- Add deprecation notices to old documentation

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

**October 2025: Deployment System Radically Simplified**
- **Old Problem**: 5+ deployment scripts, 7+ env files, constant confusion
- **Solution**: ONE deploy script, ONE docker-compose.yml, ONE .env template
- **Result**: Impossible to use wrong script/config (only one of each exists)
- **See**: `deployment/archive/README.md` for history of the simplification

**Pitfall**: Missing or misconfigured .env file
- **Symptom**: Deployment fails with "POSTGRES_PASSWORD not set" or similar
- **Solution**: Copy `.env.production.template` to `.env` and fill in secrets
- **Prevention**: deploy script checks for `.env` file existence before proceeding
- **Quick Fix**: `cd deployment && cp .env.production.template .env && vim .env`

**Pitfall**: Container startup failures
- **Symptom**: Health checks fail, deployment rolls back automatically
- **Solution**: Check logs: `cd deployment && docker-compose logs`
- **Common Causes**: Database password mismatch, incorrect API URLs
- **Prevention**: Docker health checks catch issues early, automatic rollback prevents bad deployments

**Pitfall**: Nginx config not taking effect
- **Root Cause**: Nginx config is baked into Docker image at build time
- **Solution**: The deploy script always rebuilds with `--no-cache`, so nginx config changes take effect
- **Manual Rebuild**: `cd deployment && docker-compose build --no-cache frontend`
- **Lesson**: Accept Docker's immutability - rebuild instead of fighting it

**Pitfall**: Testing deployment system changes on production (2025-10-27 CRITICAL INCIDENT)
- **Symptom**: Production outage while testing "zero-downtime" blue-green deployment
- **Root Cause**: Tested deployment infrastructure changes directly on live system without local verification
- **Solution**: ALWAYS test deployment changes locally FIRST with complete workflow verification
- **Prevention**: Pre-deployment checklist enforcement - see [incident report](docs/learnings/errors/2025-10-27-blue-green-production-outage.md)
- **Critical**: Production is NEVER a test environment, especially for deployment infrastructure
- **Impact**: 30-minute production outage, violated core medical application reliability principle

**Pitfall**: Azure VM disk space fills up over time (RESOLVED 2025-11-10)
- **Symptom**: Disk space fills up causing deployment failures and production issues
- **Root Cause**: Docker images accumulate with each build (1-2GB per production deployment, 200-500MB per staging), old images not cleaned up
- **Solution**: Automated cleanup added to both `deploy` and `deploy-staging` scripts - runs after successful deployment
- **Cleanup actions**: `docker image prune -f` (removes dangling images), `docker builder prune -f --keep-storage 1GB` (controls build cache)
- **Prevention**: Disk usage warning shows before deployment, automatic cleanup frees 1-3.5GB per deployment cycle
- **Safe**: Only removes unused resources, preserves active containers/volumes/tagged images for both environments
- **Manual cleanup**: `docker system prune -f` if emergency space needed (but both deployment scripts handle this now)
- **Implementation note**: Cleanup code is intentionally duplicated in both scripts for simplicity (5 lines each, aligns with "radically simplified" philosophy)

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