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
- **Design Log**: [DESIGN_LOG.md](DESIGN_LOG.md) - Active design decisions and questions
- **Design History**: [docs/design-logs/](docs/design-logs/) - Historical design records
- **Deployment**: [docs/deployment/](docs/deployment/) - Azure VM and local setup
- **Troubleshooting**: [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) - Common issues and pitfalls
- **Priority API**: [docs/PRIORITY_INTEGRATION.md](docs/PRIORITY_INTEGRATION.md) - Integration rules
- **API Reference**: [docs/API_REFERENCE.md](docs/API_REFERENCE.md) - Endpoints and auth
- **Testing**: [docs/testing/README.md](docs/testing/README.md) - Test patterns and coverage
- **Compounding Engineering**: [docs/COMPOUNDING-ENGINEERING-SETUP.md](docs/COMPOUNDING-ENGINEERING-SETUP.md) - Workflow system
- **Multi-Agent Development**: [docs/MULTI_AGENT_WORKFLOW.md](docs/MULTI_AGENT_WORKFLOW.md) - Parallel agent workflow
- **Agent Behavior**: [.claude/settings.md](.claude/settings.md) - Claude Code guidelines

## Commands
- `/design` - Start a new design log entry (for significant changes)
- `/azure-check` - Validate Local vs Azure parity before deployment
- `/spawn` - Launch background agent for analysis (see [settings.md](.claude/settings.md))
- `/test` - Run tests and verify build passes
- `/worker create <name>` - Create parallel worktree (fast, skips npm install)
- `/worker create <name> --full` - Create worktree with npm install
- `/worker remove <name>` - Remove a worktree
- `/worker list` - List active workers

## Testing
- **Backend**: `cd backend && npm test`
- **Frontend**: `cd frontend && npm test`
- **TDD**: Write failing test before fixing bugs (see [settings.md](.claude/settings.md#test-driven-development))

## Parallel Development
- **Setup**: `/worker create <name>` or `./scripts/setup-parallel-worker.sh create --branch BRANCH --name NAME`
- **Rules**: See "Parallel Worktree Isolation Rules" in [settings.md](.claude/settings.md)
- **Guide**: [docs/MULTI_AGENT_WORKFLOW.md](docs/MULTI_AGENT_WORKFLOW.md)
