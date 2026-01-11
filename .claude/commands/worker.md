---
description: Manage parallel git worktrees for multi-agent development
allowed-tools: Bash(./scripts/setup-parallel-worker.sh:*), Bash(git:*)
argument-hint: <create <name> [--full]|remove <name>|list>
---

Parse $ARGUMENTS for worktree management using `./scripts/setup-parallel-worker.sh`.

## Actions

### create <name> [--full]
1. Get current branch: `git branch --show-current`
2. Build command: `./scripts/setup-parallel-worker.sh create --branch <branch> --name <name>`
3. If `--full` is NOT present: add `--skip-install` (default: fast mode)
4. If `--full` IS present: do not add `--skip-install` (runs npm install)
5. Execute and report results

### remove <name>
Execute: `./scripts/setup-parallel-worker.sh remove --name <name> --force`

Note: `--force` required for non-interactive execution.

### list
Execute: `./scripts/setup-parallel-worker.sh list`

## Error Handling

- Missing action: Show usage
- `create` without name: Error "Usage: /worker create <name> [--full]"
- `remove` without name: Error "Usage: /worker remove <name>"
- Unknown action: Show available actions (create, remove, list)
