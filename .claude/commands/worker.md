---
description: Manage parallel git worktrees for multi-agent development
allowed-tools: Bash(./scripts/setup-parallel-worker.sh:*), Bash(git:*)
argument-hint: <create <name> [--quick]|remove <name>|list>
---

Parse $ARGUMENTS for worktree management using `./scripts/setup-parallel-worker.sh`.

## Actions

### create <name> [--quick]
1. Get current branch: `git branch --show-current`
2. Build command: `./scripts/setup-parallel-worker.sh create --branch <branch> --name <name>`
3. If `--quick` is present: add `--skip-install` (fast mode, may break dev server)
4. If `--quick` is NOT present: do not add `--skip-install` (default: runs npm install)
5. Execute and report results

### remove <name>
Execute: `./scripts/setup-parallel-worker.sh remove --name <name> --force`

Note: `--force` required for non-interactive execution.

### list
Execute: `./scripts/setup-parallel-worker.sh list`

## Error Handling

- Missing action: Show usage
- `create` without name: Error "Usage: /worker create <name> [--quick]"
- `remove` without name: Error "Usage: /worker remove <name>"
- Unknown action: Show available actions (create, remove, list)
