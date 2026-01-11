---
description: Launch analysis agent (test, lint, review, security, coverage)
allowed-tools: Bash(*), Task(*)
argument-hint: <test|lint|review|security|coverage> [--worktree <name>]
---

Parse $ARGUMENTS to launch an analysis agent.

**CRITICAL**: These agents are READ-ONLY. They cannot write files.

## Task Types and Agents

| Task | Agent | Command |
|------|-------|---------|
| test | testing-specialist | npm test |
| lint | ala-code-reviewer | npm run lint && npm run typecheck |
| review | ala-code-reviewer | git diff analysis |
| security | security-audit | dependency and auth analysis |
| coverage | testing-specialist | npm run test:coverage |

## Execution Steps

1. Parse task type (first argument)
2. If `--worktree <name>` present, resolve path to `.worktrees/<name>`
3. Use Task tool with:
   - Appropriate `subagent_type` from table above
   - Working directory in prompt if worktree specified
   - Do NOT use `run_in_background: true` (output capture is unreliable - see note below)

## Why Not Background Mode?

Claude Code's `run_in_background: true` has known issues with output capture (GitHub Issues #9905, #14521). Background agents often complete with empty output. Running synchronously ensures results are always captured.

## Error Handling

- Unknown task type: Show available tasks (test, lint, review, security, coverage)
- Missing worktree: Run `./scripts/setup-parallel-worker.sh list` to show available
- Invalid arguments: Show usage: `/spawn <task> [--worktree <name>]`
