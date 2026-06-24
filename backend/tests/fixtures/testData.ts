// Test data fixtures for medical application testing.
//
// Sites/orders/applicators are DERIVED from the single source of truth
// (shared/fixtures/test-data.json via shared/testData) so these mocks cannot
// drift from the dataset the app actually serves in Test Mode. They previously
// hardcoded fake "APP001/APP002" applicators with an INTDATA2 of 25 — values
// that do not exist in the real data and contradicted production seed counts.
import { testData } from "../../../shared/testData";

export const mockSites = testData.sites as Array<{
  custName: string;
  custDes: string;
}>;

const orderByName = (ordName: string) => {
  const order = (testData.orders as Array<Record<string, unknown>>).find(
    (o) => o.ORDNAME === ordName,
  );
  if (!order)
    throw new Error(`Test fixture: order ${ordName} not in test-data`);
  return order;
};

// The two orders the unit tests exercise, taken straight from canonical data.
export const mockOrders = [
  orderByName("SO25000015"),
  orderByName("SO25000010"),
];

// Real SO25000015 applicators (serials + INTDATA2 source counts) from canonical
// data — no fabricated quantities.
export const mockApplicators = testData.subform_data["SO25000015"].value;

export const mockPriorityUser = {
  EMAIL: "test@example.com",
  PHONE: "555-TEST",
  NAME: "Test User",
  POSITIONCODE: "1",
  CUSTNAME: "100078",
  CUSTDES: "Main Test Hospital",
};

export const mockPriorityAdminUser = {
  EMAIL: "admin@alphatau.com",
  PHONE: "555-ADMIN",
  NAME: "Alpha Tau Admin",
  POSITIONCODE: "99",
  CUSTNAME: "ALL_SITES",
  CUSTDES: "All Sites Access",
};

export const mockTreatmentData = {
  id: "test-treatment-uuid-001",
  type: "insertion" as "insertion" | "removal",
  subjectId: "PAT-2025-015",
  patientName: "Patient Test-015",
  site: "100078",
  date: "2025-07-10",
  isComplete: false,
  priorityId: "SO25000015",
  userId: "test-user-uuid-001",
};

export const mockApplicatorData = {
  id: "test-applicator-uuid-001",
  serialNumber: "APP001-2025-001",
  applicatorType: "Standard Applicator Type A",
  seedQuantity: 25,
  usageType: "full" as "full" | "faulty" | "none",
  insertedSeedsQty: 25,
  insertionTime: new Date("2025-07-10T10:30:00Z"),
  comments: "Test applicator insertion",
  treatmentId: "test-treatment-uuid-001",
  addedBy: "test-user-uuid-001",
  isRemoved: false,
};

export const mockUserData = {
  id: "test-user-uuid-001",
  name: "Test User",
  email: "test@example.com",
  phoneNumber: null,
  role: "hospital" as "hospital" | "admin" | "alphatau",
  metadata: {
    positionCode: 1,
    custName: "100078",
    sites: [mockSites[0]],
    fullAccess: false,
  },
};

// Mock Priority API responses
export const mockPriorityResponses = {
  phonebook: {
    data: {
      value: [mockPriorityUser],
    },
  },
  orders: {
    data: {
      value: mockOrders,
    },
  },
  customers: {
    data: {
      value: mockSites.map((site) => ({
        CUSTNAME: site.custName,
        CUSTDES: site.custDes,
      })),
    },
  },
  subformData: {
    data: {
      value: mockApplicators,
    },
  },
};

// Validation test scenarios for applicators
export const applicatorValidationScenarios = {
  valid: {
    serialNumber: "APP-VALID-001",
    treatmentId: "SO25000015",
    patientId: "PAT-2025-015",
    expectedScenario: "valid",
  },
  alreadyScanned: {
    serialNumber: "APP-SCANNED-001",
    treatmentId: "SO25000015",
    patientId: "PAT-2025-015",
    scannedApplicators: ["APP-SCANNED-001"],
    expectedScenario: "already_scanned",
  },
  wrongTreatment: {
    serialNumber: "APP-WRONG-001",
    treatmentId: "SO25000015",
    patientId: "PAT-2025-015",
    intendedPatientId: "PAT-2025-999",
    expectedScenario: "wrong_treatment",
  },
  previouslyNoUse: {
    serialNumber: "APP-NOUSER-001",
    treatmentId: "SO25000015",
    patientId: "PAT-2025-015",
    previousUsageType: "none",
    expectedScenario: "previously_no_use",
  },
  notAllowed: {
    serialNumber: "APP-NOTALLOWED-001",
    treatmentId: "SO25000015",
    patientId: "PAT-2025-015",
    expectedScenario: "not_allowed",
  },
};

// JWT test tokens
export const testTokens = {
  validToken:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InRlc3QtdXNlci11dWlkLTAwMSIsImlhdCI6MTY0NDUxNjgwMCwiZXhwIjoxNjQ3MTA4ODAwfQ.test-signature",
  expiredToken:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InRlc3QtdXNlci11dWlkLTAwMSIsImlhdCI6MTY0NDUxNjgwMCwiZXhwIjoxNjQ0NTE2ODAwfQ.expired-signature",
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
  testTokens,
};
