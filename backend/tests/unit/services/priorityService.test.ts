// Priority Service Test Suite - Medical Application Testing
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { mockPriorityResponses, mockSites, mockOrders, mockPriorityUser, mockPriorityAdminUser } from '../../fixtures/testData';
import { setupPriorityApiMocks, resetAllMocks, mockApiError } from '../../helpers/mockHelpers';

// Create mock axios instance at module level BEFORE importing priorityService
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockAxiosInstance: { get: jest.Mock<any>; post: jest.Mock<any>; patch: jest.Mock<any>; delete: jest.Mock<any> } = {
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn()
};

// Mock axios module - must be before importing priorityService
jest.mock('axios', () => ({
  create: jest.fn(() => mockAxiosInstance),
  default: {
    create: jest.fn(() => mockAxiosInstance)
  }
}));

// Import priorityService AFTER the mock is set up
import priorityService from '../../../src/services/priorityService';

// Mock file system for test data loading
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  existsSync: jest.fn()
}));

describe('Priority Service', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    resetAllMocks();

    // Clear the module-level mock axios instance
    mockAxiosInstance.get.mockReset();
    mockAxiosInstance.post.mockReset();
    mockAxiosInstance.patch.mockReset();
    mockAxiosInstance.delete.mockReset();

    // Setup Priority API mocks
    setupPriorityApiMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('debugPriorityConnection', () => {
    test('should successfully test Priority API connection', async () => {
      // Mock successful API responses
      mockAxiosInstance.get
        .mockResolvedValueOnce(mockPriorityResponses.phonebook)
        .mockResolvedValueOnce(mockPriorityResponses.orders);

      const result = await priorityService.debugPriorityConnection();

      expect(result.success).toBe(true);
      expect(result.phonebookCount).toBe(1);
      expect(result.ordersCount).toBe(2);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/PHONEBOOK', { timeout: 10000 });
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/ORDERS', {
        params: { $top: 5, $select: 'ORDNAME,CUSTNAME,CURDATE' },
        timeout: 10000
      });
    });

    test('should handle Priority API connection failure', async () => {
      // Mock API error
      const apiError = mockApiError(500, 'Connection failed');
      mockAxiosInstance.get.mockRejectedValue(apiError);

      const result = await priorityService.debugPriorityConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection failed');
    });

    test('should handle network timeout', async () => {
      // Mock timeout error
      const timeoutError = new Error('timeout of 10000ms exceeded');
      timeoutError.name = 'TimeoutError';
      mockAxiosInstance.get.mockRejectedValue(timeoutError);

      const result = await priorityService.debugPriorityConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe('timeout of 10000ms exceeded');
    });
  });

  describe('getUserSiteAccess', () => {
    test('should handle test@example.com with test data', async () => {
      // Mock file system to return test data
      const fs = require('fs');
      fs.readFileSync.mockReturnValue(JSON.stringify({
        sites: mockSites,
        orders: mockOrders
      }));

      const result = await priorityService.getUserSiteAccess('test@example.com');

      expect(result.found).toBe(true);
      expect(result.fullAccess).toBe(true);
      expect(result.sites).toHaveLength(3);
      expect(result.user?.positionCode).toBe(99);
      expect(result.user?.email).toBe('test@example.com');
    });

    test('should handle regular user with Priority API', async () => {
      // Mock successful Priority API responses
      mockAxiosInstance.get
        .mockResolvedValueOnce(mockPriorityResponses.phonebook)
        .mockResolvedValueOnce(mockPriorityResponses.orders)
        .mockResolvedValueOnce(mockPriorityResponses.phonebook)
        .mockResolvedValueOnce(mockPriorityResponses.phonebook);

      const result = await priorityService.getUserSiteAccess('regular@hospital.com');

      expect(result.found).toBe(true);
      expect(result.fullAccess).toBe(false);
      expect(result.sites).toBeDefined();
      expect(result.user).toBeDefined();
    });

    test('should handle Alpha Tau employee with position code 99', async () => {
      // Mock Priority API responses for admin user
      mockAxiosInstance.get
        .mockResolvedValueOnce(mockPriorityResponses.phonebook)
        .mockResolvedValueOnce(mockPriorityResponses.orders)
        .mockResolvedValueOnce({
          data: {
            value: [mockPriorityAdminUser]
          }
        })
        .mockResolvedValueOnce(mockPriorityResponses.customers);

      const result = await priorityService.getUserSiteAccess('admin@alphatau.com');

      expect(result.found).toBe(true);
      expect(result.fullAccess).toBe(true);
      expect(result.user?.positionCode).toBe(99);
      expect(result.sites).toHaveLength(3);
    });

    test('should handle user not found in Priority', async () => {
      // Mock empty response from Priority API
      mockAxiosInstance.get
        .mockResolvedValueOnce(mockPriorityResponses.phonebook)
        .mockResolvedValueOnce(mockPriorityResponses.orders)
        .mockResolvedValueOnce({
          data: { value: [] }
        })
        .mockResolvedValueOnce({
          data: { value: [] }
        });

      const result = await priorityService.getUserSiteAccess('notfound@example.com');

      expect(result.found).toBe(false);
    });

    test('should handle bypass user when Priority API fails', async () => {
      // Set bypass email
      process.env.BYPASS_PRIORITY_EMAILS = 'test@bypass.com';

      // Mock Priority API failure
      mockAxiosInstance.get.mockRejectedValue(new Error('API unavailable'));

      const result = await priorityService.getUserSiteAccess('test@bypass.com');

      expect(result.found).toBe(true);
      expect(result.fullAccess).toBe(true);
      expect(result.user?.email).toBe('test@bypass.com');
      expect(result.user?.positionCode).toBe(99);
    });

    test('should handle phone number authentication', async () => {
      // Mock Priority API responses for phone lookup
      mockAxiosInstance.get
        .mockResolvedValueOnce(mockPriorityResponses.phonebook)
        .mockResolvedValueOnce(mockPriorityResponses.orders)
        .mockResolvedValueOnce({
          data: {
            value: [{
              ...mockPriorityUser,
              PHONE: '5551234567'
            }]
          }
        })
        .mockResolvedValueOnce({
          data: {
            value: [{
              CUSTNAME: '100078',
              CUSTDES: 'Main Test Hospital'
            }]
          }
        });

      const result = await priorityService.getUserSiteAccess('555-123-4567');

      expect(result.found).toBe(true);
      expect(result.user?.phone).toBe('5551234567');
    });
  });

  describe('getUserFromPhonebook', () => {
    test('should find user by email', async () => {
      mockAxiosInstance.get.mockResolvedValue(mockPriorityResponses.phonebook);

      const result = await priorityService.getUserFromPhonebook('test@example.com');

      expect(result.found).toBe(true);
      expect(result.user?.email).toBe('test@example.com');
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/PHONEBOOK', {
        params: {
          $filter: "EMAIL eq 'test@example.com'",
          $select: 'CUSTNAME,POSITIONCODE,EMAIL,PHONE,NAME,CUSTDES'
        },
        timeout: 30000
      });
    });

    test('should find user by phone number', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          value: [{
            ...mockPriorityUser,
            PHONE: '5551234567'
          }]
        }
      });

      const result = await priorityService.getUserFromPhonebook('555-123-4567');

      expect(result.found).toBe(true);
      expect(result.user?.phone).toBe('5551234567');
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/PHONEBOOK', {
        params: {
          $filter: 'PHONE eq 5551234567',
          $select: 'CUSTNAME,POSITIONCODE,EMAIL,PHONE,NAME,CUSTDES'
        },
        timeout: 30000
      });
    });

    test('should perform case-insensitive email search', async () => {
      // First call returns empty (exact match)
      // Second call returns all users
      // Third call should find case-insensitive match
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { value: [] } })
        .mockResolvedValueOnce({
          data: {
            value: [{
              ...mockPriorityUser,
              EMAIL: 'TEST@EXAMPLE.COM'
            }]
          }
        });

      const result = await priorityService.getUserFromPhonebook('test@example.com');

      expect(result.found).toBe(true);
      expect(result.user?.email).toBe('TEST@EXAMPLE.COM');
    });

    test('should handle Priority API error', async () => {
      const apiError = mockApiError(500, 'Internal server error');
      mockAxiosInstance.get.mockRejectedValue(apiError);

      const result = await priorityService.getUserFromPhonebook('test@example.com');

      expect(result.found).toBe(false);
      expect(result.error).toBe('Internal server error');
    });
  });

  describe('getAllSites', () => {
    test('should retrieve all sites from CUSTOMERS endpoint', async () => {
      mockAxiosInstance.get.mockResolvedValue(mockPriorityResponses.customers);

      const result = await priorityService.getAllSites();

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        custName: '100078',
        custDes: 'Main Test Hospital'
      });
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/CUSTOMERS', {
        params: {
          $select: 'CUSTNAME,CUSTDES',
          $top: 500,
          $orderby: 'CUSTNAME'
        }
      });
    });

    test('should handle empty customers response', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { value: [] } });

      const result = await priorityService.getAllSites();

      expect(result).toEqual([]);
    });

    test('should handle API error', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('API error'));

      const result = await priorityService.getAllSites();

      expect(result).toEqual([]);
    });
  });

  describe('getOrdersForSiteWithFilter', () => {
    test('should get orders for site with date filter', async () => {
      mockAxiosInstance.get.mockResolvedValue(mockPriorityResponses.orders);

      const result = await priorityService.getOrdersForSiteWithFilter('100078', 'real@user.com', '2025-07-10');

      expect(result).toHaveLength(2);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/ORDERS', {
        params: {
          $filter: expect.stringContaining("CUSTNAME eq '100078'"),
          $select: 'ORDNAME,CUSTNAME,REFERENCE,CURDATE,SIBD_TREATDAY,ORDSTATUSDES,SBD_SEEDQTY,SBD_PREFACTIV,DETAILS,SIBD_SEEDLEN'
        },
        timeout: 30000
      });
    });

    test('should use test data for test@example.com', async () => {
      // Mock file system to return test data
      const fs = require('fs');
      fs.readFileSync.mockReturnValue(JSON.stringify({
        orders: mockOrders
      }));

      const result = await priorityService.getOrdersForSiteWithFilter('100078', 'test@example.com', '2025-07-10');

      expect(result).toBeDefined();
      expect(mockAxiosInstance.get).not.toHaveBeenCalled();
    });

    test('should handle API error and fallback to test data for test users', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('API error'));

      // Mock file system to return test data
      const fs = require('fs');
      fs.readFileSync.mockReturnValue(JSON.stringify({
        orders: mockOrders.filter(order => order.CUSTNAME === '100078')
      }));

      const result = await priorityService.getOrdersForSiteWithFilter('100078', 'test@example.com', '2025-07-10');

      expect(result).toBeDefined();
    });

    test('should throw error for real users when API fails', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('API error'));

      await expect(
        priorityService.getOrdersForSiteWithFilter('100078', 'real@user.com', '2025-07-10')
      ).rejects.toThrow('API error');
    });
  });

  describe('checkRemovalStatus', () => {
    test('should check removal status from Priority API', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          ORDNAME: 'SO25000010',
          ORDSTATUSDES: 'Waiting for removal',
          CUSTNAME: '100030',
          REFERENCE: 'PAT-2025-001'
        }
      });

      const result = await priorityService.checkRemovalStatus('SO25000010', 'real@user.com');

      expect(result.readyForRemoval).toBe(true);
      expect(result.status).toBe('Waiting for removal');
      expect(result.orderFound).toBe(true);
    });

    // Note: Test user with test data fallback is covered by getUserSiteAccess tests
    // The checkRemovalStatus for test users relies on the same test data loading mechanism

    test('should handle order not found', async () => {
      // Mock API response with empty/null data
      mockAxiosInstance.get.mockResolvedValue({ data: null });

      const result = await priorityService.checkRemovalStatus('NONEXISTENT', 'real@user.com');

      expect(result.readyForRemoval).toBe(false);
      expect(result.status).toBe('Not Found');
      expect(result.orderFound).toBe(false);
    });

    test('should handle API error', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('API error'));

      const result = await priorityService.checkRemovalStatus('SO25000010', 'real@user.com');

      expect(result.readyForRemoval).toBe(false);
      expect(result.status).toBe('Error');
      expect(result.orderFound).toBe(false);
      expect(result.error).toBe('API error');
    });
  });

  describe('updateApplicatorInPriority', () => {
    test('should update applicator in Priority system', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: { success: true } });

      const applicatorData = {
        serialNumber: 'APP001-2025-001',
        treatmentId: 'SO25000015',
        patientId: 'PAT-2025-015',
        site: '100078',
        insertionTime: '2025-07-10T10:30:00Z',
        usageType: 'Full use',
        insertedSeedsQty: 25,
        comments: 'Test applicator',
        date: '2025-07-10'
      };

      const result = await priorityService.updateApplicatorInPriority(applicatorData);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Applicator data saved to Priority successfully');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/ORDERS('SO25000015')/SIBD_APPLICATUSELIST_SUBFORM",
        {
          SERNUM: 'APP001-2025-001',
          PARTNAME: 'Standard Applicator',
          ALPH_USETIME: '2025-07-10T10:30:00Z',
          ALPH_USETYPE: 'Full use',
          ALPH_INSERTED: 25,
          FREE1: 'Test applicator'
        }
      );
    });

    test('should handle Priority saving disabled', async () => {
      process.env.ENABLE_PRIORITY_APPLICATOR_SAVE = 'false';

      const applicatorData = {
        serialNumber: 'APP001-2025-001',
        treatmentId: 'SO25000015'
      };

      const result = await priorityService.updateApplicatorInPriority(applicatorData);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Applicator data saved locally (Priority saving disabled)');
      expect(mockAxiosInstance.post).not.toHaveBeenCalled();

      // Reset environment variable
      delete process.env.ENABLE_PRIORITY_APPLICATOR_SAVE;
    });

    test('should handle API error in development mode', async () => {
      process.env.NODE_ENV = 'development';
      mockAxiosInstance.post.mockRejectedValue(new Error('API error'));

      const applicatorData = {
        serialNumber: 'APP001-2025-001',
        treatmentId: 'SO25000015'
      };

      const result = await priorityService.updateApplicatorInPriority(applicatorData);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Applicator data saved locally (Priority save simulated in development)');

      // Reset environment variable
      process.env.NODE_ENV = 'test';
    });

    test('should continue with local save when API fails in production', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('API error'));

      const applicatorData = {
        serialNumber: 'APP001-2025-001',
        treatmentId: 'SO25000015'
      };

      const result = await priorityService.updateApplicatorInPriority(applicatorData);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Applicator data saved locally (Priority integration temporary issue)');
    });
  });

  describe('Date filtering and OData queries', () => {
    test('should construct proper OData date filter', async () => {
      mockAxiosInstance.get.mockResolvedValue(mockPriorityResponses.orders);

      await priorityService.getOrdersForSiteWithFilter('100078', 'real@user.com', '2025-07-10');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/ORDERS', {
        params: {
          $filter: expect.stringMatching(/CUSTNAME eq '100078' and SIBD_TREATDAY ge 2025-07-10T00:00:00Z and SIBD_TREATDAY lt 2025-07-11T00:00:00Z/),
          $select: 'ORDNAME,CUSTNAME,REFERENCE,CURDATE,SIBD_TREATDAY,ORDSTATUSDES,SBD_SEEDQTY,SBD_PREFACTIV,DETAILS,SIBD_SEEDLEN'
        },
        timeout: 30000
      });
    });

    test('should handle invalid date format gracefully', async () => {
      mockAxiosInstance.get.mockResolvedValue(mockPriorityResponses.orders);

      await priorityService.getOrdersForSiteWithFilter('100078', 'real@user.com', 'invalid-date');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/ORDERS', {
        params: {
          $filter: "CUSTNAME eq '100078'",
          $select: 'ORDNAME,CUSTNAME,REFERENCE,CURDATE,SIBD_TREATDAY,ORDSTATUSDES,SBD_SEEDQTY,SBD_PREFACTIV,DETAILS,SIBD_SEEDLEN'
        },
        timeout: 30000
      });
    });
  });

  describe('Error handling and fallbacks', () => {
    test('should handle network timeouts gracefully', async () => {
      const timeoutError = new Error('timeout exceeded');
      timeoutError.name = 'TimeoutError';
      mockAxiosInstance.get.mockRejectedValue(timeoutError);

      const result = await priorityService.debugPriorityConnection();

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout exceeded');
    });

    test('should handle Priority API rate limiting', async () => {
      const rateLimitError = mockApiError(429, 'Too Many Requests');
      mockAxiosInstance.get.mockRejectedValue(rateLimitError);

      const result = await priorityService.debugPriorityConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Too Many Requests');
    });

    test('should handle malformed Priority API responses', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: null });

      const result = await priorityService.getAllSites();

      expect(result).toEqual([]);
    });
  });
});