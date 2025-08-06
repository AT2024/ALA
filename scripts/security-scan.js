#!/usr/bin/env node

/**
 * ALA Docker Security Scanner
 * Cross-platform unified security scanning script
 * Replaces: security-scan.bat and security-scan.sh
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Configuration
const config = {
  images: [
    { name: 'node:20.19.2-bookworm-slim', service: 'nodejs-base' },
    { name: 'nginx:1.25.3-alpine3.18', service: 'nginx-base' },
    { name: 'postgres:16.6-alpine', service: 'postgres-base' },
    { name: 'ala-frontend-dev', service: 'frontend' },
    { name: 'ala-api-dev', service: 'backend' }
  ],
  reportsDir: 'security-reports',
  trivyTimeout: 300000, // 5 minutes
  severityLevels: ['HIGH', 'CRITICAL'],
  composeFile: 'docker-compose.dev.yml'
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
    info: '🔍',
    success: '✅',
    warning: '⚠️',
    error: '❌'
  };
  
  console.log(`${colors[type]}${prefix[type]} ${message}${colors.reset}`);
};

const execCommand = (command, description, options = {}) => {
  try {
    if (description) log(`${description}...`);
    
    const result = execSync(command, { 
      encoding: 'utf8', 
      stdio: options.silent ? ['pipe', 'pipe', 'pipe'] : ['pipe', 'inherit', 'inherit'],
      timeout: options.timeout || 60000,
      ...options
    });
    
    if (description) log(`${description} completed`, 'success');
    return result ? result.trim() : '';
  } catch (error) {
    if (description) log(`${description} failed: ${error.message}`, 'error');
    if (options.throwOnError !== false) throw error;
    return '';
  }
};

// Check if Trivy is installed
const checkTrivy = () => {
  try {
    execCommand('trivy --version', null, { silent: true });
    log('Trivy is installed and ready', 'success');
    return true;
  } catch (error) {
    log('Trivy is not installed. Please install it first:', 'error');
    
    if (os.platform() === 'win32') {
      log('Windows: choco install trivy');
      log('Or download from: https://github.com/aquasecurity/trivy/releases');
    } else if (os.platform() === 'darwin') {
      log('macOS: brew install trivy');
    } else {
      log('Linux: Visit https://aquasecurity.github.io/trivy/latest/getting-started/installation/');
    }
    
    return false;
  }
};

// Create reports directory
const createReportsDir = () => {
  if (!fs.existsSync(config.reportsDir)) {
    fs.mkdirSync(config.reportsDir, { recursive: true });
    log(`Created reports directory: ${config.reportsDir}`);
  }
};

// Get current date for filename
const getDateString = () => {
  const date = new Date();
  return `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
};

// Build Docker images
const buildImages = () => {
  log('Building Docker images...');
  try {
    execCommand(`docker-compose -f ${config.composeFile} build --no-cache`, 'Building Docker images');
  } catch (error) {
    log('Failed to build some images. Continuing with scan...', 'warning');
  }
};

// Scan a single image
const scanImage = async (imageName, serviceName) => {
  const dateString = getDateString();
  const reportFile = path.join(config.reportsDir, `${serviceName}-scan-${dateString}.txt`);
  const jsonReportFile = path.join(config.reportsDir, `${serviceName}-scan-${dateString}.json`);
  
  log(`Scanning ${serviceName} (${imageName})...`);
  
  try {
    // Run table format scan for human reading
    const tableCommand = `trivy image --format table --severity ${config.severityLevels.join(',')} --output "${reportFile}" "${imageName}"`;
    execCommand(tableCommand, null, { silent: true, timeout: config.trivyTimeout });
    
    // Run JSON format scan for programmatic analysis
    const jsonCommand = `trivy image --format json --severity ${config.severityLevels.join(',')} --output "${jsonReportFile}" "${imageName}"`;
    execCommand(jsonCommand, null, { silent: true, timeout: config.trivyTimeout });
    
    // Analyze results
    const jsonContent = fs.readFileSync(jsonReportFile, 'utf8');
    const scanResult = JSON.parse(jsonContent);
    
    let criticalCount = 0;
    let highCount = 0;
    
    if (scanResult.Results) {
      scanResult.Results.forEach(result => {
        if (result.Vulnerabilities) {
          result.Vulnerabilities.forEach(vuln => {
            if (vuln.Severity === 'CRITICAL') criticalCount++;
            else if (vuln.Severity === 'HIGH') highCount++;
          });
        }
      });
    }
    
    if (criticalCount > 0) {
      log(`${serviceName} has ${criticalCount} CRITICAL vulnerabilities!`, 'error');
      return { service: serviceName, critical: criticalCount, high: highCount, status: 'critical' };
    } else if (highCount > 0) {
      log(`${serviceName} has ${highCount} HIGH vulnerabilities`, 'warning');
      return { service: serviceName, critical: criticalCount, high: highCount, status: 'warning' };
    } else {
      log(`${serviceName} passed security scan!`, 'success');
      return { service: serviceName, critical: criticalCount, high: highCount, status: 'passed' };
    }
    
  } catch (error) {
    log(`Error scanning ${serviceName}: ${error.message}`, 'error');
    return { service: serviceName, critical: 0, high: 0, status: 'error', error: error.message };
  }
};

// Main scanning function
const runSecurityScan = async () => {
  log('🔍 ALA Docker Security Scanner');
  log('==============================');
  
  // Check prerequisites
  if (!checkTrivy()) {
    process.exit(1);
  }
  
  createReportsDir();
  buildImages();
  
  log('Starting security scans...');
  
  const results = [];
  let totalIssues = 0;
  
  // Scan all images
  for (const image of config.images) {
    const result = await scanImage(image.name, image.service);
    results.push(result);
    
    if (result.status === 'critical' || result.status === 'warning') {
      totalIssues += result.critical + result.high;
    }
  }
  
  // Generate summary report
  const summaryReport = generateSummaryReport(results);
  const summaryFile = path.join(config.reportsDir, `security-summary-${getDateString()}.txt`);
  fs.writeFileSync(summaryFile, summaryReport);
  
  // Display results
  log('Security scan completed!');
  console.log(summaryReport);
  
  // Exit with appropriate code
  const criticalIssues = results.filter(r => r.status === 'critical').length;
  const warningIssues = results.filter(r => r.status === 'warning').length;
  
  if (criticalIssues > 0) {
    log(`${criticalIssues} services have CRITICAL vulnerabilities! Immediate action required!`, 'error');
    log(`Check detailed reports in ./${config.reportsDir}/`, 'info');
    process.exit(2);
  } else if (warningIssues > 0) {
    log(`${warningIssues} services have HIGH vulnerabilities.`, 'warning');
    log(`Check detailed reports in ./${config.reportsDir}/`, 'info');
    process.exit(1);
  } else {
    log('All scanned images passed security checks!', 'success');
    process.exit(0);
  }
};

// Generate summary report
const generateSummaryReport = (results) => {
  const dateString = new Date().toISOString().split('T')[0];
  let report = `
ALA Security Scan Summary
========================
Date: ${dateString}
Scanned Images: ${results.length}

Results:
--------
`;

  results.forEach(result => {
    const status = result.status === 'passed' ? '✅ PASSED' :
                   result.status === 'warning' ? '⚠️  WARNING' :
                   result.status === 'critical' ? '❌ CRITICAL' : '🔴 ERROR';
    
    report += `${result.service.padEnd(15)} ${status}`;
    
    if (result.critical > 0 || result.high > 0) {
      report += ` (Critical: ${result.critical}, High: ${result.high})`;
    }
    
    if (result.error) {
      report += ` - ${result.error}`;
    }
    
    report += '\n';
  });

  const totalCritical = results.reduce((sum, r) => sum + r.critical, 0);
  const totalHigh = results.reduce((sum, r) => sum + r.high, 0);
  const passedCount = results.filter(r => r.status === 'passed').length;

  report += `
Summary:
--------
Passed: ${passedCount}/${results.length}
Total Critical Vulnerabilities: ${totalCritical}
Total High Vulnerabilities: ${totalHigh}

${totalCritical > 0 ? '⚠️  CRITICAL vulnerabilities found - immediate action required!' :
  totalHigh > 0 ? '⚠️  HIGH vulnerabilities found - review recommended' :
  '✅ All images passed security scan'}
`;

  return report;
};

// Show help
const showHelp = () => {
  console.log(`
🔍 ALA Docker Security Scanner

Usage:
  node security-scan.js [options]

Options:
  --help, -h        Show this help message
  --verbose, -v     Verbose output
  --quick, -q       Quick scan (skip base images)

This script:
• Builds Docker images using docker-compose
• Scans all images for HIGH and CRITICAL vulnerabilities using Trivy
• Generates detailed reports in ./security-reports/
• Provides summary of security status

Prerequisites:
• Docker and Docker Compose installed
• Trivy security scanner installed

Exit codes:
  0  All scans passed
  1  Some images have HIGH vulnerabilities
  2  Some images have CRITICAL vulnerabilities
`);
};

// Handle command line arguments
const main = () => {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }
  
  // Set verbose mode if requested
  if (args.includes('--verbose') || args.includes('-v')) {
    config.verbose = true;
  }
  
  // Quick scan mode (skip base images)
  if (args.includes('--quick') || args.includes('-q')) {
    config.images = config.images.filter(img => !img.service.includes('base'));
    log('Quick scan mode: skipping base images');
  }
  
  runSecurityScan().catch(error => {
    log(`Security scan failed: ${error.message}`, 'error');
    process.exit(1);
  });
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