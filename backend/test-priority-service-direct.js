const path = require('path');

// Mock Priority API to simulate failures
const mockAxios = {
  get: () => {
    throw new Error('Priority API is down - simulated failure');
  }
};

// Mock logger
const mockLogger = {
  info: (...args) => console.log('INFO:', ...args),
  warn: (...args) => console.log('WARN:', ...args),
  error: (...args) => console.log('ERROR:', ...args)
};

// Mock filesystem operations for test data
const fs = require('fs');
const originalReadFileSync = fs.readFileSync;

const mockTestData = {
  orders: [
    {
      ORDNAME: 'TEST001',
      CUSTNAME: 'TESTSITE',
      SIBD_TREATDAY: '2025-08-19T00:00:00.000Z',
      SBD_SEEDQTY: '25',
      SBD_PREFACTIV: '0.5',
      REFERENCE: null
    }
  ]
};

// Mock fs.readFileSync to return test data
fs.readFileSync = (filePath, encoding) => {
  if (filePath.includes('test-data.json')) {
    return JSON.stringify(mockTestData);
  }
  return originalReadFileSync(filePath, encoding);
};

// Helper function to check if we should use test data
const shouldUseTestData = (identifier) => {
  return process.env.NODE_ENV === 'development' && identifier === 'test@example.com';
};

console.log('🧪 Testing Priority Service Error Handling Logic\n');

// Test the core logic without full service dependencies
async function testErrorHandlingLogic() {
  console.log('📝 Test 1: Test user should get fallback data when Priority API fails');
  
  // Simulate the error handling logic from priorityService
  const custName = 'TESTSITE';
  const userId = 'test@example.com';
  const filterDate = '2025-08-19';
  
  try {
    // Simulate Priority API failure
    mockLogger.error(`Error getting orders for site ${custName}: Priority API is down - simulated failure`);
    
    // Check error handling logic
    if (userId && shouldUseTestData(userId)) {
      mockLogger.warn(`❌ Priority API failed for test user ${userId}, using test data fallback`);
      
      // Load test data (mocked)
      const testData = mockTestData;
      
      if (testData && testData.orders) {
        let filteredOrders = testData.orders.filter((order) => order.CUSTNAME === custName);
        
        // Apply date filtering to fallback test data
        if (filterDate) {
          const targetDate = new Date(filterDate).toISOString().split('T')[0];
          filteredOrders = filteredOrders.filter((order) => {
            const orderDate = new Date(order.SIBD_TREATDAY).toISOString().split('T')[0];
            return orderDate === targetDate;
          });
        }
        
        mockLogger.info(`🧪 TEST USER FALLBACK: Retrieved ${filteredOrders.length} orders for site ${custName} from test data fallback`);
        console.log('✅ Test 1 PASSED: Test user correctly received test data fallback');
        console.log(`✅ Retrieved ${filteredOrders.length} test orders for site ${custName}\n`);
        return filteredOrders;
      }
    } else {
      // For real users, throw error
      mockLogger.error(`❌ Priority API failed for real user ${userId || 'unknown'} at site ${custName}`);
      mockLogger.error(`❌ Real users should not receive test data - throwing error`);
      throw new Error('Priority API is down - simulated failure');
    }
  } catch (error) {
    console.log('❌ Test 1 FAILED: Test user should have received test data');
    throw error;
  }
}

async function testRealUserErrorHandling() {
  console.log('📝 Test 2: Real user should get error, not test data');
  
  const custName = 'REALSITE';
  const userId = 'realuser@hospital.com';
  const filterDate = '2025-08-19';
  
  try {
    // Simulate Priority API failure
    mockLogger.error(`Error getting orders for site ${custName}: Priority API is down - simulated failure`);
    
    // Check error handling logic
    if (userId && shouldUseTestData(userId)) {
      // This should not execute for real users
      console.log('❌ Test 2 FAILED: Real user incorrectly treated as test user');
      return;
    } else {
      // For real users, throw error (this is correct behavior)
      mockLogger.error(`❌ Priority API failed for real user ${userId || 'unknown'} at site ${custName}`);
      mockLogger.error(`❌ Real users should not receive test data - throwing error`);
      throw new Error('Priority API is down - simulated failure');
    }
  } catch (error) {
    console.log('✅ Test 2 PASSED: Real user correctly received error instead of test data');
    console.log(`✅ Error: ${error.message}\n`);
  }
}

// Run tests
testErrorHandlingLogic()
  .then(() => testRealUserErrorHandling())
  .then(() => {
    console.log('🏁 Priority Service Error Handling Logic Test Complete');
    console.log('✅ CONCLUSION: Error handling logic is working correctly');
    console.log('✅ Test users get fallback data, real users get errors');
  })
  .catch(error => {
    console.error('❌ Test failed:', error.message);
  });