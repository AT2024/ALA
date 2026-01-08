# Start a Design Log Entry

Before implementing significant changes, create a design log entry.

## Steps

1. **Check existing logs** in `docs/design-logs/` for related discussions
2. **Create new file**: `docs/design-logs/2026-MM-[topic].md`
3. **Use template** from `docs/design-logs/README.md`
4. **Update index** in `DESIGN_LOG.md` with link to new entry

## What Requires a Design Log?

A "significant change" that needs a design log entry:
- Database schema changes (migrations, new tables, column modifications)
- API contract changes (new endpoints, breaking changes, auth modifications)
- Azure infrastructure changes (Docker config, networking, environment variables)
- Security-related changes (auth, permissions, data handling)

## Template Quick Reference

```markdown
# DL-XXX: [Title]

**Status**: Draft
**Created**: YYYY-MM-DD
**Author**: [name]

## Context
[Why is this change needed?]

## Design Questions
- [ ] Question 1?
- [ ] Question 2?

## Proposed Solution
[Options with pros/cons]

## Decision
[Selected approach and rationale]

## Implementation Notes
[Key files and changes]

## Results
> Added after implementation
```

## Four Pillars Reminder

1. **Read Before Write** - Check DESIGN_LOG.md first
2. **Design Before Implement** - This log before code
3. **Immutable History** - Don't edit after approval
4. **Socratic Method** - Questions become permanent record
