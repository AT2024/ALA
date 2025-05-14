# ALA Project Git Workflow Guide

This guide provides practical instructions for developers working on the Accountability Log Application (ALA) to properly use our Git workflow system.

## Getting Started

Our project uses a structured Git workflow with separate branches for development and production:

- `main` branch: Contains production-ready code
- `develop` branch: Integration branch for all new features
- Feature branches: For developing new features
- Hotfix branches: For urgent production fixes

## Daily Development Workflow

### 1. Starting a New Feature

When you begin work on a new feature, always start by creating a properly named feature branch:

```bash
# Navigate to your project directory
cd C:\path\to\ala-improved

# For Windows
scripts\new-feature.bat my-feature-name

# For Linux/Mac
./scripts/new-feature.sh my-feature-name
```

This automatically:
- Checks out the latest develop branch
- Creates a new feature branch with the proper naming convention
- Sets up the branch for pushing to GitHub

### 2. Working on Your Feature

As you develop your feature:

- Make frequent, small commits with clear messages
- Keep your feature branch updated with the latest changes from develop:
  ```bash
  git checkout develop
  git pull
  git checkout feature/my-feature-name
  git merge develop
  ```

- Test your changes locally using the development Docker configuration:
  ```bash
  docker-compose -f docker-compose.dev.yml up -d
  ```

### 3. Completing Your Feature

When your feature is complete:

1. Ensure all tests pass locally
2. Push your branch to GitHub:
   ```bash
   git push -u origin feature/my-feature-name
   ```

3. Create a pull request from your feature branch to `develop` on GitHub
4. Request code review from team members
5. After approval, merge your pull request into the develop branch

The CI/CD pipeline will automatically deploy your changes to the development environment when merged to develop.

## Promoting to Production

When the team decides the code in develop is ready for production:

```bash
# For Windows
scripts\release.bat [version]

# For Linux/Mac
./scripts/release.sh [version]
```

The version parameter is optional - if omitted, the current date will be used as the version.

This script will:
1. Ensure all tests pass
2. Merge develop into main
3. Create a version tag
4. Push changes to GitHub
5. Trigger the production deployment workflow

**Important**: The production deployment requires manual approval in GitHub Actions before the actual deployment occurs.

## Handling Production Issues

If you discover a critical issue in production that needs immediate attention:

```bash
# For Windows
scripts\new-hotfix.bat issue-description

# For Linux/Mac
./scripts/new-hotfix.sh issue-description
```

This will:
1. Create a hotfix branch from main
2. Set you up to fix the issue

After fixing the issue:
1. Push your hotfix branch
2. Create a pull request to main
3. After approval and merging, the fix will be deployed to production
4. Don't forget to also merge the hotfix back to develop:
   ```bash
   git checkout develop
   git pull
   git merge hotfix/issue-description
   git push
   ```

## Deployment Process

Our project has automated deployment using GitHub Actions:

1. **Development Environment**:
   - Automatically deployed when code is merged to the develop branch
   - Running at: [dev.ala-app.example.com](https://dev.ala-app.example.com)

2. **Production Environment**:
   - Requires manual approval after automated tests pass
   - Database backup is created before each deployment
   - Running at: [ala-app.example.com](https://ala-app.example.com)

## Database Migrations

When making changes that require database schema updates:

1. Always create proper migration scripts
2. Test migrations thoroughly in development
3. Document the migration in pull request notes
4. Database backups are automatically created before production deployments

## Docker Images

Our application uses Docker for consistent environments:

- Development: Uses volumes for live code changes
- Production: Builds optimized images with version tags

To test with Docker in development:
```bash
docker-compose -f docker-compose.dev.yml up -d
```

## Troubleshooting

### Common Issues

1. **"Cannot push to remote" errors**:
   - Ensure you have the latest code: `git pull origin develop`
   - Check your GitHub credentials

2. **Merge conflicts**:
   - Pull the latest develop branch
   - Resolve conflicts in your code editor
   - Complete the merge: `git merge --continue`

3. **Failed deployments**:
   - Check the GitHub Actions logs for details
   - Fix issues in your feature branch and create a new PR

### Getting Help

If you encounter issues with the Git workflow:

1. Check the detailed documentation in `docs/GIT-WORKFLOW.md`
2. Contact the DevOps team for assistance
3. For urgent production issues, alert the on-call developer

## Best Practices

1. Never commit directly to main or develop branches
2. Keep feature branches small and focused
3. Use descriptive commit messages
4. Run tests locally before pushing
5. Always create pull requests for code review
6. Document API changes or configuration requirements in PR descriptions
7. Keep the develop branch deployable at all times

Following these guidelines will help maintain code quality and ensure smooth deployments from development to production.
