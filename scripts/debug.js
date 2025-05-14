/**
 * Debug script for ALA Application
 * Run with: node scripts/debug.js
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const util = require('util');

// Configuration
const config = {
  backendUrl: 'http://localhost:5000',
  priorityUrl: 'https://t.eu.priority-connect.online/odata/Priority/tabbtbc6.ini/test24/',
  testCredentials: {
    identifier: 'test@example.com',
    code: '123456'
  }
};

// Set up logging
const logFile = path.join(__dirname, '..', 'logs', 'debug.log');
const logDir = path.dirname(logFile);

// Ensure logs directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Create write stream for log file
const log = fs.createWriteStream(logFile, { flags: 'a' });

// Log function that writes to console and file
function logMessage(message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}`;
  
  console.log(logEntry);
  log.write(logEntry + '\n');
  
  if (data) {
    const formatted = typeof data === 'string' ? data : util.inspect(data, { depth: null, colors: false });
    console.log(formatted);
    log.write(formatted + '\n');
  }
}

// Test backend connectivity
async function testBackendConnectivity() {
  try {
    logMessage('Testing backend connectivity...');
    const response = await axios.get(`${config.backendUrl}/api/health`);
    logMessage('Backend health check successful', response.data);
    return true;
  } catch (error) {
    logMessage('Backend health check failed', error.message);
    if (error.response) {
      logMessage('Error response', {
        status: error.response.status,
        data: error.response.data
      });
    }
    return false;
  }
}

// Test backend routes
async function testBackendRoutes() {
  try {
    logMessage('Testing backend API routes...');
    const response = await axios.get(`${config.backendUrl}/api/routes`);
    logMessage('Backend routes check successful', response.data);
    return response.data;
  } catch (error) {
    logMessage('Backend routes check failed', error.message);
    return null;
  }
}

// Test auth endpoints
async function testAuthEndpoints() {
  try {
    logMessage('Testing auth request-code endpoint...');
    const response = await axios.post(`${config.backendUrl}/api/auth/request-code`, {
      identifier: config.testCredentials.identifier
    });
    logMessage('Auth request-code successful', response.data);
    return true;
  } catch (error) {
    logMessage('Auth request-code failed', error.message);
    if (error.response) {
      logMessage('Error response', {
        status: error.response.status,
        data: error.response.data
      });
    }
    return false;
  }
}

// Test Priority API connectivity
async function testPriorityConnectivity() {
  try {
    logMessage('Testing Priority API connectivity...');
    logMessage(`Using Priority URL: ${config.priorityUrl}`);
    
    // Test PHONEBOOK endpoint
    const phonebookResponse = await axios.get(`${config.priorityUrl}PHONEBOOK`, {
      timeout: 10000
    });
    
    logMessage('Priority PHONEBOOK endpoint successful', {
      count: phonebookResponse.data.value.length,
      sample: phonebookResponse.data.value.length > 0 ? phonebookResponse.data.value[0] : null
    });
    
    // Test ORDERS endpoint
    const ordersResponse = await axios.get(`${config.priorityUrl}ORDERS?$filter=CUSTNAME eq '100078'`, {
      timeout: 10000
    });
    
    logMessage('Priority ORDERS endpoint successful', {
      count: ordersResponse.data.value.length,
      sample: ordersResponse.data.value.length > 0 ? ordersResponse.data.value[0] : null
    });
    
    return true;
  } catch (error) {
    logMessage('Priority API connectivity test failed', error.message);
    if (error.response) {
      logMessage('Error response', {
        status: error.response.status,
        data: error.response.data
      });
    }
    return false;
  }
}

// Run all tests
async function runTests() {
  logMessage('===== Starting ALA Application Debug =====');
  
  // Test backend connectivity
  const backendConnected = await testBackendConnectivity();
  
  // Only proceed with other tests if backend is connected
  if (backendConnected) {
    await testBackendRoutes();
    await testAuthEndpoints();
  }
  
  // Test Priority API
  await testPriorityConnectivity();
  
  logMessage('===== ALA Application Debug Complete =====');
  log.end();
}

// Run the tests
runTests().catch(error => {
  logMessage('Error running tests', error);
  log.end();
});
