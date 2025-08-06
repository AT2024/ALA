import { Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider } from '@/context/AuthContext';
import { TreatmentProvider } from '@/context/TreatmentContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import LoginPage from '@/pages/Auth/LoginPage';
import VerificationPage from '@/pages/Auth/VerificationPage';
import TreatmentSelection from '@/pages/Treatment/TreatmentSelection';
import TreatmentDocumentation from '@/pages/Treatment/TreatmentDocumentation';
import ApplicatorInformation from '@/pages/Treatment/ApplicatorInformation';
import UseList from '@/pages/Treatment/UseList';
import SeedRemoval from '@/pages/Treatment/SeedRemoval';
import Dashboard from '@/pages/Admin/Dashboard';
import ProjectDocPage from '@/pages/ProjectDocPage';
import ProcedureTypePage from '@/pages/Procedure/ProcedureTypePage';

function App() {
  return (
    <AuthProvider>
      <TreatmentProvider>
        <div className="min-h-screen bg-background">
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
        </div>
      </TreatmentProvider>
    </AuthProvider>
  );
}

export default App;
