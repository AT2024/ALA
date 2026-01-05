import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { TreatmentProvider, useTreatment } from '@/context/TreatmentContext';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <TreatmentProvider>{children}</TreatmentProvider>
  </BrowserRouter>
);

describe('TreatmentContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('useTreatment hook', () => {
    it('should throw error when used outside TreatmentProvider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useTreatment());
      }).toThrow('useTreatment must be used within a TreatmentProvider');

      consoleSpy.mockRestore();
    });

    it('should provide treatment context when used within TreatmentProvider', () => {
      const { result } = renderHook(() => useTreatment(), { wrapper });

      expect(result.current).toHaveProperty('currentTreatment');
      expect(result.current).toHaveProperty('applicators');
      expect(result.current).toHaveProperty('setTreatment');
      expect(result.current).toHaveProperty('addApplicator');
      expect(result.current).toHaveProperty('progressStats');
    });
  });

  describe('Initial state', () => {
    it('should start with null treatment and empty applicators', () => {
      const { result } = renderHook(() => useTreatment(), { wrapper });

      expect(result.current.currentTreatment).toBeNull();
      expect(result.current.applicators).toEqual([]);
      expect(result.current.availableApplicators).toEqual([]);
      expect(result.current.processedApplicators).toEqual([]);
      expect(result.current.currentApplicator).toBeNull();
    });

    it('should initialize procedure type from localStorage', () => {
      localStorage.setItem('procedureType', 'insertion');

      const { result } = renderHook(() => useTreatment(), { wrapper });

      expect(result.current.procedureType).toBe('insertion');
    });
  });

  describe('setTreatment', () => {
    it('should set current treatment and clear applicators', () => {
      const { result } = renderHook(() => useTreatment(), { wrapper });

      const mockTreatment = {
        id: '1',
        type: 'insertion' as const,
        subjectId: 'PATIENT-001',
        patientName: 'Patient Test-001',
        site: 'Test Site',
        date: '2025-10-09',
        isComplete: false,
        seedQuantity: 100,
      };

      act(() => {
        result.current.setTreatment(mockTreatment);
      });

      expect(result.current.currentTreatment).toEqual(mockTreatment);
      expect(result.current.applicators).toEqual([]);
      expect(result.current.availableApplicators).toEqual([]);
      expect(result.current.processedApplicators).toEqual([]);
    });
  });

  describe('Applicator management', () => {
    const mockApplicator = {
      id: '1',
      serialNumber: 'APP-001',
      seedQuantity: 25,
      usageType: 'full' as const,
      insertionTime: '2025-10-09T10:00:00Z',
      insertedSeedsQty: 25,
      patientId: 'PATIENT-001',
    };

    it('should add applicator to list', () => {
      const { result } = renderHook(() => useTreatment(), { wrapper });

      act(() => {
        result.current.addApplicator(mockApplicator);
      });

      expect(result.current.applicators).toHaveLength(1);
      expect(result.current.applicators[0]).toEqual(mockApplicator);
    });

    it('should add available applicator without duplicates', () => {
      const { result } = renderHook(() => useTreatment(), { wrapper });

      act(() => {
        result.current.addAvailableApplicator(mockApplicator);
        result.current.addAvailableApplicator(mockApplicator);
      });

      expect(result.current.availableApplicators).toHaveLength(1);
    });

    it('should process full use applicator and remove from available list', () => {
      const { result } = renderHook(() => useTreatment(), { wrapper });

      act(() => {
        result.current.addAvailableApplicator(mockApplicator);
      });

      expect(result.current.availableApplicators).toHaveLength(1);

      act(() => {
        result.current.processApplicator(mockApplicator);
      });

      expect(result.current.processedApplicators).toHaveLength(1);
      expect(result.current.availableApplicators).toHaveLength(0);
    });

    it('should process no-use applicator and keep in available list', () => {
      const noUseApplicator = {
        ...mockApplicator,
        usageType: 'none' as const,
        insertedSeedsQty: 0,
      };

      const { result } = renderHook(() => useTreatment(), { wrapper });

      act(() => {
        result.current.addAvailableApplicator(noUseApplicator);
        result.current.processApplicator(noUseApplicator);
      });

      expect(result.current.processedApplicators).toHaveLength(1);
      expect(result.current.availableApplicators).toHaveLength(1);
    });

    it('should update applicator data', () => {
      const { result } = renderHook(() => useTreatment(), { wrapper });

      act(() => {
        result.current.addApplicator(mockApplicator);
      });

      act(() => {
        result.current.updateApplicator('1', { comments: 'Updated comment' });
      });

      expect(result.current.applicators[0].comments).toBe('Updated comment');
    });

    it('should remove applicator from list', () => {
      const { result } = renderHook(() => useTreatment(), { wrapper });

      act(() => {
        result.current.addApplicator(mockApplicator);
      });

      expect(result.current.applicators).toHaveLength(1);

      act(() => {
        result.current.removeApplicator('1');
      });

      expect(result.current.applicators).toHaveLength(0);
    });
  });

  describe('Progress calculations', () => {
    const mockTreatment = {
      id: '1',
      type: 'insertion' as const,
      subjectId: 'PATIENT-001',
      patientName: 'Patient Test-001',
      site: 'Test Site',
      date: '2025-10-09',
      isComplete: false,
      seedQuantity: 100,
    };

    it('should calculate applicator progress', () => {
      const { result } = renderHook(() => useTreatment(), { wrapper });

      const applicator1 = {
        id: '1',
        serialNumber: 'APP-001',
        seedQuantity: 25,
        usageType: 'full' as const,
        insertionTime: '2025-10-09T10:00:00Z',
        insertedSeedsQty: 25,
        patientId: 'PATIENT-001',
      };

      act(() => {
        result.current.setTreatment(mockTreatment);
        result.current.addApplicator(applicator1);
      });

      const progress = result.current.getApplicatorProgress();
      expect(progress.used).toBe(1);
      expect(progress.total).toBeGreaterThan(0);
    });

    it('should calculate seed progress', () => {
      const { result } = renderHook(() => useTreatment(), { wrapper });

      const applicator1 = {
        id: '1',
        serialNumber: 'APP-001',
        seedQuantity: 25,
        usageType: 'full' as const,
        insertionTime: '2025-10-09T10:00:00Z',
        insertedSeedsQty: 25,
        patientId: 'PATIENT-001',
      };

      act(() => {
        result.current.setTreatment(mockTreatment);
        result.current.addApplicator(applicator1);
      });

      const progress = result.current.getSeedProgress();
      expect(progress.inserted).toBe(25);
      expect(progress.total).toBe(100);
    });

    it('should calculate usage type distribution', () => {
      const { result } = renderHook(() => useTreatment(), { wrapper });

      act(() => {
        result.current.processApplicator({
          id: '1',
          serialNumber: 'APP-001',
          seedQuantity: 25,
          usageType: 'full' as const,
          insertionTime: '2025-10-09T10:00:00Z',
          patientId: 'PATIENT-001',
        });
        result.current.processApplicator({
          id: '2',
          serialNumber: 'APP-002',
          seedQuantity: 25,
          usageType: 'faulty' as const,
          insertionTime: '2025-10-09T10:15:00Z',
          insertedSeedsQty: 20,
          patientId: 'PATIENT-001',
        });
        result.current.processApplicator({
          id: '3',
          serialNumber: 'APP-003',
          seedQuantity: 25,
          usageType: 'none' as const,
          insertionTime: '2025-10-09T10:30:00Z',
          insertedSeedsQty: 0,
          patientId: 'PATIENT-001',
        });
      });

      const distribution = result.current.getUsageTypeDistribution();
      expect(distribution.full).toBe(1);
      expect(distribution.faulty).toBe(1);
      expect(distribution.none).toBe(1);
    });

    it('should calculate actual total seeds correctly', () => {
      const { result } = renderHook(() => useTreatment(), { wrapper });

      act(() => {
        result.current.setTreatment(mockTreatment);
        result.current.addAvailableApplicator({
          id: '1',
          serialNumber: 'APP-001',
          seedQuantity: 25,
          usageType: 'full' as const,
          insertionTime: '2025-10-09T10:00:00Z',
          patientId: 'PATIENT-001',
        });
        result.current.addAvailableApplicator({
          id: '2',
          serialNumber: 'APP-002',
          seedQuantity: 25,
          usageType: 'full' as const,
          insertionTime: '2025-10-09T10:00:00Z',
          patientId: 'PATIENT-001',
        });
      });

      const totalSeeds = result.current.getActualTotalSeeds();
      expect(totalSeeds).toBe(50);
    });

    it('should calculate actual inserted seeds excluding no-use applicators', () => {
      const { result } = renderHook(() => useTreatment(), { wrapper });

      act(() => {
        result.current.processApplicator({
          id: '1',
          serialNumber: 'APP-001',
          seedQuantity: 25,
          usageType: 'full' as const,
          insertionTime: '2025-10-09T10:00:00Z',
          insertedSeedsQty: 25,
          patientId: 'PATIENT-001',
        });
        result.current.processApplicator({
          id: '2',
          serialNumber: 'APP-002',
          seedQuantity: 25,
          usageType: 'faulty' as const,
          insertionTime: '2025-10-09T10:15:00Z',
          insertedSeedsQty: 20,
          patientId: 'PATIENT-001',
        });
        result.current.processApplicator({
          id: '3',
          serialNumber: 'APP-003',
          seedQuantity: 25,
          usageType: 'none' as const,
          insertionTime: '2025-10-09T10:30:00Z',
          insertedSeedsQty: 0,
          patientId: 'PATIENT-001',
        });
      });

      const insertedSeeds = result.current.getActualInsertedSeeds();
      expect(insertedSeeds).toBe(45); // 25 (full) + 20 (faulty) + 0 (none)
    });
  });

  describe('Removal workflow', () => {
    const mockRemovalTreatment = {
      id: '2',
      type: 'removal' as const,
      subjectId: 'PATIENT-001',
      patientName: 'Patient Test-001',
      site: 'Test Site',
      date: '2025-10-15',
      isComplete: false,
      seedQuantity: 100,
    };

    it('should group applicators by seed count', () => {
      const { result } = renderHook(() => useTreatment(), { wrapper });

      act(() => {
        result.current.setTreatment(mockRemovalTreatment);
        result.current.addApplicator({
          id: '1',
          serialNumber: 'APP-001',
          seedQuantity: 25,
          usageType: 'full' as const,
          insertionTime: '2025-10-09T10:00:00Z',
          patientId: 'PATIENT-001',
        });
        result.current.addApplicator({
          id: '2',
          serialNumber: 'APP-002',
          seedQuantity: 25,
          usageType: 'full' as const,
          insertionTime: '2025-10-09T10:15:00Z',
          patientId: 'PATIENT-001',
        });
        result.current.addApplicator({
          id: '3',
          serialNumber: 'APP-003',
          seedQuantity: 20,
          usageType: 'faulty' as const,
          insertionTime: '2025-10-09T10:30:00Z',
          patientId: 'PATIENT-001',
        });
      });

      const groups = result.current.getApplicatorGroups();
      expect(groups).toHaveLength(2);
      expect(groups[0].seedCount).toBe(25);
      expect(groups[0].totalApplicators).toBe(2);
      expect(groups[1].seedCount).toBe(20);
      expect(groups[1].totalApplicators).toBe(1);
    });

    it('should track removal progress with individual seeds', () => {
      const { result } = renderHook(() => useTreatment(), { wrapper });

      act(() => {
        result.current.setTreatment(mockRemovalTreatment);
        result.current.addApplicator({
          id: '1',
          serialNumber: 'APP-001',
          seedQuantity: 25,
          usageType: 'full' as const,
          insertionTime: '2025-10-09T10:00:00Z',
          isRemoved: true,
          patientId: 'PATIENT-001',
        });
        result.current.setIndividualSeedsRemoved(10);
      });

      const progress = result.current.getRemovalProgress();
      expect(progress.removedSeeds).toBe(25);
      expect(progress.effectiveRemovedSeeds).toBe(35); // 25 from applicator + 10 individual
    });
  });

  describe('clearTreatment', () => {
    it('should reset all treatment data', () => {
      const { result } = renderHook(() => useTreatment(), { wrapper });

      act(() => {
        result.current.setTreatment({
          id: '1',
          type: 'insertion' as const,
          subjectId: 'PATIENT-001',
          patientName: 'Patient Test-001',
          site: 'Test Site',
          date: '2025-10-09',
          isComplete: false,
        });
        result.current.addApplicator({
          id: '1',
          serialNumber: 'APP-001',
          seedQuantity: 25,
          usageType: 'full' as const,
          insertionTime: '2025-10-09T10:00:00Z',
          patientId: 'PATIENT-001',
        });
        result.current.setIndividualSeedsRemoved(10);
      });

      expect(result.current.currentTreatment).not.toBeNull();
      expect(result.current.applicators).toHaveLength(1);

      act(() => {
        result.current.clearTreatment();
      });

      expect(result.current.currentTreatment).toBeNull();
      expect(result.current.applicators).toEqual([]);
      expect(result.current.availableApplicators).toEqual([]);
      expect(result.current.processedApplicators).toEqual([]);
      expect(result.current.individualSeedsRemoved).toBe(0);
      expect(result.current.procedureType).toBeNull();
    });
  });
});
