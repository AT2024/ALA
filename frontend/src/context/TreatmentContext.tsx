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
  availableApplicators: Applicator[];
  processedApplicators: Applicator[];
  currentApplicator: Applicator | null;
  procedureType: 'insertion' | 'removal' | null;
  loadingApplicators: boolean;
  setProcedureType: (type: 'insertion' | 'removal') => void;
  setTreatment: (treatment: Treatment) => void;
  addAvailableApplicator: (applicator: Applicator) => void;
  setBulkAvailableApplicators: (applicators: Applicator[]) => void;
  setLoadingApplicators: (loading: boolean) => void;
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
  const [availableApplicators, setAvailableApplicators] = useState<Applicator[]>([]);
  const [processedApplicators, setProcessedApplicators] = useState<Applicator[]>([]);
  const [currentApplicator, setCurrentApplicator] = useState<Applicator | null>(null);
  const [procedureType, setProcedureType] = useState<'insertion' | 'removal' | null>(null);
  const [loadingApplicators, setLoadingApplicators] = useState<boolean>(false);

  const setTreatment = (treatment: Treatment) => {
    setCurrentTreatment(treatment);
    // Clear applicators when changing treatments (for all treatment types)
    setAvailableApplicators([]);
    setProcessedApplicators([]);
  };


  const addAvailableApplicator = (applicator: Applicator) => {
    // Check for duplicates in BOTH availableApplicators AND processedApplicators
    const existsInAvailable = availableApplicators.some(app => app.serialNumber === applicator.serialNumber);
    const existsInProcessed = processedApplicators.some(app => app.serialNumber === applicator.serialNumber);
    
    if (existsInAvailable || existsInProcessed) {
      // Don't add duplicates - applicator already exists in either array
      console.log(`Applicator ${applicator.serialNumber} already exists, skipping add`);
      return;
    }
    
    setAvailableApplicators((prev) => [...prev, applicator]);
  };

  const setBulkAvailableApplicators = (applicators: Applicator[]) => {
    // Atomic bulk loading to prevent race conditions and duplicates
    // Filter out any applicators that already exist in processedApplicators
    const processedSerialNumbers = processedApplicators.map(app => app.serialNumber);
    const filteredApplicators = applicators.filter(app => 
      !processedSerialNumbers.includes(app.serialNumber)
    );
    
    console.log(`Setting ${filteredApplicators.length} available applicators (filtered from ${applicators.length} total)`);
    
    // Set the entire array atomically - this eliminates race conditions
    setAvailableApplicators(filteredApplicators);
  };

  const processApplicator = (applicator: Applicator) => {
    // Check if applicator already exists in processed applicators (by serial number)
    const existingProcessedIndex = processedApplicators.findIndex(app => app.serialNumber === applicator.serialNumber);
    
    if (existingProcessedIndex !== -1) {
      // Update existing processed applicator (editing scenario)
      setProcessedApplicators((prev) => {
        const updated = [...prev];
        updated[existingProcessedIndex] = { ...updated[existingProcessedIndex], ...applicator };
        return updated;
      });
      
      // Don't remove from available applicators when updating existing processed applicator
      // Handle "no use" return scenario for updates
      if (applicator.usageType === 'none') {
        setAvailableApplicators((prev) => {
          const exists = prev.some(app => app.serialNumber === applicator.serialNumber);
          if (!exists) {
            // Add back to available with returnedFromNoUse flag
            const returnedApplicator = { ...applicator, returnedFromNoUse: true };
            return [...prev, returnedApplicator];
          } else {
            // Update existing entry with returnedFromNoUse flag
            return prev.map(app => 
              app.serialNumber === applicator.serialNumber 
                ? { ...app, returnedFromNoUse: true }
                : app
            );
          }
        });
      } else {
        // For non-"no use" updates, remove from available if it was previously returned
        setAvailableApplicators((prev) => prev.filter(app => app.serialNumber !== applicator.serialNumber));
      }
    } else {
      // New applicator being processed
      // Remove from available applicators first
      setAvailableApplicators((prev) => prev.filter(app => app.serialNumber !== applicator.serialNumber));
      
      // Add to processed applicators
      setProcessedApplicators((prev) => [...prev, applicator]);
      
      // If usage type is "none", return to available applicators (will be shown in red)
      if (applicator.usageType === 'none') {
        setAvailableApplicators((prev) => {
          // Add as new entry with returnedFromNoUse flag
          const returnedApplicator = { ...applicator, returnedFromNoUse: true };
          return [...prev, returnedApplicator];
        });
      }
    }
  };

  const updateApplicator = (id: string, data: Partial<Applicator>) => {
    setProcessedApplicators((prev) => 
      prev.map((app) => app.id === id ? { ...app, ...data } : app)
    );
  };

  const removeApplicator = (id: string) => {
    setProcessedApplicators((prev) => prev.filter((app) => app.id !== id));
  };

  const clearTreatment = () => {
    setCurrentTreatment(null);
    setAvailableApplicators([]);
    setProcessedApplicators([]);
    setCurrentApplicator(null);
    setProcedureType(null);
    setLoadingApplicators(false);
  };

  // Progress calculation methods
  const getApplicatorProgress = () => {
    const used = processedApplicators.length;
    const total = availableApplicators.filter(app => !app.returnedFromNoUse).length + processedApplicators.length;
    return { used, total };
  };

  const getSeedProgress = () => {
    const inserted = getActualInsertedSeeds();
    const total = getActualTotalSeeds();
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

  // Fixed functions for actual seed calculations - no double counting with defensive safeguards
  const getActualTotalSeeds = () => {
    // Get processed serial numbers for defensive filtering
    const processedSerialNumbers = processedApplicators.map(app => app.serialNumber);
    
    // Calculate available seeds, excluding "no use" returns AND any that exist in processed (defensive)
    const availableSeeds = availableApplicators
      .filter(app => !app.returnedFromNoUse) // Exclude returned "no use" applicators
      .filter(app => !processedSerialNumbers.includes(app.serialNumber)) // DEFENSIVE: Exclude any that are also processed
      .reduce((sum, app) => sum + app.seedQuantity, 0);
    
    // Calculate processed seeds
    const originalProcessedSeeds = processedApplicators.reduce((sum, app) => sum + app.seedQuantity, 0);
    
    // Log warning if defensive filter caught any double counting
    const duplicateCount = availableApplicators.filter(app => 
      !app.returnedFromNoUse && processedSerialNumbers.includes(app.serialNumber)
    ).length;
    if (duplicateCount > 0) {
      console.warn(`⚠️  Defensive filter caught ${duplicateCount} applicators in both available and processed arrays`);
    }
    
    return availableSeeds + originalProcessedSeeds;
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
    // Group available applicators by seed quantity, excluding returned "no use" applicators and processed applicators
    const breakdown: { [seedCount: number]: number } = {};
    const processedSerialNumbers = processedApplicators.map(app => app.serialNumber);
    
    availableApplicators
      .filter(app => !app.returnedFromNoUse) // Exclude returned "no use" applicators
      .filter(app => !processedSerialNumbers.includes(app.serialNumber)) // DEFENSIVE: Exclude processed applicators
      .forEach(app => {
        breakdown[app.seedQuantity] = (breakdown[app.seedQuantity] || 0) + 1;
      });
    
    // Convert to sorted array (highest seed count first)
    return Object.entries(breakdown)
      .map(([seedCount, count]) => ({ seedCount: parseInt(seedCount), count }))
      .sort((a, b) => b.seedCount - a.seedCount);
  };

  // Calculate totals for removal treatment using processed applicators
  const totalSeeds = processedApplicators.reduce((sum, app) => sum + app.seedQuantity, 0);
  const removedSeeds = processedApplicators.reduce((sum, app) => 
    app.isRemoved ? sum + app.seedQuantity : sum, 0
  );

  // Comprehensive progress statistics
  const actualTotalSeeds = getActualTotalSeeds();
  const actualInsertedSeeds = getActualInsertedSeeds();
  
  const progressStats: ProgressStats = {
    totalApplicators: availableApplicators.filter(app => !app.returnedFromNoUse).length + processedApplicators.length,
    usedApplicators: processedApplicators.length,
    totalSeeds: actualTotalSeeds,
    insertedSeeds: actualInsertedSeeds,
    completionPercentage: actualTotalSeeds > 0 ? 
      Math.round((actualInsertedSeeds / actualTotalSeeds) * 100) : 0,
    usageTypeDistribution: getUsageTypeDistribution(),
    seedsRemaining: Math.max(0, actualTotalSeeds - actualInsertedSeeds),
    applicatorsRemaining: availableApplicators.length
  };

  return (
    <TreatmentContext.Provider
      value={{
        currentTreatment,
        availableApplicators,
        processedApplicators,
        currentApplicator,
        procedureType,
        loadingApplicators,
        setProcedureType,
        setTreatment,
        addAvailableApplicator,
        setBulkAvailableApplicators,
        setLoadingApplicators,
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
