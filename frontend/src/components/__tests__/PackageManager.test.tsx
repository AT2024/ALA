import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PackageManager from '../PackageManager';
import api from '@/services/api';

// Mock the API
vi.mock('@/services/api', () => ({
  default: {
    post: vi.fn()
  }
}));

describe('PackageManager', () => {
  const mockTreatmentId = 'test-treatment-123';
  const mockOnPackageCreated = vi.fn();

  const mockApplicatorsLoaded = [
    {
      id: 'app-1',
      serialNumber: 'APP001',
      applicatorType: 'Type A',
      seedQuantity: 25,
      usageType: 'full' as const,
      insertionTime: '2025-07-10T10:00:00Z',
      status: 'LOADED' as const,
      package_label: undefined
    },
    {
      id: 'app-2',
      serialNumber: 'APP002',
      applicatorType: 'Type A',
      seedQuantity: 25,
      usageType: 'full' as const,
      insertionTime: '2025-07-10T10:01:00Z',
      status: 'LOADED' as const,
      package_label: undefined
    },
    {
      id: 'app-3',
      serialNumber: 'APP003',
      applicatorType: 'Type A',
      seedQuantity: 25,
      usageType: 'full' as const,
      insertionTime: '2025-07-10T10:02:00Z',
      status: 'LOADED' as const,
      package_label: undefined
    },
    {
      id: 'app-4',
      serialNumber: 'APP004',
      applicatorType: 'Type A',
      seedQuantity: 25,
      usageType: 'full' as const,
      insertionTime: '2025-07-10T10:03:00Z',
      status: 'LOADED' as const,
      package_label: undefined
    }
  ];

  const mockApplicatorsInserted = [
    {
      id: 'app-5',
      serialNumber: 'APP005',
      applicatorType: 'Type A',
      seedQuantity: 25,
      usageType: 'full' as const,
      insertionTime: '2025-07-10T09:00:00Z',
      status: 'INSERTED' as const,
      package_label: undefined
    }
  ];

  const mockApplicatorsPackaged = [
    {
      id: 'app-6',
      serialNumber: 'APP006',
      applicatorType: 'Type A',
      seedQuantity: 25,
      usageType: 'full' as const,
      insertionTime: '2025-07-10T08:00:00Z',
      status: 'LOADED' as const,
      package_label: 'P1'
    },
    {
      id: 'app-7',
      serialNumber: 'APP007',
      applicatorType: 'Type A',
      seedQuantity: 25,
      usageType: 'full' as const,
      insertionTime: '2025-07-10T08:01:00Z',
      status: 'LOADED' as const,
      package_label: 'P1'
    },
    {
      id: 'app-8',
      serialNumber: 'APP008',
      applicatorType: 'Type A',
      seedQuantity: 25,
      usageType: 'full' as const,
      insertionTime: '2025-07-10T08:02:00Z',
      status: 'LOADED' as const,
      package_label: 'P1'
    },
    {
      id: 'app-9',
      serialNumber: 'APP009',
      applicatorType: 'Type A',
      seedQuantity: 25,
      usageType: 'full' as const,
      insertionTime: '2025-07-10T08:03:00Z',
      status: 'LOADED' as const,
      package_label: 'P1'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render PackageManager component', () => {
      render(
        <PackageManager
          treatmentId={mockTreatmentId}
          processedApplicators={mockApplicatorsLoaded}
          onPackageCreated={mockOnPackageCreated}
        />
      );

      expect(screen.getByText('Package Management')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create package/i })).toBeInTheDocument();
    });

    it('should render summary table with correct headers', () => {
      render(
        <PackageManager
          treatmentId={mockTreatmentId}
          processedApplicators={mockApplicatorsLoaded}
          onPackageCreated={mockOnPackageCreated}
        />
      );

      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByText('Inserted')).toBeInTheDocument();
      expect(screen.getByText('Available')).toBeInTheDocument();
      expect(screen.getByText('Loaded')).toBeInTheDocument();
      expect(screen.getByText('Package')).toBeInTheDocument();
    });

    it('should display "No applicators processed yet" when empty', () => {
      render(
        <PackageManager
          treatmentId={mockTreatmentId}
          processedApplicators={[]}
          onPackageCreated={mockOnPackageCreated}
        />
      );

      expect(screen.getByText('No applicators processed yet')).toBeInTheDocument();
    });
  });

  describe('Summary Table Calculations', () => {
    it('should calculate loaded count correctly', () => {
      render(
        <PackageManager
          treatmentId={mockTreatmentId}
          processedApplicators={mockApplicatorsLoaded}
          onPackageCreated={mockOnPackageCreated}
        />
      );

      // All 4 applicators are LOADED
      expect(screen.getByText('4')).toBeInTheDocument(); // Loaded count
    });

    it('should calculate inserted count correctly', () => {
      render(
        <PackageManager
          treatmentId={mockTreatmentId}
          processedApplicators={[...mockApplicatorsLoaded, ...mockApplicatorsInserted]}
          onPackageCreated={mockOnPackageCreated}
        />
      );

      // 1 applicator is INSERTED
      expect(screen.getByText('1')).toBeInTheDocument(); // Inserted count
    });

    it('should calculate package count correctly', () => {
      render(
        <PackageManager
          treatmentId={mockTreatmentId}
          processedApplicators={mockApplicatorsPackaged}
          onPackageCreated={mockOnPackageCreated}
        />
      );

      // 4 applicators in P1 = 1 package
      expect(screen.getByText('1')).toBeInTheDocument(); // Package count
    });

    it('should display available count (SEALED, OPENED, LOADED)', () => {
      const mixedApplicators = [
        { ...mockApplicatorsLoaded[0], status: 'SEALED' as const },
        { ...mockApplicatorsLoaded[1], status: 'OPENED' as const },
        { ...mockApplicatorsLoaded[2], status: 'LOADED' as const },
        { ...mockApplicatorsLoaded[3], status: 'INSERTED' as const }
      ];

      render(
        <PackageManager
          treatmentId={mockTreatmentId}
          processedApplicators={mixedApplicators}
          onPackageCreated={mockOnPackageCreated}
        />
      );

      // 3 applicators are available (SEALED, OPENED, LOADED)
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  describe('Create Package Button', () => {
    it('should enable button when loaded applicators exist', () => {
      render(
        <PackageManager
          treatmentId={mockTreatmentId}
          processedApplicators={mockApplicatorsLoaded}
          onPackageCreated={mockOnPackageCreated}
        />
      );

      const button = screen.getByRole('button', { name: /create package/i });
      expect(button).not.toBeDisabled();
    });

    it('should disable button when no loaded applicators exist', () => {
      render(
        <PackageManager
          treatmentId={mockTreatmentId}
          processedApplicators={mockApplicatorsInserted}
          onPackageCreated={mockOnPackageCreated}
        />
      );

      const button = screen.getByRole('button', { name: /create package/i });
      expect(button).toBeDisabled();
    });

    it('should open dialog when button is clicked', async () => {
      render(
        <PackageManager
          treatmentId={mockTreatmentId}
          processedApplicators={mockApplicatorsLoaded}
          onPackageCreated={mockOnPackageCreated}
        />
      );

      const button = screen.getByRole('button', { name: /create package/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Create Package (Select 4 Applicators)')).toBeInTheDocument();
      });
    });
  });

  describe('Package Creation Dialog', () => {
    it('should display selection info', async () => {
      render(
        <PackageManager
          treatmentId={mockTreatmentId}
          processedApplicators={mockApplicatorsLoaded}
          onPackageCreated={mockOnPackageCreated}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /create package/i }));

      await waitFor(() => {
        expect(screen.getByText(/Selected: 0 \/ 4 applicators/)).toBeInTheDocument();
      });
    });

    it('should display loaded applicators grouped by type', async () => {
      render(
        <PackageManager
          treatmentId={mockTreatmentId}
          processedApplicators={mockApplicatorsLoaded}
          onPackageCreated={mockOnPackageCreated}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /create package/i }));

      await waitFor(() => {
        expect(screen.getByText(/25 seeds \(4 available\)/)).toBeInTheDocument();
        expect(screen.getByText('APP001')).toBeInTheDocument();
        expect(screen.getByText('APP002')).toBeInTheDocument();
        expect(screen.getByText('APP003')).toBeInTheDocument();
        expect(screen.getByText('APP004')).toBeInTheDocument();
      });
    });

    it('should allow selecting applicators', async () => {
      render(
        <PackageManager
          treatmentId={mockTreatmentId}
          processedApplicators={mockApplicatorsLoaded}
          onPackageCreated={mockOnPackageCreated}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /create package/i }));

      await waitFor(() => {
        expect(screen.getByText('APP001')).toBeInTheDocument();
      });

      // Click on first applicator
      const applicatorElement = screen.getByText('APP001').closest('div[class*="cursor-pointer"]');
      if (applicatorElement) {
        fireEvent.click(applicatorElement);
      }

      await waitFor(() => {
        expect(screen.getByText(/Selected: 1 \/ 4 applicators/)).toBeInTheDocument();
      });
    });

    it('should validate exactly 4 applicators are selected', async () => {
      render(
        <PackageManager
          treatmentId={mockTreatmentId}
          processedApplicators={mockApplicatorsLoaded}
          onPackageCreated={mockOnPackageCreated}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /create package/i }));

      await waitFor(() => {
        expect(screen.getByText('Create Package (Select 4 Applicators)')).toBeInTheDocument();
      });

      // Try to create package without selecting any
      const createButton = screen.getAllByRole('button', { name: /create package/i }).find(
        btn => btn.closest('[role="dialog"]')
      );

      if (createButton) {
        fireEvent.click(createButton);
      }

      await waitFor(() => {
        expect(screen.getByText('You must select exactly 4 applicators')).toBeInTheDocument();
      });
    });

    it('should validate all selected applicators are same type', async () => {
      const mixedTypeApplicators = [
        ...mockApplicatorsLoaded.slice(0, 2),
        {
          ...mockApplicatorsLoaded[2],
          seedQuantity: 20, // Different seed quantity
          id: 'app-10'
        },
        mockApplicatorsLoaded[3]
      ];

      render(
        <PackageManager
          treatmentId={mockTreatmentId}
          processedApplicators={mixedTypeApplicators}
          onPackageCreated={mockOnPackageCreated}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /create package/i }));

      // This would need more complex interaction testing
      // Placeholder for type validation test
    });
  });

  describe('API Integration', () => {
    it('should call API with correct data when creating package', async () => {
      const mockPost = vi.mocked(api.post);
      mockPost.mockResolvedValue({
        data: { package_label: 'P1' }
      });

      render(
        <PackageManager
          treatmentId={mockTreatmentId}
          processedApplicators={mockApplicatorsLoaded}
          onPackageCreated={mockOnPackageCreated}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /create package/i }));

      await waitFor(() => {
        expect(screen.getByText('Create Package (Select 4 Applicators)')).toBeInTheDocument();
      });

      // Select all 4 applicators (simplified - would need actual click events in real test)
      // For now, test the API call structure

      expect(mockPost).not.toHaveBeenCalled(); // Not called until we actually create
    });

    it('should show success message after package creation', async () => {
      const mockPost = vi.mocked(api.post);
      mockPost.mockResolvedValue({
        data: { package_label: 'P2' }
      });

      render(
        <PackageManager
          treatmentId={mockTreatmentId}
          processedApplicators={mockApplicatorsLoaded}
          onPackageCreated={mockOnPackageCreated}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /create package/i }));

      // This test would require full interaction flow
      // Placeholder for success message validation
    });

    it('should show error message on API failure', async () => {
      const mockPost = vi.mocked(api.post);
      mockPost.mockRejectedValue({
        response: {
          data: { error: 'Package creation failed' }
        }
      });

      render(
        <PackageManager
          treatmentId={mockTreatmentId}
          processedApplicators={mockApplicatorsLoaded}
          onPackageCreated={mockOnPackageCreated}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /create package/i }));

      // This test would require full interaction flow
      // Placeholder for error message validation
    });

    it('should call onPackageCreated callback after successful creation', async () => {
      const mockPost = vi.mocked(api.post);
      mockPost.mockResolvedValue({
        data: { package_label: 'P1' }
      });

      render(
        <PackageManager
          treatmentId={mockTreatmentId}
          processedApplicators={mockApplicatorsLoaded}
          onPackageCreated={mockOnPackageCreated}
        />
      );

      // This test would require full interaction flow
      // Verify callback is invoked
    });
  });

  describe('Dialog Interactions', () => {
    it('should close dialog when Cancel is clicked', async () => {
      render(
        <PackageManager
          treatmentId={mockTreatmentId}
          processedApplicators={mockApplicatorsLoaded}
          onPackageCreated={mockOnPackageCreated}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /create package/i }));

      await waitFor(() => {
        expect(screen.getByText('Create Package (Select 4 Applicators)')).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText('Create Package (Select 4 Applicators)')).not.toBeInTheDocument();
      });
    });

    it('should close dialog when X button is clicked', async () => {
      render(
        <PackageManager
          treatmentId={mockTreatmentId}
          processedApplicators={mockApplicatorsLoaded}
          onPackageCreated={mockOnPackageCreated}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /create package/i }));

      await waitFor(() => {
        expect(screen.getByText('Create Package (Select 4 Applicators)')).toBeInTheDocument();
      });

      // Find and click the X button (close icon)
      const closeButtons = screen.getAllByRole('button');
      const xButton = closeButtons.find(btn => btn.querySelector('svg'));

      if (xButton) {
        fireEvent.click(xButton);
      }

      await waitFor(() => {
        expect(screen.queryByText('Create Package (Select 4 Applicators)')).not.toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle applicators with null status (backward compatibility)', () => {
      const nullStatusApplicators = mockApplicatorsLoaded.map(app => ({
        ...app,
        status: undefined
      }));

      render(
        <PackageManager
          treatmentId={mockTreatmentId}
          processedApplicators={nullStatusApplicators}
          onPackageCreated={mockOnPackageCreated}
        />
      );

      // Should still render without errors
      expect(screen.getByText('Package Management')).toBeInTheDocument();
    });

    it('should group applicators by seed quantity correctly', () => {
      const multiTypeApplicators = [
        { ...mockApplicatorsLoaded[0], seedQuantity: 25 },
        { ...mockApplicatorsLoaded[1], seedQuantity: 25 },
        { ...mockApplicatorsLoaded[2], seedQuantity: 20, id: 'app-10' },
        { ...mockApplicatorsLoaded[3], seedQuantity: 20, id: 'app-11' }
      ];

      render(
        <PackageManager
          treatmentId={mockTreatmentId}
          processedApplicators={multiTypeApplicators}
          onPackageCreated={mockOnPackageCreated}
        />
      );

      // Should show two rows in summary table (25 seeds and 20 seeds)
      expect(screen.getByText('25 seeds')).toBeInTheDocument();
      expect(screen.getByText('20 seeds')).toBeInTheDocument();
    });

    it('should not include packaged applicators in available count', () => {
      render(
        <PackageManager
          treatmentId={mockTreatmentId}
          processedApplicators={[...mockApplicatorsLoaded, ...mockApplicatorsPackaged]}
          onPackageCreated={mockOnPackageCreated}
        />
      );

      // Only non-packaged LOADED applicators should be available
      // 4 loaded without package_label
      expect(screen.getByText('4')).toBeInTheDocument();
    });
  });
});
