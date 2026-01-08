# ALA Design Log

> Living document tracking active design discussions and decisions.
> For detailed historical records, see `docs/design-logs/`.

## Current Focus: System Optimization & Environment Alignment

### Active Design Questions
- [ ] How should Local and Azure environments stay synchronized? (owner: team, due: ongoing)
- [ ] What patterns ensure safe production deployments? (owner: team, due: ongoing)

### Environment Notes

#### Local Development
- Port: 3000 (frontend), 5000 (backend)
- Database: Local PostgreSQL
- Start: `npm run dev` in both frontend/ and backend/

#### Azure Production
- URL: https://ala-app.israelcentral.cloudapp.azure.com
- VM: 20.217.84.100
- Deploy: `ssh azureuser@20.217.84.100 "cd ~/ala-improved/deployment && ./swarm-deploy"`
- **Before Azure changes**: Check latest design log entry

### Recent Decisions
| Date | Decision | Log Link |
|------|----------|----------|
| 2026-01-07 | Environment Alignment Strategy | [Link](docs/design-logs/2026-01-environment-alignment.md) |

---

## Quick Commands
- `/design` - Start a new design log entry
- `/azure-check` - Validate Azure parity before deployment

## Four Pillars (for AI collaboration)

1. **Read Before Write** - Check this log before significant changes
2. **Design Before Implement** - Create log entry before production code
3. **Immutable History** - Append results, don't edit approved designs
4. **Socratic Method** - Ask questions here; answers become permanent record

## What is a "Significant Change"?

A change requires a design log entry if it involves:
- **Database schema** - migrations, new tables, column modifications
- **API contracts** - new endpoints, breaking changes, auth modifications
- **Azure infrastructure** - Docker config, networking, environment variables
- **Security** - authentication, permissions, data handling patterns

---

## Design Log Index

| ID | Title | Status | Created |
|----|-------|--------|---------|
| DL-001 | [Environment Alignment](docs/design-logs/2026-01-environment-alignment.md) | Draft | 2026-01-07 |
