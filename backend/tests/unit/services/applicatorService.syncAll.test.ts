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
          insertedSeedsQty: 3, // faulty with a KNOWN operator-entered count
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
          seedsInserted: 3,
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

    test("faulty applicator: seedsInserted comes from insertedSeedsQty, not seedQuantity", async () => {
      // Regression for PDF "Inserted: 0" bug — pre-fix the bulk sync sent
      // app.seedQuantity (capacity) for every row, overwriting Priority's
      // correct INSERTEDSEEDSQTY whenever the bulk sync ran. Now it must
      // send the per-applicator insertedSeedsQty so the local column drives
      // both the PDF and the Priority record.
      const treatmentId = "treatment-faulty-insert";
      mockTreatmentFindByPk.mockResolvedValue({
        id: treatmentId,
        priorityId: "SO26000072",
        subjectId: null,
      });

      mockApplicatorFindAll.mockResolvedValue([
        {
          id: "app-faulty",
          serialNumber: "260423-11/A8",
          seedQuantity: 5,
          insertedSeedsQty: 2,
          status: "FAULTY",
          comments: "partial insertion before fault",
          insertionTime: new Date("2026-05-20T10:54:00Z"),
        },
      ]);

      mockSyncApplicatorUsageToPriority.mockResolvedValue({
        success: true,
        message: "Synced",
      });

      const result =
        await applicatorService.syncAllApplicatorsUsageToPriority(treatmentId);

      expect(result).toEqual({ synced: 1, failed: 0, skipped: 0 });
      expect(mockSyncApplicatorUsageToPriority).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: "SO26000072",
          serialNumber: "260423-11/A8",
          seedsInserted: 2,
          usageType: "Faulty",
        }),
      );
    });

    test("faulty applicator with NULL insertedSeedsQty is skipped, not synced with capacity", async () => {
      // Fail-safe (dosimetry): a legacy faulty row pre-dating the
      // inserted_seeds_qty column has insertedSeedsQty === null — the partial
      // count is UNKNOWN locally. Sending seedQuantity (capacity) would
      // over-report inserted seeds AND overwrite Priority's possibly-correct
      // value. When we don't know, we must not guess/clobber: skip and warn.
      const treatmentId = "treatment-faulty-null";
      mockTreatmentFindByPk.mockResolvedValue({
        id: treatmentId,
        priorityId: "SO26000099",
        subjectId: null,
      });

      mockApplicatorFindAll.mockResolvedValue([
        {
          id: "app-faulty-legacy",
          serialNumber: "260423-11/A9",
          seedQuantity: 5,
          insertedSeedsQty: null, // legacy faulty row, unknown partial count
          status: "FAULTY",
          comments: "",
          insertionTime: new Date("2026-05-20T10:54:00Z"),
        },
      ]);

      mockSyncApplicatorUsageToPriority.mockResolvedValue({
        success: true,
        message: "Synced",
      });

      const result =
        await applicatorService.syncAllApplicatorsUsageToPriority(treatmentId);

      expect(result).toEqual({ synced: 0, failed: 0, skipped: 1 });
      expect(mockSyncApplicatorUsageToPriority).not.toHaveBeenCalled();
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
