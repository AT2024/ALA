import axios from 'axios';
import logger from '../utils/logger';
import mockPriorityService from './mockPriorityService';

// Priority API credentials
const PRIORITY_URL =
  process.env.PRIORITY_URL ||
  'https://t.eu.priority-connect.online/odata/Priority/tabbtbc6.ini/test24/';
const PRIORITY_USERNAME = process.env.PRIORITY_USERNAME || 'API';
const PRIORITY_PASSWORD = process.env.PRIORITY_PASSWORD || 'Ap@123456';

// Create axios instance with authentication
const priorityApi = axios.create({
  baseURL: PRIORITY_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  auth: {
    username: PRIORITY_USERNAME,
    password: PRIORITY_PASSWORD,
  },
});

export const priorityService = {
  // Debugging Priority connection
  async debugPriorityConnection() {
    try {
      // Test basic connectivity
      logger.info('Testing connection to Priority API at:', PRIORITY_URL);
      const phonebookResponse = await priorityApi.get(`/PHONEBOOK`, {
        timeout: 10000, // 10 second timeout
      });
      logger.info('Connected to Priority API PHONEBOOK endpoint successfully');
      logger.info('Number of contacts:', phonebookResponse.data.value.length);

      if (phonebookResponse.data.value.length > 0) {
        logger.info('Sample contact data:', phonebookResponse.data.value[0]);
      }

      // Test ORDERS endpoint with a sample customer
      const ordersResponse = await priorityApi.get(`/ORDERS?$filter=CUSTNAME eq '100078'`, {
        timeout: 10000,
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

    // For testing/development, add more test accounts for easier testing
    const testAccounts: Record<
      string,
      {
        email: string;
        phone: string;
        positionCode: number;
        sites: string[];
      }
    > = {
      '475': {
        email: 'test@example.com',
        phone: '475',
        positionCode: 50,
        sites: ['100078'],
      },
      'tzufitc@alphatau.com': {
        email: 'tzufitc@alphatau.com',
        phone: '971',
        positionCode: 99,
        sites: ['100078'],
      },
      'test@example.com': {
        email: 'test@example.com',
        phone: '555-5555',
        positionCode: 99,
        sites: ['100078'],
      },
    };

    // Check if the identifier is one of our test accounts
    if (identifier in testAccounts || identifier.includes('475')) {
      const testKey = (
        identifier in testAccounts ? identifier : '475'
      ) as keyof typeof testAccounts;
      logger.info(`Using test data for user ${testKey}`);
      return {
        found: true,
        fullAccess: testAccounts[testKey].positionCode === 99,
        sites: testAccounts[testKey].sites,
        user: {
          email: testAccounts[testKey].email,
          phone: testAccounts[testKey].phone,
          positionCode: testAccounts[testKey].positionCode,
        },
      };
    }

    try {
      // Search by email or phone
      const isEmail = identifier.includes('@');
      let filterQuery = '';

      if (isEmail) {
        // For email searches, use case-insensitive comparison if possible
        // Note: Some OData services support 'tolower' function for case-insensitive comparisons
        // Try using exact match first as a fallback
        filterQuery = `EMAIL eq '${identifier}'`;
        logger.info(`Searching for email with filter: ${filterQuery}`);
      } else {
        // For phone searches
        // First try to convert to number if possible (clean phone number)
        let phoneNumber = identifier.replace(/\D/g, '');
        if (phoneNumber) {
          filterQuery = `PHONE eq ${phoneNumber}`;
        } else {
          // If conversion fails, use the original string
          filterQuery = `PHONE eq '${identifier}'`;
        }
        logger.info(`Searching for phone with filter: ${filterQuery}`);
      }

      // First try to get specific user with filter
      logger.info(`Making request to Priority PHONEBOOK with filter: ${filterQuery}`);
      const response = await priorityApi.get('/PHONEBOOK', {
        params: {
          $filter: filterQuery,
          $select: 'CUSTNAME,POSITIONCODE,EMAIL,PHONE,NAME',
        },
      });

      logger.info(
        `Priority PHONEBOOK response received: ${response.data.value.length} records found`
      );

      if (response.data.value.length === 0) {
        // If not found with exact match and it's an email, try a more flexible search
        if (isEmail) {
          logger.info(`No exact match found for email ${identifier}, trying to get all users...`);
          // Get all users and then filter client-side (if OData doesn't support case-insensitive search)
          const allUsersResponse = await priorityApi.get('/PHONEBOOK', {
            params: {
              $select: 'CUSTNAME,POSITIONCODE,EMAIL,PHONE,NAME',
            },
          });

          // Filter manually for case-insensitive email match
          const lowerEmail = identifier.toLowerCase();
          const matchingUsers = allUsersResponse.data.value.filter(
            (user: any) => user.EMAIL && user.EMAIL.toLowerCase() === lowerEmail
          );

          if (matchingUsers.length > 0) {
            logger.info(`Found a case-insensitive match for email ${identifier}`);
            const user = matchingUsers[0];

            // Always convert positionCode to a number to avoid type mismatches
            const positionCode = parseInt(user.POSITIONCODE, 10) || 0;

            // Check if user has full access (Alpha Tau employee)
            if (positionCode === 99) {
              // Fetch all sites for admin users
              const sitesResponse = await priorityApi.get('/PHONEBOOK', {
                params: {
                  $select: 'CUSTNAME',
                  $orderby: 'CUSTNAME',
                },
              });

              // Extract unique sites
              const uniqueSites = [
                ...new Set(sitesResponse.data.value.map((item: any) => item.CUSTNAME)),
              ];

              return {
                found: true,
                fullAccess: true,
                sites: uniqueSites,
                user: {
                  email: user.EMAIL,
                  phone: user.PHONE,
                  name: user.NAME,
                  positionCode: positionCode,
                },
              };
            } else {
              // Non-admin users only have access to their associated site
              return {
                found: true,
                fullAccess: false,
                sites: [user.CUSTNAME],
                user: {
                  email: user.EMAIL,
                  phone: user.PHONE,
                  name: user.NAME,
                  positionCode: positionCode,
                },
              };
            }
          }
        }

        // If we still don't have a match
        logger.warn(
          `[Priority] No user found for identifier '${identifier}'. Full response: ${JSON.stringify(
            response.data
          )}`
        );
        return { found: false, sites: [] };
      }

      const user = response.data.value[0];
      logger.info(`Found user in Priority: ${JSON.stringify(user)}`);

      // Always convert positionCode to a number to avoid type mismatches
      const positionCode = parseInt(user.POSITIONCODE, 10) || 0;

      // Check if user has full access (Alpha Tau employee)
      if (positionCode === 99) {
        // Return all sites (fetch them all)
        const sitesResponse = await priorityApi.get('/PHONEBOOK', {
          params: {
            $select: 'CUSTNAME',
            $orderby: 'CUSTNAME',
          },
        });

        // Extract unique sites
        const uniqueSites = [
          ...new Set(sitesResponse.data.value.map((item: any) => item.CUSTNAME)),
        ];

        return {
          found: true,
          fullAccess: true,
          sites: uniqueSites,
          user: {
            email: user.EMAIL,
            phone: user.PHONE,
            name: user.NAME,
            positionCode: positionCode,
          },
        };
      } else {
        // Return only the site the user is associated with
        return {
          found: true,
          fullAccess: false,
          sites: [user.CUSTNAME],
          user: {
            email: user.EMAIL,
            phone: user.PHONE,
            name: user.NAME,
            positionCode: positionCode,
          },
        };
      }
    } catch (error: any) {
      logger.error(`Error getting user site access: ${error}`);

      // Enhanced error handling
      if (error.response) {
        // The request was made and the server responded with a status code outside of 2xx
        logger.error(
          `Priority API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
        );

        // If the user is trying one of our test accounts, provide fallback data
        if (identifier in testAccounts || identifier.includes('475')) {
          const testKey = identifier in testAccounts ? identifier : '475';
          logger.info(`Using fallback data for user ${testKey} after API error`);
          return {
            found: true,
            fullAccess: testAccounts[testKey].positionCode === 99,
            sites: testAccounts[testKey].sites,
            user: {
              email: testAccounts[testKey].email,
              phone: testAccounts[testKey].phone,
              positionCode: testAccounts[testKey].positionCode,
            },
          };
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
            $select: 'ORDNAME,CUSTNAME,ORDNAME,CURDATE,REFERENCE',
          },
        });

        // Map to our treatment format
        const siteTreatments = response.data.value.map((item: any) => ({
          id: item.ORDNAME,
          type: params.type || 'insertion',
          subjectId: item.REFERENCE || 'Unknown',
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
      // Return mock data in case of error
      return mockPriorityService.getMockContacts();
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
      // Return mock data in case of error
      return mockPriorityService.getMockOrders(custName);
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
};

export default priorityService;
