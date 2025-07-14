#!/usr/bin/env node

/**
 * ALA Environment Setup & Validation Script
 * Cross-platform environment management utility
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

// Configuration
const config = {
  environmentsDir: 'environments',
  projectRoot: process.cwd(),
  requiredFiles: [
    'environments/.env.development',
    'environments/.env.production', 
    'environments/.env.example',
    'environments/azure.env'
  ],
  requiredDependencies: [
    { name: 'Node.js', command: 'node --version', minVersion: '18.0.0' },
    { name: 'npm', command: 'npm --version', minVersion: '8.0.0' },
    { name: 'Docker', command: 'docker --version', optional: true },
    { name: 'Docker Compose', command: 'docker-compose --version', optional: true }
  ]
};

// Utility functions
const log = (message, type = 'info') => {
  const colors = {
    info: '\x1b[36m',    // Cyan
    success: '\x1b[32m', // Green
    warning: '\x1b[33m', // Yellow
    error: '\x1b[31m',   // Red
    reset: '\x1b[0m'     // Reset
  };
  
  const prefix = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌'
  };
  
  console.log(`${colors[type]}${prefix[type]} ${message}${colors.reset}`);
};

const execCommand = (command, silent = true) => {
  try {
    return execSync(command, { 
      encoding: 'utf8', 
      stdio: silent ? ['pipe', 'pipe', 'pipe'] : ['pipe', 'inherit', 'inherit']
    }).trim();
  } catch (error) {
    return null;
  }
};

const createReadlineInterface = () => {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
};

const askQuestion = (rl, question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
};

// Check system dependencies
const checkDependencies = () => {
  log('Checking system dependencies...');
  
  const results = [];
  
  for (const dep of config.requiredDependencies) {
    const version = execCommand(dep.command);
    
    if (version) {
      log(`${dep.name}: ${version}`, 'success');
      results.push({ name: dep.name, status: 'installed', version });
    } else {
      const level = dep.optional ? 'warning' : 'error';
      log(`${dep.name}: Not installed${dep.optional ? ' (optional)' : ''}`, level);
      results.push({ name: dep.name, status: 'missing', optional: dep.optional });
    }
  }
  
  const missingRequired = results.filter(r => r.status === 'missing' && !r.optional);
  
  if (missingRequired.length > 0) {
    log('Required dependencies are missing. Please install them before continuing.', 'error');
    return false;
  }
  
  return true;
};

// Validate environment files
const validateEnvironmentFiles = () => {
  log('Validating environment files...');
  
  const missing = [];
  const existing = [];
  
  for (const file of config.requiredFiles) {
    const filePath = path.join(config.projectRoot, file);
    if (fs.existsSync(filePath)) {
      existing.push(file);
    } else {
      missing.push(file);
    }
  }
  
  existing.forEach(file => {
    log(`${file}: Found`, 'success');
  });
  
  missing.forEach(file => {
    log(`${file}: Missing`, 'error');
  });
  
  return { existing, missing };
};

// Validate environment file content
const validateEnvironmentContent = (envFile) => {
  const filePath = path.join(config.projectRoot, envFile);
  
  if (!fs.existsSync(filePath)) {
    return { valid: false, error: 'File does not exist' };
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const variables = {};
    const issues = [];
    
    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmed = line.trim();
      
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) return;
      
      // Check for valid format
      const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (!match) {
        issues.push(`Line ${lineNum}: Invalid format - ${line}`);
        return;
      }
      
      const [, key, value] = match;
      variables[key] = value;
      
      // Check for potentially insecure values
      if (value.includes('CHANGE_THIS') || value.includes('your-') || value.includes('password')) {
        issues.push(`Line ${lineNum}: Placeholder value detected for ${key}`);
      }
    });
    
    return { valid: issues.length === 0, variables, issues };
    
  } catch (error) {
    return { valid: false, error: error.message };
  }
};

// Setup environment for development
const setupDevelopmentEnvironment = async () => {
  log('Setting up development environment...');
  
  const rl = createReadlineInterface();
  
  try {
    // Check if .env.local already exists
    const localEnvPath = path.join(config.projectRoot, '.env.local');
    
    if (fs.existsSync(localEnvPath)) {
      const overwrite = await askQuestion(rl, 
        '.env.local already exists. Overwrite? (y/N): '
      );
      
      if (overwrite.toLowerCase() !== 'y') {
        log('Setup cancelled by user.');
        rl.close();
        return;
      }
    }
    
    // Copy development template
    const devTemplatePath = path.join(config.projectRoot, 'environments', '.env.development');
    
    if (!fs.existsSync(devTemplatePath)) {
      log('Development template not found. Please ensure environments/.env.development exists.', 'error');
      rl.close();
      return;
    }
    
    // Get user preferences
    const dbHost = await askQuestion(rl, 
      'Database host (localhost for local, db for Docker): '
    ) || 'localhost';
    
    const apiUrl = await askQuestion(rl, 
      'API URL (http://localhost:5000/api): '
    ) || 'http://localhost:5000/api';
    
    // Read template and customize
    let content = fs.readFileSync(devTemplatePath, 'utf8');
    
    // Replace database host
    if (dbHost === 'localhost') {
      content = content.replace(
        'DATABASE_URL=postgres://postgres:postgres@db:5432/ala_db',
        'DATABASE_URL=postgres://postgres:postgres@localhost:5432/ala_db'
      );
    }
    
    // Replace API URL
    content = content.replace(
      'VITE_API_URL=http://localhost:5000/api',
      `VITE_API_URL=${apiUrl}`
    );
    
    // Write local environment file
    fs.writeFileSync(localEnvPath, content);
    
    log('Development environment setup completed!', 'success');
    log(`Created: .env.local`);
    log('You can now run: npm run dev');
    
  } catch (error) {
    log(`Setup failed: ${error.message}`, 'error');
  } finally {
    rl.close();
  }
};

// Switch between environments
const switchEnvironment = async (targetEnv) => {
  if (!['development', 'production'].includes(targetEnv)) {
    log('Invalid environment. Use: development or production', 'error');
    return;
  }
  
  const sourcePath = path.join(config.projectRoot, 'environments', `.env.${targetEnv}`);
  const targetPath = path.join(config.projectRoot, '.env.local');
  
  if (!fs.existsSync(sourcePath)) {
    log(`Environment file not found: ${sourcePath}`, 'error');
    return;
  }
  
  // Backup existing .env.local if it exists
  if (fs.existsSync(targetPath)) {
    const backupPath = `${targetPath}.backup.${Date.now()}`;
    fs.copyFileSync(targetPath, backupPath);
    log(`Backed up existing .env.local to ${path.basename(backupPath)}`);
  }
  
  // Copy environment file
  fs.copyFileSync(sourcePath, targetPath);
  log(`Switched to ${targetEnv} environment`, 'success');
  log(`Active environment: ${targetPath}`);
};

// Run full environment validation
const runValidation = () => {
  log('🔍 ALA Environment Validation');
  log('============================');
  
  // Check dependencies
  const depsOk = checkDependencies();
  
  // Check environment files
  const { existing, missing } = validateEnvironmentFiles();
  
  // Validate content of existing files
  const validationResults = [];
  existing.forEach(file => {
    const result = validateEnvironmentContent(file);
    validationResults.push({ file, ...result });
  });
  
  // Report results
  log('\nValidation Results:');
  log('==================');
  
  validationResults.forEach(result => {
    if (result.valid) {
      log(`${result.file}: Valid configuration`, 'success');
    } else {
      log(`${result.file}: Issues found`, 'warning');
      if (result.issues) {
        result.issues.forEach(issue => log(`  • ${issue}`, 'warning'));
      }
      if (result.error) {
        log(`  • ${result.error}`, 'error');
      }
    }
  });
  
  // Check for .env.local
  const localEnvExists = fs.existsSync(path.join(config.projectRoot, '.env.local'));
  if (localEnvExists) {
    log('.env.local: Found (active environment)', 'success');
  } else {
    log('.env.local: Not found - run setup to create', 'warning');
  }
  
  // Summary
  const allValid = validationResults.every(r => r.valid) && depsOk && missing.length === 0;
  
  if (allValid) {
    log('\nEnvironment validation passed! ✅', 'success');
  } else {
    log('\nEnvironment validation found issues. ⚠️', 'warning');
    if (missing.length > 0) {
      log('Missing files - ensure all environment templates exist');
    }
  }
  
  return allValid;
};

// Show help
const showHelp = () => {
  console.log(`
🛠️  ALA Environment Setup & Validation

Usage:
  node setup.js <command> [options]

Commands:
  validate              Run full environment validation
  setup                 Interactive development environment setup  
  switch <env>          Switch to development or production environment
  check                 Quick dependency check
  help                  Show this help message

Examples:
  node setup.js validate                    # Check all environment files
  node setup.js setup                       # Setup development environment
  node setup.js switch development          # Switch to development env
  node setup.js switch production           # Switch to production env

Environment Files:
  environments/.env.development     # Development configuration
  environments/.env.production      # Production configuration
  environments/.env.example         # Template for new setups
  environments/azure.env            # Azure deployment config
  .env.local                       # Active local environment (git-ignored)

The .env.local file takes precedence and should contain your personal
environment configuration. It's automatically ignored by git.
`);
};

// Main execution
const main = async () => {
  const [,, command, ...args] = process.argv;
  
  switch (command) {
    case 'validate':
      runValidation();
      break;
    case 'setup':
      await setupDevelopmentEnvironment();
      break;
    case 'switch':
      await switchEnvironment(args[0]);
      break;
    case 'check':
      checkDependencies();
      break;
    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;
    default:
      log('Invalid command. Use "help" to see available commands.', 'error');
      showHelp();
      process.exit(1);
  }
};

// Handle errors
process.on('uncaughtException', (error) => {
  log(`Uncaught Exception: ${error.message}`, 'error');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log(`Unhandled Rejection: ${reason}`, 'error');
  process.exit(1);
});

// Run the script
main();