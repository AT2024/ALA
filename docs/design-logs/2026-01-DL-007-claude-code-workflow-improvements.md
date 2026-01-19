# DL-007: Claude Code Workflow Improvements

**Status**: Implemented
**Created**: 2026-01-13
**Author**: Claude Code

## Context

The existing Claude Code workflow setup needed improvements to align with best practices and ensure safety-critical code is correctly handled. A comprehensive review identified several dangerous patterns in initial recommendations that were corrected.

## Critical Fixes Applied

The following **DANGEROUS ADVICE** was identified during review and corrected:

| Original Bad Advice | Why It's Wrong | Fixed Rule |
|---------------------|----------------|------------|
| "ALWAYS use React.memo()" | Kills dev speed, often DEGRADES performance (memory overhead, closure leaks) | Only optimize when MEASURED performance issue |
| "Lock account after 5 failed attempts by USERNAME" | **CWE-645 DoS vector** - attacker locks out legitimate users | Rate limit by IP with exponential backoff |
| "Priority ERP is ALWAYS source of truth" | **PATIENT SAFETY RISK** - ERP sync delay means "dirty" device appears "clean" | Local DB is truth for SAFETY. ERP is truth for INVENTORY only |
| "Proceed with warning when ERP offline" | **FAIL-OPEN DANGER** - allows expired applicators to be used | FAIL-CLOSED with ApplicatorCache |
| Complex PHI masking rules | Data is already pre-masked at source | Treat patient_id as string. Focus on process safety |
| Soft deletes for clinical data | Allows "undelete" of clinical records | Use is_voided flag (non-reversible) |

## Implementation

### Phase 1: Path-Specific Rules (`.claude/rules/`)

Created 6 rule files with path matchers:

| File | Path Scope | Key Content |
|------|-----------|-------------|
| `frontend-react.md` | `frontend/src/**/*.tsx` | Anti-memo patterns, React 19 compiler notes |
| `backend-api.md` | `backend/src/**/*.ts` | IP-based rate limiting, Zod validation |
| `database.md` | `backend/src/models/**` | Migration requirements, is_voided pattern |
| `priority-integration.md` | `**/*priority*.ts` | FAIL-CLOSED pattern, ApplicatorCache |
| `medical-safety.md` | `**/treatment/**` | LOCAL DB FIRST for safety |
| `testing.md` | `**/*.test.ts` | Safety validation test patterns |

### Phase 2: ApplicatorCache Model

Created new model for ERP offline resilience:
- `backend/src/models/ApplicatorCache.ts`
- `backend/src/migrations/20260113100000-create-applicator-cache.sql`

Cache strategy:
- Updated on every successful ERP query
- TTL: 24 hours (configurable)
- Used ONLY when ERP is offline
- Stale cache = BLOCK (fail-safe)

### Phase 3: Skills (`.claude/skills/`)

Created 3 domain-specific skills:

| Skill | Purpose |
|-------|---------|
| `shared-code` | Reference to prevent duplicate code creation |
| `priority-api` | OData patterns, Local-Safety-First validation |
| `medical-compliance` | HIPAA audit, is_voided pattern, fail-safe principles |

### Phase 4: Hooks

Added auto-formatting hook to `.claude/settings.json`:
```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Edit|Write",
      "hooks": [{
        "type": "command",
        "command": "npx prettier --write \"${FILE_PATH}\" 2>/dev/null || true"
      }]
    }]
  }
}
```

### Phase 5: Migration Check Script

Created `backend/scripts/check-model-migration-diff.ts`:
- Compares Sequelize models to actual database schema
- Fails if columns in models don't exist in database
- Ignores timestamp columns (createdAt, updatedAt, deletedAt)
- Added `npm run db:check-diff` command

## Source of Truth Hierarchy

**Golden Rule: LOCAL DB wins for SAFETY. ERP wins for INVENTORY.**

| Data Type | Source of Truth | Why |
|-----------|-----------------|-----|
| **Device USAGE** (used/unused) | LOCAL DB | Real-time, safety-critical |
| **Device METADATA** (expiry, model) | ERP | Inventory management |
| **Patient Treatment Records** | LOCAL DB | Direct observation |
| **Inventory Counts** | ERP | Business operations |

## Applicator Validation Flow

```
1. CHECK LOCAL DB → Is it marked USED?
   ├─ YES → BLOCK (even if ERP says available)
   └─ NO → Continue

2. CHECK ERP → Metadata validation
   ├─ ERP offline, no cache → BLOCK (fail-safe)
   ├─ ERP offline, stale cache → BLOCK (fail-safe)
   ├─ ERP offline, fresh cache → Use cached data
   ├─ Expired? → BLOCK
   ├─ NO USE flag? → BLOCK
   └─ Valid → Continue

3. CHECK TREATMENT TYPE → Clinical match
   └─ Mismatch → BLOCK

4. PROCEED → Record usage in LOCAL DB FIRST
```

## Files Created/Modified

### New Files
- `.claude/rules/frontend-react.md`
- `.claude/rules/backend-api.md`
- `.claude/rules/database.md`
- `.claude/rules/priority-integration.md`
- `.claude/rules/medical-safety.md`
- `.claude/rules/testing.md`
- `.claude/skills/shared-code/SKILL.md`
- `.claude/skills/priority-api/SKILL.md`
- `.claude/skills/medical-compliance/SKILL.md`
- `backend/src/models/ApplicatorCache.ts`
- `backend/src/migrations/20260113100000-create-applicator-cache.sql`
- `backend/scripts/check-model-migration-diff.ts`

### Modified Files
- `backend/src/models/index.ts` - Added ApplicatorCache export
- `backend/package.json` - Added db:check-diff script
- `.claude/settings.json` - Added PostToolUse hooks

## Verification

After implementation:
1. Test applicator reuse: Local says USED, ERP says AVAILABLE → Should BLOCK
2. Test rate limiting: Attack username from IP-A, login from IP-B → Should work
3. Run `npm run db:check-diff` to verify model/schema parity
4. Run tests to verify all safety tests pass

## Results

- ✅ Path-specific rules created for all domains
- ✅ ApplicatorCache model for fail-safe ERP offline handling
- ✅ Skills extracted from SHARED_UTILITIES.md
- ✅ Auto-formatting hooks configured
- ✅ Migration check script added
- ✅ Design log documented
