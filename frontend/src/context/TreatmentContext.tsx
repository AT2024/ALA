import { createContext, useState, useContext, ReactNode } from 'react';

interface Treatment {
  id: string;
  type: 'insertion' | 'removal';
  subjectId: string;
  site: string;
  date: string;
  isComplete: boolean;
}

interface Applicator {
  id: string;
  serialNumber: string;
  seedQuantity: number;
  usageType: 'full' | 'faulty' | 'none';
  insertionTime: string;
  comments?: string;
  image?: string;
  isRemoved?: boolean;
  removalComments?: string;
  removalImage?: string;
}

interface TreatmentContextType {
  currentTreatment: Treatment | null;
  applicators: Applicator[];
  currentApplicator: Applicator | null;
  procedureType: 'insertion' | 'removal' | null;
  setProcedureType: (type: 'insertion' | 'removal') => void;
  setTreatment: (treatment: Treatment) => void;
  addApplicator: (applicator: Applicator) => void;
  updateApplicator: (id: string, data: Partial<Applicator>) => void;
  setCurrentApplicator: (applicator: Applicator | null) => void;
  removeApplicator: (id: string) => void;
  clearTreatment: () => void;
  totalSeeds: number;
  removedSeeds: number;
}

const TreatmentContext = createContext<TreatmentContextType | undefined>(undefined);

export function TreatmentProvider({ children }: { children: ReactNode }) {
  const [currentTreatment, setCurrentTreatment] = useState<Treatment | null>(null);
  const [applicators, setApplicators] = useState<Applicator[]>([]);
  const [currentApplicator, setCurrentApplicator] = useState<Applicator | null>(null);
  const [procedureType, setProcedureType] = useState<'insertion' | 'removal' | null>(null);

  const setTreatment = (treatment: Treatment) => {
    setCurrentTreatment(treatment);
    // Clear applicators when changing treatments
    if (treatment.type === 'insertion') {
      setApplicators([]);
    }
  };

  const addApplicator = (applicator: Applicator) => {
    setApplicators((prev) => [...prev, applicator]);
  };

  const updateApplicator = (id: string, data: Partial<Applicator>) => {
    setApplicators((prev) => 
      prev.map((app) => app.id === id ? { ...app, ...data } : app)
    );
  };

  const removeApplicator = (id: string) => {
    setApplicators((prev) => prev.filter((app) => app.id !== id));
  };

  const clearTreatment = () => {
    setCurrentTreatment(null);
    setApplicators([]);
    setCurrentApplicator(null);
    setProcedureType(null);
  };

  // Calculate totals for removal treatment
  const totalSeeds = applicators.reduce((sum, app) => sum + app.seedQuantity, 0);
  const removedSeeds = applicators.reduce((sum, app) => 
    app.isRemoved ? sum + app.seedQuantity : sum, 0
  );

  return (
    <TreatmentContext.Provider
      value={{
        currentTreatment,
        applicators,
        currentApplicator,
        procedureType,
        setProcedureType,
        setTreatment,
        addApplicator,
        updateApplicator,
        setCurrentApplicator,
        removeApplicator,
        clearTreatment,
        totalSeeds,
        removedSeeds
      }}
    >
      {children}
    </TreatmentContext.Provider>
  );
}

export function useTreatment() {
  const context = useContext(TreatmentContext);
  if (context === undefined) {
    throw new Error('useTreatment must be used within a TreatmentProvider');
  }
  return context;
}
