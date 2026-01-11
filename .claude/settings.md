# Claude Code Project Settings

This file contains behavioral guidelines for Claude Code when working on the ALA project.

## Design Log Methodology (Four Pillars)

Before making significant changes, follow the [Wix Engineering Design Log Methodology](https://www.wix.engineering/post/why-i-stop-prompting-and-start-logging-the-design-log-methodology):

| Pillar | Description |
|--------|-------------|
| **Read Before Write** | Check `DESIGN_LOG.md` and `docs/design-logs/` before significant changes |
| **Design Before Implement** | Create design log entry before production code for significant changes |
| **Immutable History** | Design freezes once implementation starts; changes appended as "Results" |
| **Socratic Method** | Questions asked in the log become permanent record |

### What is a "Significant Change"?

A change requires a design log entry if it involves:
- **Database schema** - migrations, new tables, column modifications
- **API contracts** - new endpoints, breaking changes, auth modifications
- **Azure infrastructure** - Docker config, networking, environment variables
- **Security** - authentication, permissions, data handling patterns

### What Does NOT Require a Design Log?

These changes can proceed without a design log entry:
- **Documentation-only** - README, comments, JSDoc, markdown files
- **Test-only** - New tests, test fixtures, test configuration
- **Minor fixes** - Typos, linting errors, import ordering
- **Dependencies** - Patch/minor version updates (major versions DO require log)
- **Config tweaks** - Log levels, timeouts, non-breaking environment variables

### Environment Safety Rules

**Before Azure Production Changes:**
1. Run `/azure-check` to validate Local vs Azure parity
2. Check `docs/design-logs/` for related pending decisions
3. Ensure database backup exists if schema changes involved
4. Use the `deployment-azure` agent for deployment tasks

**Azure-Specific Considerations:**
- Changes to `docker-stack.yml` affect production replicas
- Swarm uses rolling updates (old containers run until new healthy)
- SSL certificates are bind-mounted from `/home/azureuser/ala-improved/ssl-certs/`
- External overlay network `ala-network` must exist before stack deploy
- See `docs/design-logs/2026-01-environment-alignment.md` for parity gaps

### Quick Commands
- `/design` - Start a new design log entry
- `/azure-check` - Validate Azure parity before deployment

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

## Specialized Agent Usage

**Anthropic Best Practice:** "Only delegate to subagents when the task clearly benefits from a separate agent with a new context window"

**Decision rule:**
- ✅ Use agents for: Multi-file coordination, unknown locations, specialized domains, critical paths
- ❌ Skip agents for: Single file with known path, trivial changes, simple direct questions

### Implementation Agents (write code)

- **testing-specialist** - PROACTIVELY handle test creation, failures, coverage
  - Auto-triggers: "test", "coverage", "Jest", "Vitest", "Playwright", "mock", "E2E", "failing test"

- **priority-integration** - PROACTIVELY handle Priority ERP integration, OData API
  - Auto-triggers: "Priority", "OData", "applicator", "PHONEBOOK", "ORDERS", "SIBD"

- **frontend-ui** - PROACTIVELY handle React components, TypeScript, Tailwind, state management
  - Auto-triggers: "React", "component", "UI", "frontend", "Tailwind", "state", "hooks"

- **deployment-azure** - PROACTIVELY handle Azure VM, Docker, production deployment
  - Auto-triggers: "deploy", "Azure", "Docker", "production", "container", "VM", "SSH"

- **database-specialist** - PROACTIVELY handle PostgreSQL, Sequelize, migrations, schema
  - Auto-triggers: "database", "PostgreSQL", "Sequelize", "migration", "schema", "table", "query"

- **performance-optimization** - PROACTIVELY handle bottlenecks, slow queries, optimization
  - Auto-triggers: "slow", "performance", "bottleneck", "optimize", "memory leak", "latency"

- **security-audit** - PROACTIVELY handle auth, JWT, vulnerabilities, input validation
  - Auto-triggers: "security", "vulnerability", "auth", "JWT", "validation", "CORS", "XSS"

### Reviewer Agents (use AFTER implementation)

- **ala-code-reviewer** - General code quality, standards, TypeScript best practices
- **priority-api-reviewer** - OData queries, applicator validation patterns
- **medical-safety-reviewer** - Patient safety, data integrity, audit trails (MANDATORY for medical changes)

## MCP Tool Guidance

**set_coding_task (mcp-as-a-judge):**
- **When to use:** Multi-file features, high-risk changes, database schema, auth, medical features
- **Why:** Validation gates prevent rework (saves 50,000+ tokens debugging mistakes)
- **Skip:** Trivial changes (typos, comments, documentation-only)

**sequential thinking:**
- **When to use:** Complex analysis, architectural decisions, multiple trade-offs
- **Why:** Transparent reasoning prevents wrong decisions
- **Skip:** Simple questions with obvious answers

**Context7 (library docs):**
- **When to use:** External library documentation needed
- **Example YES:** "How to use React Query?" → Use Context7 for latest docs
- **Example NO:** "How does TreatmentContext work?" → Read the file instead (internal code)

**Explore agent:**
- **When to use:** "where is X?", "how does Y work?", "find Z pattern", "explain structure"
- **Why:** Saves 3-5 manual search iterations
- **Skip:** Known file paths ("show me src/app.ts" → use Read directly)

## Priority Integration Context

- **Position Code 99**: Full admin access to all 100+ sites (e.g., alexs@alphatau.com)
- **Other users**: Site-restricted based on Priority PHONEBOOK authorization
- **Validation critical**: Always validate applicator reference chains and data integrity
- **Test mode**: Only use test data for test@example.com, never mix with production
- **Data source indicators**: 🧪 Test data, 🎯 Real API, ❌ Fallback

## When to Escalate or Clarify

- Ambiguous medical/safety requirements → always seek clarification
- Fundamental architecture changes → discuss approach first
- Priority API integration modifications → validate business logic
- Data integrity or patient safety concerns → raise immediately
- Missing foundational choices (framework, UI type, hosting) → use `raise_missing_requirements`

## Development Standards

### Code Quality Gates

All code changes must satisfy these quality gates before completion:

1. **Build Verification**: `npm run build` must pass in affected packages
2. **Type Check**: `npm run typecheck` (if available) must pass
3. **Lint Clean**: No new lint warnings/errors introduced
4. **Test Pass**: Relevant tests must pass (`npm test` in backend/ and frontend/)

Use `/spawn test` for async test verification during development.

### Test-Driven Development

For robust code, follow TDD principles:

- **Bug fixes**: Write failing test FIRST that reproduces the bug, then fix
- **New features**: Define test cases before implementation
- **Refactoring**: Ensure test coverage exists before changing code
- **Medical safety features**: MANDATORY tests before code changes

### Commit Guidelines

For a medical safety system, clean commit history is critical:

- **Atomic commits**: One logical change per commit
- **No bundling**: Never mix refactoring with bug fixes or features
- **Clear messages**: Format as `type(scope): description`
  - Types: feat, fix, refactor, test, docs, chore
  - Example: `fix(applicator): validate status before removal`
- **Medical changes**: Require separate commit with explicit safety context

## Parallel Worktree Isolation Rules

### Worktree Detection

When working in a worktree (path contains `.worktrees/`):
1. You are in an ISOLATED environment
2. Your scope is limited to THIS worktree only
3. The parent repo is OFF-LIMITS for modifications

### Isolation Checklist (Before ANY Modification)

Before modifying files in a parallel worktree environment:
- [ ] Am I in my assigned worktree?
- [ ] Is this file within my allowed scope?
- [ ] Have I avoided accessing other worktrees?
- [ ] Am I NOT modifying shared contracts without approval?

### Port Awareness

Each worktree has unique ports. When starting services:
- Check `.env.worker` or `.env` for port assignments
- Do NOT assume default ports (3000, 5000, 5432)
- Use port from environment variables

**Port Formula:** `port = base_port + (worker_number * 100)`
- Worker 1: Frontend 3100, Backend 5100
- Worker 2: Frontend 3200, Backend 5200

### Spawn Agent Behavior

The `/spawn` command runs analysis agents synchronously (not in background):
- Output is always captured and displayed
- Agent completes before returning control

**Why synchronous?** Claude Code's `run_in_background: true` has known output capture issues (GitHub #9905, #14521). Background agents often complete with empty output.

**Spawn agent constraints:**
1. LIMITED to analysis/verification only
2. CANNOT write files - attempting to do so will fail
3. Output findings as text (captured by orchestrator)

**Available /spawn tasks:** test, lint, review, security, coverage

### Conflict Prevention

When working on files that might conflict:
1. Check if file is in LOCKED list (from `docs/MULTI_AGENT_WORKFLOW.md`)
2. If locked, do NOT modify - report to human coordinator
3. If borderline scope, ask before proceeding

**Locked files** (require human coordination):
- `shared/applicatorStatuses.ts`
- `frontend/src/context/TreatmentContext.tsx`
- `backend/src/models/*.ts`
- `backend/src/services/priorityService.ts`
- `package.json` (all)

### Emergency Stop Conditions

**STOP and notify human coordinator if:**
- You need to modify a file outside your scope
- You detect another agent working in same area
- Database schema changes are needed
- Priority API modifications required
- Any patient safety-related changes

### Human Coordinator Role

The human developer is the ONLY coordination point:
- Creates worktrees with `./scripts/setup-parallel-worker.sh`
- Assigns agent scopes and branches
- Merges branches from different worktrees
- Resolves conflicts between parallel work
- Reviews and approves cross-worktree changes

**You (the agent) should NEVER:**
- Coordinate with other agents directly
- Leave messages for other agents in files
- Assume knowledge of other worktrees' state
- Access files in `.worktrees/` subdirectories other than your own
