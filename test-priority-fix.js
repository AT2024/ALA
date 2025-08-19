const axios = require('axios');

const baseURL = 'http://localhost:5000';

// Test our test data fix
async function testPriorityData() {
  console.log('🧪 Testing Priority Service Test Data Fix...\n');
  
  try {
    // First, validate the test user
    console.log('Step 1: Validating test user...');
    const validateResponse = await axios.post(`${baseURL}/api/proxy/priority/validate-email`, {
      email: 'test@example.com'
    });
    
    if (validateResponse.data.isValid) {
      console.log('✅ Test user validated successfully');
      console.log('   Sites:', validateResponse.data.userData.sites.map(s => s.custName || s));
      
      console.log('\nStep 2: Testing loadTestData function directly...');
      
      // Since we can't easily test with auth, let's test the core logic by checking debug endpoint
      const debugResponse = await axios.get(`${baseURL}/api/proxy/priority/debug`);
      console.log('   Debug response available:', !!debugResponse.data);
      
      // Test getting orders for different dates
      const testSite = '100078'; // Main Test Hospital from test data
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      
      console.log('\nStep 2: Testing date filtering...');
      
      const dates = [
        { name: 'Yesterday', date: yesterday.toISOString().split('T')[0] },
        { name: 'Today', date: today.toISOString().split('T')[0] },
        { name: 'Tomorrow', date: tomorrow.toISOString().split('T')[0] }
      ];
      
      for (const dateTest of dates) {
        console.log(`\nTesting ${dateTest.name} (${dateTest.date}):`);
        
        try {
          const ordersResponse = await axios.post(`${baseURL}/api/proxy/priority/orders`, {
            site: testSite,
            date: dateTest.date,
            procedureType: 'insertion'
          }, {
            headers: {
              'Authorization': `Bearer ${mockToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          const orders = ordersResponse.data.orders || [];
          console.log(`   📊 Found ${orders.length} orders for ${testSite} on ${dateTest.name}`);
          
          if (orders.length > 0) {
            console.log('   📋 Sample orders:');
            orders.slice(0, 3).forEach((order, index) => {
              console.log(`     ${index + 1}. ${order.ORDNAME} - Seeds: ${order.SBD_SEEDQTY} - Activity: ${order.SBD_PREFACTIV}`);
            });
            console.log(`   ✅ ${dateTest.name} test PASSED - Orders found!`);
          } else {
            console.log(`   ❌ ${dateTest.name} test FAILED - No orders found!`);
          }
          
        } catch (error) {
          console.log(`   ❌ ${dateTest.name} test ERROR:`, error.response?.data?.error || error.message);
        }
      }
      
      console.log('\n🎯 Test Summary:');
      console.log('   - Test data should now show patients for yesterday, today, and tomorrow');
      console.log('   - Each order should have a unique suffix (_Y, _T, _M)');
      console.log('   - Date filtering should work consistently');
      
    } else {
      console.log('❌ Test user validation failed');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testPriorityData().then(() => {
  console.log('\n🧪 Test completed!');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Test script error:', error);
  process.exit(1);
});