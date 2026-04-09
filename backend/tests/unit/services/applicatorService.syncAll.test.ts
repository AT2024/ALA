// Applicator Service - syncAllApplicatorsUsageToPriority Test Suite
import { jest, describe, test, expect, beforeEach } from "@jest/globals";

// Mock models before importing applicatorService
const mockTreatmentFindByPk = jest.fn();
const mockApplicatorFindAll = jest.fn();

jest.mock("../../../src/models", () => ({
  Treatment: { findByPk: mockTreatmentFindByPk },
  Applicator: { findAll: mockApplicatorFindAll },
  ApplicatorAuditLog: { create: jest.fn() },
}));

// Mock priorityService
const mockSyncApplicatorUsageToPriority = jest.fn();
jest.mock("../../../src/services/priorityService", () => ({
  __esModule: true,
  default: {
    syncApplicatorUsageToPriority: mockSyncApplicatorUsageToPriority,
    updateApplicatorInPriority: jest.fn(),
    getApplicatorFromPriority: jest.fn(),
    updateTreatmentStatus: jest.fn(),
  },
}));

// Mock database
jest.mock("../../../src/config/database", () => ({
  __esModule: true,
  default: {
    transaction: jest.fn(),
    query: jest.fn(),
  },
}));

// Mock priorityDataTransformer
jest.mock("../../../src/utils/priorityDataTransformer", () => ({
  transformPriorityApplicatorData: jest.fn(),
  validatePriorityDataStructure: jest.fn(),
  transformToPriorityFormat: jest.fn(),
  PriorityApplicatorData: {},
}));

jest.mock("../../../src/utils/priorityIdParser", () => ({
  getFirstOrderId: jest.fn((id: string) => id),
}));

import applicatorService from "../../../src/services/applicatorService";

describe("Applicator Service", () => {
  describe("syncAllApplicatorsUsageToPriority", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test("should sync terminal-state applicators successfully", async () => {
      // Arrange
      const treatmentId = "treatment-001";
      mockTreatmentFindByPk.mockResolvedValue({
        id: treatmentId,
        priorityId: "SO26000055",
        subjectId: "PAT-001",
      });

      mockApplicatorFindAll.mockResolvedValue([
        {
          id: "app-1",
          serialNumber: "260116-23/A1",
          seedQuantity: 20,
          status: "INSERTED",
          comments: "All good",
          insertionTime: new Date("2026-04-09T10:30:00Z"),
        },
        {
          id: "app-2",
          serialNumber: "260116-23/A2",
          seedQuantity: 15,
          status: "FAULTY",
          comments: "",
          insertionTime: new Date("2026-04-09T11:00:00Z"),
        },
      ]);

      mockSyncApplicatorUsageToPriority.mockResolvedValue({
        success: true,
        message: "Synced",
      });

      // Act
      const result =
        await applicatorService.syncAllApplicatorsUsageToPriority(treatmentId);

      // Assert
      expect(result).toEqual({ synced: 2, failed: 0, skipped: 0 });
      expect(mockSyncApplicatorUsageToPriority).toHaveBeenCalledTimes(2);
      expect(mockSyncApplicatorUsageToPriority).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: "SO26000055",
          serialNumber: "260116-23/A1",
          seedsInserted: 20,
          usageType: "Full use",
        }),
      );
      expect(mockSyncApplicatorUsageToPriority).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: "SO26000055",
          serialNumber: "260116-23/A2",
          usageType: "Faulty",
        }),
      );
    });

    test("should skip intermediate-state applicators", async () => {
      // Arrange
      const treatmentId = "treatment-002";
      mockTreatmentFindByPk.mockResolvedValue({
        id: treatmentId,
        priorityId: "SO26000056",
        subjectId: null,
      });

      mockApplicatorFindAll.mockResolvedValue([
        {
          id: "app-1",
          serialNumber: "260116-23/A1",
          seedQuantity: 20,
          status: "INSERTED",
          comments: "",
          insertionTime: new Date("2026-04-09T10:30:00Z"),
        },
        {
          id: "app-2",
          serialNumber: "260116-23/A2",
          seedQuantity: 10,
          status: "LOADED",
          comments: "",
          insertionTime: new Date("2026-04-09T11:00:00Z"),
        },
        {
          id: "app-3",
          serialNumber: "260116-23/A3",
          seedQuantity: 0,
          status: "SEALED",
          comments: "",
          insertionTime: new Date("2026-04-09T11:30:00Z"),
        },
      ]);

      mockSyncApplicatorUsageToPriority.mockResolvedValue({
        success: true,
        message: "Synced",
      });

      // Act
      const result =
        await applicatorService.syncAllApplicatorsUsageToPriority(treatmentId);

      // Assert
      expect(result).toEqual({ synced: 1, failed: 0, skipped: 2 });
      expect(mockSyncApplicatorUsageToPriority).toHaveBeenCalledTimes(1);
    });

    test("should handle no Priority order ID gracefully", async () => {
      // Arrange
      const treatmentId = "treatment-003";
      mockTreatmentFindByPk.mockResolvedValue({
        id: treatmentId,
        priorityId: null,
        subjectId: null,
      });

      mockApplicatorFindAll.mockResolvedValue([
        {
          id: "app-1",
          serialNumber: "260116-23/A1",
          seedQuantity: 20,
          status: "INSERTED",
          comments: "",
          insertionTime: new Date("2026-04-09T10:30:00Z"),
        },
      ]);

      // Act
      const result =
        await applicatorService.syncAllApplicatorsUsageToPriority(treatmentId);

      // Assert
      expect(result).toEqual({ synced: 0, failed: 0, skipped: 1 });
      expect(mockSyncApplicatorUsageToPriority).not.toHaveBeenCalled();
    });
  });
});
