# GitHub Setup Guide

This document explains how to configure GitHub for the ALA Medical Application.

## Branch Protection Rules

Configure these in GitHub: **Settings → Branches → Add branch protection rule**

### Main Branch (`main`)

| Setting | Value |
|---------|-------|
| Branch name pattern | `main` |
| Require a pull request before merging | ❌ (solo dev) |
| Require status checks to pass | ✅ |
| Required checks | `lint`, `test-frontend`, `test-backend` |
| Require branches to be up to date | ✅ |
| Do not allow force pushes | ✅ |
| Allow deletions | ❌ |

### Production Branch (`production`)

| Setting | Value |
|---------|-------|
| Branch name pattern | `production` |
| Require a pull request before merging | ✅ |
| Require approvals | 0 (self-review) |
| Require status checks to pass | ✅ |
| Required checks | ALL checks |
| Do not allow force pushes | ✅ |
| Allow deletions | ❌ |

## Auto-Merge Setup

Enable auto-merge in **Settings → General → Pull Requests**:
- ✅ Allow auto-merge
- ✅ Automatically delete head branches

## Workflow

```
feature/* → main (auto-deploy to staging) → production (manual deploy)
```

### Daily Workflow

1. Work on `main` branch for small changes
2. Use `feature/*` branches for larger features
3. CI runs automatically on push
4. Auto-merge to main when checks pass
5. Create PR to `production` when ready to deploy

### Commit Messages

Use conventional commits (enforced by commitlint):

```
feat: add new applicator validation
fix: resolve signature modal bug
docs: update API reference
refactor: simplify treatment service
test: add priority integration tests
chore: update dependencies
```

### Creating a Feature Branch

```bash
git checkout -b feature/add-barcode-scanning
# make changes
git add .
git commit -m "feat: add barcode scanning support"
git push -u origin feature/add-barcode-scanning
gh pr create --fill
```

### Deploying to Production

```bash
# Ensure main is up to date
git checkout main
git pull

# Create PR to production
gh pr create --base production --title "Release: v1.x.x" --body "Summary of changes"

# After self-review, merge
gh pr merge --auto
```

## Useful Commands

```bash
# Check PR status
gh pr status

# View CI check status
gh pr checks

# Create issue
gh issue create --title "Bug: ..." --body "..."

# List open issues
gh issue list

# Link PR to issue (auto-close)
# In commit message: "fix: resolve auth issue. Closes #123"
```
