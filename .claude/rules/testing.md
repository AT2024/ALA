---
paths:
  - "**/*.test.ts"
  - "**/*.spec.ts"
  - "**/__tests__/**"
---

# Testing Rules

## Critical Path Tests (MANDATORY 100%)

- Local-before-ERP safety validation
- Applicator reuse prevention (block even if ERP says available)
- Treatment state transitions (valid + invalid)
- Rate limiting by IP (not username lockout)
- ERP offline fail-safe (block when no fresh cache)

## Test Patterns

- AAA: Arrange, Act, Assert
- Naming: `describe("Service") > describe("method") > it("should behavior")`
- MOCK all external API calls; test error scenarios (401, 500, timeout, offline)
- NEVER use production data; use factories; reset DB between suites

## Database Tests

- Test migration constraints (dosage range, foreign keys)
- Test referential integrity (prevent orphaned records)

## Test Falsifiability (MANDATORY before claiming a fix is verified)

A green test proves nothing on its own. A test counts as real only after:

1. Get it GREEN against the real code (E2E: real app + backend, no mocking the
   thing under test).
2. Revert the fix with a mutation that changes **what the test asserts** (verify
   the causal chain).
3. Re-run → it MUST go RED on the named assertion. Stayed green ⇒ not real;
   report it, don't count it.
4. Restore the fix → GREEN.

Revert mutations with the **Edit tool, never `git checkout`** (fix files are
often unstaged; checkout destroys them). Re-Read before the restoring Edit —
hooks/formatters may reflow the file. Full rationale + ALA E2E mechanics:
Skill `e2e-testing`; memory `ala-e2e-real-testing-method`.
