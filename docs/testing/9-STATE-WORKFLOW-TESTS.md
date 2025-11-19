# 9-State Applicator Workflow - Test Suite

This document describes the comprehensive test suite for the 9-state applicator workflow and packaging feature.

## Overview

The test suite covers:
- **Backend Unit Tests**: State machine validation and packaging logic
- **Frontend Component Tests**: PackageManager UI and interactions
- **Context Tests**: TreatmentContext helper functions
- **E2E Tests**: Complete workflow from scan to package creation

## Test Files

### Backend Unit Tests
**Location**: `backend/tests/services/applicatorService.9state.test.ts`

**Coverage**:
- `mapStatusToUsageType()` - All 9 status mappings
- `validateStatusTransition()` - Valid and invalid transitions
- `createPackage()` - Success and error cases
- `getNextPackageLabel()` - P1, P2, P3 progression
- `saveApplicatorToPriority()` - Sync behavior for intermediate vs terminal states

**Run**:
```bash
cd backend
npm test -- applicatorService.9state.test.ts
```

### Frontend Component Tests
**Location**: `frontend/src/components/__tests__/PackageManager.test.tsx`

**Coverage**:
- Component rendering
- Summary table calculations
- Dialog interactions
- Selection validation
- API integration
- Error handling

**Run**:
```bash
cd frontend
npm test -- PackageManager.test.tsx
```

### Context Helper Tests
**Location**: `frontend/src/context/__tests__/TreatmentContext.9state.test.tsx`

**Coverage**:
- `sortApplicatorsByStatus()` - Sorting logic for active vs terminal states
- `isPancreasOrProstate()` - Treatment type detection
- Backward compatibility with null status
- Integration scenarios

**Run**:
```bash
cd frontend
npm test -- TreatmentContext.9state.test.tsx
```

### E2E Tests
**Location**: `frontend/tests/e2e/applicator-workflow.spec.ts`

**Coverage**:
- Complete workflow: SEALED → OPENED → LOADED → INSERTED
- Invalid transition rejection
- Faulty applicator workflow
- Disposal workflow
- Deployment failure workflow
- Package creation for pancreas treatments
- Package label progression (P1, P2, P3)
- Sorting and display validation
- Priority API sync behavior

**Run**:
```bash
cd frontend
npm run test:e2e
```

## Test Execution

### Run All Tests
```bash
# Backend tests
cd backend && npm test

# Frontend unit tests
cd frontend && npm test

# E2E tests
cd frontend && npm run test:e2e
```

### Run Specific Test Suites
```bash
# Only 9-state workflow tests
cd backend && npm test -- 9state
cd frontend && npm test -- 9state

# Only PackageManager tests
cd frontend && npm test -- PackageManager

# Only E2E applicator workflow tests
cd frontend && npx playwright test applicator-workflow
```

### Run with Coverage
```bash
# Backend coverage
cd backend && npm test -- --coverage

# Frontend coverage
cd frontend && npm test -- --coverage
```

## Test Scenarios

### 1. State Machine Transitions

#### Valid Transitions
- **SEALED** → OPENED, FAULTY, UNACCOUNTED
- **OPENED** → LOADED, FAULTY, DISPOSED, UNACCOUNTED
- **LOADED** → INSERTED, FAULTY, DEPLOYMENT_FAILURE, UNACCOUNTED
- **INSERTED** → DISCHARGED, DISPOSED
- **FAULTY** → DISPOSED, DISCHARGED
- **DEPLOYMENT_FAILURE** → DISPOSED, FAULTY

#### Invalid Transitions
- SEALED → INSERTED (must go through OPENED → LOADED first)
- OPENED → INSERTED (must load first)
- LOADED → DISPOSED (must be inserted or marked faulty first)
- Terminal states (DISPOSED, DISCHARGED, UNACCOUNTED) → Any state

### 2. Package Creation

#### Success Cases
- 4 applicators, same seed quantity, all LOADED
- Labels increment correctly (P1, P2, P3, ...)
- Package labels displayed in UI

#### Error Cases
- Not exactly 4 applicators
- Different seed quantities
- Wrong status (not LOADED)
- Applicators belong to different treatments

### 3. Priority API Sync

#### Intermediate States (No Sync)
- SEALED
- OPENED
- LOADED

#### Terminal States (Sync to Priority)
- INSERTED → "Full use"
- FAULTY → "Faulty"
- DEPLOYMENT_FAILURE → "Faulty"
- DISPOSED → "No Use"
- DISCHARGED → "No Use"
- UNACCOUNTED → "No Use"

### 4. UI Behavior

#### Row Colors
- SEALED → White background
- OPENED → Red background (bg-red-50)
- LOADED → Yellow background (bg-yellow-50)
- INSERTED → Green background (bg-green-50)
- Terminal states → Black background, white text (bg-gray-900)

#### Sorting
- Active states (SEALED, OPENED, LOADED) → Top of list
- Terminal states → Bottom of list
- Within groups → Sorted by seed quantity (highest first)

#### Package Manager Visibility
- **Visible**: Pancreas and Prostate treatments
- **Hidden**: Skin treatments and other types

## Coverage Goals

### Backend
- **Target**: > 90% coverage for applicatorService functions
- **Critical paths**: 100% coverage
  - State machine validation
  - Package creation
  - Priority sync logic

### Frontend
- **Target**: > 80% coverage for PackageManager component
- **Critical paths**: 100% coverage
  - Selection validation
  - API calls
  - Error handling

### E2E
- **Target**: All critical user workflows covered
- **Must test**:
  - Complete applicator lifecycle
  - Package creation flow
  - Error scenarios
  - Treatment type differences

## Debugging Tests

### Backend Test Issues
```bash
# Run single test with verbose output
cd backend
npm test -- applicatorService.9state.test.ts --verbose

# Run with debugging
NODE_OPTIONS='--inspect-brk' npm test -- applicatorService.9state.test.ts
```

### Frontend Test Issues
```bash
# Run with UI mode (Vitest)
cd frontend
npm test -- --ui

# Run single test file
npm test -- PackageManager.test.tsx --reporter=verbose
```

### E2E Test Issues
```bash
# Run with headed browser (see what's happening)
cd frontend
npx playwright test applicator-workflow --headed

# Run with debug mode
npx playwright test applicator-workflow --debug

# Generate trace for failed tests
npx playwright test applicator-workflow --trace on
npx playwright show-trace trace.zip
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Test 9-State Workflow

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          cd backend && npm install
          cd ../frontend && npm install

      - name: Run backend tests
        run: cd backend && npm test -- 9state --coverage

      - name: Run frontend tests
        run: cd frontend && npm test -- 9state --coverage

      - name: Run E2E tests
        run: cd frontend && npm run test:e2e -- applicator-workflow

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./backend/coverage/lcov.info,./frontend/coverage/lcov.info
```

## Test Data

### Test Applicators
The tests use the following serial number conventions:
- `APP-TEST-*` - General test applicators
- `APP-PKG-*` - Package creation tests
- `APP-P1-*`, `APP-P2-*` - Package label progression tests
- `APP-SORT-*` - Sorting tests
- `APP-COLOR-*` - UI color tests
- `APP-SYNC-*` - Priority sync tests
- `APP-TERMINAL-*` - Terminal state tests

### Test Treatments
- **Pancreas**: Treatment type `pancreas_insertion`
- **Prostate**: Treatment type `prostate_insertion`
- **Skin**: Treatment type `skin_insertion`

## Known Issues and Limitations

### Current Limitations
1. E2E tests assume test@example.com user is set up
2. Some API mocking needed for Priority sync verification
3. Full interaction testing in PackageManager requires more complex setup

### Future Improvements
- Add visual regression tests for UI components
- Add performance tests for large treatment datasets
- Add integration tests with real Priority API (staging environment)
- Add mutation testing to verify test quality

## Maintenance

### When to Update Tests
- **State machine changes**: Update `validateStatusTransition` tests
- **New statuses added**: Update all mapping and sorting tests
- **Package logic changes**: Update package creation tests
- **UI changes**: Update component and E2E tests
- **Priority sync changes**: Update API integration tests

### Test Review Checklist
- [ ] All 9 states covered in state machine tests
- [ ] All valid transitions tested
- [ ] All invalid transitions tested
- [ ] Package creation success and error cases
- [ ] Priority sync behavior for all states
- [ ] UI rendering for all states
- [ ] Sorting logic verified
- [ ] Treatment type detection verified
- [ ] E2E tests cover complete workflows
- [ ] Error handling tested

## References

- [Testing Best Practices](../CLAUDE.md#testing-patterns)
- [State Machine Documentation](../TODO-9-state-applicator-workflow.md)
- [Package Feature Documentation](../TODO-file-upload-feature.md)
- [Jest Documentation](https://jestjs.io/)
- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
