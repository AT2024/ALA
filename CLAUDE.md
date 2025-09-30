# ALA Medical Treatment Tracking System

## Project Context
Medical treatment tracking application for seed applicator procedures with Priority ERP integration.
- **Purpose**: Real-time tracking and validation of medical seed applicator treatments
- **Critical**: Patient safety system - accuracy and data integrity are paramount
- **Tech Stack**: React/TypeScript/Tailwind frontend, Express/TypeScript backend, PostgreSQL database
- **Key Integration**: Priority ERP for patient data, site access, and applicator validation

## Core Behavioral Guidelines

### Code Modification Approach
- **Substantial changes** (features, bugs, refactoring): Start with `mcp__mcp-as-a-judge__set_coding_task`
- **Multi-step tasks**: Use `TodoWrite` to track progress and maintain visibility
- **Complex analysis**: Consider `mcp__sequential__sequentialthinking` for thorough problem-solving
- Skip formal workflows for: explanations, research-only tasks, documentation reading

### Specialized Agent Usage
Consider these agents when their domain expertise adds value:
- **Testing tasks**: `testing-specialist` for test creation, debugging, coverage
- **Priority ERP issues**: `priority-integration` for OData, applicator validation
- **UI/React work**: `frontend-ui` for components, state management, Tailwind
- **Deployment**: `deployment-azure` for Docker, Azure VM, production issues
- **Database work**: `database-specialist` for PostgreSQL, migrations, Sequelize
- **Performance**: `performance-optimization` for bottlenecks, slow queries
- **Security**: `security-audit` for auth, JWT, vulnerability assessment

### Priority Integration Context
- **Position Code 99**: Full admin access to all 100+ sites (e.g., alexs@alphatau.com)
- **Other users**: Site-restricted based on Priority PHONEBOOK authorization
- **Validation critical**: Always validate applicator reference chains and data integrity
- **Test mode**: Only use test data for test@example.com, never mix with production
- **Data source indicators**: 🧪 Test data, 🎯 Real API, ❌ Fallback

### When to Escalate or Clarify
- Ambiguous medical/safety requirements → always seek clarification
- Fundamental architecture changes → discuss approach first
- Priority API integration modifications → validate business logic
- Data integrity or patient safety concerns → raise immediately
- Missing foundational choices (framework, UI type, hosting) → use `raise_missing_requirements`

## System Architecture Essentials

### Data Flow
1. Authentication via Priority PHONEBOOK API
2. Treatment selection from Priority ORDERS
3. Applicator validation against Priority SIBD_APPLICATUSELIST
4. Real-time progress tracking in TreatmentContext
5. Persistence in PostgreSQL with Priority sync

### Key Files
- **Priority Service**: [backend/src/services/priorityService.ts](backend/src/services/priorityService.ts)
- **Applicator Logic**: [backend/src/services/applicatorService.ts](backend/src/services/applicatorService.ts)
- **Treatment State**: [frontend/src/contexts/TreatmentContext.tsx](frontend/src/contexts/TreatmentContext.tsx)
- **Scanner Component**: [frontend/src/components/Scanner.tsx](frontend/src/components/Scanner.tsx)

## Quick Reference
For detailed information, consult these specialized documents:
- **Deployment**: [docs/deployment/](docs/deployment/) - Azure VM and local setup
- **Troubleshooting**: [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) - Common issues and fixes
- **Priority API**: [docs/PRIORITY_INTEGRATION.md](docs/PRIORITY_INTEGRATION.md) - Integration rules and workflows
- **API Reference**: [docs/API_REFERENCE.md](docs/API_REFERENCE.md) - Endpoints and authentication
- **Development**: [docs/deployment/LOCAL_DEVELOPMENT.md](docs/deployment/LOCAL_DEVELOPMENT.md) - Local setup

## Environment Context
- **Production VM**: 20.217.84.100 (Azure)
- **Local Dev**: Docker Compose with hot reload
- **Test User**: test@example.com (code: 123456)
- **Admin User**: alexs@alphatau.com (Position 99)