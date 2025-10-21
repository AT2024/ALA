# Workflow Documentation

This directory contains documentation for development workflows, processes, and methodologies used in the ALA Medical Application.

## Directory Structure

### `/compounding`
Compounding engineering workflows that create a self-improving development system. These workflows ensure each task makes future work easier rather than harder.

## Philosophy

The compounding engineering approach follows a cycle:
1. **Plan it out in detail** - Thorough planning prevents rework
2. **Do the work** - Execute with quality and documentation
3. **Make sure it works** - Validate through multiple lenses
4. **Record learnings** - Capture knowledge for future tasks

Each iteration should:
- Leave the codebase easier to understand
- Add preventive measures for common errors
- Document patterns that work well
- Update reviewer agents with new standards

## Key Workflows

### Three-Lane Development Model

**Planning Lane**: Use mcp-as-a-judge tools for requirements and design
- `set_coding_task` - Create task and get workflow guidance
- `judge_coding_plan` - Validate plan before implementation
- Research and architectural decisions

**Implementation Lane**: Use specialized agents for domain work
- Database changes - `database-specialist`
- UI components - `frontend-ui`
- API integration - `priority-integration`
- Parallel execution when possible

**Review Lane**: Use reviewer agents for quality assurance
- Code standards - `ala-code-reviewer`
- Priority integration - `priority-integration-reviewer`
- Patient safety - `medical-safety-reviewer`
- Test coverage - `testing-specialist`

### Quality Gates

Every substantial change should pass through:
1. **Planning Review**: `judge_coding_plan` approval
2. **Code Review**: `judge_code_change` approval
3. **Testing Review**: `judge_testing_implementation` approval
4. **Completion Review**: `judge_coding_task_completion` approval

### Learning Loops

After each task:
1. Document lessons in `docs/learnings/`
2. Extract patterns to `docs/patterns/`
3. Update reviewer agents if new standards emerge
4. Add prevention measures to CLAUDE.md
5. Create tests for error scenarios

## Benefits

- **Faster iterations**: Less time explaining context
- **Higher quality**: Automated quality gates
- **Better documentation**: Knowledge captured as work happens
- **Fewer bugs**: Error prevention system learns from mistakes
- **Easier onboarding**: Documented patterns and decisions
