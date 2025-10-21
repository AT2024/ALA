# Compounding Engineering Workflow Guide

This guide shows you how to use the complete compounding engineering system in your ALA Medical Application, orchestrating mcp-as-a-judge tools with your 7 implementation agents and 3 reviewer agents.

## Table of Contents
1. [Quick Start Examples](#quick-start-examples)
2. [Complete Workflow Walkthrough](#complete-workflow-walkthrough)
3. [Agent Orchestration Patterns](#agent-orchestration-patterns)
4. [Learning Loop Implementation](#learning-loop-implementation)
5. [Common Scenarios](#common-scenarios)

---

## Quick Start Examples

### Example 1: Adding a New Feature (Full Workflow)

**User Request**: "I need to add a feature to track which nurse performed each treatment"

**Workflow**:

**Step 1: Planning Lane**
```
Claude: "I'll use set_coding_task to plan this nurse tracking feature"

Tool: mcp__mcp-as-a-judge__set_coding_task
Args:
  user_request: "Track which nurse performed each treatment"
  task_title: "Add Nurse Tracking to Treatment Records"
  task_description: "Add nurse identification to treatment workflow with audit trail"
  task_size: "m"

Response:
  workflow_guidance.next_tool: "judge_coding_plan"
  Guidance: Research existing user tracking, plan database changes, design UI
```

**Step 2: Research & Design**
```
Claude: "Let me research existing patterns and create detailed plan"
[Searches docs/patterns/, reviews existing code, creates design]

Claude: "Now I'll validate the plan with judge_coding_plan"

Tool: mcp__mcp-as-a-judge__judge_coding_plan
Args:
  plan: "[Detailed implementation plan]"
  design: "[Architecture and component design]"
  research: "[Findings from existing patterns]"

Response:
  approved: true
  workflow_guidance.next_tool: "judge_code_change"
```

**Step 3: Implementation Lane (Parallel Agents)**
```
User: "Use database-specialist and frontend-ui agents in parallel to implement this"

[database-specialist creates migration and model]
[frontend-ui creates nurse selection component]
[Both agents work simultaneously]
```

**Step 4: Review Lane**
```
Claude: "Implementation complete. Running reviewer agents..."

1. ala-code-reviewer: Checks TypeScript, patterns, code quality ✅
2. medical-safety-reviewer: Validates audit trail, data integrity ✅
3. judge_code_change: Final validation with git diff

Response:
  approved: true
  workflow_guidance.next_tool: "judge_testing_implementation"
```

**Step 5: Testing Validation**
```
Claude: "Use testing-specialist to create comprehensive tests"

[testing-specialist creates unit tests, integration tests, E2E tests]
[Runs test suite]

Tool: mcp__mcp-as-a-judge__judge_testing_implementation
Args:
  test_files: ["backend/src/models/treatment.test.ts", ...]
  test_execution_results: "[Raw Jest output]"

Response:
  approved: true
  workflow_guidance.next_tool: "judge_coding_task_completion"
```

**Step 6: Completion & Learning**
```
Tool: mcp__mcp-as-a-judge__judge_coding_task_completion
Args:
  completion_summary: "Nurse tracking fully implemented with audit trail"
  requirements_met: [list of requirements]

Response:
  approved: true
  workflow_guidance.next_tool: null (completed!)

Claude: "Task complete! Now capturing learnings..."
- Documents pattern in docs/patterns/frontend/user-tracking.md
- Updates CLAUDE.md Known Pitfalls if any discovered
- Creates ADR if architectural decision made
```

---

### Example 2: Fixing a Production Bug (Learning Loop)

**User Report**: "The Priority API times out when loading patient lists"

**Workflow**:

**Step 1: Investigation**
```
Claude: "I'll use priority-integration agent to investigate the timeout"

[priority-integration agent examines OData queries, checks logs, identifies issue]

Finding: OData query not using pagination, loading 1000+ records
```

**Step 2: Quick Fix**
```
Claude: "Implementing pagination fix"
[priority-integration agent adds $top and $skip parameters]

Tool: judge_code_change
  approved: true (simple fix, well-tested)
```

**Step 3: Learning Loop**
```
Claude: "Creating learning documentation"

Creates: docs/learnings/bugs/2025-10-16-priority-api-pagination.md
Content:
  - Problem: OData timeout on large patient lists
  - Root Cause: Missing pagination in query
  - Solution: Added $top=100 and $skip parameters
  - Prevention: priority-api-reviewer now checks for pagination

Updates: priority-api-reviewer agent checklist
  - Added: "Check for pagination on list queries"

Updates: CLAUDE.md Known Pitfalls
  - Added: "Always paginate Priority OData list queries"

Creates: Pattern doc docs/patterns/integration/priority-pagination.md
```

---

### Example 3: Code Review Without Implementation

**User Request**: "Review this code for quality before I commit it"

**Workflow**:
```
Claude: "I'll use the reviewer agents to check your code"

1. ala-code-reviewer:
   - Checks TypeScript types ✅
   - Validates patterns against docs/patterns/ ✅
   - Flags: Missing error handling in async function ⚠️

2. priority-api-reviewer (if Priority code):
   - Validates OData syntax ✅
   - Checks applicator validation ✅

3. medical-safety-reviewer (if critical feature):
   - Validates audit trail ✅
   - Checks data integrity ✅
   - Flags: Transaction missing for multi-step operation 🚨

Claude: "Found 1 critical and 1 high priority issue. Details:"
[Provides specific feedback with file:line references]
```

---

## Complete Workflow Walkthrough

### Phase 1: Planning & Requirements (Planning Lane)

#### Step 1.1: Create Coding Task
```typescript
Tool: set_coding_task
When: Any substantial change (features, bugs, refactoring)
Output: Task ID, workflow guidance, next steps

Key decisions at this stage:
- Task size assessment (xs/s/m/l/xl)
- Research requirements determined
- Risk assessment needed?
- Design patterns enforcement needed?
```

#### Step 1.2: Handle Missing Requirements
```typescript
Tool: raise_missing_requirements (if needed)
When: Ambiguous requirements, unclear technical choices
Output: User clarification, updated requirements

Example triggers:
- "Should we use webhook or polling for notifications?"
- "Which Priority API endpoint should we use?"
- "What's the expected behavior on validation failure?"
```

#### Step 1.3: Handle Obstacles
```typescript
Tool: raise_obstacle (if needed)
When: Technical blocker, architectural decision needed
Output: User decision, direction to proceed

Example triggers:
- "Database migration will require downtime, proceed?"
- "This changes existing API contract, breaking change OK?"
- "Two approaches possible, which do you prefer?"
```

#### Step 1.4: Validate Plan
```typescript
Tool: judge_coding_plan
When: After research and design complete
Input: Detailed plan, design, research, risk assessment
Output: Approval or required improvements

Required for plan approval:
- Clear implementation steps
- Architecture/design documented
- Risks identified and mitigated
- Library selection map (prefer existing libraries)
- Internal reuse components identified
- Design patterns specified (if enforcement enabled)
```

### Phase 2: Implementation (Implementation Lane)

#### Step 2.1: Choose Implementation Strategy

**Parallel Execution** (when tasks are independent):
```
"Use database-specialist and frontend-ui agents in parallel"
```

**Sequential Execution** (when tasks depend on each other):
```
1. database-specialist creates schema
2. priority-integration adds API integration
3. frontend-ui builds UI (needs schema and API)
```

#### Step 2.2: Implementation Agents

**Available Agents**:
- `testing-specialist`: Test creation, debugging, coverage
- `priority-integration`: Priority API, OData, applicator validation
- `frontend-ui`: React components, TypeScript, Tailwind, state management
- `deployment-azure`: Azure VM, Docker, production deployment
- `database-specialist`: PostgreSQL, Sequelize, migrations
- `performance-optimization`: Bottlenecks, slow queries, optimization
- `security-audit`: Auth, JWT, vulnerability assessment

**Agent Selection**:
- Mention domain keywords to trigger auto-selection
- Explicitly request agent if needed
- Use multiple agents in parallel when possible

### Phase 3: Review (Review Lane)

#### Step 3.1: Reviewer Agents

**Review Sequence** (run all applicable reviewers):

1. **ala-code-reviewer** (always run)
   - Code quality standards
   - TypeScript best practices
   - Pattern compliance
   - Documentation quality

2. **priority-api-reviewer** (if Priority code changed)
   - OData query correctness
   - Applicator validation completeness
   - Test/prod data isolation
   - Error handling and fallbacks

3. **medical-safety-reviewer** (if safety-critical)
   - Patient safety requirements
   - Data integrity validation
   - Audit trail completeness
   - Transaction boundaries

**How to invoke**:
```
"Use ala-code-reviewer, priority-api-reviewer, and medical-safety-reviewer to review these changes"
```

#### Step 3.2: Code Change Validation
```typescript
Tool: judge_code_change
When: After implementation and reviews complete
Input: Git diff, change description
Output: Approval or required improvements

Prerequisites:
- Implementation complete
- Reviewer agents have checked
- Git diff prepared

Validates:
- Code matches approved plan
- Quality standards met
- Patterns followed
- Safety requirements satisfied
```

### Phase 4: Testing (Quality Assurance)

#### Step 4.1: Test Implementation
```typescript
Agent: testing-specialist
Tasks:
- Create unit tests for business logic
- Create integration tests for workflows
- Create E2E tests for critical paths
- Generate mock data matching real structure
- Run test suite and fix failures
```

#### Step 4.2: Test Validation
```typescript
Tool: judge_testing_implementation
When: After tests written and executed
Input: Test files list, test execution output, coverage report
Output: Approval or required improvements

Requirements:
- Critical paths have coverage
- Tests actually execute (provide real output)
- Edge cases covered
- Mock data realistic
```

### Phase 5: Completion (Final Gate)

#### Step 5.1: Task Completion Validation
```typescript
Tool: judge_coding_task_completion
When: All quality gates passed
Input: Summary, requirements met, implementation details
Output: Final approval

Validates:
- All requirements satisfied
- All quality gates passed (plan, code, testing)
- Documentation updated
- No blocking issues remain
```

#### Step 5.2: Learning Loop

**Capture Knowledge**:
1. Document successful patterns in `docs/patterns/`
2. Document any issues encountered in `docs/learnings/`
3. Create ADR if architectural decision made
4. Update CLAUDE.md if broadly applicable lesson
5. Update reviewer agents if new standard to enforce

---

## Agent Orchestration Patterns

### Pattern 1: Simple Feature Implementation

```
Request: "Add export button to treatment history"

Workflow:
1. set_coding_task (size: s)
2. frontend-ui implements button
3. ala-code-reviewer checks quality
4. judge_code_change validates
5. DONE (no formal testing for simple UI change)
```

### Pattern 2: Database Schema Change

```
Request: "Add status field to treatment table"

Workflow:
1. set_coding_task (size: m)
2. judge_coding_plan (validates migration safety)
3. database-specialist creates migration
4. medical-safety-reviewer checks data integrity
5. judge_code_change validates
6. testing-specialist adds tests
7. judge_testing_implementation validates
8. judge_coding_task_completion
9. Document in docs/learnings/
```

### Pattern 3: Priority API Integration

```
Request: "Add new Priority API endpoint for applicator details"

Workflow:
1. set_coding_task (size: m)
2. raise_missing_requirements (which endpoint? fields needed?)
3. judge_coding_plan (validates OData approach)
4. priority-integration implements
5. priority-api-reviewer checks OData correctness
6. medical-safety-reviewer checks data handling
7. judge_code_change validates
8. testing-specialist adds integration tests
9. judge_testing_implementation validates
10. judge_coding_task_completion
11. Document pattern in docs/patterns/integration/
```

### Pattern 4: Bug Fix with Learning

```
Request: "Scanner component crashes on invalid barcode"

Workflow:
1. set_coding_task (size: s)
2. frontend-ui investigates and fixes
3. medical-safety-reviewer checks error handling
4. judge_code_change validates
5. testing-specialist adds regression test
6. judge_testing_implementation validates
7. Document in docs/learnings/bugs/YYYY-MM-DD-scanner-crash.md
8. Update medical-safety-reviewer checklist
9. Update CLAUDE.md Known Pitfalls
```

### Pattern 5: Parallel Multi-Domain Feature

```
Request: "Add treatment notes with audit trail"

Workflow:
1. set_coding_task (size: l)
2. judge_coding_plan
3. PARALLEL EXECUTION:
   - database-specialist: Creates notes table, audit triggers
   - frontend-ui: Creates notes component, text editor
   - priority-integration: Syncs notes to Priority (if needed)
4. ALL REVIEWERS:
   - ala-code-reviewer
   - priority-api-reviewer
   - medical-safety-reviewer
5. judge_code_change
6. testing-specialist (unit + integration + E2E)
7. judge_testing_implementation
8. judge_coding_task_completion
9. Document pattern in docs/patterns/
10. Create ADR for notes architecture
```

---

## Learning Loop Implementation

### After Every Bug Fix

**Required Steps**:
1. Create `docs/learnings/bugs/YYYY-MM-DD-brief-description.md`
2. Extract reusable pattern to `docs/patterns/` if applicable
3. Update relevant reviewer agent checklist
4. Add prevention to CLAUDE.md if broadly applicable
5. Create regression test

**Template**:
```markdown
# [Bug Title]

**Date**: 2025-10-16
**Category**: Bug
**Severity**: High
**Area**: Priority API Integration

## Problem
Priority API returned 500 error when applicator not found

## Investigation
- Checked logs: Missing null check before accessing applicatorData.SONICSERIALNO
- Root cause: Assumed applicator always exists in response

## Solution
Added null check and proper error handling:
\`\`\`typescript
if (!applicatorData || !applicatorData.SONICSERIALNO) {
  throw new ValidationError('Applicator not found');
}
\`\`\`

## Prevention
- ✅ Added test for missing applicator scenario
- ✅ Updated priority-api-reviewer to check null handling
- ✅ Added to CLAUDE.md Known Pitfalls

## Related Files
- [backend/src/services/applicatorService.ts:145](backend/src/services/applicatorService.ts#L145)
- [backend/src/services/applicatorService.test.ts:87](backend/src/services/applicatorService.test.ts#L87)
```

### After Production Errors

**Required Steps**:
1. Create `docs/learnings/errors/YYYY-MM-DD-error-description.md`
2. Implement monitoring/alerting improvements
3. Create test that reproduces error
4. Update medical-safety-reviewer if safety-related
5. Document prevention in CLAUDE.md

### After Feature Completion

**Required Steps**:
1. Document successful patterns in `docs/patterns/[domain]/pattern-name.md`
2. Note what worked well
3. Update CLAUDE.md if pattern should be default
4. Update reviewer checklists if should be enforced

---

## Common Scenarios

### Scenario 1: "Just Write Code" (No Formal Workflow)

**When to use**: Trivial changes, documentation updates, simple fixes

**Example**:
```
"Fix typo in error message"
"Update README with new deployment steps"
"Add console.log for debugging"
```

**Workflow**: Just do it, no formal gates needed

### Scenario 2: "Standard Feature" (Full Workflow)

**When to use**: New features, refactoring, database changes

**Example**:
```
"Add treatment notes feature"
"Refactor applicator validation logic"
"Add new database table"
```

**Workflow**: Full three-lane process with all gates

### Scenario 3: "Emergency Bug Fix" (Abbreviated Workflow)

**When to use**: Production bug, high severity

**Example**:
```
"Priority API down, need immediate fallback"
"Treatment data lost, need recovery script"
```

**Workflow**:
1. set_coding_task (document the issue)
2. Implement fix quickly
3. judge_code_change (safety check)
4. Deploy
5. Complete learning loop afterwards

### Scenario 4: "Research Task" (No Code)

**When to use**: Understanding codebase, architecture review

**Example**:
```
"How does applicator validation work?"
"What's our current test coverage?"
"Explain the Priority API integration"
```

**Workflow**: No formal workflow, just investigation and explanation

### Scenario 5: "Review Existing Code" (Review Only)

**When to use**: PR review, code audit, quality check

**Example**:
```
"Review this PR for quality"
"Check if this meets our standards"
"Audit treatment tracking for safety"
```

**Workflow**:
1. Applicable reviewer agents only
2. Provide feedback
3. No implementation changes

---

## Best Practices

### DO:
✅ Use set_coding_task for substantial changes
✅ Run all applicable reviewer agents
✅ Capture learnings after every bug/error
✅ Document successful patterns
✅ Update reviewer agents as standards evolve
✅ Use parallel agent execution when possible
✅ Provide real test execution output
✅ Create ADRs for architectural decisions

### DON'T:
❌ Skip planning for medical safety features
❌ Ignore reviewer agent feedback
❌ Forget to document learnings
❌ Skip learning loop after production errors
❌ Use formal workflow for trivial changes
❌ Implement before plan approval for large features
❌ Skip quality gates for safety-critical code

---

## Success Indicators

Your compounding engineering system is working when you see:

1. **Decreasing time to implement similar features** - patterns are reused
2. **Fewer reviewer iterations** - standards are established and followed
3. **No repeated bugs** - learning loop prevents regression
4. **Growing pattern library** - successful approaches documented
5. **Evolving reviewer agents** - system learns from experience
6. **Richer CLAUDE.md** - institutional knowledge captured

---

## Getting Help

- **Workflow questions**: Consult this guide
- **Agent capabilities**: See `docs/development/CLAUDE-CODE-SUBAGENTS.md`
- **MCP tools**: See tool descriptions in system prompt
- **Patterns**: Browse `docs/patterns/` directories
- **Past issues**: Check `docs/learnings/` directories
- **Architectural decisions**: Review `docs/architecture/adr/`
