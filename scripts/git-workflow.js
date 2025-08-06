#!/usr/bin/env node

/**
 * ALA Git Workflow Manager
 * Cross-platform unified script for git operations
 * Replaces: new-feature.bat/.sh, new-hotfix.bat/.sh, release.bat/.sh
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
  mainBranch: 'main',
  developBranch: 'develop',
  featurePrefix: 'feature/',
  hotfixPrefix: 'hotfix/',
  releasePrefix: 'release/'
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
    info: '🔄',
    success: '✅',
    warning: '⚠️',
    error: '❌'
  };
  
  console.log(`${colors[type]}${prefix[type]} ${message}${colors.reset}`);
};

const execCommand = (command, description) => {
  try {
    log(`${description}...`);
    const result = execSync(command, { 
      encoding: 'utf8', 
      stdio: ['pipe', 'pipe', 'pipe'] 
    });
    log(`${description} completed`, 'success');
    return result.trim();
  } catch (error) {
    log(`${description} failed: ${error.message}`, 'error');
    throw error;
  }
};

// Git workflow functions
const createFeatureBranch = (featureName) => {
  if (!featureName) {
    log('Error: Feature name is required!', 'error');
    log('Usage: node git-workflow.js feature <feature-name>');
    process.exit(1);
  }
  
  const branchName = `${config.featurePrefix}${featureName}`;
  
  log(`Creating feature branch: ${branchName}`);
  
  // Switch to develop and update
  execCommand(`git checkout ${config.developBranch}`, 'Switching to develop branch');
  execCommand(`git pull origin ${config.developBranch}`, 'Pulling latest changes from develop');
  
  // Create and switch to feature branch
  execCommand(`git checkout -b "${branchName}"`, `Creating feature branch ${branchName}`);
  
  log(`Successfully created and switched to branch '${branchName}'`, 'success');
  log('Next steps:');
  log(`1. Make your changes`);
  log(`2. Commit: git add . && git commit -m "Your commit message"`);
  log(`3. Push: git push -u origin ${branchName}`);
  log(`4. Create a pull request from ${branchName} to ${config.developBranch}`);
};

const createHotfixBranch = (hotfixName) => {
  if (!hotfixName) {
    log('Error: Hotfix name is required!', 'error');
    log('Usage: node git-workflow.js hotfix <hotfix-name>');
    process.exit(1);
  }
  
  const branchName = `${config.hotfixPrefix}${hotfixName}`;
  
  log(`Creating hotfix branch: ${branchName}`);
  
  // Switch to main and update
  execCommand(`git checkout ${config.mainBranch}`, 'Switching to main branch');
  execCommand(`git pull origin ${config.mainBranch}`, 'Pulling latest changes from main');
  
  // Create and switch to hotfix branch
  execCommand(`git checkout -b "${branchName}"`, `Creating hotfix branch ${branchName}`);
  
  log(`Successfully created and switched to branch '${branchName}'`, 'success');
  log('Next steps:');
  log(`1. Fix the issue`);
  log(`2. Commit: git add . && git commit -m "Fix: description"`);
  log(`3. Push: git push -u origin ${branchName}`);
  log(`4. Create a pull request from ${branchName} to ${config.mainBranch}`);
  log(`5. After merging to main, merge back to develop:`);
  log(`   git checkout ${config.developBranch} && git pull && git merge ${branchName} && git push`);
};

const createRelease = (version) => {
  // Generate version if not provided
  if (!version) {
    const date = new Date();
    version = `${date.getFullYear()}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getDate().toString().padStart(2, '0')}`;
  }
  
  log(`Preparing release version ${version}...`);
  
  // Ensure develop is up to date
  execCommand(`git checkout ${config.developBranch}`, 'Switching to develop branch');
  execCommand(`git pull origin ${config.developBranch}`, 'Pulling latest changes from develop');
  
  // Run tests if available
  log('Checking for tests...', 'info');
  try {
    if (fs.existsSync(path.join(process.cwd(), 'backend', 'package.json'))) {
      const backendPkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'backend', 'package.json')));
      if (backendPkg.scripts && backendPkg.scripts.test) {
        execCommand('cd backend && npm test', 'Running backend tests');
      }
    }
    
    if (fs.existsSync(path.join(process.cwd(), 'frontend', 'package.json'))) {
      const frontendPkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'frontend', 'package.json')));
      if (frontendPkg.scripts && frontendPkg.scripts.test) {
        execCommand('cd frontend && npm test', 'Running frontend tests');
      }
    }
  } catch (error) {
    log('Tests failed! Aborting release.', 'error');
    throw error;
  }
  
  // Switch to main and merge
  execCommand(`git checkout ${config.mainBranch}`, 'Switching to main branch');
  execCommand(`git pull origin ${config.mainBranch}`, 'Pulling latest changes from main');
  execCommand(`git merge ${config.developBranch}`, 'Merging develop into main');
  
  // Create version tag
  execCommand(`git tag -a "v${version}" -m "Release version ${version}"`, `Creating version tag v${version}`);
  
  // Push changes
  execCommand(`git push origin ${config.mainBranch}`, 'Pushing changes to main');
  execCommand(`git push origin "v${version}"`, 'Pushing version tag');
  
  log(`Release v${version} successfully created and pushed to main!`, 'success');
  log('The production deployment workflow should start automatically.');
  log(`Don't forget to switch back to develop: git checkout ${config.developBranch}`);
};

const showHelp = () => {
  console.log(`
🚀 ALA Git Workflow Manager

Usage:
  node git-workflow.js <command> [options]

Commands:
  feature <name>    Create a new feature branch from develop
  hotfix <name>     Create a new hotfix branch from main  
  release [version] Create a release (merge develop to main)
  help              Show this help message

Examples:
  node git-workflow.js feature user-authentication
  node git-workflow.js hotfix critical-bug-fix
  node git-workflow.js release 2024.01.15
  node git-workflow.js release  # Auto-generates date-based version

Git Flow:
  • Features: develop → feature/name → develop (via PR)
  • Hotfixes: main → hotfix/name → main (via PR) → develop
  • Releases: develop → main (with version tag)
`);
};

// Main execution
const main = () => {
  const [,, command, ...args] = process.argv;
  
  switch (command) {
    case 'feature':
      createFeatureBranch(args[0]);
      break;
    case 'hotfix':
      createHotfixBranch(args[0]);
      break;
    case 'release':
      createRelease(args[0]);
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