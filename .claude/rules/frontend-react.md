---
paths:
  - "frontend/src/**/*.tsx"
  - "frontend/src/**/*.ts"
---

# Frontend Development Rules - React/TypeScript

## React Component Rules (CORRECTED)

### What NOT To Do (Anti-Patterns)
- DON'T "ALWAYS use React.memo()" - this is premature optimization
- DON'T memoize everything - creates memory overhead and closure leaks
- DON'T add useMemo/useCallback unless you MEASURED performance issues

### What To Do Instead
- PREFER composition over context nesting
- PREFER lifting state up over prop drilling
- MOVE logic OUT of UI components into custom hooks
- MEASURE performance with React DevTools BEFORE optimizing
- TRUST React's default render cycle - it's fast

### Memoization Rules (From Dan Abramov)
- USE React.memo ONLY when:
  1. You've MEASURED a performance problem
  2. The component renders often with the same props
  3. The re-render is expensive (>10ms)
- BETTER alternatives before memo:
  1. Move state down (closer to where it's used)
  2. Use `children` prop to avoid re-renders
  3. Split components so expensive parts are isolated

### Hooks Best Practices
- useEffect: Include dependencies, BUT refs and constants are legitimate exceptions
- useCallback: ONLY for callbacks passed to memoized children (not by default)
- useMemo: ONLY for expensive computations you've MEASURED (>10ms)
- useRef: NEVER add ref.current to dependency arrays (defeats purpose of refs)

### React 19 Compiler Note
The React Compiler auto-memoizes. Manual memoization is increasingly obsolete.

**If using React 19/Compiler:**
- REMOVE useMemo and useCallback entirely
- EXCEPTION: Keep stable refs for external libraries that require them
- The compiler handles memoization better than manual optimization

## TypeScript Rules

### Strict Mode
- `"strict": true` - MANDATORY
- `"noImplicitAny": true` - MANDATORY

### Type Patterns
- PREFER type inference where obvious
- USE explicit return types for public functions
- USE discriminated unions for status types
- IMPORT shared types from `@/types/` - never duplicate

### Null Safety
- USE optional chaining: `patient?.name`
- USE nullish coalescing: `value ?? defaultValue`

## Component Structure

### Composition Over Context
```tsx
// GOOD: Composition
function Layout({ children }: { children: React.ReactNode }) {
  return <div className="layout">{children}</div>;
}

// BAD: Deeply nested context providers
<Provider1><Provider2><Provider3><App /></Provider3></Provider2></Provider1>
```

### Logic Out of UI
```tsx
// GOOD: Logic in custom hook
function TreatmentForm() {
  const { treatment, updateStatus, isValid } = useTreatmentForm();
  return <form>...</form>;
}

// BAD: Logic mixed in component
function TreatmentForm() {
  const [status, setStatus] = useState();
  const [errors, setErrors] = useState();
  // 50 lines of business logic...
  return <form>...</form>;
}
```

## Accessibility (WCAG 2.1)
- Minimum 4.5:1 color contrast for text
- 44x44px minimum touch targets for medical buttons
- Semantic HTML: button for actions, a for navigation
- aria-label on icon-only buttons
- Visible focus indicators (never `outline: none`)

## Pre-Commit Checklist
- [ ] TypeScript compiles with no errors
- [ ] No new React.memo added without measured performance issue
- [ ] Accessibility attributes present on interactive elements
- [ ] Loading states for async operations
