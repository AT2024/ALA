# ALA Environment Configuration System

This directory contains all environment configuration files for the ALA (Alpha Tau Medical Treatment Tracking) project. The system is designed for security, maintainability, and ease of use across different deployment environments.

## 📁 File Structure (After Cleanup - October 2025)

```
environments/
├── .env.development        # ✅ ACTIVE: Local Docker development
├── .env.example            # 📄 Template with all available options
├── .env.local.template     # 📄 Template for personal overrides
├── .env.staging.template   # 📄 Template for staging environment
└── README.md              # This documentation

../azure/
├── .env.azure.https        # ✅ ACTIVE: Azure production (HTTPS)
├── .env.azure.https.template  # 📄 Template for Azure HTTPS
└── .env.staging.template   # 📄 Template for staging
```

**Note:** Cleanup performed on 2025-10-21 - Removed 7 confusing/duplicate files

## 🔄 Environment Loading Priority

The application loads environment variables in this order (highest to lowest priority):

1. **`.env.local`** (git-ignored) - Personal/sensitive overrides
2. **`environments/.env.development`** or **`environments/.env.production`** - Environment-specific settings
3. **`environments/.env.example`** - Fallback defaults

## 🚀 Quick Start

### For New Developers

1. **Set up your local environment:**
   ```bash
   # Use the automated setup script
   node scripts/setup.js setup
   
   # Or manually copy the template
   cp environments/.env.local.template .env.local
   ```

2. **Edit `.env.local` with your personal settings:**
   ```bash
   # Generate a secure JWT secret
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   
   # Add it to your .env.local file
   echo "JWT_SECRET=your_generated_secret" >> .env.local
   ```

3. **Validate your configuration:**
   ```bash
   node scripts/setup.js validate
   ```

### For Docker Development

Use the development environment as-is:
```bash
# The development environment is pre-configured for Docker
docker-compose -f docker-compose.dev.yml up
```

### For Local Development (without Docker)

Override the database URL in your `.env.local`:
```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/ala_db
```

## 🔒 Security Best Practices

### Sensitive Data Handling

- **Never commit `.env.local`** - It's automatically git-ignored
- **Use `.env.local` for all sensitive overrides** (passwords, API keys, etc.)
- **Rotate secrets regularly** - Especially JWT secrets and database passwords
- **Use strong, unique passwords** - Don't reuse passwords across environments

### Template Files

- **`.env.example`** - Safe defaults for documentation
- **`.env.local.template`** - Template for personal overrides
- **Environment-specific files** - May contain placeholder values that must be overridden

### Production Security

- **Always override sensitive values** in production
- **Use environment-specific secrets management** (Azure Key Vault, AWS Secrets Manager, etc.)
- **Enable SSL/TLS** for all production connections
- **Audit environment access** regularly

## 📋 Available Environment Variables

### Backend Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@host:5432/db` |
| `ENABLE_SSL` | Enable SSL for database | `true` or `false` |
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Node environment | `development` or `production` |
| `JWT_SECRET` | JWT signing secret | `your-secret-key` |
| `JWT_EXPIRES_IN` | JWT expiration time | `1d`, `24h`, `3600` |

### Priority System Integration

| Variable | Description | Current Value (Production) |
|----------|-------------|---------------------------|
| `PRIORITY_URL` | Priority API endpoint | `https://t.eu.priority-connect.online/odata/Priority/tabbtbc6.ini/test24` |
| `PRIORITY_USERNAME` | Priority API username | `API` |
| `PRIORITY_PASSWORD` | Priority API password | `Ap@123456` |
| `SYNC_WITH_PRIORITY` | Enable Priority sync | `true` |
| `BYPASS_PRIORITY_EMAILS` | Bypass Priority for test users | `test@example.com` |

**⚠️ Important Priority Notes:**
- ✅ **Current (working):** `https://t.eu.priority-connect.online/odata/Priority/tabbtbc6.ini/test24`
- ❌ **Old (broken):** `https://priority.alphatau1.com/odata/Priority/tabula.ini/a100722/` - DO NOT USE
- Test user `test@example.com` (code: `123456`) bypasses Priority API for development

### Frontend Configuration (Vite)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:5000/api` |
| `VITE_PRIORITY_API_URL` | Priority API URL | `https://priority.example.com/...` |
| `VITE_ENVIRONMENT` | Application environment | `development` or `production` |
| `VITE_OFFLINE_STORAGE` | Enable offline storage | `true` or `false` |

### Docker Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_USER` | Database username for Docker | `postgres` |
| `DB_PASSWORD` | Database password for Docker | `postgres` |
| `DB_NAME` | Database name for Docker | `ala_db` |
| `API_URL` | Internal API URL for Docker | `http://api:5000` |

## 🛠️ Environment Management Tools

### Docker Commands (Current System)

**Local Development:**
```bash
cd deployment/docker
docker-compose -f docker-compose.dev.yml up -d
docker logs ala-api-docker --tail 50
docker-compose -f docker-compose.dev.yml down
```

**Azure Production:**
```bash
ssh azureuser@20.217.84.100
cd ~/ala-improved/deployment/azure
docker-compose -f docker-compose.azure.yml --env-file .env.azure.https up -d --build
docker logs ala-api-azure --tail 50
```

**Reload Environment Variables (Important!):**
```bash
# MUST recreate containers, not just restart
docker-compose -f docker-compose.dev.yml up -d --force-recreate api
```

### Setup Script (Legacy - May Not Exist)

```bash
# Interactive setup for development
node scripts/setup.js setup

# Validate current configuration
node scripts/setup.js validate
```

### NPM Scripts (after updating package.json)

```bash
# Environment management
npm run env:setup     # Interactive environment setup
npm run env:validate  # Validate current environment
npm run env:switch    # Switch between environments

# Development
npm run dev           # Start development environment
npm run build         # Build for production
npm run test          # Run tests
```

## 🔧 Troubleshooting

### Common Issues

**"Database connection failed"**
- Check your `DATABASE_URL` in `.env.local`
- Ensure PostgreSQL is running (local) or Docker is started (Docker)
- Verify database credentials and hostname

**"Priority API authentication failed"**
- Check `PRIORITY_USERNAME` and `PRIORITY_PASSWORD`
- Verify `PRIORITY_URL` is correct
- Test Priority API connection manually

**"Environment validation failed"**
- Run `node scripts/setup.js validate` for detailed errors
- Check for placeholder values that need to be replaced
- Ensure all required environment variables are set

**"JWT authentication failed"**
- Generate a new `JWT_SECRET` and add it to `.env.local`
- Ensure the secret is at least 32 characters long
- Clear browser cookies/localStorage and try again

### Getting Help

1. **Validate your environment:** `node scripts/setup.js validate`
2. **Check the setup script output** for specific error messages
3. **Review this documentation** for configuration requirements
4. **Ask the team** for help with Priority API credentials or database access

## 🔄 Migration from Old System

If you're upgrading from the old environment file structure:

1. **Backup your current `.env` files**
2. **Run the migration:** `node scripts/setup.js setup`
3. **Copy your custom settings** to the new `.env.local` file
4. **Validate the new setup:** `node scripts/setup.js validate`
5. **Update your documentation** to reference the new structure

## 📖 Additional Resources

- [Environment Variables Best Practices](https://12factor.net/config)
- [Docker Environment Configuration](https://docs.docker.com/compose/environment-variables/)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Node.js Environment Variables](https://nodejs.org/en/learn/command-line/how-to-read-environment-variables-from-nodejs)