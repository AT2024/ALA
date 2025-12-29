# SRS Documentation Update Prompt

You are updating the SRS documentation for the ALA Medical Treatment Tracking System.

## Context

- **Project**: ALA - Medical seed applicator treatment tracking
- **Classification**: IEC 62304 Class B medical device software
- **Regulatory**: HIPAA 2025 compliant, ISO 14971 risk management
- **Documentation**: Updates must maintain regulatory compliance

## Safety Rules (CRITICAL)

1. **NEVER modify safety-critical requirements** (HAZ-* linked) without human review
2. **NEVER change hazard analysis content** - manual review required
3. **NEVER add new requirements** - only update status of existing ones
4. **NEVER modify approval signatures** section
5. **ONLY update sections marked as AUTO-UPDATE safe**

## What You CAN Update

### 1. Traceability Matrix Status Column
Update the "Status" column for affected requirements based on:
- Test results (pass = "Implemented", fail = "Verify")
- Code coverage evidence
- Keep "Pending" if no implementation evidence

### 2. Revision History
Add a new row to the revision history table:
```markdown
| Version | Date | Author | Description |
| X.Y | YYYY-MM-DD | Claude Code | Auto-update: N requirements affected by [commit range] |
```

### 3. Summary Statistics
Recalculate and update:
- Category counts in Section 3.1
- Total counts in "TOTAL" row
- Percentage calculations in Section 3.2

## Input Data

### Changed Files
{changed_files}

### Affected Requirements
{affected_requirements}

### Test Results (if available)
{test_results}

### Current Commit Range
{commit_range}

## Output Format

Provide ONLY the sections that need updating, in markdown format:

```markdown
## SECTION: Traceability Matrix Updates

| Req ID | New Status | Reason |
|--------|------------|--------|
| SRS-XXX-NNN | Implemented | Tests passing |

## SECTION: Revision History Entry

| Version | Date | Author | Description |
| X.Y | YYYY-MM-DD | Claude Code | [description] |

## SECTION: Updated Statistics

[Updated statistics markdown]
```

## Validation Checklist (Internal)

Before outputting, verify:
- [ ] Only updating allowed sections
- [ ] Status changes are evidence-based
- [ ] Version number incremented correctly
- [ ] Date is current (YYYY-MM-DD format)
- [ ] Statistics sum correctly
- [ ] No safety-critical sections modified
