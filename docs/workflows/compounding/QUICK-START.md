# Compounding Engineering Quick Start

Get started with your new compounding engineering workflow in 5 minutes!

## What You Now Have

### 10 Specialized Agents

**7 Implementation Agents** (write code):
1. `testing-specialist` - Creates tests
2. `priority-integration` - Handles Priority API
3. `frontend-ui` - Builds React components
4. `deployment-azure` - Manages Azure deployment
5. `database-specialist` - Database operations
6. `performance-optimization` - Optimizes performance
7. `security-audit` - Security reviews

**3 Reviewer Agents** (review quality):
1. `ala-code-reviewer` - Code quality & patterns
2. `priority-api-reviewer` - Priority integration correctness
3. `medical-safety-reviewer` - Patient safety & data integrity

### MCP-as-a-Judge Tools

Quality gates that validate your work:
- `set_coding_task` - Start with planning
- `judge_coding_plan` - Validate design
- `judge_code_change` - Review implementation
- `judge_testing_implementation` - Validate tests
- `judge_coding_task_completion` - Final approval

### Knowledge Capture System

Directories for learning loops:
- `docs/learnings/` - Bug fixes and production errors
- `docs/patterns/` - Successful patterns
- `docs/architecture/adr/` - Architectural decisions

## Your First Task with the New System

Let's walk through a simple feature to see how it all works:

### Example: Add "Treatment Notes" Field

**Step 1: Start with Planning**
```
You: "I need to add a notes field where nurses can add comments during treatment"

Claude: "I'll use set_coding_task to plan this feature"
[Creates task with task_id, gets workflow guidance]
```

**Step 2: Get Plan Approval**
```
Claude: "Let me create a detailed plan and validate it"
[Researches patterns, designs solution, calls judge_coding_plan]

Result: Plan approved ✅
Next: Implement the changes
```

**Step 3: Parallel Implementation**
```
You: "Use database-specialist and frontend-ui in parallel"

[database-specialist creates migration + model]
[frontend-ui creates notes textarea component]
[Both work simultaneously - saves time!]
```

**Step 4: Quality Review**
```
Claude: "Implementation done. Running reviews..."

[ala-code-reviewer: Code quality ✅]
[medical-safety-reviewer: Audit trail check ✅]
[judge_code_change: Final validation ✅]
```

**Step 5: Testing**
```
Claude: "Use testing-specialist to add tests"

[testing-specialist creates unit + integration tests]
[judge_testing_implementation validates coverage ✅]
```

**Step 6: Complete & Learn**
```
[judge_coding_task_completion: Final approval ✅]

Claude: "Task complete! Documenting what we learned..."
- Created pattern: docs/patterns/frontend/text-input-fields.md
- Updated CLAUDE.md with lesson
```

## Simple Commands to Try Right Now

### For Implementation
```
"Add export button to treatment history"
→ Automatically triggers frontend-ui agent

"Fix Priority API timeout issue"
→ Automatically triggers priority-integration agent

"Create database migration for new field"
→ Automatically triggers database-specialist agent
```

### For Review
```
"Review this code before I commit"
→ Triggers appropriate reviewer agents

"Check if this Priority query is correct"
→ Triggers priority-api-reviewer

"Audit this for medical safety"
→ Triggers medical-safety-reviewer
```

### For Full Workflow
```
"Add nurse tracking to treatments using the full workflow"
→ Goes through all quality gates

"Fix the scanner crash bug with proper learning loop"
→ Includes documentation and prevention
```

## The Three-Lane Concept

Think of it as an assembly line with quality checks:

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  PLANNING   │ --> │IMPLEMENTATION│ --> │   REVIEW    │
│             │     │              │     │             │
│ mcp-as-a-   │     │ 7 specialist │     │ 3 reviewer  │
│ judge tools │     │ agents build │     │ agents check│
│ plan & gate │     │ the features │     │ for quality │
└─────────────┘     └──────────────┘     └─────────────┘
```

Each feature flows through all three lanes before it's done.

## Learning Loops - The Secret Sauce

After you fix a bug or complete a feature, the system learns:

### Bug Fix Learning Loop
```
Bug Fixed
  ↓
Document in docs/learnings/bugs/
  ↓
Extract pattern if reusable
  ↓
Update reviewer agent to catch similar issues
  ↓
Future bugs in this category: PREVENTED ✅
```

### This Makes Each Task Easier
- First time: Takes full time
- Second similar task: Reuses patterns, goes faster
- Third similar task: Even faster, reviewers auto-catch issues
- **Result**: Compounding efficiency!

## When to Use What

### Use Full Workflow For:
- New features
- Database schema changes
- Priority API integration
- Medical workflows
- Anything affecting patient safety

### Use Abbreviated Workflow For:
- Bug fixes (set_coding_task + implementation + review)
- Simple UI changes
- Configuration updates

### Skip Workflow For:
- Typo fixes
- Documentation updates
- Console.log debugging
- Trivial changes

## Your Enhanced CLAUDE.md

Your `CLAUDE.md` now has a whole new section with:
- **Decision Log**: Why we chose PostgreSQL, Priority API, etc.
- **Known Pitfalls**: Common mistakes and how to avoid them
- **Testing Patterns**: What test strategies work
- **Quality Gates**: The 6-gate approval process
- **Learning Loops**: How to capture knowledge

## Next Steps

1. **Try it out**: Ask for a simple feature using the workflow
2. **See the agents**: Request different agents to see how they work
3. **Create your first learning**: After fixing a bug, document it in `docs/learnings/`
4. **Document a pattern**: Found something that works well? Add it to `docs/patterns/`
5. **Write an ADR**: Made an architectural decision? Document why in `docs/architecture/adr/`

## Pro Tips

**Parallel is Faster**:
```
"Use database-specialist and frontend-ui in parallel"
→ Both agents work simultaneously
```

**Be Specific for Auto-Selection**:
```
"Fix Priority OData query"
→ Auto-triggers priority-integration agent

"React component rendering slowly"
→ Auto-triggers frontend-ui agent
```

**Review Before Committing**:
```
"Review this code with all applicable reviewers"
→ Gets thorough quality check before commit
```

## Help & References

- **Full Guide**: [COMPOUNDING-WORKFLOW-GUIDE.md](COMPOUNDING-WORKFLOW-GUIDE.md)
- **Agent Details**: [docs/development/CLAUDE-CODE-SUBAGENTS.md](../../development/CLAUDE-CODE-SUBAGENTS.md)
- **Enhanced CLAUDE.md**: [CLAUDE.md](../../../CLAUDE.md)
- **Pattern Examples**: [docs/patterns/](../../patterns/)
- **ADR Template**: [docs/architecture/README.md](../../architecture/README.md)

## What Success Looks Like

After a few weeks, you should see:
- ✅ Faster implementation of similar features
- ✅ Fewer bugs making it to production
- ✅ Growing pattern library you reference
- ✅ Richer CLAUDE.md with lessons learned
- ✅ Reviewer agents catching issues automatically
- ✅ Less context switching and explaining

**That's compounding engineering**: Each task makes future tasks easier!

---

Ready to start? Just ask Claude to help with any feature using "the full workflow" and you'll see it all in action!
