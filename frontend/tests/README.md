# Frontend Testing Infrastructure

## Overview
This directory contains the testing setup and utilities for the ALA Medical Treatment Tracking System frontend.

## Test Setup Files

### `setup.ts`
Global test configuration that:
- Extends Vitest's expect with jest-dom matchers
- Cleans up after each test
- Mocks browser APIs (window.matchMedia, IntersectionObserver)
- Configures localStorage/sessionStorage cleanup

### `testUtils.tsx`
Reusable test utilities including:
- Custom render function with all providers (Auth, Treatment, Router)
- Mock data (users, treatments, applicators)
- Helper functions for authentication setup
- Common test patterns

## Running Tests

### Unit Tests
```bash
npm run test:unit          # Run all tests once
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Run tests with coverage report
npm run test:ui            # Open Vitest UI
npm run test:ci            # Run tests for CI with verbose output
```

### End-to-End Tests
```bash
npm run test:e2e           # Run all E2E tests
npm run test:e2e:ui        # Open Playwright UI
npm run test:e2e:debug     # Debug E2E tests
```

## Test Structure

### Component Tests
Location: `src/components/__tests__/`

Tests for UI components:
- **ProgressTracker.test.tsx** - Treatment progress display
- **Layout.test.tsx** - App layout with navigation
- **ProtectedRoute.test.tsx** - Route authentication guard
- **ConfirmationDialog.test.tsx** - Confirmation dialog component

### Context Tests
Location: `src/context/__tests__/`

Tests for React context providers:
- **AuthContext.test.tsx** - Authentication state management
- **TreatmentContext.test.tsx** - Treatment workflow state

### Service Tests
Location: `src/services/__tests__/`

Tests for API and service layers:
- **api.test.ts** - Axios instance configuration and interceptors

## Writing Tests

### Basic Component Test
```typescript
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '../../../tests/testUtils';
import MyComponent from '../MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### Test with User Interaction
```typescript
import userEvent from '@testing-library/user-event';

it('should handle button click', async () => {
  const user = userEvent.setup();
  render(<MyComponent />);

  await user.click(screen.getByRole('button'));
  expect(mockCallback).toHaveBeenCalled();
});
```

### Test with Authenticated User
```typescript
import { setupAuthenticatedUser } from '../../../tests/testUtils';

it('should show user data when authenticated', () => {
  setupAuthenticatedUser();
  render(<MyComponent />);

  expect(screen.getByText('Test User')).toBeInTheDocument();
});
```

## Coverage Goals

- **Lines**: 70% minimum
- **Functions**: 70% minimum
- **Branches**: 70% minimum
- **Statements**: 70% minimum

View coverage report:
```bash
npm run test:coverage
# Open coverage/index.html in browser
```

## Mock Data

### Mock Users
- `mockUser` - Regular hospital user
- `mockAdminUser` - Admin user with full access

### Mock Treatments
- `mockTreatment` - Insertion treatment
- `mockRemovalTreatment` - Removal treatment

### Mock Applicators
- `mockApplicator` - Full use applicator
- `mockFaultyApplicator` - Faulty applicator
- `mockNoUseApplicator` - Unused applicator

## Best Practices

1. **Query by Role**: Prefer `getByRole` over `getByTestId`
2. **User-Centric**: Test user interactions, not implementation
3. **Async Handling**: Use `waitFor` for async updates
4. **Cleanup**: Tests auto-cleanup after each run
5. **Descriptive Names**: Use clear test descriptions
6. **Arrange-Act-Assert**: Follow AAA pattern
7. **Mock External Deps**: Mock APIs, third-party libs
8. **Test Critical Paths**: Focus on medical workflows

## Troubleshooting

### Tests Fail Due to Missing Dependencies
```bash
# Clean reinstall
rm -rf node_modules package-lock.json
npm install
```

### Coverage Provider Issues
```bash
# Install matching coverage provider version
npm install -D @vitest/coverage-v8@^1.3.1
```

### Rollup Module Errors
```bash
# Install optional rollup dependency
npm install --save-optional @rollup/rollup-win32-x64-msvc
```

### React Router Errors
Ensure components are wrapped with `BrowserRouter`:
```typescript
import { render } from '../../../tests/testUtils';
// testUtils already includes BrowserRouter
```

## Configuration Files

- **vitest.config.ts** - Vitest configuration
- **tsconfig.json** - TypeScript path aliases
- **package.json** - Test scripts and dependencies

## CI/CD Integration

The `test:ci` script is optimized for continuous integration:
```bash
npm run test:ci
```

This runs tests with:
- Coverage reporting
- Verbose output
- Single run (no watch mode)
- Exit on completion

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/react)
- [Playwright](https://playwright.dev/)
- [Jest-DOM Matchers](https://github.com/testing-library/jest-dom)
