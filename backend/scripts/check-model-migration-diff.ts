/**
 * Model/Schema Diff Checker
 *
 * This script compares Sequelize models to actual database schema
 * and fails if there are columns in models without corresponding migrations.
 *
 * Usage: npm run db:check-diff
 *
 * Purpose:
 * - Development uses sequelize.sync({ alter: true }) which auto-creates columns
 * - Production requires manual migrations - columns won't exist otherwise
 * - This script catches the gap before deployment
 *
 * See: .claude/rules/database.md
 */

import sequelize from '../src/config/database';
import { QueryTypes } from 'sequelize';

// Columns auto-managed by Sequelize - don't require migrations
const IGNORED_COLUMNS = ['createdAt', 'updatedAt', 'deletedAt', 'created_at', 'updated_at', 'deleted_at'];

// Convert camelCase to snake_case
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

interface ColumnInfo {
  column_name: string;
}

async function checkModelSchemaDiff(): Promise<void> {
  try {
    // Wait for models to be loaded
    await sequelize.authenticate();
    console.log('Database connection established.');

    const models = Object.values(sequelize.models);
    const errors: string[] = [];

    for (const model of models) {
      const tableName = model.tableName;
      const rawAttributes = model.rawAttributes;

      if (!rawAttributes) {
        console.log(`Skipping ${model.name} - no rawAttributes`);
        continue;
      }

      // Get model column names, excluding ignored columns
      const modelColumns = Object.keys(rawAttributes)
        .filter(col => !IGNORED_COLUMNS.includes(col));

      // Query actual database schema
      const schemaColumns = await sequelize.query<ColumnInfo>(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = '${tableName}'
        AND table_schema = 'public'
      `, { type: QueryTypes.SELECT });

      if (!schemaColumns || schemaColumns.length === 0) {
        // Table doesn't exist - this is expected for new tables in development
        console.log(`Table ${tableName} not found in database (new table?)`);
        continue;
      }

      const dbColumnNames = schemaColumns.map((c: ColumnInfo) => c.column_name.toLowerCase());

      // Find columns in model but not in database
      const missingInDb = modelColumns.filter(col => {
        // Check both camelCase and snake_case versions
        const snakeCase = toSnakeCase(col).toLowerCase();
        const fieldName = rawAttributes[col]?.field?.toLowerCase() || snakeCase;
        return !dbColumnNames.includes(fieldName) && !dbColumnNames.includes(col.toLowerCase());
      });

      if (missingInDb.length > 0) {
        errors.push(`${tableName}: Missing columns in DB: ${missingInDb.join(', ')}`);
      }
    }

    if (errors.length > 0) {
      console.error('\n❌ Model/Schema mismatch detected:\n');
      errors.forEach(e => console.error(`  - ${e}`));
      console.error('\n👉 Create a migration file in backend/src/migrations/');
      console.error('   See: .claude/rules/database.md for migration template\n');
      process.exit(1);
    }

    console.log('\n✅ Model/Schema parity check passed\n');
    process.exit(0);
  } catch (error) {
    console.error('Error checking model/schema diff:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

checkModelSchemaDiff();
