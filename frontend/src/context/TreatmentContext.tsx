import { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface Treatment {
  id: string;
  type: 'insertion' | 'removal' | 'pancreas_insertion' | 'prostate_insertion' | 'skin_insertion';
  subjectId: string;
  site: string;
  date: string;
  isComplete: boolean;
  email?: string;
  seedQuantity?: number;
  activityPerSeed?: number;
  surgeon?: string;
  daysSinceInsertion?: number;
  patientName?: string;
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
  // Upload/sync fields
  attachmentFileCount?: number;
  attachmentSyncStatus?: 'pending' | 'syncing' | 'synced' | 'failed' | null;
  attachmentFilename?: string;
  // 9-state workflow field (replaces usageType)
  status?: 'SEALED' | 'OPENED' | 'LOADED' | 'INSERTED' | 'FAULTY' | 'DISPOSED' | 'DISCHARGED' | 'DEPLOYMENT_FAILURE' | 'UNACCOUNTED';
  // Package label for pancreas/prostate treatments
  package_label?: string;
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

export interface ApplicatorGroup {
  seedCount: number;
  totalApplicators: number;
  removedApplicators: number;
  applicators: Applicator[];
}

interface RemovalProgress {
  totalSeeds: number;
  removedSeeds: number;
  effectiveTotalSeeds: number;
  effectiveRemovedSeeds: number;
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
  setApplicators: (applicators: Applicator[]) => void;
  setProcessedApplicators: (applicators: Applicator[]) => void;
  addApplicator: (applicator: Applicator) => void;
  addAvailableApplicator: (applicator: Applicator) => void;
  processApplicator: (applicator: Applicator) => void;
  updateApplicator: (id: string, data: Partial<Applicator>) => void;
  setCurrentApplicator: (applicator: Applicator | null) => void;
  clearCurrentApplicator: () => void;
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
  getApplicatorTypeBreakdown: () => { seedCount: number; used: number; total: number }[];
  getFilteredAvailableApplicators: () => Applicator[];
  getApplicatorGroups: () => ApplicatorGroup[];
  getRemovalProgress: () => RemovalProgress;
  individualSeedsRemoved: number;
  setIndividualSeedsRemoved: (count: number) => void;
  getIndividualSeedsRemoved: () => number;
  sortApplicatorsByStatus: (applicators: Applicator[]) => Applicator[];
  isPancreasOrProstate: () => boolean;
}

const TreatmentContext = createContext<TreatmentContextType | undefined>(undefined);

export function TreatmentProvider({ children }: { children: ReactNode }) {
  const location = useLocation();

  const [currentTreatment, setCurrentTreatment] = useState<Treatment | null>(() => {
    // Restore treatment from sessionStorage on mount
    try {
      const stored = sessionStorage.getItem('currentTreatment');
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Failed to restore treatment from sessionStorage:', error);
      return null;
    }
  });

  const [applicators, setApplicators] = useState<Applicator[]>([]);

  const [availableApplicators, setAvailableApplicators] = useState<Applicator[]>(() => {
    // Restore available applicators from sessionStorage on mount
    try {
      const stored = sessionStorage.getItem('availableApplicators');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to restore available applicators from sessionStorage:', error);
      return [];
    }
  });

  const [processedApplicators, setProcessedApplicators] = useState<Applicator[]>(() => {
    // Restore processed applicators from sessionStorage on mount
    try {
      const stored = sessionStorage.getItem('processedApplicators');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to restore processed applicators from sessionStorage:', error);
      return [];
    }
  });

  const [currentApplicator, setCurrentApplicator] = useState<Applicator | null>(null);

  const [individualSeedsRemoved, setIndividualSeedsRemoved] = useState<number>(() => {
    // Restore individual seeds removed from sessionStorage on mount
    try {
      const stored = sessionStorage.getItem('individualSeedsRemoved');
      return stored ? JSON.parse(stored) : 0;
    } catch (error) {
      console.error('Failed to restore individual seeds removed from sessionStorage:', error);
      return 0;
    }
  });

  const [procedureType, setProcedureType] = useState<'insertion' | 'removal' | null>(() => {
    const urlParams = new URLSearchParams(location.search);
    const urlType = urlParams.get('type') as 'insertion' | 'removal' | null;
    if (urlType) return urlType;

    const stored = localStorage.getItem('procedureType');
    return stored as 'insertion' | 'removal' | null;
  });

  // Persist treatment state to sessionStorage whenever it changes
  useEffect(() => {
    try {
      if (currentTreatment) {
        sessionStorage.setItem('currentTreatment', JSON.stringify(currentTreatment));
      } else {
        sessionStorage.removeItem('currentTreatment');
      }
    } catch (error) {
      console.error('Failed to persist treatment to sessionStorage:', error);
    }
  }, [currentTreatment]);

  // Persist processed applicators to sessionStorage whenever they change
  useEffect(() => {
    try {
      sessionStorage.setItem('processedApplicators', JSON.stringify(processedApplicators));
    } catch (error) {
      console.error('Failed to persist processed applicators to sessionStorage:', error);
    }
  }, [processedApplicators]);

  // Persist available applicators to sessionStorage whenever they change
  useEffect(() => {
    try {
      sessionStorage.setItem('availableApplicators', JSON.stringify(availableApplicators));
    } catch (error) {
      console.error('Failed to persist available applicators to sessionStorage:', error);
    }
  }, [availableApplicators]);

  // Persist individual seeds removed to sessionStorage whenever it changes
  useEffect(() => {
    try {
      sessionStorage.setItem('individualSeedsRemoved', JSON.stringify(individualSeedsRemoved));
    } catch (error) {
      console.error('Failed to persist individual seeds removed to sessionStorage:', error);
    }
  }, [individualSeedsRemoved]);

  const setTreatment = (treatment: Treatment) => {
    setCurrentTreatment(treatment);
    // Clear applicators when changing treatments (for all treatment types)
    setApplicators([]);
    setAvailableApplicators([]);
    setProcessedApplicators([]);
  };

  const setApplicatorsData = (newApplicators: Applicator[]) => {
    setApplicators(newApplicators);
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
    // Always add to processed applicators list for history tracking
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
    
    // Handle available applicators based on usage type
    if (applicator.usageType === 'none') {
      // For "No Use": Keep in available list but mark as returned from no use
      setAvailableApplicators((prev) =>
        prev.map(app => 
          app.serialNumber === applicator.serialNumber 
            ? { ...app, returnedFromNoUse: true }
            : app
        )
      );
    } else {
      // For "Full use" and "Faulty": Remove from available list
      setAvailableApplicators((prev) => 
        prev.filter(app => app.serialNumber !== applicator.serialNumber)
      );
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

  const clearCurrentApplicator = () => {
    setCurrentApplicator(null);
  };

  const clearTreatment = () => {
    setCurrentTreatment(null);
    setApplicators([]);
    setAvailableApplicators([]);
    setProcessedApplicators([]);
    setCurrentApplicator(null);
    setIndividualSeedsRemoved(0);
    setProcedureType(null);

    // Clear sessionStorage when treatment is cleared
    try {
      sessionStorage.removeItem('currentTreatment');
      sessionStorage.removeItem('processedApplicators');
      sessionStorage.removeItem('availableApplicators');
      sessionStorage.removeItem('individualSeedsRemoved');
    } catch (error) {
      console.error('Failed to clear sessionStorage:', error);
    }
  };

  // Centralized filtering function - single source of truth
  const getFilteredAvailableApplicators = (): Applicator[] => {
    if (!currentTreatment) return [];
    
    // Get serial numbers of applicators that should be excluded from available list
    // Only exclude non-"No Use" processed applicators
    const processedNonNoUseSerialNumbers = new Set(
      processedApplicators
        .filter(app => app.usageType !== 'none') // Keep "No Use" applicators available
        .map(app => app.serialNumber)
    );
    
    return availableApplicators.filter(app => 
      app.patientId === currentTreatment.subjectId && // Current patient only
      !processedNonNoUseSerialNumbers.has(app.serialNumber) // Exclude processed non-"No Use" applicators
    );
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
    const filteredAvailable = getFilteredAvailableApplicators();
    const availableSeeds = filteredAvailable.reduce((sum, app) => sum + app.seedQuantity, 0);
    // Only count processed applicators that are not "No Use" - same logic as getActualInsertedSeeds
    const processedSeeds = processedApplicators.reduce((sum, app) => {
      if (app.usageType === 'none') return sum; // Exclude "No Use" applicators from total
      return sum + app.seedQuantity;
    }, 0);
    
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
    if (!currentTreatment) return [];

    const breakdown: { [seedCount: number]: { total: number; used: number } } = {};

    // Count remaining available applicators (already filtered by current patient)
    const filteredAvailable = getFilteredAvailableApplicators();
    filteredAvailable.forEach(app => {
      if (!breakdown[app.seedQuantity]) {
        breakdown[app.seedQuantity] = { total: 0, used: 0 };
      }
      breakdown[app.seedQuantity].total++;
    });

    // Count used applicators and add to total
    // processedApplicators is already scoped to current treatment
    processedApplicators.forEach(app => {
      if (!breakdown[app.seedQuantity]) {
        breakdown[app.seedQuantity] = { total: 0, used: 0 };
      }
      breakdown[app.seedQuantity].total++;  // Add to total
      breakdown[app.seedQuantity].used++;   // Increment used
    });

    // Convert to sorted array (highest seed count first)
    return Object.entries(breakdown)
      .map(([seedCount, counts]) => ({
        seedCount: parseInt(seedCount),
        used: counts.used,
        total: counts.total
      }))
      .sort((a, b) => b.seedCount - a.seedCount);
  };

  // Group applicators by seed count for removal workflow
  const getApplicatorGroups = (): ApplicatorGroup[] => {
    const groups: { [seedCount: number]: ApplicatorGroup } = {};

    applicators.forEach(app => {
      if (!groups[app.seedQuantity]) {
        groups[app.seedQuantity] = {
          seedCount: app.seedQuantity,
          totalApplicators: 0,
          removedApplicators: 0,
          applicators: []
        };
      }

      groups[app.seedQuantity].totalApplicators++;
      groups[app.seedQuantity].applicators.push(app);

      if (app.isRemoved) {
        groups[app.seedQuantity].removedApplicators++;
      }
    });

    return Object.values(groups).sort((a, b) => b.seedCount - a.seedCount);
  };

  // Calculate removal progress including individual seeds
  const getRemovalProgress = (): RemovalProgress => {
    const totalSeeds = applicators.reduce((sum, app) => sum + app.seedQuantity, 0);
    const removedFromApplicators = applicators.reduce((sum, app) =>
      app.isRemoved ? sum + app.seedQuantity : sum, 0
    );

    const effectiveTotalSeeds = currentTreatment?.seedQuantity || totalSeeds;
    const effectiveRemovedSeeds = removedFromApplicators + individualSeedsRemoved;

    return {
      totalSeeds,
      removedSeeds: removedFromApplicators,
      effectiveTotalSeeds,
      effectiveRemovedSeeds
    };
  };

  // Get individual seeds removed count
  const getIndividualSeedsRemoved = (): number => {
    return individualSeedsRemoved;
  };

  // Sort applicators by status - active states first, then terminal states
  const sortApplicatorsByStatus = (applicators: Applicator[]): Applicator[] => {
    const activeStates = ['SEALED', 'OPENED', 'LOADED'];

    return [...applicators].sort((a, b) => {
      // Get status from status field, fallback to usageType for backward compatibility
      const statusA = a.status || (a.usageType === 'full' ? 'INSERTED' : a.usageType === 'faulty' ? 'FAULTY' : 'SEALED');
      const statusB = b.status || (b.usageType === 'full' ? 'INSERTED' : b.usageType === 'faulty' ? 'FAULTY' : 'SEALED');

      const aIsActive = activeStates.includes(statusA);
      const bIsActive = activeStates.includes(statusB);

      // Active states go to top
      if (aIsActive && !bIsActive) return -1;
      if (!aIsActive && bIsActive) return 1;

      // Within same group (both active or both terminal), sort by seedQuantity descending
      return b.seedQuantity - a.seedQuantity;
    });
  };

  // Check if treatment is pancreas or prostate (requires packaging)
  const isPancreasOrProstate = (): boolean => {
    if (!currentTreatment) return false;
    const type = currentTreatment.type.toLowerCase();
    return type.includes('pancreas') || type.includes('prostate');
  };

  // Get applicator summary by seed quantity (for table views)
  const getApplicatorSummary = () => {
    const summaryMap: {
      [key: number]: {
        seedQuantity: number;
        inserted: number;
        available: number;
        loaded: number;
        packaged: number;
      };
    } = {};

    processedApplicators.forEach((app) => {
      if (!summaryMap[app.seedQuantity]) {
        summaryMap[app.seedQuantity] = {
          seedQuantity: app.seedQuantity,
          inserted: 0,
          available: 0,
          loaded: 0,
          packaged: 0,
        };
      }

      // Determine effective status (new 9-state or backward compatible)
      const status = app.status || (app.usageType === 'full' ? 'INSERTED' :
                                     app.usageType === 'faulty' ? 'FAULTY' : 'SEALED');

      // Count inserted applicators
      if (status === 'INSERTED') {
        summaryMap[app.seedQuantity].inserted++;
      }

      // Count available applicators (active states only)
      if (['SEALED', 'OPENED', 'LOADED'].includes(status)) {
        summaryMap[app.seedQuantity].available++;
      }

      // Count loaded applicators
      if (status === 'LOADED') {
        summaryMap[app.seedQuantity].loaded++;
      }

      // Count packaged applicators
      if (app.package_label) {
        summaryMap[app.seedQuantity].packaged++;
      }
    });

    return Object.values(summaryMap).sort((a, b) => a.seedQuantity - b.seedQuantity);
  };

  // Calculate totals for removal treatment
  const totalSeeds = applicators.reduce((sum, app) => sum + app.seedQuantity, 0);
  const removedSeeds = applicators.reduce((sum, app) =>
    app.isRemoved ? sum + app.seedQuantity : sum, 0
  );

  // Comprehensive progress statistics
  const actualTotalSeeds = getActualTotalSeeds();
  const actualInsertedSeeds = getActualInsertedSeeds();
  
  // Use centralized filtering for consistency
  const actualAvailableApplicators = getFilteredAvailableApplicators();
  
  // Only count non-"No Use" processed applicators as actually used
  const actuallyUsedApplicators = processedApplicators.filter(app => app.usageType !== 'none');
  
  const progressStats: ProgressStats = {
    totalApplicators: actualAvailableApplicators.length + actuallyUsedApplicators.length,
    usedApplicators: actuallyUsedApplicators.length,
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
        setApplicators: setApplicatorsData,
        setProcessedApplicators,
        addApplicator,
        addAvailableApplicator,
        processApplicator,
        updateApplicator,
        setCurrentApplicator,
        clearCurrentApplicator,
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
        getApplicatorTypeBreakdown,
        getApplicatorSummary,
        getFilteredAvailableApplicators,
        getApplicatorGroups,
        getRemovalProgress,
        individualSeedsRemoved,
        setIndividualSeedsRemoved,
        getIndividualSeedsRemoved,
        sortApplicatorsByStatus,
        isPancreasOrProstate
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
