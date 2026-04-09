---
paths:
  - "**/.worktrees/**"
---

# Parallel Worktree Isolation Rules

## You Are in an Isolated Worktree

1. Your scope is limited to THIS worktree only
2. The parent repo and other worktrees are OFF-LIMITS
3. Check `.env.worker` or `.env` for port assignments — do NOT assume defaults

**Port formula:** `base_port + (worker_number * 100)` (Worker 1: 3100/5100, Worker 2: 3200/5200)

## Before ANY Modification

- Am I in my assigned worktree?
- Is this file within my allowed scope?
- Is this file in the LOCKED list? If yes, STOP and report to human coordinator.

**Locked files** (require human coordination):

- `shared/applicatorStatuses.ts`
- `frontend/src/context/TreatmentContext.tsx`
- `backend/src/models/*.ts`
- `backend/src/services/priorityService.ts`
- `package.json` (all)

## Emergency Stop

STOP and notify human if: modifying outside scope, detecting another agent in same area, needing schema/Priority/safety changes.

## Human Coordinator

Only the human creates worktrees, assigns scope, merges branches, resolves conflicts. NEVER coordinate with other agents directly or leave messages in files.
