// Mock helpers for testing medical application
import { jest } from '@jest/globals';
import { mockPriorityResponses } from '../fixtures/testData';

// Mock Priority API service
export const mockPriorityService = {
  getUserSiteAccess: jest.fn(),
  getUserFromPhonebook: jest.fn(),
  getAllSites: jest.fn(),
  getUserSites: jest.fn(),
  getOrdersForSiteWithFilter: jest.fn(),
  getOrderSubform: jest.fn(),
  getOrderDetails: jest.fn(),
  getApplicatorFromPriority: jest.fn(),
  getPartDetails: jest.fn(),
  updateApplicatorInPriority: jest.fn(),
  updateTreatmentStatus: jest.fn(),
  checkRemovalStatus: jest.fn(),
  validateApplicatorForManualEntry: jest.fn(),
  debugPriorityConnection: jest.fn(),
  getTreatmentsForSiteAndDateRange: jest.fn(),
  getApplicatorsForTreatment: jest.fn(),
  getAvailableApplicatorsForTreatment: jest.fn(),
  searchApplicatorsByName: jest.fn(),
  calculateLevenshteinDistance: jest.fn()
};

// Mock Sequelize models
export const mockSequelizeModel = {
  findAll: jest.fn(),
  findByPk: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  destroy: jest.fn(),
  count: jest.fn(),
  findOrCreate: jest.fn()
};

// Mock User model
export const mockUser = {
  id: 'test-user-uuid-001',
  name: 'Test User',
  email: 'test@example.com',
  phoneNumber: null,
  role: 'hospital',
  metadata: {
    positionCode: 1,
    custName: '100078',
    sites: [{ custName: '100078', custDes: 'Main Test Hospital' }],
    fullAccess: false
  },
  generateVerificationCode: jest.fn().mockResolvedValue('123456'),
  verifyCode: jest.fn(),
  save: jest.fn().mockResolvedValue(true)
};

// Mock Treatment model
export const mockTreatment = {
  id: 'test-treatment-uuid-001',
  type: 'insertion',
  subjectId: 'PAT-2025-015',
  site: '100078',
  date: '2025-07-10',
  isComplete: false,
  priorityId: 'SO25000015',
  userId: 'test-user-uuid-001',
  save: jest.fn().mockResolvedValue(true)
};

// Mock Applicator model
export const mockApplicator = {
  id: 'test-applicator-uuid-001',
  serialNumber: 'APP001-2025-001',
  applicatorType: 'Standard Applicator Type A',
  seedQuantity: 25,
  usageType: 'full',
  insertedSeedsQty: 25,
  insertionTime: new Date('2025-07-10T10:30:00Z'),
  comments: 'Test applicator insertion',
  treatmentId: 'test-treatment-uuid-001',
  addedBy: 'test-user-uuid-001',
  isRemoved: false,
  save: jest.fn().mockResolvedValue(true),
  update: jest.fn().mockResolvedValue(true)
};

// Mock JWT
export const mockJWT = {
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  verify: jest.fn().mockReturnValue({ id: 'test-user-uuid-001' })
};

// Mock bcrypt
export const mockBcrypt = {
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn().mockResolvedValue(true)
};

// Mock logger
export const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

// Mock axios for Priority API calls
export const mockAxios = {
  create: jest.fn().mockReturnValue({
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn()
  }),
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn()
};

// Helper to setup Priority API mocks
export const setupPriorityApiMocks = () => {
  // Mock successful responses
  mockPriorityService.debugPriorityConnection.mockResolvedValue({
    success: true,
    phonebookCount: 10,
    phonebookSample: mockPriorityResponses.phonebook.data.value[0],
    ordersCount: 5,
    ordersSample: mockPriorityResponses.orders.data.value[0]
  });

  mockPriorityService.getUserFromPhonebook.mockResolvedValue({
    found: true,
    user: {
      email: 'test@example.com',
      phone: '555-TEST',
      name: 'Test User',
      positionCode: 1,
      custName: '100078'
    }
  });

  mockPriorityService.getAllSites.mockResolvedValue([
    { custName: '100078', custDes: 'Main Test Hospital' },
    { custName: '100040', custDes: 'Test Hospital' }
  ]);

  mockPriorityService.getOrdersForSiteWithFilter.mockResolvedValue(
    mockPriorityResponses.orders.data.value
  );

  mockPriorityService.getApplicatorFromPriority.mockResolvedValue({
    found: true,
    data: {
      serialNumber: 'APP001-2025-001',
      partName: 'Standard Applicator Type A',
      treatmentId: 'SO25000015',
      intendedPatientId: 'PAT-2025-015',
      usageType: null,
      usageTime: null,
      insertedSeeds: 0,
      comments: ''
    }
  });

  mockPriorityService.updateApplicatorInPriority.mockResolvedValue({
    success: true,
    message: 'Applicator data saved to Priority successfully'
  });

  mockPriorityService.checkRemovalStatus.mockResolvedValue({
    readyForRemoval: true,
    status: 'Waiting for removal',
    orderFound: true
  });
};

// Helper to setup database mocks
export const setupDatabaseMocks = () => {
  // User model mocks
  mockSequelizeModel.findOne.mockImplementation(({ where }) => {
    if (where.email === 'test@example.com' || where.phoneNumber === '555-TEST') {
      return Promise.resolve(mockUser);
    }
    return Promise.resolve(null);
  });

  mockSequelizeModel.create.mockResolvedValue(mockUser);

  // Treatment model mocks
  mockSequelizeModel.findByPk.mockImplementation((id) => {
    if (id === 'test-treatment-uuid-001') {
      return Promise.resolve(mockTreatment);
    }
    if (id === 'test-applicator-uuid-001') {
      return Promise.resolve(mockApplicator);
    }
    return Promise.resolve(null);
  });

  // Applicator model mocks
  mockSequelizeModel.findAll.mockResolvedValue([mockApplicator]);
};

// Helper to reset all mocks
export const resetAllMocks = () => {
  jest.clearAllMocks();

  // Reset Priority service mocks
  Object.values(mockPriorityService).forEach(mock => {
    if (typeof mock === 'function') {
      mock.mockReset();
    }
  });

  // Reset model mocks
  Object.values(mockSequelizeModel).forEach(mock => {
    if (typeof mock === 'function') {
      mock.mockReset();
    }
  });

  // Reset other mocks
  mockJWT.sign.mockReset();
  mockJWT.verify.mockReset();
  mockBcrypt.hash.mockReset();
  mockBcrypt.compare.mockReset();
};

// Helper to simulate API errors
export const mockApiError = (status: number, message: string) => {
  const error = new Error(message) as any;
  error.response = {
    status,
    statusText: message,
    data: { error: message }
  };
  return error;
};

// Helper to mock database transaction
export const mockTransaction = {
  commit: jest.fn(),
  rollback: jest.fn(),
  finished: 'commit'
};

export default {
  mockPriorityService,
  mockSequelizeModel,
  mockUser,
  mockTreatment,
  mockApplicator,
  mockJWT,
  mockBcrypt,
  mockLogger,
  mockAxios,
  mockTransaction,
  setupPriorityApiMocks,
  setupDatabaseMocks,
  resetAllMocks,
  mockApiError
};