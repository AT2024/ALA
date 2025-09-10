import { format } from 'date-fns';

interface Treatment {
  id: string;
  type: 'insertion' | 'removal';
  subjectId: string;
  site: string;
  date: string;
  surgeon?: string;
  activityPerSeed?: number;
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
}

interface TreatmentSummary {
  timeInsertionStarted: string;
  totalApplicatorUse: number;
  faultyApplicator: number;
  notUsedApplicators: number;
  totalDartSeedsInserted: number;
  seedsInsertedBy: string;
  totalActivity: number;
}

interface TreatmentDataExport {
  exportInfo: {
    exportDate: string;
    exportTimestamp: string;
    version: string;
    generatedBy: string;
  };
  treatment: Treatment;
  applicators: Applicator[];
  summary: TreatmentSummary;
  metadata: {
    applicatorCount: number;
    totalSeeds: number;
    exportFormat: string;
  };
}

/**
 * Service for exporting treatment data to JSON format
 * Provides automatic JSON backup when generating PDF reports
 */
export class JSONExportService {
  /**
   * Export complete treatment data as JSON file
   * @param treatment - Treatment information
   * @param processedApplicators - Array of processed applicators
   * @param summary - Treatment summary data
   */
  static exportTreatmentData(
    treatment: Treatment,
    processedApplicators: Applicator[],
    summary: TreatmentSummary
  ): void {
    try {
      const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
      
      // Create comprehensive export data structure
      const exportData: TreatmentDataExport = {
        exportInfo: {
          exportDate: new Date().toISOString(),
          exportTimestamp: timestamp,
          version: '1.0',
          generatedBy: 'Accountability Log Application'
        },
        treatment: {
          ...treatment
        },
        applicators: processedApplicators.map(applicator => ({
          ...applicator
        })),
        summary: {
          ...summary
        },
        metadata: {
          applicatorCount: processedApplicators.length,
          totalSeeds: summary.totalDartSeedsInserted,
          exportFormat: 'JSON'
        }
      };

      // Convert to JSON with proper formatting
      const jsonString = JSON.stringify(exportData, null, 2);
      
      // Create blob and download
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = `Treatment_Data_${treatment.subjectId}_${timestamp}.json`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log('Treatment data exported successfully:', link.download);
      
    } catch (error) {
      console.error('Failed to export treatment data:', error);
      throw new Error('Failed to export treatment data as JSON');
    }
  }

  /**
   * Save treatment data to localStorage for recovery purposes
   * @param treatment - Treatment information
   * @param processedApplicators - Array of processed applicators
   */
  static saveToLocalStorage(
    treatment: Treatment,
    processedApplicators: Applicator[]
  ): void {
    try {
      const storageKey = `treatment_backup_${treatment.id}`;
      const backupData = {
        timestamp: new Date().toISOString(),
        treatment,
        applicators: processedApplicators,
        version: '1.0'
      };
      
      localStorage.setItem(storageKey, JSON.stringify(backupData));
      console.log('Treatment data backed up to localStorage');
      
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  }

  /**
   * Load treatment data from localStorage
   * @param treatmentId - ID of the treatment to load
   */
  static loadFromLocalStorage(treatmentId: string): any | null {
    try {
      const storageKey = `treatment_backup_${treatmentId}`;
      const data = localStorage.getItem(storageKey);
      
      if (data) {
        return JSON.parse(data);
      }
      
      return null;
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
      return null;
    }
  }

  /**
   * Clear treatment backup from localStorage
   * @param treatmentId - ID of the treatment to clear
   */
  static clearBackup(treatmentId: string): void {
    try {
      const storageKey = `treatment_backup_${treatmentId}`;
      localStorage.removeItem(storageKey);
      console.log('Treatment backup cleared from localStorage');
    } catch (error) {
      console.error('Failed to clear backup:', error);
    }
  }
}