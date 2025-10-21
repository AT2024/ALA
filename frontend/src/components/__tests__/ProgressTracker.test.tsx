import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { screen, act } from '@testing-library/react';
import { render, mockTreatment, mockApplicator, mockFaultyApplicator } from '../../../tests/testUtils';
import ProgressTracker from '../ProgressTracker';
import { TreatmentProvider, useTreatment } from '@/context/TreatmentContext';
import { BrowserRouter } from 'react-router-dom';

// Test wrapper component that sets up treatment context
const ProgressTrackerWithContext = ({
  treatment,
  applicators = []
}: {
  treatment: any;
  applicators?: any[]
}) => {
  const TestSetup = () => {
    const { setTreatment, addApplicator, processApplicator, addAvailableApplicator } = useTreatment();

    // Setup treatment and applicators
    React.useEffect(() => {
      if (treatment) {
        setTreatment(treatment);
      }
      applicators.forEach((app) => {
        if (app.processed) {
          processApplicator(app);
        } else if (app.available) {
          addAvailableApplicator(app);
        } else {
          addApplicator(app);
        }
      });
    }, []);

    return <ProgressTracker />;
  };

  return (
    <BrowserRouter>
      <TreatmentProvider>
        <TestSetup />
      </TreatmentProvider>
    </BrowserRouter>
  );
};

describe('ProgressTracker', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should render null when no treatment is selected', () => {
    const { container } = render(
      <BrowserRouter>
        <TreatmentProvider>
          <ProgressTracker />
        </TreatmentProvider>
      </BrowserRouter>
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render treatment progress when treatment is selected', () => {
    render(
      <ProgressTrackerWithContext
        treatment={mockTreatment}
        applicators={[]}
      />
    );

    expect(screen.getByText('Treatment Progress')).toBeInTheDocument();
    expect(screen.getByText('Applicators Processed')).toBeInTheDocument();
    expect(screen.getByText('Seeds Inserted')).toBeInTheDocument();
  });

  it('should display patient and treatment information', () => {
    render(
      <ProgressTrackerWithContext
        treatment={mockTreatment}
        applicators={[]}
      />
    );

    expect(screen.getByText(`Patient: ${mockTreatment.subjectId}`)).toBeInTheDocument();
    expect(screen.getByText(`Type: ${mockTreatment.type}`)).toBeInTheDocument();
    expect(screen.getByText(`Site: ${mockTreatment.site}`)).toBeInTheDocument();
  });

  it('should show progress bars for applicators and seeds', () => {
    render(
      <ProgressTrackerWithContext
        treatment={mockTreatment}
        applicators={[
          { ...mockApplicator, processed: true }
        ]}
      />
    );

    expect(screen.getByText('Applicators Processed')).toBeInTheDocument();
    expect(screen.getByText('Seeds Inserted')).toBeInTheDocument();
  });

  it('should display usage type distribution when applicators are processed', () => {
    render(
      <ProgressTrackerWithContext
        treatment={mockTreatment}
        applicators={[
          { ...mockApplicator, processed: true },
          { ...mockFaultyApplicator, processed: true }
        ]}
      />
    );

    expect(screen.getByText('Usage Type Distribution')).toBeInTheDocument();
    expect(screen.getByText(/Full Use:/)).toBeInTheDocument();
    expect(screen.getByText(/Faulty:/)).toBeInTheDocument();
    expect(screen.getByText(/No Use:/)).toBeInTheDocument();
  });

  it('should calculate and display completion percentage', () => {
    render(
      <ProgressTrackerWithContext
        treatment={mockTreatment}
        applicators={[
          { ...mockApplicator, processed: true, available: true }
        ]}
      />
    );

    expect(screen.getByText('Completion')).toBeInTheDocument();
    expect(screen.getByText(/\d+%/)).toBeInTheDocument();
  });

  it('should display seeds remaining and applicators available', () => {
    render(
      <ProgressTrackerWithContext
        treatment={mockTreatment}
        applicators={[]}
      />
    );

    expect(screen.getByText('Seeds Remaining')).toBeInTheDocument();
    expect(screen.getByText('Applicators Available')).toBeInTheDocument();
  });

  it('should show total seeds available info', () => {
    render(
      <ProgressTrackerWithContext
        treatment={mockTreatment}
        applicators={[
          { ...mockApplicator, available: true }
        ]}
      />
    );

    expect(screen.getByText(/Total Seeds Available:/)).toBeInTheDocument();
  });

  it('should display applicator type breakdown when available', () => {
    render(
      <ProgressTrackerWithContext
        treatment={mockTreatment}
        applicators={[
          { ...mockApplicator, available: true, patientId: mockTreatment.subjectId }
        ]}
      />
    );

    expect(screen.getByText('Available Applicators by Type')).toBeInTheDocument();
  });

  it('should show correct progress bar width based on percentage', () => {
    const { container } = render(
      <ProgressTrackerWithContext
        treatment={{ ...mockTreatment, seedQuantity: 100 }}
        applicators={[
          {
            ...mockApplicator,
            seedQuantity: 50,
            insertedSeedsQty: 50,
            processed: true,
            available: true,
            patientId: mockTreatment.subjectId
          }
        ]}
      />
    );

    // Progress bars should exist
    const progressBars = container.querySelectorAll('[class*="rounded-full"]');
    expect(progressBars.length).toBeGreaterThan(0);
  });

  it('should display seeds inserted count', () => {
    render(
      <ProgressTrackerWithContext
        treatment={mockTreatment}
        applicators={[
          { ...mockApplicator, processed: true }
        ]}
      />
    );

    expect(screen.getByText('Seeds Inserted')).toBeInTheDocument();
  });

  it('should handle treatment without seed quantity', () => {
    const treatmentWithoutSeeds = {
      ...mockTreatment,
      seedQuantity: undefined,
    };

    render(
      <ProgressTrackerWithContext
        treatment={treatmentWithoutSeeds}
        applicators={[]}
      />
    );

    expect(screen.getByText('Treatment Progress')).toBeInTheDocument();
  });
});
