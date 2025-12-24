# ALA Medical Treatment Tracking System

## Project Context
Medical treatment tracking for seed applicator procedures with Priority ERP integration.
- **Critical**: Patient safety system - accuracy and data integrity are paramount
- **Tech Stack**: React/TypeScript/Tailwind frontend, Express/TypeScript backend, PostgreSQL
- **Integration**: Priority ERP (OData API) for patient data and applicator validation

## Safety Rules (MANDATORY)
- NEVER skip validation for medical/treatment features
- ALWAYS use transactions for multi-step treatment operations
- NEVER mix test data (test@example.com) with production data
- Position Code 99 = admin access to all sites

## Key Commands
```bash
# Development (ALWAYS use native, not Docker)
cd backend && npm run dev   # http://localhost:5000
cd frontend && npm run dev  # http://localhost:3000

# Production deployment (zero-downtime)
ssh azureuser@20.217.84.100 "cd ~/ala-improved/deployment && ./swarm-deploy"

# Tests
npm test
```

## Key Files
- [backend/src/services/priorityService.ts](backend/src/services/priorityService.ts) - Priority ERP integration
- [backend/src/services/applicatorService.ts](backend/src/services/applicatorService.ts) - Applicator validation
- [frontend/src/context/TreatmentContext.tsx](frontend/src/context/TreatmentContext.tsx) - Treatment state
- [frontend/src/components/PackageManager.tsx](frontend/src/components/PackageManager.tsx) - Applicator package management

## Documentation
- **Deployment**: [docs/deployment/](docs/deployment/)
- **Troubleshooting**: [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
- **Priority API**: [docs/PRIORITY_INTEGRATION.md](docs/PRIORITY_INTEGRATION.md)
- **API Reference**: [docs/API_REFERENCE.md](docs/API_REFERENCE.md)
- **Patterns & Gotchas**: [.claude/cc10x/patterns.md](.claude/cc10x/patterns.md)

## Environment
- **Production**: https://ala-app.israelcentral.cloudapp.azure.com (VM: 20.217.84.100)
- **Test User**: test@example.com (code: 123456)
- **Admin User**: alexs@alphatau.com (Position 99)

## When to Escalate
- Ambiguous medical/safety requirements → ask user
- Database schema changes → use database-specialist agent
- Priority API changes → use priority-integration agent
- Production deployment issues → use deployment-azure agent
