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
  returnedFromNoUse?: boolean;
  patientId?: string;
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
  availableApplicators: Applicator[];
  processedApplicators: Applicator[];
  currentApplicator: Applicator | null;
  procedureType: 'insertion' | 'removal' | null;
  setProcedureType: (type: 'insertion' | 'removal') => void;
  setTreatment: (treatment: Treatment) => void;
  addApplicator: (applicator: Applicator) => void;
  addAvailableApplicator: (applicator: Applicator) => void;
  processApplicator: (applicator: Applicator) => void;
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
  getActualTotalSeeds: () => number;
  getActualInsertedSeeds: () => number;
  getApplicatorTypeBreakdown: () => { seedCount: number; count: number }[];
}

const TreatmentContext = createContext<TreatmentContextType | undefined>(undefined);

export function TreatmentProvider({ children }: { children: ReactNode }) {
  const [currentTreatment, setCurrentTreatment] = useState<Treatment | null>(null);
  const [applicators, setApplicators] = useState<Applicator[]>([]);
  const [availableApplicators, setAvailableApplicators] = useState<Applicator[]>([]);
  const [processedApplicators, setProcessedApplicators] = useState<Applicator[]>([]);
  const [currentApplicator, setCurrentApplicator] = useState<Applicator | null>(null);
  const [procedureType, setProcedureType] = useState<'insertion' | 'removal' | null>(null);

  const setTreatment = (treatment: Treatment) => {
    setCurrentTreatment(treatment);
    // Clear applicators when changing treatments (for all treatment types)
    setApplicators([]);
    setAvailableApplicators([]);
    setProcessedApplicators([]);
  };

  const addApplicator = (applicator: Applicator) => {
    setApplicators((prev) => [...prev, applicator]);
  };

  const addAvailableApplicator = (applicator: Applicator) => {
    setAvailableApplicators((prev) => {
      // Check for duplicates by serialNumber
      const exists = prev.some(app => app.serialNumber === applicator.serialNumber);
      if (exists) {
        return prev; // Don't add duplicates
      }
      return [...prev, applicator];
    });
  };

  const processApplicator = (applicator: Applicator) => {
    // Remove from available applicators (using serialNumber for more reliable matching)
    setAvailableApplicators((prev) => prev.filter(app => app.serialNumber !== applicator.serialNumber));
    
    // Check if applicator already exists in processed applicators (by serial number)
    setProcessedApplicators((prev) => {
      const existingIndex = prev.findIndex(app => app.serialNumber === applicator.serialNumber);
      
      if (existingIndex !== -1) {
        // Update existing applicator instead of adding duplicate
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], ...applicator };
        return updated;
      } else {
        // Add new applicator
        return [...prev, applicator];
      }
    });
    
    // If usage type is "none", return to available applicators (will be shown in red)
    // But only if it's not already there from a previous "no use" process
    if (applicator.usageType === 'none') {
      setAvailableApplicators((prev) => {
        // Check if already exists to prevent duplicates
        const exists = prev.some(app => app.serialNumber === applicator.serialNumber);
        if (exists) {
          // Update existing entry to ensure it has returnedFromNoUse flag
          return prev.map(app => 
            app.serialNumber === applicator.serialNumber 
              ? { ...app, returnedFromNoUse: true }
              : app
          );
        }
        // Add as new entry with returnedFromNoUse flag
        const returnedApplicator = { ...applicator, returnedFromNoUse: true };
        return [...prev, returnedApplicator];
      });
    }
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
    setAvailableApplicators([]);
    setProcessedApplicators([]);
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
    processedApplicators.forEach(app => {
      if (app.usageType === 'full') distribution.full++;
      else if (app.usageType === 'faulty') distribution.faulty++;
      else if (app.usageType === 'none') distribution.none++;
    });
    return distribution;
  };

  // New functions for actual seed calculations
  const getActualTotalSeeds = () => {
    // Calculate total seeds from available applicators + processed applicators
    // But don't double count "no use" applicators that are returned to available
    // Also exclude already processed applicators from available count to prevent double counting
    const processedSerialNumbers = new Set(processedApplicators.map(app => app.serialNumber));
    
    const availableSeeds = availableApplicators
      .filter(app => !app.returnedFromNoUse) // Exclude returned "no use" applicators
      .filter(app => !processedSerialNumbers.has(app.serialNumber)) // Exclude already processed applicators
      .filter(app => app.patientId === currentTreatment?.subjectId) // Only include current patient's applicators
      .reduce((sum, app) => sum + app.seedQuantity, 0);
    
    const processedSeeds = processedApplicators.reduce((sum, app) => sum + app.seedQuantity, 0);
    
    return availableSeeds + processedSeeds;
  };

  const getActualInsertedSeeds = () => {
    // Only count seeds from processed applicators based on usage type
    return processedApplicators.reduce((sum, app) => {
      if (app.usageType === 'full') return sum + app.seedQuantity;
      if (app.usageType === 'faulty') return sum + (app.insertedSeedsQty || 0);
      return sum; // 'none' type contributes 0 seeds
    }, 0);
  };

  const getApplicatorTypeBreakdown = () => {
    // Group available applicators by seed quantity, excluding returned "no use" applicators
    // Also exclude already processed applicators to prevent double counting
    const processedSerialNumbers = new Set(processedApplicators.map(app => app.serialNumber));
    const breakdown: { [seedCount: number]: number } = {};
    
    availableApplicators
      .filter(app => !app.returnedFromNoUse) // Exclude returned "no use" applicators
      .filter(app => !processedSerialNumbers.has(app.serialNumber)) // Exclude already processed applicators
      .filter(app => app.patientId === currentTreatment?.subjectId) // Only include current patient's applicators
      .forEach(app => {
        breakdown[app.seedQuantity] = (breakdown[app.seedQuantity] || 0) + 1;
      });
    
    // Convert to sorted array (highest seed count first)
    return Object.entries(breakdown)
      .map(([seedCount, count]) => ({ seedCount: parseInt(seedCount), count }))
      .sort((a, b) => b.seedCount - a.seedCount);
  };

  // Calculate totals for removal treatment
  const totalSeeds = applicators.reduce((sum, app) => sum + app.seedQuantity, 0);
  const removedSeeds = applicators.reduce((sum, app) => 
    app.isRemoved ? sum + app.seedQuantity : sum, 0
  );

  // Comprehensive progress statistics
  const actualTotalSeeds = getActualTotalSeeds();
  const actualInsertedSeeds = getActualInsertedSeeds();
  
  // Calculate available applicators excluding already processed ones
  const processedSerialNumbers = new Set(processedApplicators.map(app => app.serialNumber));
  const actualAvailableApplicators = availableApplicators
    .filter(app => !app.returnedFromNoUse) // Exclude returned "no use" applicators
    .filter(app => !processedSerialNumbers.has(app.serialNumber)) // Exclude already processed applicators
    .filter(app => app.patientId === currentTreatment?.subjectId); // Only include current patient's applicators
  
  const progressStats: ProgressStats = {
    totalApplicators: actualAvailableApplicators.length + processedApplicators.length,
    usedApplicators: processedApplicators.length,
    totalSeeds: actualTotalSeeds,
    insertedSeeds: actualInsertedSeeds,
    completionPercentage: actualTotalSeeds > 0 ? 
      Math.round((actualInsertedSeeds / actualTotalSeeds) * 100) : 0,
    usageTypeDistribution: getUsageTypeDistribution(),
    seedsRemaining: Math.max(0, actualTotalSeeds - actualInsertedSeeds),
    applicatorsRemaining: actualAvailableApplicators.length
  };

  return (
    <TreatmentContext.Provider
      value={{
        currentTreatment,
        applicators,
        availableApplicators,
        processedApplicators,
        currentApplicator,
        procedureType,
        setProcedureType,
        setTreatment,
        addApplicator,
        addAvailableApplicator,
        processApplicator,
        updateApplicator,
        setCurrentApplicator,
        removeApplicator,
        clearTreatment,
        totalSeeds,
        removedSeeds,
        progressStats,
        getApplicatorProgress,
        getSeedProgress,
        getUsageTypeDistribution,
        getActualTotalSeeds,
        getActualInsertedSeeds,
        getApplicatorTypeBreakdown
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
