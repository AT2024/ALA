// Simple test to verify loadTestData function is working correctly
const fs = require('fs');
const path = require('path');

// Mock logger
const logger = {
  info: console.log,
  warn: console.warn,
  error: console.error
};

// Generate dynamic dates function (copied from priorityService.ts)
const generateDynamicDates = () => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  
  return {
    today: today.toISOString(),
    yesterday: yesterday.toISOString(),
    tomorrow: tomorrow.toISOString(),
    // Also provide formatted dates for different use cases
    todayFormatted: today.toISOString().split('T')[0],
    yesterdayFormatted: yesterday.toISOString().split('T')[0],
    tomorrowFormatted: tomorrow.toISOString().split('T')[0]
  };
};

// Load test data function (copied from priorityService.ts)
const loadTestData = () => {
  try {
    const testDataPath = path.join(__dirname, 'test-data.json');
    const testDataContent = fs.readFileSync(testDataPath, 'utf8');
    const testData = JSON.parse(testDataContent);
    
    // Generate dynamic dates
    const dynamicDates = generateDynamicDates();
    
    // Create expanded orders array with copies for each date to ensure filtering always finds matches
    if (testData.orders && Array.isArray(testData.orders)) {
      const originalOrders = [...testData.orders];
      const expandedOrders = [];
      
      // Create three copies of each order - one for each date (yesterday, today, tomorrow)
      originalOrders.forEach((originalOrder) => {
        // Yesterday copy
        const yesterdayOrder = { 
          ...originalOrder, 
          ORDNAME: `${originalOrder.ORDNAME}_Y`,
          SIBD_TREATDAY: dynamicDates.yesterday,
          CURDATE: dynamicDates.yesterday
        };
        expandedOrders.push(yesterdayOrder);
        
        // Today copy
        const todayOrder = { 
          ...originalOrder, 
          ORDNAME: `${originalOrder.ORDNAME}_T`,
          SIBD_TREATDAY: dynamicDates.today,
          CURDATE: dynamicDates.today
        };
        expandedOrders.push(todayOrder);
        
        // Tomorrow copy
        const tomorrowOrder = { 
          ...originalOrder, 
          ORDNAME: `${originalOrder.ORDNAME}_M`,
          SIBD_TREATDAY: dynamicDates.tomorrow,
          CURDATE: dynamicDates.tomorrow
        };
        expandedOrders.push(tomorrowOrder);
      });
      
      // Replace the orders array with the expanded version
      testData.orders = expandedOrders;
      
      // Log each expanded order for debugging
      testData.orders.forEach((order) => {
        logger.info(`Created test order ${order.ORDNAME} (${order.CUSTNAME}) with treatment date: ${order.SIBD_TREATDAY}`);
      });
    }
    
    const ordersByDate = {
      yesterday: testData.orders ? testData.orders.filter((o) => o.SIBD_TREATDAY === dynamicDates.yesterday).length : 0,
      today: testData.orders ? testData.orders.filter((o) => o.SIBD_TREATDAY === dynamicDates.today).length : 0,
      tomorrow: testData.orders ? testData.orders.filter((o) => o.SIBD_TREATDAY === dynamicDates.tomorrow).length : 0
    };
    
    logger.info('Test data loaded with dynamic dates and expanded orders:', {
      yesterday: dynamicDates.yesterdayFormatted,
      today: dynamicDates.todayFormatted,
      tomorrow: dynamicDates.tomorrowFormatted,
      totalOrders: testData.orders ? testData.orders.length : 0,
      orderDistribution: ordersByDate
    });
    
    return testData;
  } catch (error) {
    logger.warn('Could not load test data file, using fallback data');
    return null;
  }
};

// Test the date filtering logic
const testDateFiltering = (testData, site, filterDate) => {
  console.log(`\n🔍 Testing date filtering for site: ${site}, date: ${filterDate}`);
  
  if (!testData || !testData.orders) {
    console.log('❌ No test data available');
    return [];
  }
  
  // Filter by site first
  let filteredOrders = testData.orders.filter((order) => order.CUSTNAME === site);
  console.log(`   Site filter: ${filteredOrders.length} orders match site ${site}`);
  
  // Apply date filtering if provided
  if (filterDate) {
    const targetDate = new Date(filterDate).toISOString().split('T')[0];
    filteredOrders = filteredOrders.filter((order) => {
      const orderDate = new Date(order.SIBD_TREATDAY || order.CURDATE).toISOString().split('T')[0];
      return orderDate === targetDate;
    });
    console.log(`   Date filter: ${filteredOrders.length} orders match date ${targetDate}`);
  }
  
  filteredOrders.forEach((order, index) => {
    console.log(`     ${index + 1}. ${order.ORDNAME} - ${order.CUSTNAME} - ${new Date(order.SIBD_TREATDAY).toISOString().split('T')[0]}`);
  });
  
  return filteredOrders;
};

// Run the test
console.log('🧪 Testing loadTestData function...\n');

const testData = loadTestData();

if (testData) {
  console.log('\n✅ Test data loaded successfully!');
  console.log(`   Total orders: ${testData.orders.length}`);
  console.log(`   Total sites: ${testData.sites.length}`);
  
  // Test date filtering for different dates
  const testSite = '100078'; // Main Test Hospital
  const dates = generateDynamicDates();
  
  console.log('\n🔍 Testing date filtering...');
  
  // Test yesterday
  const yesterdayOrders = testDateFiltering(testData, testSite, dates.yesterday.split('T')[0]);
  console.log(`   Yesterday result: ${yesterdayOrders.length > 0 ? '✅ PASS' : '❌ FAIL'}`);
  
  // Test today
  const todayOrders = testDateFiltering(testData, testSite, dates.today.split('T')[0]);
  console.log(`   Today result: ${todayOrders.length > 0 ? '✅ PASS' : '❌ FAIL'}`);
  
  // Test tomorrow
  const tomorrowOrders = testDateFiltering(testData, testSite, dates.tomorrow.split('T')[0]);
  console.log(`   Tomorrow result: ${tomorrowOrders.length > 0 ? '✅ PASS' : '❌ FAIL'}`);
  
  console.log('\n🎯 Summary:');
  console.log('   The fix ensures that test users will see patients for any selected date');
  console.log('   Each original order is expanded into 3 orders (_Y, _T, _M suffixes)');
  console.log('   Date filtering now works consistently like the Priority API');
  
} else {
  console.log('❌ Failed to load test data');
}