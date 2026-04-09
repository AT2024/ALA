# Compounding Engineering Workflows

Welcome to the compounding engineering system for the ALA Medical Application!

## What is Compounding Engineering?

A self-improving development system where **each task makes future work easier, not harder**.

Key principles:

- **Plan in detail** before implementing
- **Do the work** with quality and documentation
- **Validate thoroughly** through multiple gates
- **Record learnings** to prevent repetition

## Quick Navigation

### 🚀 Getting Started

- **[QUICK-START.md](QUICK-START.md)** - Start here! 5-minute introduction
- **[../../COMPOUNDING-ENGINEERING-SETUP.md](../../COMPOUNDING-ENGINEERING-SETUP.md)** - Complete setup documentation

### 📚 Complete Guide

- **[COMPOUNDING-WORKFLOW-GUIDE.md](COMPOUNDING-WORKFLOW-GUIDE.md)** - Detailed workflow walkthrough with examples

### 🔧 Configuration

- **[../../../CLAUDE.md](../../../CLAUDE.md)** - Enhanced with compounding sections
- **[../../../.claude/agents/](../../../.claude/agents/)** - All 10 agents (7 implementation + 3 reviewers)

### 📖 Supporting Documentation

- **[../../learnings/](../../learnings/)** - Bug fixes, errors, optimizations
- **[../../patterns/](../../patterns/)** - Reusable patterns
- **[../../architecture/adr/](../../architecture/adr/)** - Architectural decisions
- **[../../development/CLAUDE-CODE-SUBAGENTS.md](../../development/CLAUDE-CODE-SUBAGENTS.md)** - Agent details

## The Three-Lane Model

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  PLANNING   │────>│IMPLEMENTATION│────>│   REVIEW    │
│             │     │              │     │             │
│ mcp-as-a-   │     │ 7 specialist │     │ 3 reviewer  │
│ judge tools │     │ agents build │     │ agents check│
└─────────────┘     └──────────────┘     └─────────────┘
```

## The 10-Agent System

### Implementation Agents (Build Code)

1. **testing-specialist** - Test creation, debugging, coverage
2. **priority-integration** - Priority API, OData, applicator validation
3. **frontend-ui** - React components, TypeScript, Tailwind
4. **deployment-azure** - Azure VM, Docker, production
5. **database-specialist** - PostgreSQL, migrations, Sequelize
6. **performance-optimization** - Bottlenecks, optimization
7. **security-audit** - Auth, JWT, vulnerabilities

### Reviewer Agents (Ensure Quality) ⭐ NEW!

8. **ala-code-reviewer** - Code quality & patterns
9. **priority-api-reviewer** - Priority integration correctness
10. **medical-safety-reviewer** - Patient safety & data integrity

## Quality Gates (mcp-as-a-judge)

Every substantial change passes through:

1. **set_coding_task** - Create task and get workflow guidance
2. **judge_coding_plan** - Validate plan before implementation
3. **judge_code_change** - Review implementation quality
4. **judge_testing_implementation** - Validate test coverage
5. **judge_coding_task_completion** - Final approval

## Learning Loops

After every bug, error, or feature:

1. Document in appropriate `docs/learnings/` subdirectory
2. Extract patterns to `docs/patterns/`
3. Update reviewer agents
4. Update CLAUDE.md
5. Create ADRs for architectural decisions

**Result**: System learns and prevents repetition!

## When to Use What

### Full Workflow (All Gates)

- New features
- Database schema changes
- Priority API integration
- Medical workflows
- Patient safety features

### Abbreviated Workflow

- Bug fixes (task + implement + review)
- Simple UI changes
- Configuration updates

### No Workflow

- Typo fixes
- Documentation updates
- Trivial changes

## Example Commands

### Start a Feature

```
"Add treatment notes feature using the full workflow"
```

### Parallel Implementation

```
"Use database-specialist and frontend-ui agents in parallel"
```

### Review Code

```
"Use ala-code-reviewer and medical-safety-reviewer to review this"
```

### Fix a Bug with Learning

```
"Fix the scanner crash bug and document the learning"
```

## Success Indicators

Your system is working when:

- ✅ Similar features implemented faster over time
- ✅ Fewer bugs reaching production
- ✅ Growing pattern library
- ✅ Richer CLAUDE.md with captured knowledge
- ✅ Reviewer agents catching issues automatically

## Need Help?

- **Can't find the right workflow?** → Read [COMPOUNDING-WORKFLOW-GUIDE.md](COMPOUNDING-WORKFLOW-GUIDE.md)
- **New to the system?** → Start with [QUICK-START.md](QUICK-START.md)
- **Want agent details?** → See [../../development/CLAUDE-CODE-SUBAGENTS.md](../../development/CLAUDE-CODE-SUBAGENTS.md)
- **Need pattern templates?** → Check [../../patterns/README.md](../../patterns/README.md)
- **Creating an ADR?** → Use template in [../../architecture/README.md](../../architecture/README.md)

## Philosophy in Action

> "Plan it out in detail" → "Do the work" → "Make sure it works" → "Record learnings"

Each cycle makes the next one easier. That's compounding engineering!

---

**Ready to start?** Read [QUICK-START.md](QUICK-START.md) and try your first workflow today!
