# ALA Medical Treatment Tracking System

## Project Context

Medical treatment tracking application for source applicator procedures with Priority ERP integration.

- **Purpose**: Real-time tracking and validation of medical source applicator treatments
- **Critical**: Patient safety system - accuracy and data integrity are paramount
- **Tech Stack**: React/TypeScript/Tailwind frontend, Express/TypeScript backend, PostgreSQL database
- **Key Integration**: Priority ERP for patient data, site access, and applicator validation

## Key Files

- **Priority Service**: [backend/src/services/priorityService.ts](backend/src/services/priorityService.ts)
- **Applicator Logic**: [backend/src/services/applicatorService.ts](backend/src/services/applicatorService.ts)
- **Treatment State**: [frontend/src/context/TreatmentContext.tsx](frontend/src/context/TreatmentContext.tsx)
- **Treatment UI**: [frontend/src/pages/Treatment/TreatmentDocumentation.tsx](frontend/src/pages/Treatment/TreatmentDocumentation.tsx)

## Environment

- **Production**: https://ala-app.israelcentral.cloudapp.azure.com (Azure VM: 20.217.84.100)
- **Local Dev**: `npm run dev` in both frontend/ and backend/ directories
- **Test User**: test@example.com (code: 123456)
- **Admin User**: amitaik@alphatau.com (Position 99 = full site access)

## Quick Deploy

```bash
ssh azureuser@20.217.84.100 "cd ~/ala-improved/deployment && ./swarm-deploy"
```

## Documentation

- **Design Log**: [DESIGN_LOG.md](DESIGN_LOG.md) - Active design decisions
- **Troubleshooting**: [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) - Common issues
- **Priority API**: [docs/PRIORITY_INTEGRATION.md](docs/PRIORITY_INTEGRATION.md) - Integration rules
- See `docs/` for deployment, testing, API reference, multi-agent workflow, and more.

## Testing

- **Backend**: `cd backend && npm test`
- **Frontend**: `cd frontend && npm test`
- **TDD**: Write failing test before fixing bugs

## Database Migrations

- **Development**: Auto-sync via `sequelize.sync({ alter: true })`
- **Production**: ALWAYS create migration in `backend/src/migrations/` (see `.claude/rules/database.md`)

## Parallel Development

- Use `/worker create <name>` for isolated worktrees with dedicated databases
- See [docs/MULTI_AGENT_WORKFLOW.md](docs/MULTI_AGENT_WORKFLOW.md) for details

## Compact Instructions

When compacting, preserve:

- Active treatment state (patient ID, applicator serial, treatment status)
- Priority ERP endpoints or OData queries under investigation
- Pending migration files not yet applied to production
- Current worktree name and branch if in parallel dev session
- Any safety validation failures or blocked applicators discovered this session

<!-- TOKEN_OPTIMIZER:MODEL_ROUTING -->

## Model & Thinking Routing (by Token Optimizer)

Based on last 30 days: 76% Opus, 5% Sonnet, 19% Haiku.

- Simple edits, grep, formatting: Sonnet, no extended thinking
- Architecture, debugging, synthesis: Opus with thinking
- Subagents for data gathering: Haiku
- WARNING: 76% Opus is likely overkill. Route simple tasks to Sonnet.
  <!-- updated 2026-04-12T18:52 -->
  <!-- /TOKEN_OPTIMIZER:MODEL_ROUTING -->
