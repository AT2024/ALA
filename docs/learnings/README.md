# Learning Documentation

This directory captures lessons learned during development to create a self-improving system where each task makes future work easier.

## Directory Structure

### `/bugs`
Document bug investigations and their solutions. Each file should include:
- What the bug was
- How it was discovered
- Root cause analysis
- Solution implemented
- Prevention measures added

### `/errors`
Production error analyses and resolutions. Each file should include:
- Error details and stack trace
- User impact assessment
- Investigation process
- Fix implementation
- Monitoring/alerting improvements
- Tests added to prevent regression

### `/optimizations`
Performance improvements and optimization lessons. Each file should include:
- Performance issue description
- Metrics before optimization
- Solution implemented
- Metrics after optimization
- Lessons learned

## Template Structure

Create files with naming: `YYYY-MM-DD-brief-description.md`

Example template:
```markdown
# [Brief Title]

**Date**: YYYY-MM-DD
**Category**: [Bug/Error/Optimization]
**Severity**: [Low/Medium/High/Critical]
**Area**: [Frontend/Backend/Priority API/Database/Deployment]

## Problem Description
[What went wrong]

## Investigation
[How the issue was found and analyzed]

## Root Cause
[Why it happened]

## Solution
[What was done to fix it]

## Prevention
[What was added to prevent recurrence]
- [ ] Tests added
- [ ] Documentation updated
- [ ] Reviewer agent updated
- [ ] CLAUDE.md updated

## Related Files
- [Link to relevant code]
- [Link to tests]
```

## Usage

After resolving any bug, error, or completing an optimization:
1. Create a new markdown file in the appropriate subdirectory
2. Fill in the template
3. Update relevant reviewer agents if patterns should be enforced
4. Add prevention measures to CLAUDE.md if broadly applicable
