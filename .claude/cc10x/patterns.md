# ALA Project Patterns

## Quality Gates

1. **Planning Review** - Requirements clear, design sound, risks identified
2. **Implementation** - Specialist agents with domain expertise
3. **Code Review** - ala-code-reviewer, priority-api-reviewer
4. **Medical Safety Review** - MANDATORY for treatment features
5. **Testing Validation** - 100% coverage for critical paths
6. **Completion Validation** - All requirements met

## Common Gotchas

### Priority API
- OData syntax errors cause silent failures → test with Postman first
- Incomplete applicator validation → all 7 chain steps required
- Test/production data mixing → NEVER (test@example.com only for test)

### Frontend
- TreatmentContext out of sync → use proper invalidation
- Scanner errors → implement error boundaries

### Database
- Missing transactions → ALWAYS use for related updates
- Migration failures → test locally with production-like data first

### Deployment
- Missing .env → copy from .env.production.template
- Container failures → check logs: docker-compose logs
- Disk space → deploy script auto-cleans

## Integration Patterns

- **Position 99** = full admin (no site restrictions)
- **Data indicators**: Test, Real API, Fallback
- **Applicator validation**: Complete reference chain required (no shortcuts)

## Learning Loops

- **Bug Fixed** → docs/learnings/bugs/ + test + reviewer update
- **Feature Complete** → docs/patterns/ + CLAUDE.md if universal
- **Production Error** → docs/learnings/errors/ + monitoring + test

## Architectural Decisions

- PostgreSQL for ACID compliance (medical data integrity)
- Priority ERP via OData API (patient data source of truth)
- JWT auth with position-based authorization
- Docker Swarm for zero-downtime deployment
- React + TypeScript for type-safe medical UI

## External Tools

- **Gemini CLI** for large codebase analysis (>100KB) - see [docs/GEMINI_CLI.md](../../docs/GEMINI_CLI.md)
