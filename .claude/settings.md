# Claude Code Project Settings

## Design Log Methodology

Before significant changes (schema, API, infrastructure, security), follow the Design Log:

| Pillar                  | Rule                                                |
| ----------------------- | --------------------------------------------------- |
| Read Before Write       | Check `DESIGN_LOG.md` and `docs/design-logs/` first |
| Design Before Implement | Log entry before production code                    |
| Immutable History       | Freeze on approval; append "Results" only           |
| Socratic Method         | Questions in the log are permanent record           |

**Does NOT need a log:** Docs-only, tests-only, typos, lint, patch/minor deps, config tweaks.

**Before Azure changes:** Run `/azure-check`, check design logs, ensure DB backup if schema change.

## Quick Decision Framework

Check in order:

1. **Codebase exploration** → `Explore` agent (skip if known path)
2. **Specialist domain** (DB, tests, deploy, Priority, frontend, perf, security) → matching agent
3. **Multi-file or high-risk** → start with plan, then specialist agents
4. **Simple/direct** → handle with Read/Edit directly

**Critical paths (MANDATORY agents):** medical-safety-reviewer, database-specialist, priority-integration, deployment-azure.

## Development Standards

### Quality Gates

1. `npm run build` passes
2. `npm run typecheck` passes (if available)
3. No new lint warnings
4. Relevant tests pass

### TDD

- Bug fixes: failing test FIRST
- Medical safety: MANDATORY tests before code

### Commits

- Atomic: one logical change per commit
- Format: `type(scope): description` (feat, fix, refactor, test, docs, chore)
- Medical changes: separate commit with safety context
