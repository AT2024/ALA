import { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { TERMINAL_STATUSES, ApplicatorStatus } from '@/utils/applicatorStatus';
import { networkStatus } from '@/services/networkStatus';
import { offlineDb, OfflineApplicator, PendingChange, ChangeOperation } from '@/services/indexedDbService';
import { isValidOfflineStatusTransition, CONFIRMATION_REQUIRED_STATUSES, TreatmentType } from '@/services/offlineValidationService';

// Import shared types - single source of truth for Treatment and Applicator
import type {
  Treatment,
  Applicator,
  ApplicatorGroup,
  ProgressStats,
  RemovalProgress,
} from '@shared/types';

// Re-export for backwards compatibility
export type { ApplicatorGroup } from '@shared/types';

// Helper to get effective status from applicator (status field or usageType fallback)
function getEffectiveStatus(app: Applicator): ApplicatorStatus {
  if (app.status) return app.status as ApplicatorStatus;
  if (app.usageType === 'full') return 'INSERTED';
  if (app.usageType === 'faulty') return 'FAULTY';
  return 'SEALED';
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
  getUsageTypeDistribution: () => {
    sealed: number; opened: number; loaded: number; inserted: number;
    faulty: number; disposed: number; discharged: number; deploymentFailure: number;
    full: number; none: number;
  };
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
  getApplicatorSummary: () => {
    seedQuantity: number;
    inserted: number;
    available: number;
    loaded: number;
    packaged: number;
  }[];
  // Offline support
  isOfflineMode: boolean;
  canProcessOffline: (applicator: Applicator, newStatus: ApplicatorStatus, previousStatus?: ApplicatorStatus | null) => Promise<{ allowed: boolean; requiresConfirmation: boolean; message: string }>;
  processApplicatorOffline: (applicator: Applicator, confirmed?: boolean, originalStatus?: ApplicatorStatus | null) => Promise<boolean>;
  loadFromOfflineDb: () => Promise<void>;
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

  // Offline mode state
  const [isOfflineMode, setIsOfflineMode] = useState(!networkStatus.isOnline);

  // Subscribe to network status changes
  useEffect(() => {
    const unsubscribe = networkStatus.subscribe((online) => {
      setIsOfflineMode(!online);
    });
    return () => unsubscribe();
  }, []);

  // Persist state to sessionStorage whenever it changes
  useEffect(() => {
    try {
      if (currentTreatment) {
        sessionStorage.setItem('currentTreatment', JSON.stringify(currentTreatment));
      } else {
        sessionStorage.removeItem('currentTreatment');
      }
      sessionStorage.setItem('processedApplicators', JSON.stringify(processedApplicators));
      sessionStorage.setItem('availableApplicators', JSON.stringify(availableApplicators));
      sessionStorage.setItem('individualSeedsRemoved', JSON.stringify(individualSeedsRemoved));
    } catch (error) {
      console.error('Failed to persist state to sessionStorage:', error);
    }
  }, [currentTreatment, processedApplicators, availableApplicators, individualSeedsRemoved]);

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

    // Handle available applicators based on STATUS field (8-state workflow)
    const effectiveStatus = getEffectiveStatus(applicator);
    const isTerminal = TERMINAL_STATUSES.includes(effectiveStatus);

    if (isTerminal) {
      // Terminal status: Remove from available list
      setAvailableApplicators((prev) =>
        prev.filter(app => app.serialNumber !== applicator.serialNumber)
      );
    } else {
      // In-progress status (SEALED, OPENED, LOADED): Keep in available list, update status
      setAvailableApplicators((prev) =>
        prev.map(app =>
          app.serialNumber === applicator.serialNumber
            ? { ...app, status: applicator.status }
            : app
        )
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

    const terminalApplicatorSerialNumbers = new Set(
      processedApplicators
        .filter(app => TERMINAL_STATUSES.includes(getEffectiveStatus(app)))
        .map(app => app.serialNumber)
    );

    return availableApplicators.filter(app =>
      app.patientId === currentTreatment.subjectId &&
      !terminalApplicatorSerialNumbers.has(app.serialNumber)
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
    const distribution = {
      sealed: 0, opened: 0, loaded: 0, inserted: 0,
      faulty: 0, disposed: 0, discharged: 0, deploymentFailure: 0,
      full: 0, none: 0
    };

    processedApplicators.forEach(app => {
      const status = getEffectiveStatus(app);
      switch (status) {
        case 'SEALED': distribution.sealed++; distribution.none++; break;
        case 'OPENED': distribution.opened++; break;
        case 'LOADED': distribution.loaded++; break;
        case 'INSERTED': distribution.inserted++; distribution.full++; break;
        case 'FAULTY': distribution.faulty++; break;
        case 'DISPOSED': distribution.disposed++; break;
        case 'DISCHARGED': distribution.discharged++; break;
        case 'DEPLOYMENT_FAILURE': distribution.deploymentFailure++; break;
        default: distribution.sealed++; distribution.none++; break;
      }
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
      const statusA = getEffectiveStatus(a);
      const statusB = getEffectiveStatus(b);
      const aIsActive = activeStates.includes(statusA);
      const bIsActive = activeStates.includes(statusB);

      if (aIsActive && !bIsActive) return -1;
      if (!aIsActive && bIsActive) return 1;
      return b.seedQuantity - a.seedQuantity;
    });
  };

  // Check if treatment is pancreas or prostate (requires packaging)
  const isPancreasOrProstate = (): boolean => {
    if (!currentTreatment) return false;

    // Check indication field first (from Priority SIBD_INDICATION)
    if (currentTreatment.indication) {
      const ind = currentTreatment.indication.toLowerCase();
      return ind === 'pancreas' || ind === 'prostate';
    }

    // Fallback: Legacy keyword detection from type field
    const type = currentTreatment.type.toLowerCase();
    return type.includes('pancreas') || type.includes('prostate');
  };

  // Get applicator summary by seed quantity (for table views)
  const getApplicatorSummary = () => {
    const summaryMap: Record<number, {
      seedQuantity: number;
      inserted: number;
      available: number;
      loaded: number;
      packaged: number;
    }> = {};

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

      const status = getEffectiveStatus(app);
      const entry = summaryMap[app.seedQuantity];

      if (status === 'INSERTED') entry.inserted++;
      if (['SEALED', 'OPENED', 'LOADED'].includes(status)) entry.available++;
      if (status === 'LOADED') entry.loaded++;
      if (app.package_label) entry.packaged++;
    });

    return Object.values(summaryMap).sort((a, b) => a.seedQuantity - b.seedQuantity);
  };

  // ==========================================================================
  // Offline Support Functions
  // ==========================================================================

  /**
   * Check if an applicator can be processed offline
   * @param applicator - The applicator to process
   * @param newStatus - The new status to transition to
   * @param previousStatus - Optional: the original status before user made changes (for accurate validation)
   */
  const canProcessOffline = useCallback(async (
    applicator: Applicator,
    newStatus: ApplicatorStatus,
    previousStatus?: ApplicatorStatus | null
  ): Promise<{ allowed: boolean; requiresConfirmation: boolean; message: string }> => {
    if (!currentTreatment) {
      return { allowed: false, requiresConfirmation: false, message: 'No active treatment' };
    }

    // If online, always allow (validation will happen server-side)
    if (!isOfflineMode) {
      return { allowed: true, requiresConfirmation: false, message: 'Online mode' };
    }

    // Helper to determine treatment type for validation (SAME rules as online)
    const getTreatmentType = (): TreatmentType => {
      const site = currentTreatment.site?.toLowerCase() || '';
      const type = currentTreatment.type?.toLowerCase() || '';

      if (site.includes('pancreas') || site.includes('prostate') ||
          type.includes('pancreas') || type.includes('prostate')) {
        return 'panc_pros';
      }
      if (site.includes('skin') || type.includes('skin')) {
        return 'skin';
      }
      return 'generic';
    };

    // Validate the status transition for offline mode
    // Use previousStatus if provided (from form's originalApplicatorStatus), otherwise use applicator's current status
    const currentStatus = previousStatus !== undefined
      ? previousStatus
      : (applicator.status || 'SEALED') as ApplicatorStatus;
    const result = isValidOfflineStatusTransition(currentStatus, newStatus, getTreatmentType());

    // Check if this status requires confirmation
    const requiresConfirmation = CONFIRMATION_REQUIRED_STATUSES.includes(newStatus);

    return {
      allowed: result.allowed,
      requiresConfirmation,
      message: result.message,
    };
  }, [currentTreatment, isOfflineMode]);

  /**
   * Process an applicator while offline, queueing for later sync
   * @param applicator - The applicator with new status set
   * @param confirmed - Whether user has confirmed (for INSERTED/FAULTY statuses)
   * @param originalStatus - The original status before user made changes (for accurate validation)
   */
  const processApplicatorOffline = useCallback(async (
    applicator: Applicator,
    confirmed: boolean = false,
    originalStatus?: ApplicatorStatus | null
  ): Promise<boolean> => {
    if (!currentTreatment) {
      return false;
    }

    const newStatus = (applicator.status || 'SEALED') as ApplicatorStatus;

    // Validate the transition using originalStatus if provided
    // This is critical: the applicator object already has newStatus set,
    // so we need originalStatus to compare the actual transition
    const validation = await canProcessOffline(applicator, newStatus, originalStatus);
    if (!validation.allowed) {
      return false;
    }

    if (validation.requiresConfirmation && !confirmed) {
      return false;
    }

    try {
      // Get current user from localStorage
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const userId = user.id || 'unknown';

      // Generate stable offline ID if not present
      const offlineId = applicator.id || `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Convert applicator to offline format
      const offlineApplicator: OfflineApplicator = {
        id: offlineId,
        serialNumber: applicator.serialNumber,
        seedQuantity: applicator.seedQuantity,
        status: newStatus,
        packageLabel: applicator.package_label || null,
        insertionTime: applicator.insertionTime,
        comments: applicator.comments,
        treatmentId: currentTreatment.id,
        addedBy: userId,
        isRemoved: applicator.isRemoved || false,
        removalComments: applicator.removalComments,
        applicatorType: applicator.applicatorType,
        catalog: applicator.catalog,
        seedLength: applicator.seedLength,
        version: 1,
        syncStatus: 'pending',
        createdOffline: true,
      };

      // Save to IndexedDB
      await offlineDb.saveApplicator(offlineApplicator);

      // Create pending change for sync
      const changeHash = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(JSON.stringify({ id: applicator.id, status: newStatus, time: Date.now() }))
      ).then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));

      const pendingChange: Omit<PendingChange, 'id'> = {
        entityType: 'applicator',
        entityId: applicator.id,
        operation: 'status_change' as ChangeOperation,
        data: {
          applicatorId: applicator.id,
          serialNumber: applicator.serialNumber,
          treatmentId: currentTreatment.id,
          status: newStatus,
          insertedSeedsQty: applicator.insertedSeedsQty,
          comments: applicator.comments,
          catalog: applicator.catalog,
          seedLength: applicator.seedLength,
        },
        createdAt: new Date().toISOString(),
        retryCount: 0,
        status: 'pending',
        offlineSince: networkStatus.offlineStartTime?.toISOString() || new Date().toISOString(),
        changeHash,
      };

      await offlineDb.addPendingChange(pendingChange);

      // Update local state using existing processApplicator
      // Use consistent ID and usageType for proper state management
      const processedApplicator: Applicator = {
        ...applicator,
        id: offlineId,
        usageType: newStatus === 'INSERTED' ? 'full' as const :
                   newStatus === 'FAULTY' ? 'faulty' as const : 'none' as const,
      };
      processApplicator(processedApplicator);
      return true;
    } catch {
      return false;
    }
  }, [currentTreatment, canProcessOffline, processApplicator]);

  /**
   * Load treatment data from offline IndexedDB
   */
  const loadFromOfflineDb = useCallback(async (): Promise<void> => {
    if (!currentTreatment) {
      return;
    }

    try {
      // Load treatment from IndexedDB
      const offlineTreatment = await offlineDb.getTreatment(currentTreatment.id);
      if (!offlineTreatment) {
        return;
      }

      // Load applicators for this treatment
      const offlineApplicators = await offlineDb.getApplicatorsByTreatment(currentTreatment.id);

      // Convert offline applicators to local format
      const localApplicators: Applicator[] = offlineApplicators.map(oa => ({
        id: oa.id,
        serialNumber: oa.serialNumber,
        seedQuantity: oa.seedQuantity,
        usageType: oa.status === 'INSERTED' ? 'full' as const :
                   oa.status === 'FAULTY' ? 'faulty' as const : 'none' as const,
        insertionTime: oa.insertionTime || new Date().toISOString(),
        comments: oa.comments,
        status: oa.status as ApplicatorStatus,
        package_label: oa.packageLabel || undefined,
        catalog: oa.catalog,
        seedLength: oa.seedLength,
        applicatorType: oa.applicatorType,
        isRemoved: oa.isRemoved,
        removalComments: oa.removalComments,
      }));

      // Merge with existing data using Map for guaranteed uniqueness by serialNumber
      setAvailableApplicators(prev => {
        const applicatorMap = new Map<string, Applicator>();
        // Add existing applicators first
        prev.forEach(a => applicatorMap.set(a.serialNumber, a));
        // Add/update with offline applicators (non-terminal only for available list)
        localApplicators
          .filter(a => !TERMINAL_STATUSES.includes(a.status as ApplicatorStatus))
          .forEach(a => applicatorMap.set(a.serialNumber, a));
        return Array.from(applicatorMap.values());
      });

      setProcessedApplicators(prev => {
        const applicatorMap = new Map<string, Applicator>();
        // Add existing processed applicators first
        prev.forEach(a => applicatorMap.set(a.serialNumber, a));
        // Add/update with offline applicators (terminal only for processed list)
        localApplicators
          .filter(a => TERMINAL_STATUSES.includes(a.status as ApplicatorStatus))
          .forEach(a => applicatorMap.set(a.serialNumber, a));
        return Array.from(applicatorMap.values());
      });
    } catch {
      // Failed to load offline data - handled by caller
    }
  }, [currentTreatment]);

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
        isPancreasOrProstate,
        // Offline support
        isOfflineMode,
        canProcessOffline,
        processApplicatorOffline,
        loadFromOfflineDb,
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
