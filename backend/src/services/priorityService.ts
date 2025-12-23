import axios from 'axios';
import logger from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config/appConfig';

interface SiteInfo {
  custName: string;
  custDes: string;
}

// Helper function to load test data with dynamic dates
const loadTestData = () => {
  try {
    const testDataPath = process.env.NODE_ENV === 'production'
      ? path.join(process.cwd(), 'test-data.json')
      : path.join(__dirname, '../../test-data.json');
    const testDataContent = fs.readFileSync(testDataPath, 'utf8');
    const testData = JSON.parse(testDataContent);
    
    // Generate dynamic dates
    const dynamicDates = generateDynamicDates();
    
    // Create expanded orders array with copies for each date to ensure filtering always finds matches
    if (testData.orders && Array.isArray(testData.orders)) {
      const originalOrders = [...testData.orders];
      const expandedOrders: any[] = [];
      
      // Create three copies of each order - one for each date (yesterday, today, tomorrow)
      originalOrders.forEach((originalOrder: any) => {
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
      testData.orders.forEach((order: any) => {
        logger.info(`Created test order ${order.ORDNAME} (${order.CUSTNAME}) with treatment date: ${order.SIBD_TREATDAY}`);
      });
    }
    
    const ordersByDate = {
      yesterday: testData.orders ? testData.orders.filter((o: any) => o.SIBD_TREATDAY === dynamicDates.yesterday).length : 0,
      today: testData.orders ? testData.orders.filter((o: any) => o.SIBD_TREATDAY === dynamicDates.today).length : 0,
      tomorrow: testData.orders ? testData.orders.filter((o: any) => o.SIBD_TREATDAY === dynamicDates.tomorrow).length : 0
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

// Helper function to generate test data dynamically for specific date
const generateTestDataForDate = (requestedDate: string) => {
  try {
    const testDataPath = process.env.NODE_ENV === 'production'
      ? path.join(process.cwd(), 'test-data.json')
      : path.join(__dirname, '../../test-data.json');
    const testDataContent = fs.readFileSync(testDataPath, 'utf8');
    const baseTestData = JSON.parse(testDataContent);
    
    if (!baseTestData.orders || !Array.isArray(baseTestData.orders)) {
      logger.warn('No orders found in test data');
      return null;
    }
    
    const targetDate = new Date(requestedDate);
    if (isNaN(targetDate.getTime())) {
      logger.warn(`Invalid date provided: ${requestedDate}, falling back to static test data`);
      return loadTestData();
    }
    
    const targetDateISO = targetDate.toISOString();

    const dynamicOrders: any[] = [];
    const generatedPatientRecords = new Set<string>(); // Track already-created patient records to avoid duplicates

    // Generate main orders with the requested date
    baseTestData.orders.forEach((originalOrder: any) => {
      const dynamicOrder = {
        ...originalOrder,
        SIBD_TREATDAY: targetDateISO,
        CURDATE: targetDateISO
      };
      dynamicOrders.push(dynamicOrder);

      // Also create the referenced patient record (if it has a reference)
      // This prevents frontend reference chain validation from filtering out valid orders
      // IMPORTANT: Only create ONE patient record per unique REFERENCE to avoid duplicate combining
      if (originalOrder.REFERENCE && !generatedPatientRecords.has(originalOrder.REFERENCE)) {
        generatedPatientRecords.add(originalOrder.REFERENCE); // Mark as created
        const patientRecord = {
          ORDNAME: originalOrder.REFERENCE,
          CUSTNAME: originalOrder.CUSTNAME,
          CUSTDES: originalOrder.CUSTDES,
          REFERENCE: null, // Patient records don't have references
          CURDATE: targetDateISO,
          SIBD_TREATDAY: targetDateISO,
          ORDSTATUSDES: "Patient Record",
          SBD_SEEDQTY: 0, // Patient records have 0 seeds
          SBD_PREFACTIV: 0,
          DETAILS: `Patient Record for ${originalOrder.DETAILS}`
        };
        dynamicOrders.push(patientRecord);
      }
    });
    
    return {
      ...baseTestData,
      orders: dynamicOrders
    };
    
  } catch (error) {
    logger.error('Error generating dynamic test data:', error);
    return loadTestData(); // Fallback to static test data
  }
};

// Helper function to check if we should use test data for development
const shouldUseTestData = (identifier: string): boolean => {
  // Support both email and UUID for test user (from environment config)
  const isTestUser = identifier === config.testUserEmail || identifier === config.testUserUuid;

  return (process.env.NODE_ENV === 'development' || process.env.ENABLE_TEST_DATA === 'true') && isTestUser;
};

// Helper function to check if an email is in the bypass list
const isEmailInBypassList = (email: string): boolean => {
  const bypassEmails = process.env.BYPASS_PRIORITY_EMAILS;

  if (!bypassEmails) {
    return false;
  }

  const emailList = bypassEmails.split(',').map(e => e.trim().toLowerCase());
  return emailList.includes(email.toLowerCase());
};

// Helper function to create a bypass user response
const createBypassUserResponse = async (email: string, priorityServiceInstance: any) => {
  logger.warn(`BYPASS ACCESS: Granting emergency access to ${email}`);

  // Try to get real sites from ORDERS endpoint
  let realSites = [];
  try {
    realSites = await priorityServiceInstance.getAllSites();
  } catch (error) {
    logger.error('BYPASS: Could not fetch real sites, using fallback:', error);
    realSites = [];
  }
  
  // If no real sites available, use emergency fallback
  if (realSites.length === 0) {
    realSites = [{ custName: 'ALL_SITES', custDes: 'All Sites (Emergency Access)' }];
  }
  
  return {
    found: true,
    fullAccess: true,
    sites: realSites,
    user: {
      email: email,
      phone: '000-BYPASS',
      positionCode: 99,
    },
  };
};

// Helper function to generate dynamic dates for test data
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

// Lazy getters for Priority API credentials
function getPriorityUrl(): string {
  return process.env.PRIORITY_API_URL ||
    'https://t.eu.priority-connect.online/odata/Priority/tabbtbc6.ini/test24';
}

function getPriorityUsername(): string {
  const username = process.env.PRIORITY_API_USERNAME;
  if (!username) {
    throw new Error('PRIORITY_API_USERNAME environment variable is required');
  }
  return username;
}

function getPriorityPassword(): string {
  const password = process.env.PRIORITY_API_PASSWORD;
  if (!password) {
    throw new Error('PRIORITY_API_PASSWORD environment variable is required');
  }
  return password;
}

// Create axios instance with lazy-loaded authentication
const priorityApi = axios.create({
  baseURL: getPriorityUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  auth: {
    username: getPriorityUsername(),
    password: getPriorityPassword(),
  },
});

export const priorityService = {
  // Debugging Priority connection
  async debugPriorityConnection() {
    try {
      // Test basic connectivity
      logger.info('Testing connection to Priority API at:', getPriorityUrl());
      const phonebookResponse = await priorityApi.get(`/PHONEBOOK`, {
        timeout: config.priorityApiShortTimeout, // Configurable timeout
      });
      logger.info('Connected to Priority API PHONEBOOK endpoint successfully');
      logger.info('Number of contacts:', phonebookResponse.data.value.length);

      if (phonebookResponse.data.value.length > 0) {
        logger.info('Sample contact data:', phonebookResponse.data.value[0]);
      }

      // Test ORDERS endpoint with a basic query
      const ordersResponse = await priorityApi.get(`/ORDERS`, {
        params: {
          $top: 5, // Just get first 5 orders for testing
          $select: 'ORDNAME,CUSTNAME,CURDATE'
        },
        timeout: config.priorityApiShortTimeout,
      });
      logger.info('ORDERS endpoint successful');
      logger.info('Number of orders:', ordersResponse.data.value.length);

      if (ordersResponse.data.value.length > 0) {
        logger.info('Sample order data:', ordersResponse.data.value[0]);
      }

      return {
        success: true,
        phonebookCount: phonebookResponse.data.value.length,
        phonebookSample:
          phonebookResponse.data.value.length > 0 ? phonebookResponse.data.value[0] : null,
        ordersCount: ordersResponse.data.value.length,
        ordersSample: ordersResponse.data.value.length > 0 ? ordersResponse.data.value[0] : null,
      };
    } catch (error) {
      logger.error('Priority API connection test failed:', error);
      return {
        success: false,
        error:
          typeof error === 'object' && error !== null && 'message' in error
            ? (error as any).message
            : String(error),
        details:
          typeof error === 'object' &&
          error !== null &&
          'response' in error &&
          (error as any).response
            ? (error as any).response.data
            : null,
      };
    }
  },

  // Get user site permissions
  async getUserSiteAccess(identifier: string) {
    // Always treat identifier as string
    identifier = String(identifier).trim();

    // Priority check: Handle test user FIRST before any Priority API calls
    if (shouldUseTestData(identifier)) {
      const testData = loadTestData();
      if (testData && testData.sites) {
        return {
          found: true,
          fullAccess: true, // Grant full access for testing
          sites: testData.sites.map((site: any) => ({
            custName: site.custName,
            custDes: site.custDes
          })),
          user: {
            email: identifier,
            phone: '555-TEST',
            positionCode: 99,
          },
        };
      } else {
        logger.error(`TEST DATA ERROR: Failed to load test data for user ${identifier}`);
        // Return minimal test data as fallback
        return {
          found: true,
          fullAccess: true,
          sites: [{ custName: 'TEST_SITE', custDes: 'Test Site' }],
          user: {
            email: identifier,
            phone: '555-TEST',
            positionCode: 99,
          },
        };
      }
    }

    // Check for bypass emails before proceeding with Priority API
    const isEmail = identifier.includes('@');

    // For real users, proceed with Priority API calls
    logger.info(`Processing real user ${identifier} through Priority API`);
    
    // Try Priority API with better error handling
    try {
      // Debug the Priority API connection first
      const connectionTest = await this.debugPriorityConnection();
      if (!connectionTest.success) {
        logger.error(`Priority API connection failed for user ${identifier}:`, connectionTest.error);
        
        // If this is a test scenario, fall back to test data
        if (identifier.includes('test') || identifier.includes('example')) {
          logger.info(`Priority API unavailable, using test data fallback for ${identifier}`);
          const testData = loadTestData();
          if (testData && testData.sites) {
            return {
              found: true,
              fullAccess: true,
              sites: testData.sites.map((site: any) => ({
                custName: site.custName,
                custDes: site.custDes
              })),
              user: {
                email: identifier,
                phone: '555-TEST',
                positionCode: 99,
              },
            };
          }
        }
        
        // Check if this is a bypass email before throwing error
        if (isEmail && isEmailInBypassList(identifier)) {
          logger.warn(`BYPASS: Priority API unavailable, granting bypass access to ${identifier}`);
          return await createBypassUserResponse(identifier, this);
        }
        
        throw new Error(`Priority API is currently unavailable. Please try again later.`);
      }
      
      logger.info(`Priority API connection successful. Processing user ${identifier}`);
    } catch (error: any) {
      logger.error(`Priority API connection error: ${error.message}`);
      
      // For test users, provide fallback
      if (identifier.includes('test') || identifier.includes('example')) {
        logger.info(`Using test data fallback for ${identifier} due to API error`);
        const testData = loadTestData();
        if (testData && testData.sites) {
          return {
            found: true,
            fullAccess: true,
            sites: testData.sites.map((site: any) => ({
              custName: site.custName,
              custDes: site.custDes
            })),
            user: {
              email: identifier,
              phone: '555-TEST',
              positionCode: 99,
            },
          };
        }
      }
      
      // Check if this is a bypass email before throwing error
      if (isEmail && isEmailInBypassList(identifier)) {
        logger.warn(`BYPASS: Priority system error, granting bypass access to ${identifier}`);
        return await createBypassUserResponse(identifier, this);
      }
      
      throw new Error(`Priority system is currently unavailable. Please contact support or try again later.`);
    }

    try {
      // STEP 1: Query PHONEBOOK API to get user data
      logger.info(`Step 1: Querying PHONEBOOK API for identifier: ${identifier}`);
      const phonebookUser = await this.getUserFromPhonebook(identifier);
      
      if (!phonebookUser.found) {
        logger.warn(`User not found in PHONEBOOK: ${identifier}`);
        return { found: false, sites: [] };
      }

      // STEP 2: Check POSITIONCODE = 99 for Alpha Tau employees
      logger.info(`Step 2: Checking POSITIONCODE for user: ${phonebookUser.user?.positionCode}`);
      if (phonebookUser.user?.positionCode === 99) {
        logger.info(`User is Alpha Tau employee (POSITIONCODE=99) - granting full access`);
        
        // Get all available sites for admin users
        const allSites = await this.getAllSites();
        
        return {
          found: true,
          fullAccess: true,
          sites: allSites,
          user: phonebookUser.user,
        };
      }

      // STEP 3: Extract CUSTNAME from user record for site filtering
      logger.info(`Step 3: Extracting CUSTNAME values for non-admin user`);
      const userSites = await this.getUserSites(phonebookUser.user?.email || '', phonebookUser.user?.phone || '');
      
      return {
        found: true,
        fullAccess: false,
        sites: userSites,
        user: phonebookUser.user,
      };
    } catch (error: any) {
      logger.error(`Error getting user site access: ${error}`);

      // Enhanced error handling
      if (error.response) {
        // The request was made and the server responded with a status code outside of 2xx
        logger.error(
          `Priority API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
        );

        // If the user is the test user, provide fallback data
        if (identifier === config.testUserEmail || identifier.includes(config.testUserUuid.substring(0, 3))) {
          logger.info(`Using fallback test data for user ${identifier} after API error`);
          const testData = loadTestData();
          if (testData && testData.sites) {
            return {
              found: true,
              fullAccess: true,
              sites: testData.sites.map((site: any) => ({
                custName: site.custName,
                custDes: site.custDes
              })),
              user: {
                email: identifier,
                phone: '555-TEST',
                positionCode: 99,
              },
            };
          }
        }
      } else if (error.request) {
        // The request was made but no response was received
        logger.error('Priority API request made but no response received');
      } else {
        // Something happened in setting up the request
        logger.error(`Priority API setup error: ${error.message}`);
      }

      throw new Error(`Failed to get user site access: ${error.message || error}`);
    }
  },

  // STEP 1: Get user from PHONEBOOK API
  async getUserFromPhonebook(identifier: string) {
    try {
      const isEmail = identifier.includes('@');
      let filterQuery = '';

      if (isEmail) {
        filterQuery = `EMAIL eq '${identifier}'`;
        logger.info(`Searching PHONEBOOK by email: ${filterQuery}`);
      } else {
        // Clean phone number for query
        const phoneNumber = identifier.replace(/\D/g, '');
        if (phoneNumber) {
          filterQuery = `PHONE eq ${phoneNumber}`;
        } else {
          filterQuery = `PHONE eq '${identifier}'`;
        }
        logger.info(`Searching PHONEBOOK by phone: ${filterQuery}`);
      }

      logger.info(`Making Priority API call with filter: ${filterQuery}`);
      const response = await priorityApi.get('/PHONEBOOK', {
        params: {
          $filter: filterQuery,
          $select: 'CUSTNAME,POSITIONCODE,EMAIL,PHONE,NAME,CUSTDES',
        },
        timeout: config.priorityApiTimeout, // Configurable timeout
      });

      logger.info(`Priority API responded with ${response.data.value.length} results for ${identifier}`);

      if (response.data.value.length === 0) {
        logger.warn(`No direct match found for ${identifier}, trying case-insensitive search`);
        
        // Try case-insensitive search for emails
        if (isEmail) {
          logger.info(`Attempting case-insensitive search for email: ${identifier}`);
          const allUsersResponse = await priorityApi.get('/PHONEBOOK', {
            params: {
              $select: 'CUSTNAME,POSITIONCODE,EMAIL,PHONE,NAME,CUSTDES',
            },
            timeout: config.priorityApiTimeout,
          });

          logger.info(`Retrieved ${allUsersResponse.data.value.length} total users for case-insensitive search`);

          const lowerEmail = identifier.toLowerCase();
          const matchingUsers = allUsersResponse.data.value.filter(
            (user: any) => user.EMAIL && user.EMAIL.toLowerCase() === lowerEmail
          );

          logger.info(`Found ${matchingUsers.length} case-insensitive matches for ${identifier}`);

          if (matchingUsers.length > 0) {
            const user = matchingUsers[0];
            logger.info(`Found case-insensitive match: ${user.EMAIL} with POSITIONCODE ${user.POSITIONCODE}`);
            return {
              found: true,
              user: {
                email: user.EMAIL,
                phone: user.PHONE,
                name: user.NAME,
                positionCode: parseInt(user.POSITIONCODE, 10) || 0,
                custName: user.CUSTNAME,
              },
            };
          }
        }
        
        logger.warn(`No user found in Priority PHONEBOOK for identifier: ${identifier}`);
        return { found: false };
      }

      const user = response.data.value[0];
      logger.info(`Found user in Priority PHONEBOOK: ${user.EMAIL} with POSITIONCODE ${user.POSITIONCODE} and CUSTNAME ${user.CUSTNAME}`);
      
      return {
        found: true,
        user: {
          email: user.EMAIL,
          phone: user.PHONE,
          name: user.NAME,
          positionCode: parseInt(user.POSITIONCODE, 10) || 0,
          custName: user.CUSTNAME,
        },
      };
    } catch (error: any) {
      logger.error(`Error getting user from PHONEBOOK for ${identifier}:`, error);
      
      // Log more detailed error information
      if (error.response) {
        logger.error(`Priority API error response:`, {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          headers: error.response.headers
        });
      } else if (error.request) {
        logger.error(`Priority API network error:`, error.request);
      } else {
        logger.error(`Priority API setup error:`, error.message);
      }
      
      return { found: false, error: error.message };
    }
  },

  // STEP 2: Get all sites for Alpha Tau employees (POSITIONCODE=99)
  async getAllSites() {
    try {
      logger.info('Fetching all sites for Alpha Tau employee');
      
      // Use CUSTOMERS endpoint to get ALL sites (not just those with recent orders)
      logger.info('Getting all sites from CUSTOMERS endpoint');
      const customersResponse = await priorityApi.get('/CUSTOMERS', {
        params: {
          $select: 'CUSTNAME,CUSTDES',
          $top: 500, // Get all customers (should capture all 100+ sites)
          $orderby: 'CUSTNAME',
        },
      });

      // Extract unique sites from customers
      const siteMap = new Map();
      customersResponse.data.value.forEach((customer: any) => {
        if (customer.CUSTNAME && !siteMap.has(customer.CUSTNAME)) {
          siteMap.set(customer.CUSTNAME, {
            custName: customer.CUSTNAME,
            custDes: customer.CUSTDES || customer.CUSTNAME
          });
        }
      });
      
      const uniqueSites = Array.from(siteMap.values());
      logger.info(`Retrieved ${uniqueSites.length} sites from CUSTOMERS endpoint`);
      return uniqueSites;
      
    } catch (error: any) {
      logger.error(`Error getting all sites from CUSTOMERS: ${error}`);
      return [];
    }
  },

  // STEP 3: Get sites for specific user based on CUSTNAME
  async getUserSites(userEmail: string, userPhone: string) {
    try {
      logger.info(`Getting sites for user - email: ${userEmail}, phone: ${userPhone}`);
      
      const allUserRecords = [];
      
      // Query by email if available
      if (userEmail && userEmail.includes('@')) {
        try {
          const emailResponse = await priorityApi.get('/PHONEBOOK', {
            params: {
              $filter: `EMAIL eq '${userEmail}'`,
              $select: 'CUSTNAME,CUSTDES',
            },
          });
          allUserRecords.push(...emailResponse.data.value);
          logger.info(`Found ${emailResponse.data.value.length} records by email`);
        } catch (emailError) {
          logger.warn(`Error querying by email: ${emailError}`);
        }
      }
      
      // Query by phone if no email results
      if (userPhone && allUserRecords.length === 0) {
        try {
          const phoneNumber = userPhone.toString().replace(/\D/g, '');
          if (phoneNumber) {
            const phoneResponse = await priorityApi.get('/PHONEBOOK', {
              params: {
                $filter: `PHONE eq ${phoneNumber}`,
                $select: 'CUSTNAME,CUSTDES',
              },
            });
            allUserRecords.push(...phoneResponse.data.value);
            logger.info(`Found ${phoneResponse.data.value.length} records by phone`);
          }
        } catch (phoneError) {
          logger.warn(`Error querying by phone: ${phoneError}`);
        }
      }
      
      // Return both CUSTNAME and CUSTDES for site display
      const uniqueSites = allUserRecords.reduce((acc: SiteInfo[], record: any) => {
        if (record.CUSTNAME && !acc.find((site: SiteInfo) => site.custName === record.CUSTNAME)) {
          acc.push({
            custName: record.CUSTNAME,
            custDes: record.CUSTDES || record.CUSTNAME
          });
        }
        return acc;
      }, [] as SiteInfo[]);
      
      logger.info(`Found ${uniqueSites.length} unique sites for user: ${uniqueSites.map((s: SiteInfo) => s.custName).join(', ')}`);
      return uniqueSites;
    } catch (error: any) {
      logger.error(`Error getting user sites: ${error}`);
      return [];
    }
  },

  // Helper function to combine multiple treatments for the same patient/date/site (pancreas treatments)
  combineMultipleTreatments(orders: any[]): any[] {

    // Group orders by patient ID, site, and treatment day
    const grouped = new Map<string, any[]>();

    orders.forEach(order => {
      // Create grouping key: site + patient + date
      const patientId = order.patientName || order.DETAILS || '';
      const site = order.CUSTNAME || '';
      const treatDay = order.SIBD_TREATDAY || order.CURDATE || '';

      // Only group if we have valid patient ID (skip orders without patient identifier)
      if (!patientId) {
        const key = `UNGROUPED_${order.ORDNAME}`;
        grouped.set(key, [order]);
        return;
      }

      const key = `${site}|${patientId}|${treatDay}`;

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(order);
    });

    // Combine groups with 2+ orders, keep single orders as-is
    const combined: any[] = [];

    grouped.forEach((group, _key) => {
      if (group.length === 1) {
        // Single order, keep as-is
        combined.push(group[0]);
      } else {
        // Multiple orders for same patient/date/site - combine them
        const combinedOrder = {
          ...group[0], // Use first order as base
          ORDNAME: group.map(o => o.ORDNAME).join('+'), // "ORDER1+ORDER2+ORDER3"
          SBD_SEEDQTY: group.reduce((sum, o) => sum + (o.SBD_SEEDQTY || 0), 0), // Sum seed quantities
          SBD_PREFACTIV: group.reduce((sum, o) => sum + (o.SBD_PREFACTIV || 0), 0) / group.length, // Average activity
          _priorityIds: group.map(o => o.ORDNAME), // Track original order IDs
          _isCombined: true, // Flag to indicate this is a combined treatment
          _combinedCount: group.length // Number of orders combined
        };

        combined.push(combinedOrder);
      }
    });

    return combined;
  },

  // Get orders for site using exact Priority API format with optional date filtering
  async getOrdersForSiteWithFilter(custName: string, userId?: string, filterDate?: string) {
    try {
      logger.info(`Getting orders for site ${custName} using Priority API format${filterDate ? ` with date filter: ${filterDate}` : ''}`);
      
      // For development mode with test user, use dynamic test data first
      if (userId && shouldUseTestData(userId)) {
        // Use dynamic test data generation if a specific date is requested
        let testData;
        if (filterDate) {
          testData = generateTestDataForDate(filterDate);
        } else {
          // Fall back to static test data if no specific date
          testData = loadTestData();
        }

        if (testData && testData.orders) {
          let filteredOrders = testData.orders.filter((order: any) => order.CUSTNAME === custName);

          // Apply date filtering to test data if provided (for dynamic data this is redundant but ensures consistency)
          if (filterDate) {
            const targetDate = new Date(filterDate).toISOString().split('T')[0];
            filteredOrders = filteredOrders.filter((order: any) => {
              const orderDate = new Date(order.SIBD_TREATDAY || order.CURDATE).toISOString().split('T')[0];
              return orderDate === targetDate;
            });
          }

          // Map DETAILS field to patientName for test data consistency with validation
          const mappedTestOrders = filteredOrders.map((order: any) => ({
            ...order,
            patientName: (order.DETAILS && typeof order.DETAILS === 'string' && order.DETAILS.trim())
              ? order.DETAILS.trim()
              : null
          }));

          // Detect and combine pancreas/prostate treatments (multiple orders for same patient/date/site)
          const combinedTestOrders = this.combineMultipleTreatments(mappedTestOrders);
          return combinedTestOrders;
        } else {
          logger.warn(`TEST DATA: Failed to load test data for user ${userId}`);
        }
      }
      
      // Build Priority API OData filter with optional date filtering
      let filterParam = `CUSTNAME eq '${custName}'`;
      
      if (filterDate) {
        // Convert date to Priority API OData datetime format
        const targetDate = new Date(filterDate);
        if (!isNaN(targetDate.getTime())) {
          // Use SIBD_TREATDAY as primary treatment date field
          const odataDate = targetDate.toISOString().split('T')[0]; // Get YYYY-MM-DD format
          
          // Add date filter to the OData query
          // Filter by SIBD_TREATDAY (treatment date) - this is the correct field for treatment scheduling
          // Use next day boundary for more reliable filtering (avoids issues with 23:59:59 boundary)
          const nextDay = new Date(targetDate);
          nextDay.setDate(nextDay.getDate() + 1);
          const nextDayString = nextDay.toISOString().split('T')[0];
          
          filterParam += ` and SIBD_TREATDAY ge ${odataDate}T00:00:00Z and SIBD_TREATDAY lt ${nextDayString}T00:00:00Z`;
          
          logger.info(`Priority API: Adding date filter for ${odataDate}`);
        } else {
          logger.warn(`Invalid date format provided: ${filterDate}, proceeding without date filter`);
        }
      }
      
      const response = await priorityApi.get('/ORDERS', {
        params: {
          $filter: filterParam,
          $select: 'ORDNAME,CUSTNAME,REFERENCE,CURDATE,SIBD_TREATDAY,ORDSTATUSDES,SBD_SEEDQTY,SBD_PREFACTIV,DETAILS',
        },
        timeout: config.priorityApiTimeout, // Configurable timeout
      });

      logger.info(`Retrieved ${response.data.value.length} orders for site ${custName}`);

      // Map DETAILS field to patientName for treatment creation with validation
      const mappedOrders = response.data.value.map((order: any) => ({
        ...order,
        patientName: (order.DETAILS && typeof order.DETAILS === 'string' && order.DETAILS.trim())
          ? order.DETAILS.trim()
          : null
      }));

      // Detect and combine pancreas treatments (multiple orders for same patient/date/site)
      const combinedOrders = this.combineMultipleTreatments(mappedOrders);

      return combinedOrders;
    } catch (error: any) {
      logger.error(`Error getting orders for site ${custName}: ${error}`);
      
      // Log detailed error information
      if (error.response) {
        logger.error(`Priority API error response:`, {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
      }
      
      // Only fall back to test data if this is a test user
      if (userId && shouldUseTestData(userId)) {
        logger.warn(`Priority API failed for test user ${userId}, using test data fallback`);
        let testData;
        if (filterDate) {
          testData = generateTestDataForDate(filterDate);
        } else {
          testData = loadTestData();
        }
        
        if (testData && testData.orders) {
          let filteredOrders = testData.orders.filter((order: any) => order.CUSTNAME === custName);
          
          // Apply date filtering to fallback test data if provided
          if (filterDate) {
            const targetDate = new Date(filterDate).toISOString().split('T')[0];
            filteredOrders = filteredOrders.filter((order: any) => {
              const orderDate = new Date(order.SIBD_TREATDAY || order.CURDATE).toISOString().split('T')[0];
              return orderDate === targetDate;
            });
          }

          // Map DETAILS field to patientName for fallback test data consistency with validation
          const mappedFallbackOrders = filteredOrders.map((order: any) => ({
            ...order,
            patientName: (order.DETAILS && typeof order.DETAILS === 'string' && order.DETAILS.trim())
              ? order.DETAILS.trim()
              : null
          }));

          // Detect and combine pancreas treatments (multiple orders for same patient/date/site)
          const combinedFallbackOrders = this.combineMultipleTreatments(mappedFallbackOrders);

          return combinedFallbackOrders;
        }
      }
      
      // For real users, never return test data - throw error instead
      logger.error(`Priority API failed for real user ${userId || 'unknown'} at site ${custName}`);
      throw error;
    }
  },

  // Get order details using SIBD_APPLICATUSELIST_SUBFORM endpoint
  async getOrderSubform(orderName: string, userId?: string, treatmentType?: string) {
    try {
      // Handle combined orders (pancreas) - split and merge results
      if (orderName.includes('+')) {
        const orderIds = orderName.split('+');
        const allApplicators: any[] = [];
        for (const orderId of orderIds) {
          const applicators: any = await this.getOrderSubform(orderId.trim(), userId, treatmentType);
          if (applicators && applicators.length > 0) {
            allApplicators.push(...applicators);
          }
        }
        return allApplicators;
      }

      logger.info(`Getting order subform for order ${orderName}, type: ${treatmentType || 'unknown'}`);

      // For development mode with test user, prioritize test data
      if (userId && shouldUseTestData(userId)) {
        logger.info(`Development mode: Using test subform data for user ${userId} and order ${orderName}`);
        const testData = loadTestData();
        if (testData && testData.subform_data) {
          // Handle expanded order names (SO25000010_Y, SO25000010_T, SO25000010_M)
          // Extract the base order name by removing the suffix
          const baseOrderName = orderName.replace(/_(Y|T|M)$/, '');

          if (testData.subform_data[baseOrderName]) {
            const applicators = testData.subform_data[baseOrderName].value || [];

            // For removal treatments, ensure applicators show as inserted but not yet removed
            if (treatmentType === 'removal') {
              return applicators.map((app: any) => ({
                ...app,
                isRemoved: false,
                removalComments: null,
                removalTime: null
              }));
            }

            return applicators;
          } else if (testData.subform_data[orderName]) {
            logger.info(`Using test subform data for exact order ${orderName}`);
            const applicators = testData.subform_data[orderName].value || [];

            // For removal treatments, ensure applicators show as inserted but not yet removed
            if (treatmentType === 'removal') {
              return applicators.map((app: any) => ({
                ...app,
                isRemoved: false,
                removalComments: null,
                removalTime: null
              }));
            }

            return applicators;
          }
        }
      }
      
      // For real users, go directly to Priority API
      logger.info(`Real user - calling Priority API for order ${orderName}`);
      
      // Use exact URL format: /ORDERS('SO25000042')/SIBD_APPLICATUSELIST_SUBFORM
      const response = await priorityApi.get(`/ORDERS('${orderName}')/SIBD_APPLICATUSELIST_SUBFORM`);

      logger.info(`Retrieved subform data for order ${orderName}`);
      return response.data.value || [];
    } catch (error: any) {
      logger.error(`Error getting order subform for ${orderName}: ${error}`);
      
      // Only fall back to test data for test users
      if (userId && shouldUseTestData(userId)) {
        logger.warn(`Priority API failed for test user ${userId}, using test data fallback for subform ${orderName}`);
        const testData = loadTestData();
        if (testData && testData.subform_data) {
          // Handle expanded order names for error fallback as well
          const baseOrderName = orderName.replace(/_(Y|T|M)$/, '');

          if (testData.subform_data[baseOrderName]) {
            return testData.subform_data[baseOrderName].value || [];
          } else if (testData.subform_data[orderName]) {
            return testData.subform_data[orderName].value || [];
          }
        }
      }

      // For real users, try fallback to SIBD_APPLICATUSELIST table first
      try {
        return await this.getApplicatorsForTreatment(orderName, userId);
      } catch (fallbackError: any) {
        logger.error(`Both subform and fallback failed for real user ${userId || 'unknown'} for order ${orderName}`);
        throw error;
      }
    }
  },

  // Get detailed order information including seed quantity and activity
  async getOrderDetails(orderName: string) {
    try {
      logger.info(`Getting detailed order information for order ${orderName}`);
      
      // Try to load test data first
      const testData = loadTestData();
      if (testData && testData.orders) {
        const orderDetails = testData.orders.find((order: any) => order.ORDNAME === orderName);
        if (orderDetails) {
          logger.info(`Using test data for order details ${orderName}`);
          // Map DETAILS field to patientName for test data with validation
          return {
            ...orderDetails,
            patientName: (orderDetails.DETAILS && typeof orderDetails.DETAILS === 'string' && orderDetails.DETAILS.trim())
              ? orderDetails.DETAILS.trim()
              : null
          };
        }
      }
      
      // Use exact URL format: /ORDERS('SO25000042')
      const response = await priorityApi.get(`/ORDERS('${orderName}')`, {
        params: {
          $select: 'ORDNAME,CUSTNAME,CUSTDES,REFERENCE,CURDATE,ORDSTATUSDES,SBD_SEEDQTY,SBD_PREFACTIV,DETAILS',
        },
      });

      logger.info(`Retrieved detailed order information for ${orderName}`);

      // Map DETAILS field to patientName with validation
      const orderWithPatientName = {
        ...response.data,
        patientName: (response.data.DETAILS && typeof response.data.DETAILS === 'string' && response.data.DETAILS.trim())
          ? response.data.DETAILS.trim()
          : null
      };

      return orderWithPatientName;
    } catch (error: any) {
      logger.error(`Error getting order details for ${orderName}: ${error}`);
      
      // Fallback to test data if API fails
      const testData = loadTestData();
      if (testData && testData.orders) {
        const orderDetails = testData.orders.find((order: any) => order.ORDNAME === orderName);
        if (orderDetails) {
          logger.info(`Using test data fallback for order details ${orderName}`);
          // Map DETAILS field to patientName for test data fallback with validation
          return {
            ...orderDetails,
            patientName: (orderDetails.DETAILS && typeof orderDetails.DETAILS === 'string' && orderDetails.DETAILS.trim())
              ? orderDetails.DETAILS.trim()
              : null
          };
        }
      }
      
      throw new Error(`Failed to get order details: ${error.message}`);
    }
  },

  // Get treatments for specified sites
  async getTreatmentsForSites(sites: string[], params: any) {
    try {
      const allTreatments = [];

      // For each site, get treatments
      for (const site of sites) {
        const orderFilter = `CUSTNAME eq '${site}'`;

        const response = await priorityApi.get('/ORDERS', {
          params: {
            $filter: orderFilter,
            $select: 'ORDNAME,CUSTNAME,CURDATE,REFERENCE,DETAILS',
          },
        });

        // Map to our treatment format
        const siteTreatments = response.data.value.map((item: any) => ({
          id: item.ORDNAME,
          type: params.type || 'insertion',
          subjectId: item.REFERENCE || 'Unknown',
          patientName: item.DETAILS || null,
          site: item.CUSTNAME,
          date: item.CURDATE || new Date().toISOString().split('T')[0],
          isComplete: false,
        }));

        allTreatments.push(...siteTreatments);
      }

      // Apply any additional filtering
      return this.filterTreatments(allTreatments, params);
    } catch (error) {
      logger.error(`Error getting treatments for sites: ${error}`);
      throw new Error(`Failed to get treatments: ${error}`);
    }
  },

  // Filter treatments based on params
  filterTreatments(treatments: any[], params: any) {
    let filtered = [...treatments];

    if (params.subjectId) {
      filtered = filtered.filter((t) => t.subjectId.includes(params.subjectId));
    }

    if (params.date) {
      const paramDate = new Date(params.date).toISOString().split('T')[0];
      filtered = filtered.filter((t) => {
        const treatmentDate = new Date(t.date).toISOString().split('T')[0];
        return treatmentDate === paramDate;
      });
    }

    // Apply treatment date rules for 'removal' type
    if (params.type === 'removal') {
      const today = new Date();
      filtered = filtered.filter((t) => {
        const treatmentDate = new Date(t.date);
        const daysSinceInsertion = Math.floor(
          (today.getTime() - treatmentDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        return daysSinceInsertion >= 14 && daysSinceInsertion <= 20;
      });
    }

    return filtered;
  },

  // Get all contacts from Priority PHONEBOOK
  async getContacts() {
    try {
      const response = await priorityApi.get('/PHONEBOOK', {
        params: {
          $select: 'CUSTNAME,EMAIL,NAME,PHONE,POSITIONCODE,CUSTDES',
        },
      });
      return response.data.value;
    } catch (error) {
      logger.error(`Error getting contacts: ${error}`);
      // Return mock data in case of error (development only)
      if (process.env.NODE_ENV === 'development') {
        logger.warn('Using mock contacts data as fallback in development mode');
        const testData = loadTestData();
        if (testData && testData.sites) {
          return testData.sites.map((site: any) => ({
            EMAIL: config.testUserEmail,
            NAME: 'Test User',
            PHONE: '555-TEST',
            POSITIONCODE: '99',
            CUSTNAME: site.custName,
            CUSTDES: site.custDes
          }));
        }
        return [];
      }
      // In production, throw error instead of returning mock data
      throw new Error(`Priority API error: ${error}`);
    }
  },

  // Get orders for a specific CUSTNAME (site)
  async getOrdersForSite(custName: string) {
    try {
      const response = await priorityApi.get('/ORDERS', {
        params: {
          $filter: `CUSTNAME eq '${custName}'`,
        },
      });
      return response.data.value;
    } catch (error) {
      logger.error(`Error getting orders for site: ${error}`);
      // Return mock data in case of error (development only)
      if (process.env.NODE_ENV === 'development') {
        logger.warn(`Using mock orders data as fallback in development mode for site: ${custName}`);
        const testData = loadTestData();
        if (testData && testData.orders) {
          const filteredOrders = testData.orders.filter((order: any) => order.CUSTNAME === custName);
          return filteredOrders;
        }
        return [];
      }
      // In production, throw error instead of returning mock data
      throw new Error(`Priority API error: ${error}`);
    }
  },

  // Get allowed sites for user based on POSITIONCODE and CUSTNAME
  async getAllowedSitesForUser(userPositionCode: string, userCustName: string) {
    try {
      // Admin (99) has access to all sites
      if (userPositionCode === '99') {
        const response = await priorityApi.get('/PHONEBOOK', {
          params: {
            $select: 'CUSTNAME,CUSTDES',
            $orderby: 'CUSTNAME',
          },
        });

        // Extract unique sites
        const sites = [
          ...new Set(
            response.data.value.map((item: any) => ({
              custName: item.CUSTNAME,
              custDes: item.CUSTDES,
            }))
          ),
        ];

        return sites;
      } else {
        // Non-admin users only have access to their own site
        return [
          {
            custName: userCustName,
            custDes: 'User Site',
          },
        ];
      }
    } catch (error) {
      logger.error(`Error getting allowed sites: ${error}`);
      // Return basic data in case of error
      return [
        {
          custName: userCustName,
          custDes: 'User Site',
        },
      ];
    }
  },

  // Send treatment data to Priority
  async updatePriorityWithTreatment(treatmentData: any) {
    try {
      // Skip Priority sync for test data mode
      // Check if we're in test mode and the treatment is for test data
      if (process.env.ENABLE_TEST_DATA === 'true' && treatmentData.subjectId && treatmentData.subjectId.startsWith('SO')) {
        // For test treatments, use the subject ID as the priority ID
        // This ensures consistency between local and Azure environments
        logger.info(`Test mode: Using subject ID ${treatmentData.subjectId} as priority ID`);
        return {
          success: true,
          priorityId: treatmentData.subjectId,
          message: 'Test mode - using subject ID as priority ID',
        };
      }

      // Map treatment data to Priority format
      const priorityData = {
        CUSTNAME: treatmentData.site,
        REFERENCE: treatmentData.subjectId,
        CURDATE: new Date(treatmentData.date).toISOString(),
        // Map other fields as needed
      };

      // For a new treatment
      if (!treatmentData.priorityId) {
        const response = await priorityApi.post('/ORDERS', priorityData);
        return {
          success: true,
          priorityId: response.data.ORDNAME,
          message: 'Treatment created in Priority system',
        };
      }
      // For updating an existing treatment
      else {
        const response = await priorityApi.patch(
          `/ORDERS(ORDNAME='${treatmentData.priorityId}')`,
          priorityData
        );
        return {
          success: true,
          priorityId: treatmentData.priorityId,
          message: 'Treatment updated in Priority system',
        };
      }
    } catch (error) {
      logger.error(`Error updating Priority: ${error}`);
      throw new Error(`Failed to update Priority system: ${error}`);
    }
  },

  // Validate applicator for manual entry (24± hours, same site)
  async validateApplicatorForManualEntry(serialNumber: string, currentSite: string, currentDate: string) {
    try {
      logger.info(`Validating applicator ${serialNumber} for manual entry at site ${currentSite}`);
      
      // Get applicator data from Priority
      const applicatorData = await this.getApplicatorFromPriority(serialNumber);
      
      if (!applicatorData.found) {
        return {
          valid: false,
          reason: 'Applicator not found in Priority system',
          applicatorData: null
        };
      }
      
      // Check if applicator has a treatment ID (meaning it's been used)
      if (!applicatorData.data?.treatmentId) {
        return {
          valid: false,
          reason: 'Applicator has not been assigned to any treatment',
          applicatorData: applicatorData.data || null
        };
      }
      
      // Get the original treatment details to validate site and date
      const originalTreatment = await this.getOrderDetails(applicatorData.data.treatmentId);
      
      if (!originalTreatment) {
        return {
          valid: false,
          reason: 'Original treatment not found',
          applicatorData: applicatorData.data
        };
      }
      
      // Validate same site
      if (originalTreatment.CUSTNAME !== currentSite) {
        return {
          valid: false,
          reason: `Applicator is from different site (${originalTreatment.CUSTNAME}). Must be from same site (${currentSite})`,
          applicatorData: applicatorData.data
        };
      }
      
      // Validate time range (24± hours)
      const currentDateTime = new Date(currentDate);
      const originalDateTime = new Date(originalTreatment.CURDATE);
      const hoursDifference = Math.abs(currentDateTime.getTime() - originalDateTime.getTime()) / (1000 * 60 * 60);
      
      if (hoursDifference > 48) { // 24± means up to 48 hours
        return {
          valid: false,
          reason: `Applicator is from treatment ${Math.round(hoursDifference)} hours ago. Must be within 48 hours.`,
          applicatorData: applicatorData.data
        };
      }
      
      logger.info(`Applicator ${serialNumber} validation successful`);
      return {
        valid: true,
        reason: 'Applicator validation successful',
        applicatorData: applicatorData.data,
        originalTreatment: originalTreatment
      };
      
    } catch (error: any) {
      logger.error(`Error validating applicator ${serialNumber}: ${error}`);
      return {
        valid: false,
        reason: `Validation error: ${error.message}`,
        applicatorData: null
      };
    }
  },

  /**
   * Get applicator data from Priority SIBD_APPLICATUSELIST table
   */
  async getApplicatorFromPriority(serialNumber: string) {
    try {
      logger.info(`Fetching applicator ${serialNumber} from Priority SIBD_APPLICATUSELIST`);
      
      // Query SIBD_APPLICATUSELIST table for the serial number
      const response = await priorityApi.get('/SIBD_APPLICATUSELIST', {
        params: {
          $filter: `SERNUM eq '${serialNumber}'`,
          $select: 'SERNUM,PARTNAME,ORDNAME,REFERENCE,ALPH_USETYPE,ALPH_USETIME,ALPH_INSERTED,FREE1',
          $top: 1
        },
      });
      
      if (response.data.value.length === 0) {
        return {
          found: false
        };
      }
      
      const applicatorData = response.data.value[0];
      
      return {
        found: true,
        data: {
          serialNumber: applicatorData.SERNUM,
          partName: applicatorData.PARTNAME,
          treatmentId: applicatorData.ORDNAME,
          intendedPatientId: applicatorData.REFERENCE,
          usageType: applicatorData.ALPH_USETYPE,
          usageTime: applicatorData.ALPH_USETIME,
          insertedSeeds: applicatorData.ALPH_INSERTED || 0,
          comments: applicatorData.FREE1 || ''
        }
      };
      
    } catch (error: any) {
      logger.error(`Error fetching applicator from Priority: ${error}`);
      
      // For testing purposes, return mock data for specific serial numbers
      if (serialNumber.startsWith('APP') || serialNumber.startsWith('TEST')) {
        return {
          found: true,
          data: {
            serialNumber: serialNumber,
            partName: 'Standard Applicator Type A',
            treatmentId: null,
            intendedPatientId: null,
            usageType: null,
            usageTime: null,
            insertedSeeds: 0,
            comments: ''
          }
        };
      }
      
      return {
        found: false,
        error: error.message
      };
    }
  },

  /**
   * Get part details from Priority PARTS table
   */
  async getPartDetails(partName: string) {
    try {
      logger.info(`Fetching part details for ${partName} from Priority PARTS`);
      
      // Query PARTS table for part information
      const response = await priorityApi.get('/PARTS', {
        params: {
          $filter: `PARTNAME eq '${partName}'`,
          $select: 'PARTNAME,PARTDES,SBD_SEEDQTY,INTDATA2',
          $top: 1
        },
      });
      
      if (response.data.value.length === 0) {
        // Return default values for testing
        return {
          partDes: partName,
          seedQuantity: 25
        };
      }
      
      const partData = response.data.value[0];
      
      return {
        partDes: partData.PARTDES || partName,
        seedQuantity: partData.SBD_SEEDQTY || partData.INTDATA2 || 25
      };
      
    } catch (error: any) {
      logger.error(`Error fetching part details: ${error}`);
      
      // Return default values for testing
      return {
        partDes: partName,
        seedQuantity: 25
      };
    }
  },

  /**
   * Get treatments for a site within a date range
   */
  async getTreatmentsForSiteAndDateRange(site: string, dateFrom: string, dateTo: string) {
    try {
      logger.info(`Fetching treatments for site ${site} from ${dateFrom} to ${dateTo}`);
      
      const dateFilter = `CUSTNAME eq '${site}' and SIBD_TREATDAY ge datetime'${dateFrom}T00:00:00' and SIBD_TREATDAY le datetime'${dateTo}T23:59:59'`;
      
      const response = await priorityApi.get('/ORDERS', {
        params: {
          $filter: dateFilter,
          $select: 'ORDNAME,CUSTNAME,REFERENCE,SIBD_TREATDAY',
        },
      });
      
      return response.data.value.map((order: any) => ({
        id: order.ORDNAME,
        site: order.CUSTNAME,
        patientId: order.ORDNAME,
        date: order.SIBD_TREATDAY
      }));
      
    } catch (error: any) {
      logger.error(`Error fetching treatments for site and date range: ${error}`);
      return [];
    }
  },

  /**
   * Get applicators for a specific treatment from Priority
   */
  async getApplicatorsForTreatment(treatmentId: string, userId?: string) {
    try {
      logger.info(`Fetching applicators for treatment ${treatmentId}`);
      
      // Check if we should use test data for development
      if (userId && shouldUseTestData(userId)) {
        const testData = loadTestData();
        if (testData && testData.subform_data && testData.subform_data[treatmentId]) {
          logger.info(`Using test data for applicators in treatment ${treatmentId}`);
          const testApplicators = testData.subform_data[treatmentId].value;
          
          return testApplicators.map((item: any) => ({
            serialNumber: item.SERNUM,
            applicatorType: item.PARTDES,
            seedQuantity: item.INTDATA2,
            treatmentId: item.ORDNAME,
            patientId: treatmentId,
            usageType: item.USINGTYPE,
            usageTime: item.INSERTIONDATE,
            insertedSeeds: item.INSERTEDSEEDSQTY || 0,
            comments: item.INSERTIONCOMMENTS || ''
          }));
        }
      }
      
      const response = await priorityApi.get('/SIBD_APPLICATUSELIST', {
        params: {
          $filter: `ORDNAME eq '${treatmentId}'`,
          $select: 'SERNUM,PARTNAME,ORDNAME,REFERENCE,ALPH_USETYPE,ALPH_USETIME,ALPH_INSERTED,FREE1',
        },
      });
      
      const applicators = [];
      
      for (const item of response.data.value) {
        // Get part details for each applicator
        const partDetails = await this.getPartDetails(item.PARTNAME);
        
        applicators.push({
          serialNumber: item.SERNUM,
          applicatorType: partDetails.partDes,
          seedQuantity: partDetails.seedQuantity,
          treatmentId: item.ORDNAME,
          patientId: item.ORDNAME,
          usageType: item.ALPH_USETYPE,
          usageTime: item.ALPH_USETIME,
          insertedSeeds: item.ALPH_INSERTED || 0,
          comments: item.FREE1 || ''
        });
      }
      
      return applicators;
      
    } catch (error: any) {
      logger.error(`Error fetching applicators for treatment: ${error}`);
      return [];
    }
  },

  /**
   * Update applicator data in Priority using ORDERS subform
   */
  async updateApplicatorInPriority(applicatorData: any) {
    try {
      // Check if Priority applicator saving is enabled
      const enablePrioritySaving = process.env.ENABLE_PRIORITY_APPLICATOR_SAVE !== 'false';
      
      if (!enablePrioritySaving) {
        logger.info(`Priority applicator saving disabled via configuration`);
        return {
          success: true,
          message: 'Applicator data saved locally (Priority saving disabled)'
        };
      }

      logger.info(`Saving applicator ${applicatorData.serialNumber} to Priority via ORDERS subform`);
      
      // Prepare data for Priority subform - using the ORDERS/${orderName}/SIBD_APPLICATUSELIST_SUBFORM endpoint
      const priorityUpdateData = {
        SERNUM: applicatorData.serialNumber,
        PARTNAME: 'Standard Applicator', // Default part name
        ALPH_USETIME: applicatorData.insertionTime,
        ALPH_USETYPE: applicatorData.usageType,
        ALPH_INSERTED: applicatorData.insertedSeedsQty,
        FREE1: applicatorData.comments || ''
      };
      
      logger.info(`Prepared Priority subform data:`, priorityUpdateData);
      
      // Send data to Priority using the ORDERS subform endpoint
      const orderName = applicatorData.treatmentId;
      logger.info(`Sending applicator data to Priority ORDERS('${orderName}')/SIBD_APPLICATUSELIST_SUBFORM`);
      
      const response = await priorityApi.post(`/ORDERS('${orderName}')/SIBD_APPLICATUSELIST_SUBFORM`, priorityUpdateData);
      logger.info(`Successfully saved applicator record to Priority subform`);
      
      return {
        success: true,
        message: 'Applicator data saved to Priority successfully'
      };
      
    } catch (error: any) {
      logger.error(`Error updating applicator in Priority: ${error}`);
      logger.error(`Error details:`, {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url
      });
      
      // In development mode, simulate success to allow local testing
      if (process.env.NODE_ENV === 'development') {
        logger.info(`Development mode: Simulating successful Priority update`);
        return {
          success: true,
          message: 'Applicator data saved locally (Priority save simulated in development)'
        };
      }
      
      // In production, don't throw error - log it but return success so local save works
      logger.warn(`Priority save failed but continuing with local save`);
      return {
        success: true,
        message: 'Applicator data saved locally (Priority integration temporary issue)'
      };
    }
  },

  /**
   * Get available applicators for a treatment from same site within date range
   * Used for applicator dropdown selection
   */
  async getAvailableApplicatorsForTreatment(site: string, currentDate: string, userId?: string) {
    try {
      logger.info(`Fetching available applicators for site ${site} around date ${currentDate}`);
      
      // Calculate date range (day before and day after)
      // Handle various date formats that might come from the frontend
      let parsedDate: Date;
      try {
        // Try parsing the date directly
        parsedDate = new Date(currentDate);
        
        // If that fails, try parsing different formats
        if (isNaN(parsedDate.getTime())) {
          // Try converting DD.MMM.YYYY format (e.g., "14.Jul.2025")
          const datePattern = /(\d{1,2})\.(\w{3})\.(\d{4})/;
          const match = currentDate.match(datePattern);
          if (match) {
            const [, day, month, year] = match;
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const monthIndex = monthNames.indexOf(month);
            if (monthIndex !== -1) {
              parsedDate = new Date(parseInt(year), monthIndex, parseInt(day));
            }
          }
        }
        
        // If still invalid, use current date
        if (isNaN(parsedDate.getTime())) {
          logger.warn(`Invalid date format: ${currentDate}, using current date`);
          parsedDate = new Date();
        }
      } catch (error) {
        logger.warn(`Error parsing date: ${currentDate}, using current date`);
        parsedDate = new Date();
      }
      
      const dayBefore = new Date(parsedDate);
      dayBefore.setDate(parsedDate.getDate() - 1);
      const dayAfter = new Date(parsedDate);
      dayAfter.setDate(parsedDate.getDate() + 1);
      
      const dateFrom = dayBefore.toISOString().split('T')[0];
      const dateTo = dayAfter.toISOString().split('T')[0];
      
      logger.info(`Date range: ${dateFrom} to ${dateTo} (parsed from: ${currentDate})`);
      
      // STEP 1: Get orders for the site using the correct Priority API workflow with date range filtering
      logger.info(`Getting orders for site ${site} using Priority API format with date range ${dateFrom} to ${dateTo}`);
      
      // Get orders for each day in the date range (since Priority API date filtering is precise)
      const allOrders = [];
      const currentDateObj = new Date(dateFrom);
      const endDateObj = new Date(dateTo);
      
      while (currentDateObj <= endDateObj) {
        const dateString = currentDateObj.toISOString().split('T')[0];
        const dayOrders = await this.getOrdersForSiteWithFilter(site, userId, dateString);
        allOrders.push(...dayOrders);
        currentDateObj.setDate(currentDateObj.getDate() + 1);
      }

      // Remove duplicates based on ORDNAME
      const orders = allOrders.filter((order, index, self) =>
        index === self.findIndex(o => o.ORDNAME === order.ORDNAME)
      );

      if (orders.length === 0) {
        return [];
      }

      // Use all orders since they're already date-filtered at API level
      const filteredOrders = orders;
      
      // STEP 3: Get subform data (applicators) for each order
      const allApplicators = [];
      for (const order of filteredOrders) {
        try {
          logger.info(`Getting subform data for order ${order.ORDNAME}`);
          const subformData = await this.getOrderSubform(order.ORDNAME, userId);
          
          if (subformData && subformData.length > 0) {
            // Transform subform data to applicator format
            const applicators = subformData.map((item: any) => ({
              serialNumber: item.SERNUM,
              applicatorType: item.PARTDES || 'Unknown Applicator',
              seedQuantity: item.INTDATA2 || 0,
              treatmentId: item.ORDNAME || order.ORDNAME,
              patientId: order.ORDNAME || 'Unknown Patient',
              usageType: item.USINGTYPE || null,
              usageTime: item.INSERTIONDATE || null,
              insertedSeeds: item.INSERTEDSEEDSQTY || 0,
              comments: item.INSERTIONCOMMENTS || ''
            }));
            
            allApplicators.push(...applicators);
            logger.info(`Added ${applicators.length} applicators from order ${order.ORDNAME}`);
          } else {
            logger.info(`No subform data found for order ${order.ORDNAME}`);
          }
        } catch (subformError: any) {
          logger.error(`Error getting subform data for order ${order.ORDNAME}: ${subformError.message}`);
          // Continue with other orders
        }
      }
      
      logger.info(`Found ${allApplicators.length} total applicators`);
      
      // STEP 4: Remove duplicates and return unique applicators
      const uniqueApplicators = allApplicators.filter((applicator, index, self) => 
        index === self.findIndex(a => a.serialNumber === applicator.serialNumber)
      );
      
      logger.info(`Returning ${uniqueApplicators.length} unique applicators for site ${site}`);
      
      return uniqueApplicators;
      
    } catch (error: any) {
      logger.error(`Error getting available applicators for site ${site}: ${error.message}`);
      
      // Enhanced error logging
      if (error.response) {
        logger.error(`Priority API error response:`, {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
      }
      
      return [];
    }
  },

  /**
   * Search applicators by name with fuzzy matching
   */
  async searchApplicatorsByName(query: string, site: string, currentDate: string) {
    try {
      logger.info(`Searching applicators by name: "${query}" for site ${site}`);
      
      const availableApplicators = await this.getAvailableApplicatorsForTreatment(site, currentDate, query);
      
      if (availableApplicators.length === 0) {
        return { found: false, suggestions: [] };
      }
      
      // Simple fuzzy matching implementation
      const normalizedQuery = query.toLowerCase().trim();
      
      // Exact match first
      const exactMatch = availableApplicators.find(app => 
        app.serialNumber.toLowerCase() === normalizedQuery
      );
      
      if (exactMatch) {
        return { found: true, applicator: exactMatch, suggestions: [] };
      }
      
      // Partial matches
      const partialMatches = availableApplicators.filter(app => 
        app.serialNumber.toLowerCase().includes(normalizedQuery)
      );
      
      if (partialMatches.length > 0) {
        return { found: false, suggestions: partialMatches.slice(0, 5) };
      }
      
      // Similar names (simple Levenshtein distance)
      const similarMatches = availableApplicators.filter(app => {
        const distance = this.calculateLevenshteinDistance(
          normalizedQuery, 
          app.serialNumber.toLowerCase()
        );
        return distance <= 2; // Allow 2 character differences
      });
      
      return { found: false, suggestions: similarMatches.slice(0, 5) };
      
    } catch (error: any) {
      logger.error(`Error searching applicators: ${error}`);
      return { found: false, suggestions: [] };
    }
  },


  /**
   * Simple Levenshtein distance calculation for fuzzy matching
   */
  calculateLevenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  },

  /**
   * Check removal status for a treatment order
   * Returns true if the treatment is ready for removal (status = "Waiting for removal")
   */
  async checkRemovalStatus(orderId: string, userId?: string): Promise<{
    readyForRemoval: boolean;
    status: string;
    orderFound: boolean;
    error?: string;
  }> {
    try {
      // For development mode with test user, check test data first
      if (userId && shouldUseTestData(userId)) {
        const testData = loadTestData();
        if (testData && testData.orders) {
          // Handle expanded order names (SO25000010_Y, SO25000010_T, SO25000010_M)
          const baseOrderId = orderId.replace(/_(Y|T|M)$/, '');

          const order = testData.orders.find((o: any) =>
            o.ORDNAME === orderId || o.ORDNAME === baseOrderId
          );

          if (order) {
            const status = order.ORDSTATUSDES || 'Open';
            const readyForRemoval = status === 'Waiting for removal' || status === 'Performed';

            return {
              readyForRemoval,
              status,
              orderFound: true
            };
          } else {
            return {
              readyForRemoval: false,
              status: 'Not Found',
              orderFound: false
            };
          }
        }
      }

      // For real users, query Priority API
      try {
        const response = await priorityApi.get(`/ORDERS('${orderId}')`, {
          params: {
            $select: 'ORDNAME,ORDSTATUSDES,CUSTNAME,REFERENCE',
          },
          timeout: config.priorityApiTimeout,
        });

        if (response.data) {
          const orderStatus = response.data.ORDSTATUSDES || 'Open';
          const readyForRemoval = orderStatus === 'Waiting for removal' || orderStatus === 'Performed';

          return {
            readyForRemoval,
            status: orderStatus,
            orderFound: true
          };
        } else {
          return {
            readyForRemoval: false,
            status: 'Not Found',
            orderFound: false
          };
        }
      } catch (apiError: any) {
        logger.error(`Error querying Priority API for order ${orderId}:`, apiError);

        // If this is a test user and API fails, fall back to test data
        if (userId && shouldUseTestData(userId)) {
          logger.warn(`Priority API failed for test user ${userId}, using test data fallback for removal status check`);
          const testData = loadTestData();
          if (testData && testData.orders) {
            const baseOrderId = orderId.replace(/_(Y|T|M)$/, '');
            const order = testData.orders.find((o: any) =>
              o.ORDNAME === orderId || o.ORDNAME === baseOrderId
            );

            if (order) {
              const status = order.ORDSTATUSDES || 'Open';
              const readyForRemoval = status === 'Waiting for removal' || status === 'Performed';

              return {
                readyForRemoval,
                status,
                orderFound: true
              };
            }
          }
        }

        // For real users, don't use test data fallback
        throw apiError;
      }
    } catch (error: any) {
      logger.error(`Error checking removal status for order ${orderId}: ${error.message}`);

      return {
        readyForRemoval: false,
        status: 'Error',
        orderFound: false,
        error: error.message
      };
    }
  },

  /**
   * Update treatment status in Priority ORDERS table
   */
  async updateTreatmentStatus(orderName: string, status: 'Performed' | 'Removed') {
    try {
      logger.info(`Updating treatment ${orderName} status to ${status} in Priority`);

      const updateData = {
        ORDSTATUSDES: status
      };

      const response = await priorityApi.patch(`/ORDERS(ORDNAME='${orderName}')`, updateData);

      logger.info(`Successfully updated treatment status to ${status}`);

      return {
        success: true,
        message: `Treatment status updated to "${status}" in Priority`
      };

    } catch (error: any) {
      logger.error(`Error updating treatment status in Priority: ${error}`);

      // For testing, simulate success
      if (process.env.NODE_ENV === 'development') {
        logger.info(`Simulating successful treatment status update for testing`);
        return {
          success: true,
          message: `Treatment status updated to "${status}" in Priority (simulated for testing)`
        };
      }

      throw new Error(`Failed to update treatment status in Priority: ${error.message}`);
    }
  },

  /**
   * Upload file attachment to applicator in Priority from Buffer (in-memory)
   * Uses the correct Priority API format with composite key and data URL
   * No local file storage needed - files go directly to Priority ERP
   */
  async uploadApplicatorAttachmentFromBuffer(
    serialNumber: string,
    orderId: string,
    zipBuffer: Buffer
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Check if Priority saving is enabled
      const enablePrioritySaving = process.env.ENABLE_PRIORITY_APPLICATOR_SAVE !== 'false';

      if (!enablePrioritySaving) {
        logger.info(`Priority attachment saving disabled via configuration`);
        return {
          success: true,
          message: 'Attachment upload skipped (Priority saving disabled)'
        };
      }

      logger.info(`Uploading attachment buffer for applicator ${serialNumber} to Priority`);

      // Step 1: Handle combined pancreas orders (format: "SO25000275+SO25000274")
      const orderIds = orderId.includes('+') ? orderId.split('+') : [orderId];
      logger.info(`Uploading attachment for applicator ${serialNumber} to ${orderIds.length} order(s): ${orderIds.join(', ')}`);

      // Try each order until we find the applicator
      let applicator: any = null;
      let foundInOrderId = '';  // Track which base order ID we found the applicator in

      for (const singleOrderId of orderIds) {
        try {
          const getEndpoint = `/ORDERS('${singleOrderId}')/SIBD_APPLICATUSELIST_SUBFORM?$filter=SERNUM eq '${serialNumber}'`;
          logger.info(`Trying order ${singleOrderId}: ${getEndpoint}`);

          const applicatorResponse = await priorityApi.get(getEndpoint);

          if (applicatorResponse.data.value && applicatorResponse.data.value.length > 0) {
            applicator = applicatorResponse.data.value[0];
            foundInOrderId = singleOrderId;  // Store the base order ID for PATCH endpoint
            logger.info(`Found applicator ${serialNumber} in order ${singleOrderId}`);
            break;
          }
        } catch (err: any) {
          logger.warn(`Applicator not found in order ${singleOrderId}: ${err.message}`);
        }
      }

      if (!applicator) {
        throw new Error(`Applicator ${serialNumber} not found in any Priority order: ${orderIds.join(', ')}`);
      }

      // Validate composite key fields exist
      if (!applicator.ORDNAME || applicator.SIBD_REPPRODPAL === undefined) {
        logger.error(`Missing composite key fields. ORDNAME: ${applicator.ORDNAME}, SIBD_REPPRODPAL: ${applicator.SIBD_REPPRODPAL}`);
        throw new Error(`Invalid applicator record - missing ORDNAME or SIBD_REPPRODPAL fields`);
      }

      logger.info(`Found applicator: ORDNAME=${applicator.ORDNAME}, SIBD_REPPRODPAL=${applicator.SIBD_REPPRODPAL}`);

      // Step 2: Convert buffer to data URL format (no file read needed)
      const base64Zip = zipBuffer.toString('base64');
      const dataUrl = `data:application/zip;base64,${base64Zip}`;

      logger.info(`Prepared ZIP buffer: ${(zipBuffer.length / 1024).toFixed(2)} KB`);

      // Step 3: Build PATCH endpoint with composite key
      // Path uses BASE order ID (foundInOrderId), composite key uses FULL ORDNAME (with LOAD suffix)
      const patchEndpoint = `/ORDERS('${foundInOrderId}')/SIBD_APPLICATUSELIST_SUBFORM(ORDNAME='${applicator.ORDNAME}',SIBD_REPPRODPAL=${applicator.SIBD_REPPRODPAL})`;

      // Step 4: Send PATCH request with data URL format
      // NOTE: Do NOT include SUFFIX field - it doesn't exist in Priority SIBD_APPLICATUSELIST schema
      // The data URL format already contains the MIME type (application/zip) which Priority uses
      const requestBody = {
        EXTFILENAME: dataUrl
      };

      logger.info(`Sending PATCH to: ${patchEndpoint}`);
      logger.info(`Request body fields: EXTFILENAME length=${dataUrl.length}`);

      const response = await priorityApi.patch(patchEndpoint, requestBody);

      if (response.status !== 200 && response.status !== 204) {
        throw new Error(`Priority API returned status ${response.status}: ${response.statusText}`);
      }

      logger.info(`Successfully uploaded attachment for applicator ${serialNumber} to Priority`);

      return {
        success: true,
        message: 'Attachment uploaded to Priority successfully'
      };

    } catch (error: any) {
      logger.error(`Error uploading attachment to Priority: ${error.message}`);
      // Log detailed error info including full response data for debugging
      const errorData = error.response?.data;
      logger.error(`Priority API Error Response Data: ${JSON.stringify(errorData, null, 2)}`);
      logger.error(`Error details:`, {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: JSON.stringify(errorData),
        requestUrl: error.config?.url
      });

      // Always return failure when Priority upload fails
      // Use ENABLE_PRIORITY_APPLICATOR_SAVE=false to skip Priority uploads entirely (checked at start of function)
      return {
        success: false,
        message: `Failed to upload attachment to Priority: ${error.message}`
      };
    }
  },

  /**
   * Get site users from Priority PHONEBOOK for email selection in finalization
   * Returns users associated with a specific site (CUSTNAME)
   */
  async getSiteUsers(site: string): Promise<Array<{ email: string; name: string; position: string }>> {
    try {
      logger.info(`Fetching site users from PHONEBOOK for site: ${site}`);

      const response = await priorityApi.get('/PHONEBOOK', {
        params: {
          $filter: `CUSTNAME eq '${site}'`,
          $select: 'EMAIL,NAME,POSITIONCODE,CUSTNAME',
          $orderby: 'NAME',
        },
        timeout: config.priorityApiTimeout,
      });

      if (!response.data.value || response.data.value.length === 0) {
        logger.info(`No users found in PHONEBOOK for site: ${site}`);
        return [];
      }

      // Map Priority position codes to readable positions
      const positionMap: { [key: string]: string } = {
        '1': 'physician',
        '2': 'nurse',
        '3': 'physicist',
        '10': 'technician',
        '99': 'admin',
      };

      const users = response.data.value
        .filter((user: any) => user.EMAIL) // Only users with email addresses
        .map((user: any) => ({
          email: user.EMAIL,
          name: user.NAME || user.EMAIL,
          position: positionMap[user.POSITIONCODE] || 'staff',
        }));

      logger.info(`Found ${users.length} users for site ${site}`);
      return users;

    } catch (error: any) {
      logger.error(`Error fetching site users from PHONEBOOK: ${error}`);

      // Log more detailed error information
      if (error.response) {
        logger.error(`Priority API error response:`, {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
        });
      }

      // Return empty array on error - don't throw
      return [];
    }
  },
};

export default priorityService;
