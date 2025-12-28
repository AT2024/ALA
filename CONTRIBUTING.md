# Contributing to ALA Medical Application

## Development Workflow

### Branch Strategy

```
production  ← Protected, manual deploy
    ↑
  main      ← Working branch, auto-deploys to staging
    ↑
feature/*   ← For larger features
```

### Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting (no code change)
- `refactor`: Code change (no new feature, no bug fix)
- `perf`: Performance improvement
- `test`: Adding tests
- `build`: Build system changes
- `ci`: CI configuration
- `chore`: Maintenance

**Examples:**
```bash
feat: add applicator barcode scanning
fix: resolve signature modal validation bug
docs: update API reference for treatments
refactor: simplify priority service error handling
```

### Pre-commit Hooks

Husky runs automatically on commit:
- **pre-commit**: Lint staged files
- **commit-msg**: Validate commit message format

### Running Tests

```bash
# Frontend tests
cd frontend && npm test

# Backend tests
cd backend && npm test

# Both
npm run test:all
```

## Pull Request Guidelines

1. **Title**: Use conventional commit format
2. **Description**: Fill out the PR template
3. **Medical Safety**: Always complete the safety checklist
4. **Tests**: Ensure all tests pass
5. **Review**: Self-review before merging to production

## Code Style

- TypeScript for all new code
- ESLint + Prettier for formatting
- Run `npm run lint` before committing

## Security

- Never commit secrets or credentials
- Use environment variables for configuration
- Review Dependabot PRs promptly
