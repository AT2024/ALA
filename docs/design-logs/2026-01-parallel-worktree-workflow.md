# DL-002: Parallel Agentic Workflow with Git Worktrees

**Status**: Implemented
**Created**: 2026-01-08
**Author**: Claude Code / amitaik
**Stakeholders**: Development team

## Context

The ALA project needs automated infrastructure for parallel AI agent development. The existing `docs/MULTI_AGENT_WORKFLOW.md` defines contract-first development with manual branch management. This design adds automation tooling to streamline parallel workflows while maintaining strict isolation.

### Problem Statement

Currently, parallel agent development requires:
1. Manual branch creation and management
2. Manual port allocation to avoid conflicts
3. Manual .env file setup for each parallel session
4. No standardized way to spawn background verification tasks

### Goals

1. Automate Git Worktree creation with environment syncing
2. Provide automatic port allocation to prevent conflicts
3. Enable background agent spawning for analysis tasks
4. Establish clear isolation rules for parallel agents

## Design Questions

- [x] Where should worktrees be stored? **Decision: `.worktrees/` (hidden, gitignored)**
- [x] Should the script support both Bash and PowerShell? **Decision: Bash only (Git Bash/WSL)**
- [x] How should databases be handled? **Decision: Shared database with port isolation**
- [x] What can background agents do? **Decision: Analysis-only (cannot write files)**

## Proposed Solution

### Component 1: scripts/setup-parallel-worker.sh

A bash script to automate Git Worktree creation, environment syncing, and port allocation.

**CLI Interface:**
```bash
./scripts/setup-parallel-worker.sh create --branch feat/feature-A --name worker-1
./scripts/setup-parallel-worker.sh list
./scripts/setup-parallel-worker.sh remove --name worker-1
./scripts/setup-parallel-worker.sh clean --all
```

**Port Allocation:**
- Formula: `port = base_port + (worker_number * 100)`
- Worker 1: Frontend 3100, Backend 5100
- Worker 2: Frontend 3200, Backend 5200
- Maximum 9 parallel workers

**Features:**
- Registry-based port tracking (`.worktree-registry.json`)
- .env file copying with automatic port patching
- npm install in worktree
- Colored logging (matches `swarm-deploy` patterns)
- Dry-run mode for validation

### Component 2: /spawn Slash Command

A Claude Code slash command to spawn background agents for analysis tasks.

**Critical Constraint:** Background agents CANNOT write files. They can only:
- Run tests, linting, type checking
- Perform code review analysis
- Generate text reports

**Supported Task Types:**

| Task | Command | Agent |
|------|---------|-------|
| test | `npm test` | testing-specialist |
| lint | `npm run lint && typecheck` | ala-code-reviewer |
| review | Read-only analysis | ala-code-reviewer |
| security | Security scanning | security-audit |
| coverage | `npm run test:coverage` | testing-specialist |

### Component 3: Isolation Rules

Updates to `CLAUDE.md` and `.claude/settings.md` with strict isolation principles:

1. **Worktree Boundary Enforcement** - Work only within assigned worktree
2. **No Cross-Worktree Communication** - Agents cannot message each other
3. **Human Coordinator Role** - Human merges branches and resolves conflicts
4. **Background Agent Constraints** - Analysis-only, cannot write files

## Decision

Implement all three components with the following design decisions:

| Question | Decision | Rationale |
|----------|----------|-----------|
| Worktree Location | `.worktrees/` | Hidden, gitignored, keeps root clean |
| Platform Support | Bash only | Matches existing patterns, works with Git Bash |
| Database Handling | Shared database | Simpler setup, acceptable for dev |
| Background Agents | Analysis-only | Technical limitation - background agents cannot write files |

## Implementation Notes

### Files Created

| File | Purpose |
|------|---------|
| `scripts/setup-parallel-worker.sh` | Worktree management script |
| `.claude/commands/spawn.md` | Background agent spawning command |

### Files Modified

| File | Change |
|------|--------|
| `CLAUDE.md` | Add "Parallel Development with Git Worktrees" section |
| `.claude/settings.md` | Add "Parallel Worktree Isolation Rules" section |
| `DESIGN_LOG.md` | Add DL-002 entry to index |
| `.gitignore` | Add `.worktrees/` exclusion |

### Directory Structure

```
ala-improved/
├── .worktrees/                   # Worktree storage (gitignored)
│   ├── worker-1/
│   ├── worker-2/
│   └── .worktree-registry.json   # Active worker tracking
├── scripts/
│   └── setup-parallel-worker.sh
├── .claude/
│   └── commands/
│       └── spawn.md
```

## Alternatives Considered

| Alternative | Decision | Rationale |
|-------------|----------|-----------|
| Docker-per-worker | SKIP | Too resource-intensive for development |
| Python orchestration | SKIP | Bash matches existing script patterns |
| MCP coordination server | SKIP | Violates isolation principle |
| File-based agent handoffs | SKIP | Creates coordination complexity |

## Results

### Outcome

Implementation completed successfully on 2026-01-08:

1. **setup-parallel-worker.sh** - Fully functional with:
   - `create`, `list`, `remove`, `clean` commands
   - Simple file-based registry (no jq dependency)
   - Port allocation working correctly (3100/5100 for worker-1)
   - Dry-run mode for validation

2. **/spawn command** - Documentation created in `.claude/commands/spawn.md`
   - Task types: test, lint, review, security, coverage
   - Clear constraint documentation (analysis-only)

3. **Isolation rules** - Added to:
   - `CLAUDE.md` - Brief reference with links
   - `.claude/settings.md` - Full isolation rules

4. **Infrastructure**:
   - `.gitignore` updated with `.worktrees/` exclusion
   - Design log index updated

### Lessons Learned

1. **jq dependency removed** - Original design used jq for JSON registry, but Windows Git Bash doesn't have it by default. Refactored to simple pipe-delimited file format.

2. **CLAUDE.md should stay thin** - Moved detailed isolation rules to `.claude/settings.md` per best practices. CLAUDE.md just contains brief references and links.

3. **Background agent limitation is fundamental** - The constraint that background agents cannot write files is a Claude Code platform limitation, not something we can work around. Design explicitly accounts for this.
