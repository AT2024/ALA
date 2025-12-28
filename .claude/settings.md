# Claude Code Project Settings

This file contains behavioral guidelines for Claude Code when working on the ALA project.

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
