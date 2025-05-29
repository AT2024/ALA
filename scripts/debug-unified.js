#!/usr/bin/env node

/**
 * ALA Application Universal Debug Tool
 * Works on Windows, Linux, and macOS
 * Combines functionality from ala-dev.bat, debug.sh, and debug.js
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios').default;

// Configuration
const config = {
  backendUrl: 'http://localhost:5000',
  frontendUrl: 'http://localhost:3000',
  priorityUrl: 'https://t.eu.priority-connect.online/odata/Priority/tabbtbc6.ini/test24/',
  logFile: path.join(__dirname, '..', 'logs', 'debug.log')
};

// Utility functions
const log = (message, data = null) => {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}`;
  
  console.log(logEntry);
  
  // Ensure logs directory exists
  const logDir = path.dirname(config.logFile);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  // Write to log file
  fs.appendFileSync(config.logFile, logEntry + '\n');
  
  if (data) {
    const formatted = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    console.log(formatted);
    fs.appendFileSync(config.logFile, formatted + '\n');
  }
};

const execPromise = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject({ error, stderr });
      } else {
        resolve(stdout);
      }
    });
  });
};

// Check system dependencies
async function checkDependencies() {
  log('🔍 Checking system dependencies...');
  
  const checks = [
    { name: 'Node.js', command: 'node --version' },
    { name: 'npm', command: 'npm --version' },
    { name: 'Docker', command: 'docker --version' },
    { name: 'Docker Compose', command: 'docker-compose --version' }
  ];
  
  for (const check of checks) {
    try {
      const result = await execPromise(check.command);
      log(`✅ ${check.name}: ${result.trim()}`);
    } catch (error) {
      log(`❌ ${check.name}: Not installed or not in PATH`);
    }
  }
}

// Test backend connectivity
async function testBackend() {
  log('🔧 Testing backend connectivity...');
  
  try {
    const response = await axios.get(`${config.backendUrl}/api/health`, { timeout: 5000 });
    log('✅ Backend health check successful', response.data);
    return true;
  } catch (error) {
    log('❌ Backend health check failed', error.message);
    return false;
  }
}

// Test frontend connectivity
async function testFrontend() {
  log('🎨 Testing frontend connectivity...');
  
  try {
    const response = await axios.get(config.frontendUrl, { timeout: 5000 });
    log('✅ Frontend is accessible');
    return true;
  } catch (error) {
    log('❌ Frontend is not accessible', error.message);
    return false;
  }
}

// Check Docker containers
async function checkContainers() {
  log('🐳 Checking Docker containers...');
  
  try {
    const result = await execPromise('docker-compose -f docker-compose.dev.yml ps');
    log('Docker containers status:', result);
  } catch (error) {
    log('❌ Error checking Docker containers', error.error.message);
  }
}

// Interactive menu
function showMenu() {
  console.clear();
  console.log('');
  console.log('=====================================================');
  console.log('   🚀 ALA Application Debug & Development Tool');
  console.log('=====================================================');
  console.log('');
  console.log('[1] 🏥 Full Health Check');
  console.log('[2] 🐳 Start Development Environment');
  console.log('[3] 🛑 Stop Development Environment');
  console.log('[4] 🔄 Restart Development Environment');
  console.log('[5] 📋 View Container Logs');
  console.log('[6] 🌐 Open Application in Browser');
  console.log('[7] 🔍 Run System Diagnostics');
  console.log('[0] 🚪 Exit');
  console.log('');
  
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.question('Choose an option (0-7): ', async (choice) => {
    rl.close();
    await handleMenuChoice(choice);
  });
}

async function handleMenuChoice(choice) {
  switch (choice) {
    case '1':
      await runFullHealthCheck();
      break;
    case '2':
      await startDevelopment();
      break;
    case '3':
      await stopDevelopment();
      break;
    case '4':
      await restartDevelopment();
      break;
    case '5':
      await viewLogs();
      break;
    case '6':
      await openBrowser();
      break;
    case '7':
      await runDiagnostics();
      break;
    case '0':
      log('👋 Goodbye!');
      process.exit(0);
      break;
    default:
      log('❌ Invalid choice');
  }
  
  // Return to menu after operation
  setTimeout(() => {
    console.log('\nPress any key to return to menu...');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', () => {
      process.stdin.setRawMode(false);
      showMenu();
    });
  }, 1000);
}

async function runFullHealthCheck() {
  log('🏥 Running full health check...');
  await checkDependencies();
  await checkContainers();
  await testBackend();
  await testFrontend();
  log('✅ Health check complete!');
}

async function startDevelopment() {
  log('🚀 Starting development environment...');
  try {
    await execPromise('docker-compose -f docker-compose.dev.yml up -d --build');
    log('✅ Development environment started!');
    log(`🌐 Frontend: ${config.frontendUrl}`);
    log(`🔧 Backend: ${config.backendUrl}`);
  } catch (error) {
    log('❌ Failed to start development environment', error.error.message);
  }
}

async function stopDevelopment() {
  log('🛑 Stopping development environment...');
  try {
    await execPromise('docker-compose -f docker-compose.dev.yml down');
    log('✅ Development environment stopped!');
  } catch (error) {
    log('❌ Failed to stop development environment', error.error.message);
  }
}

async function restartDevelopment() {
  log('🔄 Restarting development environment...');
  await stopDevelopment();
  await startDevelopment();
}

async function viewLogs() {
  log('📋 Viewing container logs...');
  log('Press Ctrl+C to return to menu');
  
  const logProcess = spawn('docker-compose', ['-f', 'docker-compose.dev.yml', 'logs', '-f'], {
    stdio: 'inherit'
  });
  
  logProcess.on('close', () => {
    log('📋 Log viewing ended');
  });
}

async function openBrowser() {
  log('🌐 Opening application in browser...');
  
  const open = process.platform === 'win32' ? 'start' : 
                process.platform === 'darwin' ? 'open' : 'xdg-open';
  
  try {
    await execPromise(`${open} ${config.frontendUrl}`);
    log('✅ Browser opened');
  } catch (error) {
    log('❌ Failed to open browser', error.error.message);
  }
}

async function runDiagnostics() {
  log('🔍 Running comprehensive diagnostics...');
  await runFullHealthCheck();
  
  // Additional diagnostic checks
  log('📊 Additional system information:');
  try {
    const osInfo = await execPromise(process.platform === 'win32' ? 'systeminfo | findstr /B /C:"OS Name"' : 'uname -a');
    log('💻 System:', osInfo.trim());
  } catch (error) {
    log('❌ Could not get system info');
  }
  
  log('✅ Diagnostics complete!');
}

// Main execution
async function main() {
  // Check if running with arguments for headless mode
  const args = process.argv.slice(2);
  
  if (args.length > 0) {
    switch (args[0]) {
      case 'health':
        await runFullHealthCheck();
        break;
      case 'start':
        await startDevelopment();
        break;
      case 'stop':
        await stopDevelopment();
        break;
      case 'restart':
        await restartDevelopment();
        break;
      case 'logs':
        await viewLogs();
        break;
      default:
        console.log('Available commands: health, start, stop, restart, logs');
    }
    process.exit(0);
  } else {
    // Interactive mode
    showMenu();
  }
}

// Handle errors
process.on('uncaughtException', (error) => {
  log('❌ Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log('❌ Unhandled Rejection:', reason);
  process.exit(1);
});

// Start the application
main().catch(error => {
  log('❌ Application error:', error.message);
  process.exit(1);
});
