import { createContext, useState, useContext, ReactNode } from 'react';

interface Treatment {
  id: string;
  type: 'insertion' | 'removal';
  subjectId: string;
  site: string;
  date: string;
  isComplete: boolean;
  email?: string;
  seedQuantity?: number;
  activityPerSeed?: number;
  surgeon?: string;
}

interface Applicator {
  id: string;
  serialNumber: string;
  applicatorType?: string;
  seedQuantity: number;
  usageType: 'full' | 'faulty' | 'none';
  insertionTime: string;
  insertedSeedsQty?: number;
  comments?: string;
  image?: string;
  isRemoved?: boolean;
  removalComments?: string;
  removalImage?: string;
}

interface ProgressStats {
  totalApplicators: number;
  usedApplicators: number;
  totalSeeds: number;
  insertedSeeds: number;
  completionPercentage: number;
  usageTypeDistribution: {
    full: number;
    faulty: number;
    none: number;
  };
  seedsRemaining: number;
  applicatorsRemaining: number;
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
  progressStats: ProgressStats;
  getApplicatorProgress: () => { used: number; total: number };
  getSeedProgress: () => { inserted: number; total: number };
  getUsageTypeDistribution: () => { full: number; faulty: number; none: number };
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

  // Progress calculation methods
  const getApplicatorProgress = () => {
    const used = applicators.length;
    const total = currentTreatment?.seedQuantity ? Math.ceil(currentTreatment.seedQuantity / 25) : used; // Estimate based on 25 seeds per applicator
    return { used, total };
  };

  const getSeedProgress = () => {
    const inserted = applicators.reduce((sum, app) => sum + (app.insertedSeedsQty || 0), 0);
    const total = currentTreatment?.seedQuantity || inserted;
    return { inserted, total };
  };

  const getUsageTypeDistribution = () => {
    const distribution = { full: 0, faulty: 0, none: 0 };
    applicators.forEach(app => {
      if (app.usageType === 'full') distribution.full++;
      else if (app.usageType === 'faulty') distribution.faulty++;
      else if (app.usageType === 'none') distribution.none++;
    });
    return distribution;
  };

  // Calculate totals for removal treatment
  const totalSeeds = applicators.reduce((sum, app) => sum + app.seedQuantity, 0);
  const removedSeeds = applicators.reduce((sum, app) => 
    app.isRemoved ? sum + app.seedQuantity : sum, 0
  );

  // Comprehensive progress statistics
  const progressStats: ProgressStats = {
    totalApplicators: currentTreatment?.seedQuantity ? Math.ceil(currentTreatment.seedQuantity / 25) : applicators.length,
    usedApplicators: applicators.length,
    totalSeeds: currentTreatment?.seedQuantity || getSeedProgress().inserted,
    insertedSeeds: getSeedProgress().inserted,
    completionPercentage: currentTreatment?.seedQuantity ? 
      Math.round((getSeedProgress().inserted / currentTreatment.seedQuantity) * 100) : 0,
    usageTypeDistribution: getUsageTypeDistribution(),
    seedsRemaining: Math.max(0, (currentTreatment?.seedQuantity || 0) - getSeedProgress().inserted),
    applicatorsRemaining: Math.max(0, (currentTreatment?.seedQuantity ? Math.ceil(currentTreatment.seedQuantity / 25) : 0) - applicators.length)
  };

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
        removedSeeds,
        progressStats,
        getApplicatorProgress,
        getSeedProgress,
        getUsageTypeDistribution
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
