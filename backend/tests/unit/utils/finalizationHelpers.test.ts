/**
 * Tests for finalizationHelpers.ts - Removal PDF Data Generation
 *
 * DL-004: Verifies that buildRemovalPdfData correctly populates applicatorGroups
 * and calculates totalSourcesRemoved for removal procedure PDFs.
 */

import { buildRemovalPdfData, ApplicatorForPdf } from '../../../src/utils/finalizationHelpers';
import { Treatment } from '../../../src/models';

// Mock the models to avoid database connection
jest.mock('../../../src/models', () => ({
  Treatment: class MockTreatment {
    id = 'test-treatment-id';
    type = 'removal';
    subjectId = 'TEST-001';
    site = '100078';
    date = new Date('2026-01-01');
    surgeon = 'Dr. Test';
    activityPerSeed = 2.8;
    patientName = 'Test Patient';
  },
  TreatmentPdf: {},
  SignatureVerification: {},
}));

describe('finalizationHelpers', () => {
  describe('buildRemovalPdfData', () => {
    // Create a mock treatment for testing
    const mockTreatment = {
      id: 'test-removal-001',
      type: 'removal' as const,
      subjectId: 'REMOVAL-TEST-001',
      site: '100078',
      date: new Date('2026-01-01'),
      surgeon: 'Dr. Test',
      activityPerSeed: 2.8,
      patientName: 'Test Patient (Ready for removal)',
      seedQuantity: 20,
    } as Treatment;

    it('should populate applicatorGroups when applicators are provided', () => {
      // Create 4 applicators with 5 sources each = 20 total sources
      const applicators: ApplicatorForPdf[] = [
        { id: '1', serialNumber: 'APP-001', seedQuantity: 5, usageType: 'full', insertionTime: '2026-01-01T10:00:00Z' },
        { id: '2', serialNumber: 'APP-002', seedQuantity: 5, usageType: 'full', insertionTime: '2026-01-01T10:05:00Z' },
        { id: '3', serialNumber: 'APP-003', seedQuantity: 5, usageType: 'full', insertionTime: '2026-01-01T10:10:00Z' },
        { id: '4', serialNumber: 'APP-004', seedQuantity: 5, usageType: 'full', insertionTime: '2026-01-01T10:15:00Z' },
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

    it('should calculate totalSourcesRemoved correctly', () => {
      const applicators: ApplicatorForPdf[] = [
        { id: '1', serialNumber: 'APP-001', seedQuantity: 5, usageType: 'full', insertionTime: '2026-01-01T10:00:00Z' },
        { id: '2', serialNumber: 'APP-002', seedQuantity: 5, usageType: 'full', insertionTime: '2026-01-01T10:05:00Z' },
        { id: '3', serialNumber: 'APP-003', seedQuantity: 5, usageType: 'full', insertionTime: '2026-01-01T10:10:00Z' },
        { id: '4', serialNumber: 'APP-004', seedQuantity: 5, usageType: 'full', insertionTime: '2026-01-01T10:15:00Z' },
      ];

      const result = buildRemovalPdfData(mockTreatment, applicators);

      // 4 applicators × 5 sources = 20 total removed
      expect(result.summary.totalSourcesRemoved).toBe(20);
      expect(result.summary.totalSourcesInserted).toBe(20);
    });

    it('should handle mixed seed quantities correctly', () => {
      // Mix of 5-seed and 10-seed applicators
      const applicators: ApplicatorForPdf[] = [
        { id: '1', serialNumber: 'APP-001', seedQuantity: 5, usageType: 'full', insertionTime: '2026-01-01T10:00:00Z' },
        { id: '2', serialNumber: 'APP-002', seedQuantity: 10, usageType: 'full', insertionTime: '2026-01-01T10:05:00Z' },
        { id: '3', serialNumber: 'APP-003', seedQuantity: 5, usageType: 'full', insertionTime: '2026-01-01T10:10:00Z' },
      ];

      const treatmentWith20Sources = { ...mockTreatment, seedQuantity: 20 };
      const result = buildRemovalPdfData(treatmentWith20Sources as Treatment, applicators);

      // Should have 2 groups (5-seed and 10-seed)
      expect(result.applicatorGroups.length).toBe(2);

      // Total: 5 + 10 + 5 = 20 sources removed
      expect(result.summary.totalSourcesRemoved).toBe(20);
    });

    it('should handle partial removal (not all applicators removed)', () => {
      const applicators: ApplicatorForPdf[] = [
        { id: '1', serialNumber: 'APP-001', seedQuantity: 5, usageType: 'full', insertionTime: '2026-01-01T10:00:00Z' },
        { id: '2', serialNumber: 'APP-002', seedQuantity: 5, usageType: 'full', insertionTime: '2026-01-01T10:05:00Z' },
        { id: '3', serialNumber: 'APP-003', seedQuantity: 5, usageType: 'none', insertionTime: '' }, // Not removed
        { id: '4', serialNumber: 'APP-004', seedQuantity: 5, usageType: 'none', insertionTime: '' }, // Not removed
      ];

      const result = buildRemovalPdfData(mockTreatment, applicators);

      // Only 2 applicators removed = 10 sources removed
      expect(result.summary.totalSourcesRemoved).toBe(10);
      expect(result.discrepancy.sourcesNotRemoved).toBe(10);
      expect(result.discrepancy.isRemovedEqualInserted).toBe(false);
    });

    it('should return empty applicatorGroups when no applicators provided', () => {
      const result = buildRemovalPdfData(mockTreatment, []);

      // This is the bug condition - should return empty groups
      expect(result.applicatorGroups).toEqual([]);
      expect(result.summary.totalSourcesRemoved).toBe(0);
    });

    it('should include treatment information in the output', () => {
      const applicators: ApplicatorForPdf[] = [
        { id: '1', serialNumber: 'APP-001', seedQuantity: 5, usageType: 'full', insertionTime: '2026-01-01T10:00:00Z' },
      ];

      const result = buildRemovalPdfData(mockTreatment, applicators);

      expect(result.treatment.id).toBe(mockTreatment.id);
      expect(result.treatment.patientName).toBe(mockTreatment.patientName);
      expect(result.treatment.surgeon).toBe(mockTreatment.surgeon);
      expect(result.treatment.site).toBe(mockTreatment.site);
      expect(result.treatment.type).toBe('removal');
    });
  });
});
