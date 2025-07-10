import axios from 'axios';
import logger from '../utils/logger';
import mockPriorityService from './mockPriorityService';

interface SiteInfo {
  custName: string;
  custDes: string;
}

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
        sites: SiteInfo[];
      }
    > = {
      '475': {
        email: 'test@example.com',
        phone: '475',
        positionCode: 50,
        sites: [{ custName: '100078', custDes: 'Test Hospital' }],
      },
      'tzufitc@alphatau.com': {
        email: 'tzufitc@alphatau.com',
        phone: '971',
        positionCode: 99,
        sites: [{ custName: '100078', custDes: 'Test Hospital' }],
      },
      'test@example.com': {
        email: 'test@example.com',
        phone: '555-5555',
        positionCode: 99,
        sites: [{ custName: '100078', custDes: 'Test Hospital' }],
      },
      // Test user with multiple sites (non-admin)
      'multisite@example.com': {
        email: 'multisite@example.com',
        phone: '123456789',
        positionCode: 50,
        sites: [
          { custName: '100078', custDes: 'Test Hospital' },
          { custName: '100030', custDes: 'Regional Medical Center' },
          { custName: '100045', custDes: 'City General Hospital' }
        ],
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

    // Helper function to get all sites for a non-admin user
    const getAllSitesForUser = async (userEmail: string, userPhone: string) => {
      try {
        logger.info(`Getting all sites for user - email: ${userEmail}, phone: ${userPhone}`);
        
        // Query all PHONEBOOK records for this user by email or phone
        let allUserRecords = [];
        
        // Only query by email if we have a valid email
        if (userEmail && userEmail.includes('@')) {
          try {
            const emailResponse = await priorityApi.get('/PHONEBOOK', {
              params: {
                $filter: `EMAIL eq '${userEmail}'`,
                $select: 'CUSTNAME,CUSTDES,POSITIONCODE,EMAIL,PHONE,NAME',
              },
            });
            allUserRecords.push(...emailResponse.data.value);
            logger.info(`Found ${emailResponse.data.value.length} records by email`);
          } catch (emailError) {
            logger.warn(`Error querying by email: ${emailError}`);
            // Continue with phone query
          }
        }
        
        // Only query by phone if we have a valid phone and didn't already find records
        if (userPhone && allUserRecords.length === 0) {
          try {
            // Clean phone number for query
            const phoneNumber = userPhone.toString().replace(/\D/g, '');
            if (phoneNumber) {
              const phoneResponse = await priorityApi.get('/PHONEBOOK', {
                params: {
                  $filter: `PHONE eq ${phoneNumber}`,
                  $select: 'CUSTNAME,CUSTDES,POSITIONCODE,EMAIL,PHONE,NAME',
                },
              });
              allUserRecords.push(...phoneResponse.data.value);
              logger.info(`Found ${phoneResponse.data.value.length} records by phone`);
            }
          } catch (phoneError) {
            logger.warn(`Error querying by phone: ${phoneError}`);
            // Continue anyway
          }
        }
        
        // Remove duplicates based on CUSTNAME
        const uniqueRecords = allUserRecords.filter((record, index, self) => 
          index === self.findIndex(r => r.CUSTNAME === record.CUSTNAME)
        );
        
        // Extract all unique sites (CUSTNAME values)
        const userSites = uniqueRecords.map(record => record.CUSTNAME).filter(Boolean);
        
        logger.info(`Found ${userSites.length} unique sites for user: ${userSites.join(', ')}`);
        
        return {
          sites: userSites,
          records: uniqueRecords
        };
      } catch (error) {
        logger.error(`Error in getAllSitesForUser: ${error}`);
        // Return empty result on error, will fall back to original logic
        return {
          sites: [],
          records: []
        };
      }
    };

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

      const response = await priorityApi.get('/PHONEBOOK', {
        params: {
          $filter: filterQuery,
          $select: 'CUSTNAME,POSITIONCODE,EMAIL,PHONE,NAME,CUSTDES',
        },
      });

      if (response.data.value.length === 0) {
        // Try case-insensitive search for emails
        if (isEmail) {
          const allUsersResponse = await priorityApi.get('/PHONEBOOK', {
            params: {
              $select: 'CUSTNAME,POSITIONCODE,EMAIL,PHONE,NAME,CUSTDES',
            },
          });

          const lowerEmail = identifier.toLowerCase();
          const matchingUsers = allUsersResponse.data.value.filter(
            (user: any) => user.EMAIL && user.EMAIL.toLowerCase() === lowerEmail
          );

          if (matchingUsers.length > 0) {
            const user = matchingUsers[0];
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
        return { found: false };
      }

      const user = response.data.value[0];
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
      logger.error(`Error getting user from PHONEBOOK: ${error}`);
      return { found: false };
    }
  },

  // STEP 2: Get all sites for Alpha Tau employees (POSITIONCODE=99)
  async getAllSites() {
    try {
      logger.info('Fetching all sites for Alpha Tau employee');
      const sitesResponse = await priorityApi.get('/PHONEBOOK', {
        params: {
          $select: 'CUSTNAME,CUSTDES',
          $orderby: 'CUSTNAME',
        },
      });

      // Extract unique sites with descriptions
      const uniqueSites = sitesResponse.data.value.reduce((acc: SiteInfo[], item: any) => {
        if (item.CUSTNAME && !acc.find((site: SiteInfo) => site.custName === item.CUSTNAME)) {
          acc.push({
            custName: item.CUSTNAME,
            custDes: item.CUSTDES || item.CUSTNAME
          });
        }
        return acc;
      }, [] as SiteInfo[]);

      logger.info(`Retrieved ${uniqueSites.length} unique sites`);
      return uniqueSites;
    } catch (error: any) {
      logger.error(`Error getting all sites: ${error}`);
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

  // Get orders for site using exact Priority API format
  async getOrdersForSiteWithFilter(custName: string) {
    try {
      logger.info(`Getting orders for site ${custName} using Priority API format`);
      
      // Use exact URL format as described: /ORDERS?$filter=CUSTNAME eq %27100030%27
      // The %27 represents URL encoded single quotes
      const filterParam = `CUSTNAME eq '${custName}'`;
      logger.info(`Using filter: ${filterParam}`);
      
      const response = await priorityApi.get('/ORDERS', {
        params: {
          $filter: filterParam,
          $select: 'ORDNAME,CUSTNAME,REFERENCE,CURDATE,ORDSTATUSDES',
        },
      });

      logger.info(`Retrieved ${response.data.value.length} orders for site ${custName}`);
      return response.data.value;
    } catch (error: any) {
      logger.error(`Error getting orders for site ${custName}: ${error}`);
      return [];
    }
  },

  // Get order details using SIBD_APPLICATUSELIST_SUBFORM endpoint
  async getOrderSubform(orderName: string) {
    try {
      logger.info(`Getting order subform for order ${orderName}`);
      
      // Use exact URL format: /ORDERS('SO25000042')/SIBD_APPLICATUSELIST_SUBFORM
      const response = await priorityApi.get(`/ORDERS('${orderName}')/SIBD_APPLICATUSELIST_SUBFORM`);

      logger.info(`Retrieved subform data for order ${orderName}`);
      return response.data.value || [];
    } catch (error: any) {
      logger.error(`Error getting order subform for ${orderName}: ${error}`);
      
      // Fallback to regular SIBD_APPLICATUSELIST table
      logger.info(`Falling back to SIBD_APPLICATUSELIST table for order ${orderName}`);
      return await this.getApplicatorsForTreatment(orderName);
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
      
      const dateFilter = `CUSTNAME eq '${site}' and CURDATE ge datetime'${dateFrom}T00:00:00' and CURDATE le datetime'${dateTo}T23:59:59'`;
      
      const response = await priorityApi.get('/ORDERS', {
        params: {
          $filter: dateFilter,
          $select: 'ORDNAME,CUSTNAME,REFERENCE,CURDATE',
        },
      });
      
      return response.data.value.map((order: any) => ({
        id: order.ORDNAME,
        site: order.CUSTNAME,
        patientId: order.REFERENCE,
        date: order.CURDATE
      }));
      
    } catch (error: any) {
      logger.error(`Error fetching treatments for site and date range: ${error}`);
      return [];
    }
  },

  /**
   * Get applicators for a specific treatment from Priority
   */
  async getApplicatorsForTreatment(treatmentId: string) {
    try {
      logger.info(`Fetching applicators for treatment ${treatmentId}`);
      
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
          patientId: item.REFERENCE,
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
   * Update applicator data in Priority SIBD_APPLICATUSELIST table
   */
  async updateApplicatorInPriority(applicatorData: any) {
    try {
      logger.info(`Updating applicator ${applicatorData.serialNumber} in Priority`);
      
      // Prepare data for Priority update
      const priorityUpdateData = {
        SERNUM: applicatorData.serialNumber,
        ORDNAME: applicatorData.treatmentId,
        REFERENCE: applicatorData.patientId,
        ALPH_USETIME: applicatorData.insertionTime,
        ALPH_USETYPE: applicatorData.usageType,
        ALPH_INSERTED: applicatorData.insertedSeedsQty,
        FREE1: applicatorData.comments || ''
      };
      
      // Check if record exists
      const existingResponse = await priorityApi.get('/SIBD_APPLICATUSELIST', {
        params: {
          $filter: `SERNUM eq '${applicatorData.serialNumber}' and ORDNAME eq '${applicatorData.treatmentId}'`,
          $top: 1
        },
      });
      
      if (existingResponse.data.value.length > 0) {
        // Update existing record
        const existingRecord = existingResponse.data.value[0];
        const updateResponse = await priorityApi.patch(
          `/SIBD_APPLICATUSELIST(SERNUM='${applicatorData.serialNumber}',ORDNAME='${applicatorData.treatmentId}')`,
          priorityUpdateData
        );
        
        logger.info(`Updated existing applicator record in Priority`);
      } else {
        // Create new record
        const createResponse = await priorityApi.post('/SIBD_APPLICATUSELIST', priorityUpdateData);
        logger.info(`Created new applicator record in Priority`);
      }
      
      return {
        success: true,
        message: 'Applicator data updated in Priority successfully'
      };
      
    } catch (error: any) {
      logger.error(`Error updating applicator in Priority: ${error}`);
      
      // For testing, simulate success
      if (process.env.NODE_ENV === 'development') {
        logger.info(`Simulating successful Priority update for testing`);
        return {
          success: true,
          message: 'Applicator data updated in Priority successfully (simulated for testing)'
        };
      }
      
      throw new Error(`Failed to update applicator in Priority: ${error.message}`);
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
};

export default priorityService;
