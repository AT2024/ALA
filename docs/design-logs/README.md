# Design Logs

This directory contains design log entries following the [Wix Engineering Design Log Methodology](https://www.wix.engineering/post/why-i-stop-prompting-and-start-logging-the-design-log-methodology).

## Purpose

Design logs capture architectural reasoning and decisions **before** implementation begins. They serve as:
- A record of "why" decisions were made
- A reference for AI collaborators to understand context
- A history that becomes immutable once implementation starts

## Four Pillars

1. **Read Before Write** - AI checks design-logs before making changes
2. **Design Before Implement** - Log created/approved before production code
3. **Immutable History** - Design freezes once implementation starts; changes appended as "Results"
4. **Socratic Method** - Questions asked in the log become permanent record

## Template

Use this template for new design log entries:

```markdown
# DL-XXX: [Title]

**Status**: Draft | In Review | Approved | Implemented | Archived
**Created**: YYYY-MM-DD
**Author**: [name]
**Stakeholders**: [names]

## Context

Why is this change needed? What problem are we solving?

## Design Questions

- [ ] Question 1?
- [ ] Question 2?

## Proposed Solution

### Option A: [Name]
- Pros: ...
- Cons: ...

### Option B: [Name]
- Pros: ...
- Cons: ...

## Decision

[Selected option and rationale]

## Implementation Notes

Key files affected:
- `path/to/file1.ts` - Description of change
- `path/to/file2.ts` - Description of change

## Results

> Added after implementation is complete

### Outcome
[What actually happened]

### Lessons Learned
[What we learned for future reference]
```

## Naming Convention

Files follow the pattern: `YYYY-MM-[topic].md`

Examples:
- `2026-01-environment-alignment.md`
- `2026-02-authentication-refactor.md`

## Workflow

1. **Create**: Start a new design log with `/design` command
2. **Discuss**: Add questions and options
3. **Decide**: Document the chosen approach
4. **Implement**: Status changes to "Approved", log becomes read-only
5. **Record**: Add Results section after implementation

## Index

| ID | Title | Status | Date |
|----|-------|--------|------|
| DL-001 | [Environment Alignment](2026-01-environment-alignment.md) | Draft | 2026-01-07 |
| DL-004 | [Removal PDF Fix](2026-01-removal-pdf-fix.md) | Implemented | 2026-01-11 |
