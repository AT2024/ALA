import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { TreatmentProvider, useTreatment } from '../TreatmentContext';
import { ReactNode } from 'react';

// Wrapper component for testing - includes BrowserRouter for useLocation() hook
const wrapper = ({ children }: { children: ReactNode }) => (
  <BrowserRouter>
    <TreatmentProvider>{children}</TreatmentProvider>
  </BrowserRouter>
);

describe('TreatmentContext - 8-State Workflow Helpers', () => {
  describe('sortApplicatorsByStatus', () => {
    it('should sort active states (SEALED, OPENED, LOADED) to top', () => {
      const { result } = renderHook(() => useTreatment(), { wrapper });

      const applicators = [
        {
          id: '1',
          serialNumber: 'APP001',
          seedQuantity: 25,
          usageType: 'full' as const,
          insertionTime: '2025-07-10T10:00:00Z',
          status: 'INSERTED' as const
        },
        {
          id: '2',
          serialNumber: 'APP002',
          seedQuantity: 25,
          usageType: 'full' as const,
          insertionTime: '2025-07-10T10:01:00Z',
          status: 'OPENED' as const
        },
        {
          id: '3',
          serialNumber: 'APP003',
          seedQuantity: 25,
          usageType: 'full' as const,
          insertionTime: '2025-07-10T10:02:00Z',
          status: 'SEALED' as const
        }
      ];

      const sorted = result.current.sortApplicatorsByStatus(applicators);

      // Active states (OPENED, SEALED) should be at top
      expect(sorted[0].status).toBe('OPENED');
      expect(sorted[1].status).toBe('SEALED');

      // Terminal state (INSERTED) should be at bottom
      expect(sorted[2].status).toBe('INSERTED');
    });

    it('should sort LOADED status to top (active state)', () => {
      const { result } = renderHook(() => useTreatment(), { wrapper });

      const applicators = [
        {
          id: '1',
          serialNumber: 'APP001',
          seedQuantity: 25,
          usageType: 'full' as const,
          insertionTime: '2025-07-10T10:00:00Z',
          status: 'FAULTY' as const
        },
        {
          id: '2',
          serialNumber: 'APP002',
          seedQuantity: 25,
          usageType: 'full' as const,
          insertionTime: '2025-07-10T10:01:00Z',
          status: 'LOADED' as const
        }
      ];

      const sorted = result.current.sortApplicatorsByStatus(applicators);

      // LOADED should be first (active)
      expect(sorted[0].status).toBe('LOADED');

      // FAULTY should be last (terminal)
      expect(sorted[1].status).toBe('FAULTY');
    });

    it('should sort terminal states (INSERTED, FAULTY, DISPOSED, etc.) to bottom', () => {
      const { result } = renderHook(() => useTreatment(), { wrapper });

      const applicators = [
        {
          id: '1',
          serialNumber: 'APP001',
          seedQuantity: 25,
          usageType: 'full' as const,
          insertionTime: '2025-07-10T10:00:00Z',
          status: 'DISPOSED' as const
        },
        {
          id: '2',
          serialNumber: 'APP002',
          seedQuantity: 25,
          usageType: 'full' as const,
          insertionTime: '2025-07-10T10:01:00Z',
          status: 'SEALED' as const
        },
        {
          id: '3',
          serialNumber: 'APP003',
          seedQuantity: 25,
          usageType: 'full' as const,
          insertionTime: '2025-07-10T10:02:00Z',
          status: 'FAULTY' as const
        },
        {
          id: '4',
          serialNumber: 'APP004',
          seedQuantity: 25,
          usageType: 'full' as const,
          insertionTime: '2025-07-10T10:03:00Z',
          status: 'OPENED' as const
        }
      ];

      const sorted = result.current.sortApplicatorsByStatus(applicators);

      // Active states at top
      expect(sorted[0].status).toBe('SEALED');
      expect(sorted[1].status).toBe('OPENED');

      // Terminal states at bottom
      expect(sorted[2].status).toBe('DISPOSED');
      expect(sorted[3].status).toBe('FAULTY');
    });

    it('should sort by seedQuantity within same group (highest first)', () => {
      const { result } = renderHook(() => useTreatment(), { wrapper });

      const applicators = [
        {
          id: '1',
          serialNumber: 'APP001',
          seedQuantity: 20,
          usageType: 'full' as const,
          insertionTime: '2025-07-10T10:00:00Z',
          status: 'SEALED' as const
        },
        {
          id: '2',
          serialNumber: 'APP002',
          seedQuantity: 25,
          usageType: 'full' as const,
          insertionTime: '2025-07-10T10:01:00Z',
          status: 'SEALED' as const
        },
        {
          id: '3',
          serialNumber: 'APP003',
          seedQuantity: 15,
          usageType: 'full' as const,
          insertionTime: '2025-07-10T10:02:00Z',
          status: 'INSERTED' as const
        },
        {
          id: '4',
          serialNumber: 'APP004',
          seedQuantity: 30,
          usageType: 'full' as const,
          insertionTime: '2025-07-10T10:03:00Z',
          status: 'INSERTED' as const
        }
      ];

      const sorted = result.current.sortApplicatorsByStatus(applicators);

      // Active group: sorted by seedQuantity descending
      expect(sorted[0].seedQuantity).toBe(25);
      expect(sorted[1].seedQuantity).toBe(20);

      // Terminal group: sorted by seedQuantity descending
      expect(sorted[2].seedQuantity).toBe(30);
      expect(sorted[3].seedQuantity).toBe(15);
    });

    it('should handle null status with backward compatibility (use usageType)', () => {
      const { result } = renderHook(() => useTreatment(), { wrapper });

      const applicators = [
        {
          id: '1',
          serialNumber: 'APP001',
          seedQuantity: 25,
          usageType: 'full' as const,
          insertionTime: '2025-07-10T10:00:00Z',
          status: undefined // null status, should fallback to usageType
        },
        {
          id: '2',
          serialNumber: 'APP002',
          seedQuantity: 25,
          usageType: 'none' as const,
          insertionTime: '2025-07-10T10:01:00Z',
          status: undefined
        },
        {
          id: '3',
          serialNumber: 'APP003',
          seedQuantity: 25,
          usageType: 'faulty' as const,
          insertionTime: '2025-07-10T10:02:00Z',
          status: undefined
        }
      ];

      const sorted = result.current.sortApplicatorsByStatus(applicators);

      // usageType: 'none' should map to SEALED (active)
      // usageType: 'full' should map to INSERTED (terminal)
      // usageType: 'faulty' should map to FAULTY (terminal)

      // SEALED should be first
      expect(sorted[0].usageType).toBe('none');

      // Terminal states at bottom
      expect(sorted[1].usageType).toBe('full');
      expect(sorted[2].usageType).toBe('faulty');
    });

    it('should handle DEPLOYMENT_FAILURE and DISCHARGED as terminal states', () => {
      const { result } = renderHook(() => useTreatment(), { wrapper });

      const applicators = [
        {
          id: '1',
          serialNumber: 'APP001',
          seedQuantity: 25,
          usageType: 'faulty' as const,
          insertionTime: '2025-07-10T10:00:00Z',
          status: 'DEPLOYMENT_FAILURE' as const
        },
        {
          id: '2',
          serialNumber: 'APP002',
          seedQuantity: 25,
          usageType: 'none' as const,
          insertionTime: '2025-07-10T10:01:00Z',
          status: 'DISCHARGED' as const
        },
        {
          id: '3',
          serialNumber: 'APP003',
          seedQuantity: 25,
          usageType: 'full' as const,
          insertionTime: '2025-07-10T10:02:00Z',
          status: 'OPENED' as const
        }
      ];

      const sorted = result.current.sortApplicatorsByStatus(applicators);

      // OPENED should be at top (active)
      expect(sorted[0].status).toBe('OPENED');

      // All others should be at bottom (terminal)
      const terminalStatuses = sorted.slice(1).map(app => app.status);
      expect(terminalStatuses).toContain('DEPLOYMENT_FAILURE');
      expect(terminalStatuses).toContain('DISCHARGED');
    });

    it('should not mutate original array', () => {
      const { result } = renderHook(() => useTreatment(), { wrapper });

      const applicators = [
        {
          id: '1',
          serialNumber: 'APP001',
          seedQuantity: 25,
          usageType: 'full' as const,
          insertionTime: '2025-07-10T10:00:00Z',
          status: 'INSERTED' as const
        },
        {
          id: '2',
          serialNumber: 'APP002',
          seedQuantity: 25,
          usageType: 'full' as const,
          insertionTime: '2025-07-10T10:01:00Z',
          status: 'SEALED' as const
        }
      ];

      const originalOrder = [...applicators];
      result.current.sortApplicatorsByStatus(applicators);

      // Original array should remain unchanged
      expect(applicators).toEqual(originalOrder);
    });
  });

  describe('isPancreasOrProstate', () => {
    it('should return true for pancreas_insertion treatment', () => {
      const { result } = renderHook(() => useTreatment(), { wrapper });

      act(() => {
        result.current.setTreatment({
          id: 'treatment-1',
          type: 'pancreas_insertion',
          subjectId: 'PAT-001',
          site: '100078',
          date: '2025-07-10',
          isComplete: false
        });
      });

      expect(result.current.isPancreasOrProstate()).toBe(true);
    });

    it('should return true for prostate_insertion treatment', () => {
      const { result } = renderHook(() => useTreatment(), { wrapper });

      act(() => {
        result.current.setTreatment({
          id: 'treatment-2',
          type: 'prostate_insertion',
          subjectId: 'PAT-002',
          site: '100078',
          date: '2025-07-10',
          isComplete: false
        });
      });

      expect(result.current.isPancreasOrProstate()).toBe(true);
    });

    it('should return false for skin_insertion treatment', () => {
      const { result } = renderHook(() => useTreatment(), { wrapper });

      act(() => {
        result.current.setTreatment({
          id: 'treatment-3',
          type: 'skin_insertion',
          subjectId: 'PAT-003',
          site: '100078',
          date: '2025-07-10',
          isComplete: false
        });
      });

      expect(result.current.isPancreasOrProstate()).toBe(false);
    });

    it('should return false for insertion treatment (generic)', () => {
      const { result } = renderHook(() => useTreatment(), { wrapper });

      act(() => {
        result.current.setTreatment({
          id: 'treatment-4',
          type: 'insertion',
          subjectId: 'PAT-004',
          site: '100078',
          date: '2025-07-10',
          isComplete: false
        });
      });

      expect(result.current.isPancreasOrProstate()).toBe(false);
    });

    it('should return false for removal treatment', () => {
      const { result } = renderHook(() => useTreatment(), { wrapper });

      act(() => {
        result.current.setTreatment({
          id: 'treatment-5',
          type: 'removal',
          subjectId: 'PAT-005',
          site: '100078',
          date: '2025-07-10',
          isComplete: false
        });
      });

      expect(result.current.isPancreasOrProstate()).toBe(false);
    });

    it('should return false when no treatment is set', () => {
      const { result } = renderHook(() => useTreatment(), { wrapper });

      expect(result.current.isPancreasOrProstate()).toBe(false);
    });

    it('should be case-insensitive (handle PANCREAS, Pancreas, etc.)', () => {
      const { result } = renderHook(() => useTreatment(), { wrapper });

      // Test with uppercase
      act(() => {
        result.current.setTreatment({
          id: 'treatment-6',
          type: 'PANCREAS_insertion' as any,
          subjectId: 'PAT-006',
          site: '100078',
          date: '2025-07-10',
          isComplete: false
        });
      });

      expect(result.current.isPancreasOrProstate()).toBe(true);

      // Test with mixed case
      act(() => {
        result.current.setTreatment({
          id: 'treatment-7',
          type: 'Prostate_Insertion' as any,
          subjectId: 'PAT-007',
          site: '100078',
          date: '2025-07-10',
          isComplete: false
        });
      });

      expect(result.current.isPancreasOrProstate()).toBe(true);
    });

    it('should handle partial matches in treatment type string', () => {
      const { result } = renderHook(() => useTreatment(), { wrapper });

      // Test with treatment type containing 'pancreas' anywhere
      act(() => {
        result.current.setTreatment({
          id: 'treatment-8',
          type: 'pancreas_combined_insertion' as any,
          subjectId: 'PAT-008',
          site: '100078',
          date: '2025-07-10',
          isComplete: false
        });
      });

      expect(result.current.isPancreasOrProstate()).toBe(true);
    });
  });

  describe('Integration: Sorting + Treatment Type', () => {
    it('should work together for pancreas treatments with packages', () => {
      const { result } = renderHook(() => useTreatment(), { wrapper });

      act(() => {
        result.current.setTreatment({
          id: 'treatment-9',
          type: 'pancreas_insertion',
          subjectId: 'PAT-009',
          site: '100078',
          date: '2025-07-10',
          isComplete: false
        });
      });

      const applicators = [
        {
          id: '1',
          serialNumber: 'APP001',
          seedQuantity: 25,
          usageType: 'full' as const,
          insertionTime: '2025-07-10T10:00:00Z',
          status: 'INSERTED' as const,
          package_label: 'P1'
        },
        {
          id: '2',
          serialNumber: 'APP002',
          seedQuantity: 25,
          usageType: 'full' as const,
          insertionTime: '2025-07-10T10:01:00Z',
          status: 'LOADED' as const,
          package_label: 'P2'
        }
      ];

      // Verify it's a pancreas treatment (requires packaging)
      expect(result.current.isPancreasOrProstate()).toBe(true);

      // Verify sorting works correctly
      const sorted = result.current.sortApplicatorsByStatus(applicators);
      expect(sorted[0].status).toBe('LOADED'); // Active state
      expect(sorted[1].status).toBe('INSERTED'); // Terminal state
    });
  });
});
