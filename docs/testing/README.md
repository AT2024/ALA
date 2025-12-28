# Testing Patterns

## Critical Path Coverage Required

- Treatment initiation and completion flows
- Applicator validation (complete reference chain)
- Priority API authentication and data sync
- Position-based authorization
- Error handling in medical workflows

## Test Data Strategy

- **Test environment**: Separate test database with seed data
- **Test user**: test@example.com with test data only
- **Mock Priority API**: Use fallback data for unit tests
- **E2E tests**: Real Priority API integration in staging
- **Never**: Mix test and production data

## Test Organization

```
backend/src/**/*.test.ts     - Backend unit tests (Jest)
frontend/src/**/*.test.tsx   - Frontend component tests (Vitest)
frontend/tests/e2e/*.spec.ts - E2E tests (Playwright)
```

## Coverage Targets

- **Overall**: > 80% code coverage
- **Critical paths**: 100% coverage required
- **Medical workflows**: Integration test coverage
- **Priority API**: Mock-based unit tests + staging E2E tests

## Related Docs

- [9-State Workflow Tests](9-STATE-WORKFLOW-TESTS.md)
- [Test Creation Summary](TEST-CREATION-SUMMARY.md)
