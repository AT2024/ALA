---
paths:
  - "frontend/src/**/*.tsx"
  - "frontend/src/**/*.ts"
---

# Frontend Rules

## React Performance (Don'ts)

- DON'T use React.memo/useMemo/useCallback unless you MEASURED a problem (>10ms re-render)
- React 19 Compiler handles memoization — manual optimization is obsolete
- Better alternatives: move state down, use `children` prop, split components

## Component Design

- PREFER composition over nested context providers
- MOVE logic into custom hooks, keep components thin
- IMPORT shared types from `@/types/` — never duplicate

## Accessibility (WCAG 2.1)

- 4.5:1 color contrast minimum
- 44x44px touch targets for medical buttons
- Semantic HTML (button for actions, a for navigation)
- aria-label on icon-only buttons; never `outline: none`
