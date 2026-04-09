// Priority Service - syncApplicatorUsageToPriority Test Suite
import {
  jest,
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { resetAllMocks, mockApiError } from "../../helpers/mockHelpers";

// Create mock axios instance at module level BEFORE importing priorityService
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockAxiosInstance: {
  get: jest.Mock<any>;
  post: jest.Mock<any>;
  patch: jest.Mock<any>;
  delete: jest.Mock<any>;
} = {
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
};

// Mock axios module - must be before importing priorityService
jest.mock("axios", () => ({
  create: jest.fn(() => mockAxiosInstance),
  default: {
    create: jest.fn(() => mockAxiosInstance),
  },
}));

// Import priorityService AFTER the mock is set up
import priorityService from "../../../src/services/priorityService";

// Mock file system for test data loading
jest.mock("fs", () => ({
  readFileSync: jest.fn(),
  existsSync: jest.fn(),
}));

const baseSyncData = {
  orderId: "SO26000055",
  serialNumber: "260116-23/A1",
  seedsInserted: 20,
  usageType: "Full use",
  comments: "Insertion completed successfully",
  reportedBy: "doctor@hospital.com",
  insertionDate: "2026-04-09T10:30:00Z",
};

describe("Priority Service - syncApplicatorUsageToPriority", () => {
  beforeEach(() => {
    resetAllMocks();
    mockAxiosInstance.get.mockReset();
    mockAxiosInstance.post.mockReset();
    mockAxiosInstance.patch.mockReset();
    mockAxiosInstance.delete.mockReset();

    // Ensure env vars are clean
    delete process.env.ENABLE_PRIORITY_APPLICATOR_SAVE;
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.ENABLE_PRIORITY_APPLICATOR_SAVE;
    process.env.NODE_ENV = "test";
  });

  test("should successfully sync applicator usage to Priority", async () => {
    // Mock GET - find the applicator's KLINE
    mockAxiosInstance.get.mockResolvedValueOnce({
      data: {
        value: [
          {
            KLINE: 3,
            SERNUMTEXT: "260116-23/A1",
          },
        ],
      },
    });

    // Mock PATCH - update the usage data
    mockAxiosInstance.patch.mockResolvedValueOnce({ data: {} });

    const result =
      await priorityService.syncApplicatorUsageToPriority(baseSyncData);

    expect(result.success).toBe(true);

    // Verify GET was called with correct URL and filter
    expect(mockAxiosInstance.get).toHaveBeenCalledWith(
      "/ORDERS('SO26000055')/SIBD_APPUSELISTTEXT_SUBFORM",
      {
        params: {
          $filter: "SERNUMTEXT eq '260116-23/A1'",
          $select: "KLINE,SERNUMTEXT",
        },
      },
    );

    // Verify PATCH was called with correct URL and body
    expect(mockAxiosInstance.patch).toHaveBeenCalledWith(
      "/ORDERS('SO26000055')/SIBD_APPUSELISTTEXT_SUBFORM(KLINE=3)",
      {
        INSERTEDSEEDSQTY: 20,
        USINGTYPE: "Full use",
        INSERTIONCOMMENTS: "Insertion completed successfully",
        INSERTEDREPORTEDBY: "doctor@hospital.com",
        INSERTIONDATE: "2026-04-09T10:30:00Z",
      },
    );
  });

  test("should return success with disabled message when env var is false", async () => {
    process.env.ENABLE_PRIORITY_APPLICATOR_SAVE = "false";

    const result =
      await priorityService.syncApplicatorUsageToPriority(baseSyncData);

    expect(result.success).toBe(true);
    expect(result.message).toContain("disabled");
    expect(mockAxiosInstance.get).not.toHaveBeenCalled();
    expect(mockAxiosInstance.patch).not.toHaveBeenCalled();
  });

  test("should return failure when applicator not found in Priority", async () => {
    // Mock GET - empty result
    mockAxiosInstance.get.mockResolvedValueOnce({
      data: {
        value: [],
      },
    });

    const result =
      await priorityService.syncApplicatorUsageToPriority(baseSyncData);

    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
    expect(mockAxiosInstance.patch).not.toHaveBeenCalled();
  });

  test("should handle combined orders (split on +)", async () => {
    const combinedData = {
      ...baseSyncData,
      orderId: "SO26000055+SO26000056",
    };

    // First order - not found
    mockAxiosInstance.get.mockResolvedValueOnce({
      data: { value: [] },
    });

    // Second order - found
    mockAxiosInstance.get.mockResolvedValueOnce({
      data: {
        value: [{ KLINE: 5, SERNUMTEXT: "260116-23/A1" }],
      },
    });

    // PATCH succeeds
    mockAxiosInstance.patch.mockResolvedValueOnce({ data: {} });

    const result =
      await priorityService.syncApplicatorUsageToPriority(combinedData);

    expect(result.success).toBe(true);
    expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
    expect(mockAxiosInstance.patch).toHaveBeenCalledWith(
      "/ORDERS('SO26000056')/SIBD_APPUSELISTTEXT_SUBFORM(KLINE=5)",
      expect.objectContaining({
        INSERTEDSEEDSQTY: 20,
        USINGTYPE: "Full use",
      }),
    );
  });

  test("should simulate success in development mode on API error", async () => {
    process.env.NODE_ENV = "development";
    mockAxiosInstance.get.mockRejectedValueOnce(new Error("API error"));

    const result =
      await priorityService.syncApplicatorUsageToPriority(baseSyncData);

    expect(result.success).toBe(true);
    expect(result.message).toContain("simulated");
  });

  test("should return failure in production on API error", async () => {
    process.env.NODE_ENV = "production";
    mockAxiosInstance.get.mockRejectedValueOnce(new Error("API error"));

    const result =
      await priorityService.syncApplicatorUsageToPriority(baseSyncData);

    expect(result.success).toBe(false);
    expect(result.message).toBeDefined();
  });
});
