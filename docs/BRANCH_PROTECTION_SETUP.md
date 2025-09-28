# Branch Protection Rules Setup Guide

## Overview

This guide provides step-by-step instructions to configure branch protection rules for the ALA medical application's new Git flow structure.

## Branch Protection Configuration

### 1. Production Branch Protection (Most Restrictive)

**Navigation**: Repository → Settings → Branches → Add rule

**Branch name pattern**: `production`

**Settings to Enable**:
- ✅ **Require a pull request before merging**
  - Required number of reviewers: **2**
  - ✅ Dismiss stale pull request approvals when new commits are pushed
  - ✅ Require review from code owners (if CODEOWNERS file exists)
- ✅ **Require status checks to pass before merging**
  - ✅ Require branches to be up to date before merging
  - Required status checks:
    - `backend-tests` (will be created in Phase 4)
    - `frontend-e2e-tests`
    - `security-scan`
    - `staging-deployment-success`
- ✅ **Require conversation resolution before merging**
- ✅ **Restrict pushes that create files larger than 100 MB**
- ✅ **Do not allow bypassing the above settings**

**Purpose**: Production branch should only receive thoroughly tested, approved code via pull requests from main branch.

---

### 2. Main Branch Protection (Moderate)

**Branch name pattern**: `main`

**Settings to Enable**:
- ✅ **Require a pull request before merging**
  - Required number of reviewers: **1**
  - ✅ Dismiss stale pull request approvals when new commits are pushed
- ✅ **Require status checks to pass before merging**
  - ✅ Require branches to be up to date before merging
  - Required status checks:
    - `backend-tests`
    - `frontend-tests`
    - `integration-tests`
    - `security-scan`
- ✅ **Require conversation resolution before merging**
- ✅ **Restrict pushes that create files larger than 100 MB**
- ✅ **Allow force pushes** (disabled)
- ✅ **Allow deletions** (disabled)

**Purpose**: Main branch should receive tested code from develop branch, ready for staging deployment.

---

### 3. Develop Branch Protection (Basic)

**Branch name pattern**: `develop`

**Settings to Enable**:
- ✅ **Require status checks to pass before merging**
  - Required status checks:
    - `unit-tests`
    - `lint`
    - `build`
- ✅ **Restrict pushes that create files larger than 100 MB**
- ✅ **Allow force pushes** (disabled - keep clean history)

**Purpose**: Develop branch accepts feature branches after basic quality checks.

---

## Additional Repository Settings

### Default Branch Configuration
1. Go to **Repository → Settings → General → Default branch**
2. Change default branch from `main` to `develop`
3. This ensures new features branch from develop by default

### Auto-merge Configuration
1. Go to **Repository → Settings → General → Pull Requests**
2. ✅ Enable "Allow auto-merge"
3. ✅ Enable "Automatically delete head branches"

### Security Settings
1. Go to **Repository → Settings → Security & analysis**
2. ✅ Enable "Dependency graph"
3. ✅ Enable "Dependabot alerts"
4. ✅ Enable "Dependabot security updates"
5. ✅ Enable "Secret scanning"

## Workflow Integration

### Status Checks Creation
The following status checks will be automatically created once the enhanced GitHub Actions workflows are implemented (Phase 3):

- `backend-tests`: Jest unit and integration tests
- `frontend-tests`: Vitest unit tests
- `frontend-e2e-tests`: Playwright E2E tests
- `integration-tests`: Full API integration tests
- `security-scan`: Trivy security scanning
- `lint`: ESLint and TypeScript checks
- `build`: Successful Docker builds

### Emergency Access
- Repository admins can bypass branch protection in emergencies
- All bypasses are logged in the repository's security audit log
- Use sparingly and document in commit messages

## Verification Steps

After configuring branch protection:

1. **Test develop branch**: Create a test feature branch and ensure it requires status checks
2. **Test main branch**: Create a PR from develop to main and verify review requirements
3. **Test production branch**: Create a PR from main to production and verify strict requirements

## Best Practices

### For Development Team
- Always branch from `develop` for new features
- Use descriptive branch names: `feature/applicator-validation`, `fix/priority-api-timeout`
- Ensure all status checks pass before requesting review
- Address all review comments before merging

### For Code Reviews
- Review for medical data handling compliance
- Verify Priority API integration patterns
- Check for proper error handling and logging
- Validate test coverage for new functionality

### For Emergency Fixes
- Use `hotfix/` branches from production for critical production issues
- Follow accelerated review process but maintain quality standards
- Deploy hotfixes to production immediately after merge

---

## Implementation Checklist

- [ ] Configure production branch protection (2 reviewers, all checks)
- [ ] Configure main branch protection (1 reviewer, tests required)
- [ ] Configure develop branch protection (status checks only)
- [ ] Change default branch to develop
- [ ] Enable auto-merge and auto-delete
- [ ] Enable security scanning features
- [ ] Test branch protection with sample PRs
- [ ] Document emergency bypass procedures

**Next Phase**: Once branch protection is configured, we'll proceed to Phase 2: Staging Environment Setup.