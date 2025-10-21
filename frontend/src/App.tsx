import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';

import { AuthProvider } from '@/context/AuthContext';
import { TreatmentProvider } from '@/context/TreatmentContext';
import ProtectedRoute from '@/components/ProtectedRoute';

// Eager load authentication pages (needed immediately)
import LoginPage from '@/pages/Auth/LoginPage';
import VerificationPage from '@/pages/Auth/VerificationPage';

// Lazy load feature pages (loaded on demand)
const TreatmentSelection = lazy(() => import('@/pages/Treatment/TreatmentSelection'));
const TreatmentDocumentation = lazy(() => import('@/pages/Treatment/TreatmentDocumentation'));
const ApplicatorInformation = lazy(() => import('@/pages/Treatment/ApplicatorInformation'));
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

function App() {
  return (
    <AuthProvider>
      <TreatmentProvider>
        <div className="min-h-screen bg-background">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/verify" element={<VerificationPage />} />
              <Route path="/docs" element={<ProjectDocPage />} /> {/* New docs page - accessible without login */}

              <Route element={<ProtectedRoute />}>
                <Route path="/procedure-type" element={<ProcedureTypePage />} />
                <Route path="/treatment/select" element={<TreatmentSelection />} />
                <Route path="/treatment/scan" element={<TreatmentDocumentation />} />
                <Route path="/treatment/applicator" element={<ApplicatorInformation />} />
                <Route path="/treatment/list" element={<UseList />} />
                <Route path="/treatment/removal" element={<SeedRemoval />} />
                <Route path="/admin/dashboard" element={<Dashboard />} />
              </Route>

              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Suspense>
        </div>
      </TreatmentProvider>
    </AuthProvider>
  );
}

export default App;
