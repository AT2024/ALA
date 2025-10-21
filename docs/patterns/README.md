# Pattern Documentation

This directory contains reusable patterns that have proven successful in the ALA medical application. These patterns embody the compounding engineering philosophy: document what works so future implementations are faster and more reliable.

## Directory Structure

### `/frontend`
React, TypeScript, and UI patterns that work well for medical applications:
- Component composition patterns
- State management strategies
- Scanner integration patterns
- Form validation approaches
- Loading state handling
- Error boundary patterns

### `/backend`
Express, TypeScript, and API patterns:
- Controller patterns
- Service layer organization
- Error handling strategies
- Logging patterns
- Request validation
- Response formatting

### `/integration`
Priority ERP integration patterns:
- OData query construction
- Applicator validation flows
- Authentication handling
- Data synchronization strategies
- Fallback data handling
- Position-based authorization

## Template Structure

Create files with naming: `pattern-name.md`

Example template:
```markdown
# [Pattern Name]

## Context
When to use this pattern and why it's valuable.

## Problem
What problem does this pattern solve?

## Solution
How to implement this pattern with code examples.

## Benefits
- Clear benefit 1
- Clear benefit 2

## Tradeoffs
- Consideration 1
- Consideration 2

## Examples
### Example 1: [Use Case]
\`\`\`typescript
// Code example
\`\`\`

### Example 2: [Use Case]
\`\`\`typescript
// Code example
\`\`\`

## Related Patterns
- Link to related patterns
- Link to similar approaches

## References
- [Link to implementation](path/to/file.ts:line)
- [Link to tests](path/to/test.ts:line)
```

## Usage

When you discover a pattern that works particularly well:
1. Create a new markdown file in the appropriate subdirectory
2. Document the pattern using the template
3. Add examples from your actual codebase
4. Reference the pattern in CLAUDE.md if it should be default behavior
5. Update relevant reviewer agents to enforce the pattern

## Existing Patterns

Check subdirectories for documented patterns you can reuse:
- Frontend patterns for medical UI components
- Backend patterns for Priority API integration
- Database patterns for treatment tracking
