import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTreatment } from '@/context/TreatmentContext';
import Layout from '@/components/Layout';

const ProcedureTypePage = () => {
  const navigate = useNavigate();
  const { setProcedureType } = useTreatment();
  const [selectedType, setSelectedType] = useState<'insertion' | 'removal' | null>(null);

  const handleProceedClick = () => {
    if (selectedType) {
      setProcedureType(selectedType);
      navigate('/treatment/select');
    }
  };

  return (
    <Layout title="Select Procedure Type" showBackButton={false}>
      <div className="mx-auto max-w-md space-y-6">
        <div className="rounded-lg border bg-white p-6 shadow-md">
          <h2 className="mb-6 text-xl font-medium text-center">Select the type of procedure</h2>
          
          <div className="flex flex-col gap-4">
            <button
              onClick={() => setSelectedType('insertion')}
              className={`flex items-center justify-between rounded-lg border p-4 transition-all ${
                selectedType === 'insertion'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 hover:border-primary/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`rounded-full p-2 ${
                  selectedType === 'insertion' ? 'bg-primary/20' : 'bg-gray-100'
                }`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={selectedType === 'insertion' ? 'text-primary' : ''}>
                    <path d="M12 5v14"></path>
                    <path d="M5 12h14"></path>
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium">Treatment</h3>
                  <p className="text-sm text-gray-500">New treatment insertion</p>
                </div>
              </div>
              {selectedType === 'insertion' && (
                <div className="rounded-full bg-primary p-1 text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5"></path>
                  </svg>
                </div>
              )}
            </button>
            
            <button
              onClick={() => setSelectedType('removal')}
              className={`flex items-center justify-between rounded-lg border p-4 transition-all ${
                selectedType === 'removal'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 hover:border-primary/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`rounded-full p-2 ${
                  selectedType === 'removal' ? 'bg-primary/20' : 'bg-gray-100'
                }`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={selectedType === 'removal' ? 'text-primary' : ''}>
                    <path d="M5 12h14"></path>
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium">Removal</h3>
                  <p className="text-sm text-gray-500">Treatment removal procedure</p>
                </div>
              </div>
              {selectedType === 'removal' && (
                <div className="rounded-full bg-primary p-1 text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5"></path>
                  </svg>
                </div>
              )}
            </button>
          </div>
          
          <div className="mt-8">
            <button
              onClick={handleProceedClick}
              disabled={!selectedType}
              className="w-full rounded-md bg-primary py-2 px-4 font-medium text-white shadow-sm transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
            >
              Proceed
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ProcedureTypePage;
