---
description: Run tests and verify build passes
allowed-tools: Bash(npm test, npm run build, npm run typecheck)
argument-hint: [backend|frontend|all]
---

Run the test suite and build verification for the ALA project.

## Usage

- `/test` or `/test all` - Run tests in both backend and frontend
- `/test backend` - Run backend tests only
- `/test frontend` - Run frontend tests only

## Execution Steps

1. Parse $ARGUMENTS (default: "all")
2. Run the appropriate tests:

**For backend:**
```bash
cd backend && npm test
```

**For frontend:**
```bash
cd frontend && npm test
```

3. After tests pass, verify build:
```bash
cd backend && npm run build
cd frontend && npm run build
```

4. Report results with pass/fail summary

## TDD Reminder

Per the Development Standards in settings.md:
- Bug fixes: Write failing test FIRST
- New features: Define test cases before implementation
- Medical safety changes: MANDATORY tests before code

## On Failure

If tests or build fail:
1. Report the specific failure
2. Do NOT proceed with commits
3. Fix the issue or ask for guidance
