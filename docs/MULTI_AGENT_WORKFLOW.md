# Multi-Agent Parallel Development Plan for ALA

> **For Claude Agents:** REQUIRED: Follow ALL rules in this document. Violations will cause patient data integrity issues.

**Goal:** Run multiple AI agents on separate branches working on independent features, then manually merge and combine them safely.

**Architecture:** Contract-first development with file locking, Priority ERP isolation, mandatory audit logging, and visual verification. You (human) are the Architect + Tester + Mediator. Agents are scoped Workers only.

**Tech Stack:** React/TypeScript/Tailwind frontend, Express/TypeScript backend, PostgreSQL, Priority ERP integration

**Prerequisites:**
- Git repository on `develop` branch
- All tests passing (`npm test`)
- No uncommitted changes

---

## Phase 0: Contract-First (Before ANY Parallel Work)

**Why:** If agents define incompatible types, merge becomes impossible. Define contracts FIRST.

### Step 1: Update shared types on develop

```bash
git checkout develop
git pull origin develop
```

### Step 2: Define/update contracts for ALL planned features

**Files to potentially update:**
- `shared/applicatorStatuses.ts` - Treatment state definitions
- `shared/types.ts` - Create if needed for new interfaces

**Example - adding new interface:**
```typescript
// shared/types.ts
export interface NewFeatureData {
  id: string;
  // Define ALL fields agents will need
}
```

### Step 3: Commit as "Contract Commit"

```bash
git add shared/
git commit -m "chore: define contracts for [feature-set-name]"
```

### Step 4: ALL feature branches fork FROM this commit

```bash
# Create all branches from this point
git checkout -b feat/feature-A
git checkout develop && git checkout -b feat/feature-B
git checkout develop && git checkout -b feat/feature-C
```

---

## Phase 1: Lock Critical Files (Windows)

**Why:** Physical file locks prevent agents from "accidentally" modifying protected files.

### Step 1: Lock files before starting ANY agent

```powershell
# PowerShell - Run as Administrator if needed
attrib +R "shared\applicatorStatuses.ts"
attrib +R "backend\src\models\*.ts"
attrib +R "package.json"
attrib +R "backend\package.json"
attrib +R "frontend\package.json"
attrib +R "frontend\src\context\TreatmentContext.tsx"
attrib +R "backend\src\services\priorityService.ts"
```

### Step 2: Verify locks are in place

```powershell
attrib "shared\applicatorStatuses.ts"
# Should show: R    C:\...\shared\applicatorStatuses.ts
```

### Step 3: Unlock ONLY after all merges complete

```powershell
attrib -R "shared\applicatorStatuses.ts"
attrib -R "backend\src\models\*.ts"
attrib -R "package.json"
attrib -R "backend\package.json"
attrib -R "frontend\package.json"
attrib -R "frontend\src\context\TreatmentContext.tsx"
attrib -R "backend\src\services\priorityService.ts"
```

**Files to lock:**

| File | Why | Risk if Modified |
|------|-----|------------------|
| `shared/applicatorStatuses.ts` | Central treatment state contract | Merge hell, state inconsistencies |
| `backend/src/models/*.ts` | Database schema definitions | Data corruption, migration failures |
| `frontend/src/context/TreatmentContext.tsx` | Global state management | State bugs across all features |
| `package.json` (all 3) | Dependency versions | Build failures, version conflicts |
| `backend/src/services/priorityService.ts` | Priority ERP adapter | Patient data integrity risk |

---

## Phase 2: Create Feature Branches

### Branch Structure

```
main
└── develop (integration)
    ├── feat/feature-A ──── Agent 1
    ├── feat/feature-B ──── Agent 2
    └── feat/feature-C ──── Agent 3
```

### Step 1: Create branches (one terminal per agent)

```bash
# Terminal 1
git checkout develop
git checkout -b feat/feature-A
# Start Agent 1 here

# Terminal 2
git checkout develop
git checkout -b feat/feature-B
# Start Agent 2 here

# Terminal 3
git checkout develop
git checkout -b feat/feature-C
# Start Agent 3 here
```

---

## Phase 3: Agent Prompt Template (COPY THIS EXACTLY)

```
═══════════════════════════════════════════════════════════════════
                    ALA FEATURE AGENT PROMPT
═══════════════════════════════════════════════════════════════════

ROLE: Senior Full-Stack Engineer (React, Node, TypeScript)
APP CONTEXT: ALA - Medical treatment tracking replacing paper-based records
FEATURE: [INSERT FEATURE NAME]
BRANCH: feat/[branch-name]

═══════════════════════════════════════════════════════════════════
                         YOUR SCOPE
═══════════════════════════════════════════════════════════════════

YOU CAN MODIFY:
- [specific directories]
- [specific files]

YOU CANNOT MODIFY (READ-ONLY / LOCKED):
- shared/applicatorStatuses.ts
- shared/types.ts (unless contract update approved)
- frontend/src/context/TreatmentContext.tsx
- backend/src/models/*.ts
- backend/src/services/priorityService.ts
- package.json (root, backend, frontend)
- Any files outside your scope

═══════════════════════════════════════════════════════════════════
                    PRIORITY ERP RULES (CRITICAL)
═══════════════════════════════════════════════════════════════════

1. NEVER call Priority API directly
   - No axios/fetch to Priority endpoints
   - Use ONLY: backend/src/services/priorityService.ts methods
   - If method missing: create mock + flag for human review

2. TESTING: ALL tests MUST mock priorityService
   ```typescript
   // REQUIRED at top of every test file using Priority
   jest.mock('../services/priorityService', () => ({
     getPatientData: jest.fn().mockResolvedValue({ /* mock data */ }),
     validateApplicator: jest.fn().mockResolvedValue(true),
     // ... mock all methods you use
   }));
   ```

3. NEVER let tests hit real Priority API
   - No network calls in tests
   - Mock ALL external dependencies

═══════════════════════════════════════════════════════════════════
                    AUDIT LOGGING (MEDICAL COMPLIANCE)
═══════════════════════════════════════════════════════════════════

Every applicator status change MUST create audit log:

```typescript
import ApplicatorAuditLog from '../models/ApplicatorAuditLog';

// REQUIRED for every status change
await ApplicatorAuditLog.create({
  applicatorId: applicator.id,
  oldStatus: applicator.currentStatus,
  newStatus: newStatus,
  changedBy: user.email,
  reason: 'Description of why status changed',
  requestId: req.headers['x-request-id'] || null,
});
```

For NON-applicator data changes, add TODO comment:
```typescript
// TODO: Audit - [describe the data modification]
await someModel.update({ ... });
```

═══════════════════════════════════════════════════════════════════
                    3-STRIKE RULE (BEFORE EVERY COMMIT)
═══════════════════════════════════════════════════════════════════

Before committing, ALL THREE must pass:

Strike 1: npm run lint
Strike 2: npm run typecheck
Strike 3: npm test (with at least one new test for your changes)

If ANY fails, fix before committing. No exceptions.

═══════════════════════════════════════════════════════════════════
                    CODE STYLE REQUIREMENTS
═══════════════════════════════════════════════════════════════════

- Functional components only (no class components)
- Strictly typed props (no `any`)
- Tailwind CSS for styling (no inline styles, no CSS files)
- Use existing UI components from frontend/src/components/ui/
- Follow existing patterns in the codebase

═══════════════════════════════════════════════════════════════════
                         YOUR TASK
═══════════════════════════════════════════════════════════════════

[DESCRIBE THE SPECIFIC FEATURE HERE]

Example: "Add a 'Syringe Disposal' confirmation step to the treatment
flow. Include audit logging for the disposal action."

═══════════════════════════════════════════════════════════════════
```

---

## Phase 4: Safe Parallel Domains

### Files SAFE for Parallel Work

| Domain | Path | Rule |
|--------|------|------|
| Frontend pages | `frontend/src/pages/` | Different pages only |
| Frontend components | `frontend/src/components/` | Different components only |
| Backend services | `backend/src/services/` | Different services only (NOT priorityService) |
| Backend controllers | `backend/src/controllers/` | Different controllers only |
| Tests | `frontend/tests/`, `backend/tests/` | Always safe |
| Documentation | `docs/` | Always safe |

### Files NEVER Touch in Parallel

| File | Risk Level | Rule |
|------|------------|------|
| `shared/applicatorStatuses.ts` | CRITICAL | One agent only, ever |
| `frontend/src/context/TreatmentContext.tsx` | CRITICAL | One agent only, ever |
| `backend/src/models/*.ts` | HIGH | Schema changes = serialize |
| `backend/src/services/priorityService.ts` | HIGH | Locked, human approval only |
| `package.json` (any) | MEDIUM | No dependency changes |

---

## Phase 5: Merge Strategy

### Merge Order (ALWAYS follow this sequence)

```
1. Backend API changes    → Establishes contracts
2. Frontend consuming API → Uses established contracts
3. Tests/docs             → Validates everything
```

### Step-by-Step Merge Process

```bash
# 1. Checkout develop
git checkout develop
git pull origin develop

# 2. Merge first feature (backend-heavy first)
git merge feat/feature-A --no-ff -m "feat: merge feature A"

# 3. Run 3-Strike validation
npm run lint
npm run typecheck
npm test

# 4. If ALL pass, continue. If ANY fails, STOP and fix.

# 5. Merge second feature
git merge feat/feature-B --no-ff -m "feat: merge feature B"

# 6. Run 3-Strike validation again
npm run lint
npm run typecheck
npm test

# 7. Continue pattern for remaining features...

# 8. Final build verification
npm run build
```

### Handling Merge Conflicts

```bash
# If conflict occurs:
git merge feat/feature-B --no-ff
# CONFLICT in src/file.ts

# 1. Open conflicted file
code src/file.ts

# 2. Resolve manually (keep both changes if possible)

# 3. Mark resolved
git add src/file.ts
git commit

# 4. IMMEDIATELY run 3-Strike validation
npm run lint && npm run typecheck && npm test
```

---

## Phase 6: Visual Patient-Path Verification (MEDICAL REQUIREMENT)

**Why:** Unit tests passing ≠ patient flow works. This is regulatory compliance.

### After EVERY Merge, Complete This Checklist:

```
POST-MERGE VERIFICATION CHECKLIST
═════════════════════════════════

[ ] 1. Start application locally
      npm run dev (both frontend and backend)

[ ] 2. Login as test user
      Email: test@example.com
      Code: 123456

[ ] 3. Core Patient Flow Test
      a. Navigate to Treatment page
      b. Scan test QR code (or enter test applicator)
      c. Select treatment type
      d. Complete one full treatment cycle
      e. Verify treatment appears in history

[ ] 4. Feature-Specific Test
      a. Test the NEW feature you just merged
      b. Verify it doesn't break existing flows

[ ] 5. PDF Export Test (if PDF was touched)
      a. Generate treatment report PDF
      b. Verify PDF contains correct data

[ ] 6. Check Audit Logs (if status changes involved)
      a. Query: SELECT * FROM applicator_audit_log ORDER BY changed_at DESC LIMIT 10;
      b. Verify new entries exist for your actions

ONLY proceed to next merge if ALL checks pass.
```

---

## Phase 7: Practical Example - 3 Independent Features

### Feature A: PDF Export Improvements

**Branch:** `feat/pdf-export-v2`

**Agent Scope:**
```
YOUR SCOPE (you CAN modify):
- backend/src/services/pdfGenerationService.ts
- frontend/src/services/pdfService.ts
- backend/tests/services/pdfGenerationService.test.ts
- frontend/src/components/PDFExportButton.tsx (if exists)
```

### Feature B: New Admin Dashboard

**Branch:** `feat/admin-dashboard`

**Agent Scope:**
```
YOUR SCOPE (you CAN modify):
- frontend/src/pages/Admin/ (create new directory)
- backend/src/controllers/adminController.ts (create new)
- backend/src/routes/adminRoutes.ts (create new)
- All related test files
```

### Feature C: API Caching Layer

**Branch:** `feat/api-caching`

**Agent Scope:**
```
YOUR SCOPE (you CAN modify):
- backend/src/middleware/cache.ts (create new)
- backend/src/middleware/index.ts (add export)
- backend/tests/middleware/cache.test.ts (create new)
```

**Why this works:** Each feature touches completely different files.

---

## Risk Assessment

| Risk | P | I | Score | Mitigation |
|------|---|---|-------|------------|
| Agent modifies locked file | 2 | 5 | 10 | File locking + scope in prompt |
| Priority API called in test | 3 | 5 | 15 | Mandatory mock rule in prompt |
| Merge conflict in shared types | 3 | 4 | 12 | Contract-first development |
| Audit log missing | 3 | 5 | 15 | Explicit audit rule in prompt |
| Patient flow broken after merge | 2 | 5 | 10 | Visual verification checklist |
| Type mismatch between agents | 4 | 3 | 12 | Contract commit before branching |

**Address risks with score > 8 first.** All mitigations are built into this plan.

---

## Summary: Your Role as Coordinator

| Phase | Your Action | Agent Action |
|-------|-------------|--------------|
| 0 | Define contracts (shared types) | - |
| 1 | Lock critical files (attrib +R) | - |
| 2 | Create feature branches | - |
| 3 | Write scoped prompts using template | - |
| 4 | Start agents in separate terminals | Implement features |
| 5 | Monitor for scope drift | Follow 3-strike rule |
| 6 | Sequential merge + 3-strike check | - |
| 7 | Visual patient-path verification | - |
| 8 | Unlock files (attrib -R) | - |
| 9 | Deploy to staging/production | - |

**You are the Architect + Tester + Mediator. Agents are Workers only.**

---

## What We Intentionally Skipped

| Proposed | Verdict | Reason |
|----------|---------|--------|
| 4-agent hierarchy | SKIP | Overkill for solo dev - coordination > coding |
| 30-min rebase cycles | SKIP | Adds friction for independent features |
| Shadow Observer agent | SKIP | You ARE the observer |
| Python orchestration | SKIP | Manual is correct at your scale |
| AuditService (fictional) | SKIP | Use existing ApplicatorAuditLog model |

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────────┐
│                 ALA MULTI-AGENT QUICK REFERENCE                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  BEFORE PARALLEL WORK:                                         │
│  1. Update shared types → commit as "Contract Commit"          │
│  2. attrib +R [locked files]                                   │
│  3. Create branches from contract commit                       │
│                                                                 │
│  AGENT RULES:                                                  │
│  • Scope limited to specific files                             │
│  • Priority API → use priorityService.ts ONLY                  │
│  • Tests → MUST mock priorityService                           │
│  • Status changes → MUST create ApplicatorAuditLog             │
│  • Before commit → lint + typecheck + test                     │
│                                                                 │
│  MERGE ORDER:                                                  │
│  Backend → Frontend → Tests                                    │
│                                                                 │
│  AFTER EACH MERGE:                                             │
│  1. npm run lint && typecheck && test                          │
│  2. Visual patient-path verification                           │
│                                                                 │
│  AFTER ALL MERGES:                                             │
│  1. attrib -R [unlock files]                                   │
│  2. npm run build                                              │
│  3. Deploy                                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Success Criteria

- [ ] All agents complete within defined scope
- [ ] No modifications to locked files
- [ ] All tests pass after each merge
- [ ] Visual patient-path verification passes
- [ ] Audit logs created for all status changes
- [ ] No direct Priority API calls in code or tests
- [ ] Final build succeeds
- [ ] No regressions in core treatment flow
