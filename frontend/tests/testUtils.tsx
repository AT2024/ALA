import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { TreatmentProvider } from '@/context/TreatmentContext';

// Mock user data for tests
export const mockUser = {
  id: '1',
  email: 'test@example.com',
  phoneNumber: '+1234567890',
  role: 'hospital' as const,
  name: 'Test User',
  positionCode: '10',
  custName: 'Test Hospital',
  sites: ['Site A', 'Site B'],
  fullAccess: false,
};

export const mockAdminUser = {
  id: '2',
  email: 'admin@example.com',
  phoneNumber: '+1234567891',
  role: 'alphatau' as const,
  name: 'Admin User',
  positionCode: '99',
  custName: 'AlphaTau',
  sites: [],
  fullAccess: true,
};

// Mock treatment data
export const mockTreatment = {
  id: '1',
  type: 'insertion' as const,
  subjectId: 'PATIENT-001',
  patientName: 'Patient Test-001',
  site: 'Test Site',
  date: '2025-10-09',
  isComplete: false,
  email: 'test@example.com',
  seedQuantity: 100,
  activityPerSeed: 1.5,
  surgeon: 'Dr. Test',
};

export const mockRemovalTreatment = {
  id: '2',
  type: 'removal' as const,
  subjectId: 'PATIENT-001',
  patientName: 'Patient Test-001',
  site: 'Test Site',
  date: '2025-10-15',
  isComplete: false,
  email: 'test@example.com',
  seedQuantity: 100,
  daysSinceInsertion: 7,
};

// Mock applicator data
export const mockApplicator = {
  id: '1',
  serialNumber: 'APP-001',
  applicatorType: 'Type A',
  seedQuantity: 25,
  usageType: 'full' as const,
  insertionTime: '2025-10-09T10:00:00Z',
  insertedSeedsQty: 25,
  comments: 'Test comment',
  patientId: 'PATIENT-001',
};

export const mockFaultyApplicator = {
  id: '2',
  serialNumber: 'APP-002',
  applicatorType: 'Type A',
  seedQuantity: 25,
  usageType: 'faulty' as const,
  insertionTime: '2025-10-09T10:15:00Z',
  insertedSeedsQty: 20,
  comments: 'Faulty applicator',
  patientId: 'PATIENT-001',
};

export const mockNoUseApplicator = {
  id: '3',
  serialNumber: 'APP-003',
  applicatorType: 'Type A',
  seedQuantity: 25,
  usageType: 'none' as const,
  insertionTime: '2025-10-09T10:30:00Z',
  insertedSeedsQty: 0,
  comments: 'Not used',
  patientId: 'PATIENT-001',
};

// Custom render function that includes providers
interface AllTheProvidersProps {
  children: React.ReactNode;
}

const AllTheProviders = ({ children }: AllTheProvidersProps) => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TreatmentProvider>{children}</TreatmentProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };

// Helper to setup localStorage with authenticated user
export const setupAuthenticatedUser = (user = mockUser) => {
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('token', 'test-token-123');
};

// Helper to clear authentication
export const clearAuth = () => {
  localStorage.removeItem('user');
  localStorage.removeItem('token');
};

// Helper to wait for async updates
export const waitForLoadingToFinish = async () => {
  const { waitFor } = await import('@testing-library/react');
  await waitFor(() => {}, { timeout: 100 });
};
