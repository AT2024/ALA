# Git Workflow Documentation for ALA Project

This document outlines the Git workflow process for the Accountability Log Application (ALA), explaining how to manage code from development to production environments.

## Branching Strategy

Our project follows a modified GitFlow workflow with the following branch structure:

- **`main`**: The production branch. All code here is deployable to the production environment.
- **`develop`**: The integration branch for new features. This branch represents the development environment.
- **`feature/feature-name`**: Feature branches for new development work.
- **`hotfix/issue-name`**: Hotfix branches for urgent production fixes.

## Development Workflow

### Starting a New Feature

1. Make sure you're on the develop branch:
   ```
   git checkout develop
   git pull origin develop
   ```

2. Create a new feature branch:
   ```
   ./scripts/new-feature.bat my-new-feature
   ```
   (On Linux/Mac: `./scripts/new-feature.sh my-new-feature`)

3. Make your changes to implement the feature.

4. Commit your changes:
   ```
   git add .
   git commit -m "Description of your changes"
   ```

5. Push your feature branch to the remote repository:
   ```
   git push -u origin feature/my-new-feature
   ```

6. Create a pull request from your feature branch to the `develop` branch.

7. After code review, merge the pull request into the `develop` branch.

### Deploying to Development Environment

When code is merged to the `develop` branch, the CI/CD pipeline will automatically:

1. Run tests on the code
2. If tests pass, deploy to the development environment

You can also manually trigger this workflow from GitHub Actions.

## Production Workflow

### Releasing to Production

When the code in development is ready for production:

1. Use the release script:
   ```
   ./scripts/release.bat 1.2.3
   ```
   (On Linux/Mac: `./scripts/release.sh 1.2.3`)

   If you don't specify a version, the current date will be used.

2. The script will:
   - Ensure the `develop` branch is up to date
   - Run tests
   - Merge `develop` into `main`
   - Create a version tag
   - Push changes to the remote repository

3. The production deployment workflow will start automatically. It requires:
   - Passing automated tests
   - Manual approval in GitHub Actions
   - After approval, it will deploy to production

### Hotfixes for Production Issues

If you need to fix a critical issue in production:

1. Create a hotfix branch:
   ```
   ./scripts/new-hotfix.bat critical-bug-fix
   ```
   (On Linux/Mac: `./scripts/new-hotfix.sh critical-bug-fix`)

2. Make your changes to fix the issue.

3. Commit your changes:
   ```
   git add .
   git commit -m "Fix critical issue"
   ```

4. Push your hotfix branch:
   ```
   git push -u origin hotfix/critical-bug-fix
   ```

5. Create a pull request from your hotfix branch to the `main` branch.

6. After code review, merge the pull request into the `main` branch.

7. Don't forget to also merge the changes back to the `develop` branch:
   ```
   git checkout develop
   git pull origin develop
   git merge hotfix/critical-bug-fix
   git push origin develop
   ```

## Docker Image Tags

Our Docker images follow a specific tagging convention:

- Development images: `ala-frontend:dev`, `ala-backend:dev`
- Production images: `ala-frontend:1.2.3`, `ala-backend:1.2.3` (with version numbers)

## Database Considerations

Before deploying to production, the CI/CD pipeline will:
1. Create a backup of the production database
2. Apply any new migrations

If you need to roll back a production deployment, use the database backup to restore to the previous state.

## Secrets and Environment Variables

GitHub Actions secrets are used for:
- SSH deployment keys
- Server IP addresses
- Project paths
- Database credentials

These must be configured in your GitHub repository settings under Secrets and Variables > Actions.

Required secrets for the workflow:
- `DEV_SSH_PRIVATE_KEY`: SSH key for the development server
- `DEV_SERVER_IP`: IP address of the development server
- `DEV_SERVER_USER`: Username for development server SSH access
- `DEV_PROJECT_PATH`: Path to the project directory on the development server
- `PROD_SSH_PRIVATE_KEY`: SSH key for the production server
- `PROD_SERVER_IP`: IP address of the production server
- `PROD_SERVER_USER`: Username for production server SSH access
- `PROD_PROJECT_PATH`: Path to the project directory on the production server

## Local Development

For local development, follow these practices:

1. Always create feature branches from the latest `develop` branch
2. Regularly pull changes from the `develop` branch to stay up-to-date
3. Test your changes with Docker using the development configuration:
   ```
   docker-compose -f docker-compose.dev.yml up -d
   ```
4. Create pull requests early to get early feedback (use the "Draft PR" feature)
