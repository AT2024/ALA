// Test data fixtures for medical application testing
export const mockSites = [
  {
    custName: '100078',
    custDes: 'Main Test Hospital'
  },
  {
    custName: '100040',
    custDes: 'Test Hospital'
  },
  {
    custName: '100030',
    custDes: 'Regional Medical Center'
  }
];

export const mockOrders = [
  {
    ORDNAME: 'SO25000015',
    CUSTNAME: '100078',
    CUSTDES: 'Main Test Hospital',
    REFERENCE: 'PAT-2025-015',
    CURDATE: '2025-07-10T00:00:00Z',
    SIBD_TREATDAY: '2025-07-10T00:00:00Z',
    ORDSTATUSDES: 'Open',
    SBD_SEEDQTY: 20,
    SBD_PREFACTIV: 2.8,
    DETAILS: 'Patient Main-015'
  },
  {
    ORDNAME: 'SO25000010',
    CUSTNAME: '100030',
    CUSTDES: 'Regional Medical Center',
    REFERENCE: 'PAT-2025-001',
    CURDATE: '2025-07-10T00:00:00Z',
    SIBD_TREATDAY: '2025-07-10T00:00:00Z',
    ORDSTATUSDES: 'Waiting for removal',
    SBD_SEEDQTY: 15,
    SBD_PREFACTIV: 2.5,
    DETAILS: 'Patient Regional-001'
  }
];

export const mockApplicators = [
  {
    SERNUM: 'APP001-2025-001',
    PARTDES: 'Standard Applicator Type A',
    INTDATA2: 25,
    ORDNAME: 'SO25000015',
    USINGTYPE: 'full',
    INSERTIONDATE: '2025-07-10T10:30:00Z',
    INSERTEDSEEDSQTY: 25,
    INSERTIONCOMMENTS: 'Test applicator insertion'
  },
  {
    SERNUM: 'APP002-2025-001',
    PARTDES: 'Standard Applicator Type B',
    INTDATA2: 20,
    ORDNAME: 'SO25000015',
    USINGTYPE: 'partial',
    INSERTIONDATE: '2025-07-10T11:00:00Z',
    INSERTEDSEEDSQTY: 15,
    INSERTIONCOMMENTS: 'Partial use - technical issue'
  }
];

export const mockPriorityUser = {
  EMAIL: 'test@example.com',
  PHONE: '555-TEST',
  NAME: 'Test User',
  POSITIONCODE: '1',
  CUSTNAME: '100078',
  CUSTDES: 'Main Test Hospital'
};

export const mockPriorityAdminUser = {
  EMAIL: 'admin@alphatau.com',
  PHONE: '555-ADMIN',
  NAME: 'Alpha Tau Admin',
  POSITIONCODE: '99',
  CUSTNAME: 'ALL_SITES',
  CUSTDES: 'All Sites Access'
};

export const mockTreatmentData = {
  id: 'test-treatment-uuid-001',
  type: 'insertion' as 'insertion' | 'removal',
  subjectId: 'PAT-2025-015',
  patientName: 'Patient Test-015',
  site: '100078',
  date: '2025-07-10',
  isComplete: false,
  priorityId: 'SO25000015',
  userId: 'test-user-uuid-001'
};

export const mockApplicatorData = {
  id: 'test-applicator-uuid-001',
  serialNumber: 'APP001-2025-001',
  applicatorType: 'Standard Applicator Type A',
  seedQuantity: 25,
  usageType: 'full' as 'full' | 'faulty' | 'none',
  insertedSeedsQty: 25,
  insertionTime: new Date('2025-07-10T10:30:00Z'),
  comments: 'Test applicator insertion',
  treatmentId: 'test-treatment-uuid-001',
  addedBy: 'test-user-uuid-001',
  isRemoved: false
};

export const mockUserData = {
  id: 'test-user-uuid-001',
  name: 'Test User',
  email: 'test@example.com',
  phoneNumber: null,
  role: 'hospital' as 'hospital' | 'admin' | 'alphatau',
  metadata: {
    positionCode: 1,
    custName: '100078',
    sites: [mockSites[0]],
    fullAccess: false
  }
};

// Mock Priority API responses
export const mockPriorityResponses = {
  phonebook: {
    data: {
      value: [mockPriorityUser]
    }
  },
  orders: {
    data: {
      value: mockOrders
    }
  },
  customers: {
    data: {
      value: mockSites.map(site => ({
        CUSTNAME: site.custName,
        CUSTDES: site.custDes
      }))
    }
  },
  subformData: {
    data: {
      value: mockApplicators
    }
  }
};

// Validation test scenarios for applicators
export const applicatorValidationScenarios = {
  valid: {
    serialNumber: 'APP-VALID-001',
    treatmentId: 'SO25000015',
    patientId: 'PAT-2025-015',
    expectedScenario: 'valid'
  },
  alreadyScanned: {
    serialNumber: 'APP-SCANNED-001',
    treatmentId: 'SO25000015',
    patientId: 'PAT-2025-015',
    scannedApplicators: ['APP-SCANNED-001'],
    expectedScenario: 'already_scanned'
  },
  wrongTreatment: {
    serialNumber: 'APP-WRONG-001',
    treatmentId: 'SO25000015',
    patientId: 'PAT-2025-015',
    intendedPatientId: 'PAT-2025-999',
    expectedScenario: 'wrong_treatment'
  },
  previouslyNoUse: {
    serialNumber: 'APP-NOUSER-001',
    treatmentId: 'SO25000015',
    patientId: 'PAT-2025-015',
    previousUsageType: 'none',
    expectedScenario: 'previously_no_use'
  },
  notAllowed: {
    serialNumber: 'APP-NOTALLOWED-001',
    treatmentId: 'SO25000015',
    patientId: 'PAT-2025-015',
    expectedScenario: 'not_allowed'
  }
};

// JWT test tokens
export const testTokens = {
  validToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InRlc3QtdXNlci11dWlkLTAwMSIsImlhdCI6MTY0NDUxNjgwMCwiZXhwIjoxNjQ3MTA4ODAwfQ.test-signature',
  expiredToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InRlc3QtdXNlci11dWlkLTAwMSIsImlhdCI6MTY0NDUxNjgwMCwiZXhwIjoxNjQ0NTE2ODAwfQ.expired-signature'
};

export default {
  mockSites,
  mockOrders,
  mockApplicators,
  mockPriorityUser,
  mockPriorityAdminUser,
  mockTreatmentData,
  mockApplicatorData,
  mockUserData,
  mockPriorityResponses,
  applicatorValidationScenarios,
  testTokens
};