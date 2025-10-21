# Architecture Documentation

This directory contains architectural decisions and system design documentation for the ALA Medical Treatment Tracking System.

## Directory Structure

### `/adr` - Architectural Decision Records
Document important architectural decisions using the ADR format. This creates a historical record of why certain choices were made, which prevents revisiting old discussions and helps new team members understand the system.

## ADR Template

Create files with naming: `adr/ADR-[number]-[title].md`

Example:
```markdown
# ADR-001: Use PostgreSQL for Treatment Data Storage

**Status**: Accepted
**Date**: YYYY-MM-DD
**Deciders**: [Names or roles]

## Context
What is the issue we're facing that requires a decision?

## Decision
What is the architectural decision we're making?

## Rationale
Why this particular decision?
- Reason 1
- Reason 2
- Reason 3

## Consequences

### Positive
- Benefit 1
- Benefit 2

### Negative
- Tradeoff 1
- Tradeoff 2

### Neutral
- Side effect 1

## Alternatives Considered
### Option 1: [Alternative]
- Pros: ...
- Cons: ...
- Why not chosen: ...

### Option 2: [Alternative]
- Pros: ...
- Cons: ...
- Why not chosen: ...

## Related Decisions
- Links to related ADRs
- Links to superseded decisions

## References
- [Relevant documentation]
- [Research or articles that influenced this decision]
```

## ADR Statuses

- **Proposed**: Under discussion
- **Accepted**: Decision made and being implemented
- **Deprecated**: No longer recommended but still in use
- **Superseded**: Replaced by a new decision (link to new ADR)
- **Rejected**: Considered but not adopted

## Usage

Create an ADR when making decisions about:
- Technology choices (databases, frameworks, libraries)
- System architecture changes
- API design patterns
- Security approaches
- Integration strategies
- Deployment architectures

## Benefits

1. **Historical Context**: Understand why decisions were made
2. **Onboarding**: New developers quickly grasp system design
3. **Avoid Rework**: Don't revisit settled decisions
4. **Knowledge Transfer**: Preserve institutional knowledge
5. **Communication**: Document decisions across team

## Example ADRs to Create

Consider documenting these existing decisions:
- ADR-001: Use PostgreSQL for Treatment Data Storage
- ADR-002: Integrate with Priority ERP for Patient Data
- ADR-003: Use JWT for Authentication
- ADR-004: Deploy on Azure VM with Docker
- ADR-005: Use React with TypeScript for Frontend
- ADR-006: Position Code 99 for Admin Access
- ADR-007: Test Data Strategy for Development
