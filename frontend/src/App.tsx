import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';

import { AuthProvider } from '@/context/AuthContext';
import { TreatmentProvider } from '@/context/TreatmentContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { EnvironmentBanner, useIsStaging } from '@/components/EnvironmentBanner';
import { TestModeBanner, useIsTestMode } from '@/components/TestModeBanner';

// Eager load authentication pages (needed immediately)
import LoginPage from '@/pages/Auth/LoginPage';
import VerificationPage from '@/pages/Auth/VerificationPage';

// Lazy load feature pages (loaded on demand)
const TreatmentSelection = lazy(() => import('@/pages/Treatment/TreatmentSelection'));
const TreatmentDocumentation = lazy(() => import('@/pages/Treatment/TreatmentDocumentation'));
const UseList = lazy(() => import('@/pages/Treatment/UseList'));
const SeedRemoval = lazy(() => import('@/pages/Treatment/SeedRemoval'));
const Dashboard = lazy(() => import('@/pages/Admin/Dashboard'));
const ProjectDocPage = lazy(() => import('@/pages/ProjectDocPage'));
const ProcedureTypePage = lazy(() => import('@/pages/Procedure/ProcedureTypePage'));

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      <p className="text-sm text-gray-600">Loading...</p>
    </div>
  </div>
);

// Inner app component that can use auth context hooks
function AppContent() {
  const isStaging = useIsStaging();
  const isTestMode = useIsTestMode();

  // Add padding when banners are visible
  const topPadding = isStaging || isTestMode ? 'pt-12' : '';

  return (
    <div className="min-h-screen bg-background">
      {/* Environment banner - only shows in staging */}
      <EnvironmentBanner />
      {/* Test mode banner - only shows when test mode is enabled */}
      <TestModeBanner />

      {/* Main content - conditional padding only when banner is visible */}
      <div className={topPadding}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/verify" element={<VerificationPage />} />
            <Route path="/docs" element={<ProjectDocPage />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/procedure-type" element={<ProcedureTypePage />} />
              <Route path="/treatment/select" element={<TreatmentSelection />} />
              <Route path="/treatment/scan" element={<TreatmentDocumentation />} />
              <Route path="/treatment/list" element={<UseList />} />
              <Route path="/treatment/removal" element={<SeedRemoval />} />
              <Route path="/admin/dashboard" element={<Dashboard />} />
            </Route>

            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <TreatmentProvider>
        <AppContent />
      </TreatmentProvider>
    </AuthProvider>
  );
}

export default App;
