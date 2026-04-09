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
