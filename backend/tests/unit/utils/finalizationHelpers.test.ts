/**
 * Tests for finalizationHelpers.ts - Removal PDF Data Generation
 *
 * DL-004: Verifies that buildRemovalPdfData correctly populates applicatorGroups
 * and calculates totalSourcesRemoved for removal procedure PDFs.
 */

import {
  buildRemovalPdfData,
  finalizeAndSendPdf,
  mergeApplicatorsForPdf,
  ApplicatorForPdf,
  SignatureDetails,
} from "../../../src/utils/finalizationHelpers";
import { Treatment } from "../../../src/models";
import * as emailService from "../../../src/services/emailService";

// Mock the models to avoid database connection. TreatmentPdf.create returns a
// stub row with mutable fields and a no-op save() so finalizeAndSendPdf can
// mark statuses without touching Postgres.
jest.mock("../../../src/models", () => ({
  Treatment: class MockTreatment {
    id = "test-treatment-id";
    type = "removal";
    subjectId = "TEST-001";
    site = "100078";
    date = new Date("2026-01-01");
    surgeon = "Dr. Test";
    activityPerSeed = 2.8;
    patientName = "Test Patient";
  },
  TreatmentPdf: {
    create: jest.fn().mockImplementation((data: Record<string, unknown>) => {
      const row: Record<string, unknown> = {
        ...data,
        id: "mock-pdf-id",
        save: jest.fn().mockResolvedValue(undefined),
      };
      return Promise.resolve(row);
    }),
  },
  SignatureVerification: {},
}));

// Avoid generating real PDFs in tests — return fixed-shape buffers.
jest.mock("../../../src/services/pdfGenerationService", () => ({
  generateTreatmentPdf: jest
    .fn()
    .mockResolvedValue(Buffer.from("fake-insertion-pdf")),
  generateRemovalPdf: jest
    .fn()
    .mockResolvedValue(Buffer.from("fake-removal-pdf")),
}));

// Spy-able email service. sendSignedPdf still has its real null→env fallback,
// but the helper should now provide an explicit recipient.
jest.mock("../../../src/services/emailService", () => ({
  sendSignedPdf: jest.fn().mockResolvedValue(true),
  getPdfRecipientEmail: jest.fn().mockReturnValue("env-fallback@example.test"),
}));

describe("finalizationHelpers", () => {
  describe("mergeApplicatorsForPdf field pass-through", () => {
    // Bugs 3, 4, 5: the merge used to drop status, seedLength and catalog, so the
    // emailed PDF showed blank Length/Catalog columns and could not resolve the
    // effective status. The DB records carry these fields; merge must preserve them.
    it("preserves status, seedLength and catalog for processed applicators", () => {
      const processed = [
        {
          id: "1",
          serialNumber: "SO25000015/A2",
          applicatorType: "Alpha Flex Applicator",
          seedQuantity: 3,
          usageType: "faulty",
          status: "FAULTY",
          insertionTime: "2026-06-01T10:00:00.000Z",
          insertedSeedsQty: 2,
          comments: "bent",
          seedLength: 140,
          catalog: "FLEX-00019-FG",
        },
      ];

      const [row] = mergeApplicatorsForPdf(processed, []);

      expect(row.status).toBe("FAULTY");
      expect(row.seedLength).toBe(140);
      expect(row.catalog).toBe("FLEX-00019-FG");
      expect(row.insertedSeedsQty).toBe(2);
    });

    it("preserves status, seedLength and catalog for unused (available) applicators", () => {
      const available = [
        {
          id: "9",
          serialNumber: "SO25000015/A9",
          applicatorType: "Alpha Flex Applicator",
          seedQuantity: 5,
          status: "SEALED",
          seedLength: 140,
          catalog: "FLEX-00023-FG",
        },
      ];

      const [row] = mergeApplicatorsForPdf([], available);

      expect(row.status).toBe("SEALED");
      expect(row.seedLength).toBe(140);
      expect(row.catalog).toBe("FLEX-00023-FG");
      expect(row.usageType).toBe("sealed");
    });
  });

  describe("buildRemovalPdfData", () => {
    // Create a mock treatment for testing
    const mockTreatment = {
      id: "test-removal-001",
      type: "removal" as const,
      subjectId: "REMOVAL-TEST-001",
      site: "100078",
      date: new Date("2026-01-01"),
      surgeon: "Dr. Test",
      activityPerSeed: 2.8,
      patientName: "Test Patient (Ready for removal)",
      seedQuantity: 20,
    } as Treatment;

    it("should populate applicatorGroups when applicators are provided", () => {
      // Create 4 applicators with 5 sources each = 20 total sources
      const applicators: ApplicatorForPdf[] = [
        {
          id: "1",
          serialNumber: "APP-001",
          seedQuantity: 5,
          usageType: "full",
          insertionTime: "2026-01-01T10:00:00Z",
        },
        {
          id: "2",
          serialNumber: "APP-002",
          seedQuantity: 5,
          usageType: "full",
          insertionTime: "2026-01-01T10:05:00Z",
        },
        {
          id: "3",
          serialNumber: "APP-003",
          seedQuantity: 5,
          usageType: "full",
          insertionTime: "2026-01-01T10:10:00Z",
        },
        {
          id: "4",
          serialNumber: "APP-004",
          seedQuantity: 5,
          usageType: "full",
          insertionTime: "2026-01-01T10:15:00Z",
        },
      ];

      const result = buildRemovalPdfData(mockTreatment, applicators);

      // Verify applicatorGroups is populated
      expect(result.applicatorGroups.length).toBeGreaterThan(0);

      // Should have one group for 5-seed applicators
      expect(result.applicatorGroups[0].seedCount).toBe(5);
      expect(result.applicatorGroups[0].totalApplicators).toBe(4);
      expect(result.applicatorGroups[0].removedApplicators).toBe(4); // All marked as 'full' = removed
      expect(result.applicatorGroups[0].totalSources).toBe(20);
      expect(result.applicatorGroups[0].removedSources).toBe(20);
    });

    it("should calculate totalSourcesRemoved correctly", () => {
      const applicators: ApplicatorForPdf[] = [
        {
          id: "1",
          serialNumber: "APP-001",
          seedQuantity: 5,
          usageType: "full",
          insertionTime: "2026-01-01T10:00:00Z",
        },
        {
          id: "2",
          serialNumber: "APP-002",
          seedQuantity: 5,
          usageType: "full",
          insertionTime: "2026-01-01T10:05:00Z",
        },
        {
          id: "3",
          serialNumber: "APP-003",
          seedQuantity: 5,
          usageType: "full",
          insertionTime: "2026-01-01T10:10:00Z",
        },
        {
          id: "4",
          serialNumber: "APP-004",
          seedQuantity: 5,
          usageType: "full",
          insertionTime: "2026-01-01T10:15:00Z",
        },
      ];

      const result = buildRemovalPdfData(mockTreatment, applicators);

      // 4 applicators × 5 sources = 20 total removed
      expect(result.summary.totalSourcesRemoved).toBe(20);
      expect(result.summary.totalSourcesInserted).toBe(20);
    });

    it("should handle mixed seed quantities correctly", () => {
      // Mix of 5-seed and 10-seed applicators
      const applicators: ApplicatorForPdf[] = [
        {
          id: "1",
          serialNumber: "APP-001",
          seedQuantity: 5,
          usageType: "full",
          insertionTime: "2026-01-01T10:00:00Z",
        },
        {
          id: "2",
          serialNumber: "APP-002",
          seedQuantity: 10,
          usageType: "full",
          insertionTime: "2026-01-01T10:05:00Z",
        },
        {
          id: "3",
          serialNumber: "APP-003",
          seedQuantity: 5,
          usageType: "full",
          insertionTime: "2026-01-01T10:10:00Z",
        },
      ];

      const treatmentWith20Sources = { ...mockTreatment, seedQuantity: 20 };
      const result = buildRemovalPdfData(
        treatmentWith20Sources as Treatment,
        applicators,
      );

      // Should have 2 groups (5-seed and 10-seed)
      expect(result.applicatorGroups.length).toBe(2);

      // Total: 5 + 10 + 5 = 20 sources removed
      expect(result.summary.totalSourcesRemoved).toBe(20);
    });

    it("should handle partial removal (not all applicators removed)", () => {
      const applicators: ApplicatorForPdf[] = [
        {
          id: "1",
          serialNumber: "APP-001",
          seedQuantity: 5,
          usageType: "full",
          insertionTime: "2026-01-01T10:00:00Z",
        },
        {
          id: "2",
          serialNumber: "APP-002",
          seedQuantity: 5,
          usageType: "full",
          insertionTime: "2026-01-01T10:05:00Z",
        },
        {
          id: "3",
          serialNumber: "APP-003",
          seedQuantity: 5,
          usageType: "none",
          insertionTime: "",
        }, // Not removed
        {
          id: "4",
          serialNumber: "APP-004",
          seedQuantity: 5,
          usageType: "none",
          insertionTime: "",
        }, // Not removed
      ];

      const result = buildRemovalPdfData(mockTreatment, applicators);

      // Only 2 applicators removed = 10 sources removed
      expect(result.summary.totalSourcesRemoved).toBe(10);
      expect(result.discrepancy.sourcesNotRemoved).toBe(10);
      expect(result.discrepancy.isRemovedEqualInserted).toBe(false);
    });

    it("should return empty applicatorGroups when no applicators provided", () => {
      const result = buildRemovalPdfData(mockTreatment, []);

      // This is the bug condition - should return empty groups
      expect(result.applicatorGroups).toEqual([]);
      expect(result.summary.totalSourcesRemoved).toBe(0);
    });

    it("should include treatment information in the output", () => {
      const applicators: ApplicatorForPdf[] = [
        {
          id: "1",
          serialNumber: "APP-001",
          seedQuantity: 5,
          usageType: "full",
          insertionTime: "2026-01-01T10:00:00Z",
        },
      ];

      const result = buildRemovalPdfData(mockTreatment, applicators);

      expect(result.treatment.id).toBe(mockTreatment.id);
      expect(result.treatment.patientName).toBe(mockTreatment.patientName);
      expect(result.treatment.surgeon).toBe(mockTreatment.surgeon);
      expect(result.treatment.site).toBe(mockTreatment.site);
      expect(result.treatment.type).toBe("removal");
    });
  });

  describe("finalizeAndSendPdf — recipient routing", () => {
    const baseTreatment = {
      id: "test-treatment-routing-001",
      type: "insertion",
      subjectId: "ROUTING-001",
      site: "100078",
      date: new Date("2026-05-20T09:00:00Z"),
      surgeon: "Dr. Example",
      activityPerSeed: 2.8,
      patientName: "Routing Test Patient",
    } as unknown as Treatment;

    const baseSignature: SignatureDetails = {
      type: "alphatau_verified",
      signerName: "Dr. Example",
      signerEmail: "surgeon@example.test",
      signerPosition: "Surgeon",
      signedAt: new Date("2026-05-20T10:00:00Z"),
    };

    it("sends the PDF to the signer email, not the env value", async () => {
      const sendSpy = emailService.sendSignedPdf as jest.Mock;

      await finalizeAndSendPdf(baseTreatment, [], baseSignature);

      expect(sendSpy).toHaveBeenCalledTimes(1);
      expect(sendSpy).toHaveBeenCalledWith(
        "surgeon@example.test",
        expect.any(Buffer),
        baseTreatment.id,
        baseSignature,
      );
    });

    it("trims and lowercases the signer email before sending", async () => {
      const sendSpy = emailService.sendSignedPdf as jest.Mock;

      await finalizeAndSendPdf(baseTreatment, [], {
        ...baseSignature,
        signerEmail: "  Surgeon@Example.Test  ",
      });

      expect(sendSpy).toHaveBeenCalledWith(
        "surgeon@example.test",
        expect.any(Buffer),
        baseTreatment.id,
        expect.objectContaining({ signerEmail: "  Surgeon@Example.Test  " }),
      );
    });
  });
});
