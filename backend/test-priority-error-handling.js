const axios = require('axios');

const API_BASE = 'http://localhost:5000';

async function testPriorityErrorHandling() {
  console.log('🔍 Testing Priority API Error Handling\n');
  
  // Test 1: Test user should get test data when Priority API fails
  console.log('📝 Test 1: Test user fallback to test data');
  try {
    // We need to authenticate first to get proper user context
    const testLoginResponse = await axios.post(`${API_BASE}/api/auth/verify`, {
      identifier: 'test@example.com',
      code: '123456'
    });
    
    const testToken = testLoginResponse.data.token;
    console.log('✅ Test user authenticated successfully');
    
    // Now try to get orders for a site - this should fallback to test data
    const testOrdersResponse = await axios.post(`${API_BASE}/api/proxy/priority/orders`, {
      site: 'TESTSITE',
      date: '2025-08-19',
      procedureType: 'insertion'
    }, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    
    console.log(`✅ Test user received ${testOrdersResponse.data.orders.length} orders from test data fallback`);
    console.log('✅ Test 1 PASSED: Test user correctly received test data\n');
  } catch (error) {
    console.log('❌ Test 1 FAILED: Test user should have received test data');
    console.error('Error:', error.response?.data || error.message);
    console.log('');
  }
  
  // Test 2: Real user should get error (not test data) when Priority API fails
  console.log('📝 Test 2: Real user should get error, not test data');
  try {
    // Try to authenticate as a real user (this will likely fail with Priority API down)
    const realUserEmail = 'realuser@hospital.com';
    
    const realLoginResponse = await axios.post(`${API_BASE}/api/auth/verify`, {
      identifier: realUserEmail,
      code: '123456'
    });
    
    console.log('⚠️ Real user authenticated - this is unexpected if Priority API is down');
    
    // If we somehow get a token, test orders API
    const realToken = realLoginResponse.data.token;
    const realOrdersResponse = await axios.post(`${API_BASE}/api/proxy/priority/orders`, {
      site: 'REALSITE',
      date: '2025-08-19',
      procedureType: 'insertion'
    }, {
      headers: { Authorization: `Bearer ${realToken}` }
    });
    
    // If we get here with test data, that's a failure
    if (realOrdersResponse.data.orders && realOrdersResponse.data.orders.length > 0) {
      const hasTestData = realOrdersResponse.data.orders.some(order => 
        order.ORDNAME && order.ORDNAME.includes('TEST')
      );
      
      if (hasTestData) {
        console.log('❌ Test 2 FAILED: Real user received test data instead of error');
        console.log('❌ CRITICAL BUG: Test data leaked to real user!');
      } else {
        console.log('✅ Test 2 PASSED: Real user received real Priority data (not test data)');
      }
    } else {
      console.log('⚠️ Real user received empty data - could be correct if no orders exist');
    }
  } catch (error) {
    // This is expected - real users should get errors when Priority API fails
    if (error.response?.status === 404 || error.response?.status === 500) {
      console.log('✅ Test 2 PASSED: Real user correctly received error instead of test data');
      console.log(`✅ Error message: ${error.response.data.error || error.message}`);
    } else {
      console.log('⚠️ Test 2: Unexpected error type');
      console.error('Error:', error.response?.data || error.message);
    }
    console.log('');
  }
  
  console.log('🏁 Priority API Error Handling Test Complete');
}

// Run the test
testPriorityErrorHandling().catch(console.error);