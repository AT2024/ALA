# Database Migrations

This directory contains SQL migration scripts for production database schema changes.

## Migration Strategy

This project uses **Sequelize auto-sync** in development mode:
- **Development**: Models are automatically synced with `sequelize.sync({ alter: true })`
- **Production**: Manual migrations are required for safety

## How to Use

### Development
No action needed - schema changes in model files are automatically applied when the server starts.

### Production

1. **Apply migration manually** via psql or database tool:
   ```bash
   psql -h <host> -U <user> -d ala_db -f migrations/<migration-file>.sql
   ```

2. **Or connect to production database**:
   ```bash
   # SSH to Azure VM
   ssh azureuser@20.217.84.100

   # Connect to database container
   docker exec -it deployment_db_1 psql -U postgres -d ala_db

   # Run migration
   \i /path/to/migration.sql
   ```

3. **Verify migration**:
   ```sql
   -- Check column was added
   \d treatments

   -- Or use information_schema
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_name = 'treatments';
   ```

## Migration Files

Migrations are named with timestamp prefix: `YYYYMMDDHHMMSS-description.sql`

Each migration includes:
- ✅ UP migration (apply changes)
- ✅ DOWN migration (rollback)
- ✅ Comments and documentation
- ✅ Verification queries

## Rollback Procedure

If a migration needs to be rolled back:

1. Find the DOWN migration section in the SQL file
2. Execute the rollback commands
3. Verify rollback with verification queries

## Best Practices

- **Test migrations locally first** with production-like data
- **Always include rollback (DOWN) migration**
- **Make migrations idempotent** using `IF EXISTS` / `IF NOT EXISTS`
- **Document the purpose** of each migration
- **Use transactions** for multi-step migrations (wrap in BEGIN/COMMIT)
- **Backup database** before running migrations in production

## Current Migrations

- `20251111000000-add-patient-name.sql` - Add patient_name column to treatments table
- `20251119000000-add-applicator-status-fields.sql` - Add status and package_label columns for 9-state workflow
- `20251214000000-add-treatment-pdf-tables.sql` - Add treatment_pdfs and signature_verifications tables for digital signature workflow
