import logger from './logger';
import { ApplicatorStatus, ALL_STATUSES } from '../../../shared/applicatorStatuses';

/**
 * Priority Data Transformer Utility
 * Handles data format conversion between Priority system and our application
 */

export interface PriorityApplicatorData {
  serialNumber?: string;
  usageType?: string;
  status?: string; // 8-state workflow status (SEALED, OPENED, LOADED, INSERTED, FAULTY, DISPOSED, DISCHARGED, DEPLOYMENT_FAILURE)
  insertionTime?: string | Date;
  seedQuantity?: number;
  insertedSeedsQty?: number;
  comments?: string;
  applicatorType?: string; // From Priority PARTS.PARTDES
  catalog?: string; // From Priority PARTNAME field
  seedLength?: number; // From Priority SIBD_SEEDLEN field
  // Add other fields that might come from Priority
  [key: string]: any;
}

export interface TransformedApplicatorData {
  serialNumber: string;
  usageType: 'full' | 'faulty' | 'none';
  status?: ApplicatorStatus | null; // 8-state workflow status (SEALED, OPENED, LOADED, INSERTED, FAULTY, DISPOSED, DISCHARGED, DEPLOYMENT_FAILURE)
  insertionTime: Date;
  seedQuantity: number;
  insertedSeedsQty: number;
  comments?: string;
  applicatorType?: string; // From Priority PARTS.PARTDES
  catalog?: string; // From Priority PARTNAME field
  seedLength?: number; // From Priority SIBD_SEEDLEN field
  // Add fields that might be missing from Priority but required by our DB
  imagePath?: string;
  isRemoved?: boolean;
}

export interface DataTransformationResult {
  success: boolean;
  data?: TransformedApplicatorData;
  errors?: string[];
  warnings?: string[];
}

/**
 * Transform Priority system data to our application format
 */
export const transformPriorityApplicatorData = (
  rawData: PriorityApplicatorData,
  requestId?: string
): DataTransformationResult => {
  const logPrefix = `[PRIORITY_TRANSFORMER] ${requestId ? `[${requestId}]` : ''}`;
  const errors: string[] = [];
  const warnings: string[] = [];

  logger.debug(`${logPrefix} Starting Priority data transformation`, {
    rawData,
    rawDataKeys: Object.keys(rawData || {}),
    rawDataTypes: Object.fromEntries(Object.entries(rawData || {}).map(([k, v]) => [k, typeof v]))
  });

  try {
    // Initialize transformed data with defaults
    const transformedData: Partial<TransformedApplicatorData> = {};

    // Transform serial number
    if (rawData.serialNumber) {
      if (typeof rawData.serialNumber === 'string') {
        transformedData.serialNumber = rawData.serialNumber.trim();
      } else {
        transformedData.serialNumber = String(rawData.serialNumber);
        warnings.push(`Serial number converted from ${typeof rawData.serialNumber} to string`);
      }
    } else {
      errors.push('Serial number is required but not provided');
    }

    // Transform usage type with Priority system mapping
    if (rawData.usageType) {
      const usageTypeMapping: { [key: string]: 'full' | 'faulty' | 'none' } = {
        // Standard values
        'full': 'full',
        'faulty': 'faulty',
        'none': 'none',
        
        // Priority system variants with spaces
        'full use': 'full',
        'full_use': 'full',
        'faulty use': 'faulty',
        'faulty_use': 'faulty',
        'no use': 'none',
        'no_use': 'none',
        
        // Other Priority variants
        'complete': 'full',
        'completed': 'full',
        'defective': 'faulty',
        'broken': 'faulty',
        'unused': 'none',
        'not_used': 'none',
        'not used': 'none',
        'fully_used': 'full',
        'fully used': 'full',
        'partial': 'faulty',
        'partial use': 'faulty',
        'partial_use': 'faulty',
        
        // Additional common variants
        'ok': 'full',
        'good': 'full',
        'bad': 'faulty',
        'failed': 'faulty',
        'error': 'faulty',
        'empty': 'none',
        'skip': 'none',
        'skipped': 'none'
      };

      // More robust normalization: lowercase, trim, and normalize spaces/underscores
      const normalizedUsageType = String(rawData.usageType)
        .toLowerCase()
        .trim()
        .replace(/[\s_-]+/g, ' ') // Replace multiple spaces, underscores, or hyphens with single space
        .replace(/^\s+|\s+$/g, ''); // Trim again after normalization

      const mappedUsageType = usageTypeMapping[normalizedUsageType];

      if (mappedUsageType) {
        transformedData.usageType = mappedUsageType;
        if (normalizedUsageType !== mappedUsageType) {
          warnings.push(`Usage type mapped from '${rawData.usageType}' to '${mappedUsageType}'`);
        }
      } else {
        errors.push(`Invalid usage type: '${rawData.usageType}'. Valid values: ${Object.keys(usageTypeMapping).join(', ')}`);
      }
    } else {
      errors.push('Usage type is required but not provided');
    }

    // Transform insertion time
    if (rawData.insertionTime) {
      if (rawData.insertionTime instanceof Date) {
        transformedData.insertionTime = rawData.insertionTime;
      } else if (typeof rawData.insertionTime === 'string') {
        const parsedDate = new Date(rawData.insertionTime);
        if (!isNaN(parsedDate.getTime())) {
          transformedData.insertionTime = parsedDate;
        } else {
          warnings.push(`Invalid insertion time format: '${rawData.insertionTime}', using current time`);
          transformedData.insertionTime = new Date();
        }
      } else {
        warnings.push(`Insertion time is not a valid date type: ${typeof rawData.insertionTime}, using current time`);
        transformedData.insertionTime = new Date();
      }
    } else {
      transformedData.insertionTime = new Date();
      warnings.push('Insertion time not provided, using current time');
    }

    // Transform seed quantity
    if (rawData.seedQuantity !== undefined) {
      if (typeof rawData.seedQuantity === 'number') {
        transformedData.seedQuantity = Math.max(0, rawData.seedQuantity);
      } else {
        const parsedQuantity = parseInt(String(rawData.seedQuantity), 10);
        if (!isNaN(parsedQuantity)) {
          transformedData.seedQuantity = Math.max(0, parsedQuantity);
          warnings.push(`Seed quantity converted from ${typeof rawData.seedQuantity} to number`);
        } else {
          transformedData.seedQuantity = 0;
          warnings.push(`Invalid seed quantity: '${rawData.seedQuantity}', using 0`);
        }
      }
    } else {
      transformedData.seedQuantity = 0;
      warnings.push('Seed quantity not provided, using 0');
    }

    // Transform inserted seeds quantity (Priority system specific)
    if (rawData.insertedSeedsQty !== undefined) {
      if (typeof rawData.insertedSeedsQty === 'number') {
        transformedData.insertedSeedsQty = Math.max(0, rawData.insertedSeedsQty);
      } else {
        const parsedQuantity = parseInt(String(rawData.insertedSeedsQty), 10);
        if (!isNaN(parsedQuantity)) {
          transformedData.insertedSeedsQty = Math.max(0, parsedQuantity);
          warnings.push(`Inserted seeds quantity converted from ${typeof rawData.insertedSeedsQty} to number`);
        } else {
          transformedData.insertedSeedsQty = 0;
          warnings.push(`Invalid inserted seeds quantity: '${rawData.insertedSeedsQty}', using 0`);
        }
      }
    } else {
      transformedData.insertedSeedsQty = transformedData.seedQuantity || 0;
      warnings.push('Inserted seeds quantity not provided, using seed quantity value');
    }

    // Transform comments
    if (rawData.comments) {
      transformedData.comments = String(rawData.comments).trim();
    }

    // Transform applicator type (from Priority PARTS.PARTDES)
    if (rawData.applicatorType) {
      transformedData.applicatorType = String(rawData.applicatorType).trim();
    }

    // Transform catalog (from Priority PARTNAME field)
    if (rawData.catalog) {
      transformedData.catalog = String(rawData.catalog).trim();
    }

    // Transform seed length (from Priority SIBD_SEEDLEN field)
    if (rawData.seedLength !== undefined && rawData.seedLength !== null) {
      if (typeof rawData.seedLength === 'number') {
        transformedData.seedLength = rawData.seedLength;
      } else {
        const parsedLength = parseFloat(String(rawData.seedLength));
        if (!isNaN(parsedLength)) {
          transformedData.seedLength = parsedLength;
          warnings.push(`Seed length converted from ${typeof rawData.seedLength} to number`);
        }
      }
    }

    // Transform status (8-state workflow)
    if (rawData.status) {
      const normalizedStatus = String(rawData.status).toUpperCase().trim();
      if (ALL_STATUSES.includes(normalizedStatus as ApplicatorStatus)) {
        transformedData.status = normalizedStatus as ApplicatorStatus;
      } else {
        warnings.push(`Unknown status '${rawData.status}', ignoring`);
      }
    }

    // Add default values for fields that might be missing from Priority
    transformedData.imagePath = rawData.imagePath || null;
    transformedData.isRemoved = rawData.isRemoved || false;

    // Validate required fields for faulty applicators
    if (transformedData.usageType === 'faulty' && !transformedData.comments) {
      errors.push('Comments are required for faulty applicators');
    }

    // Check for errors
    if (errors.length > 0) {
      logger.error(`${logPrefix} Data transformation failed`, {
        errors,
        warnings,
        rawData,
        partialTransformedData: transformedData
      });
      return { success: false, errors, warnings };
    }

    logger.debug(`${logPrefix} Data transformation successful`, {
      transformedData,
      warnings,
      originalKeys: Object.keys(rawData || {}),
      transformedKeys: Object.keys(transformedData)
    });

    return {
      success: true,
      data: transformedData as TransformedApplicatorData,
      warnings: warnings.length > 0 ? warnings : undefined
    };

  } catch (error: any) {
    logger.error(`${logPrefix} Data transformation error`, {
      error: {
        message: error.message,
        name: error.name,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      rawData
    });
    return { success: false, errors: [`Transformation error: ${error.message}`] };
  }
};

/**
 * Transform our application data to Priority system format
 */
export const transformToPriorityFormat = (
  appData: TransformedApplicatorData,
  requestId?: string
): any => {
  const logPrefix = `[PRIORITY_TRANSFORMER] ${requestId ? `[${requestId}]` : ''}`;

  logger.debug(`${logPrefix} Transforming to Priority format`, {
    appData
  });

  const priorityData = {
    serialNumber: appData.serialNumber,
    insertionTime: appData.insertionTime.toISOString(),
    usingType: appData.usageType,
    insertedSeedsQty: appData.insertedSeedsQty,
    comments: appData.comments
  };

  logger.debug(`${logPrefix} Priority format transformation complete`, {
    priorityData
  });

  return priorityData;
};

/**
 * Validate Priority system data structure
 */
export const validatePriorityDataStructure = (
  data: any,
  requestId?: string
): { isValid: boolean; issues: string[] } => {
  const logPrefix = `[PRIORITY_VALIDATOR] ${requestId ? `[${requestId}]` : ''}`;
  const issues: string[] = [];

  logger.debug(`${logPrefix} Validating Priority data structure`, {
    data,
    dataType: typeof data,
    isNull: data === null,
    isUndefined: data === undefined,
    keys: data ? Object.keys(data) : []
  });

  if (!data || typeof data !== 'object') {
    issues.push('Data must be a valid object');
    return { isValid: false, issues };
  }

  // Check for common Priority system field issues
  if (data.serialNumber === null || data.serialNumber === undefined) {
    issues.push('Serial number is null or undefined');
  }

  if (data.usageType === null || data.usageType === undefined) {
    issues.push('Usage type is null or undefined');
  }

  // Check for unexpected data types
  if (data.serialNumber && typeof data.serialNumber !== 'string') {
    issues.push(`Serial number should be string, got ${typeof data.serialNumber}`);
  }

  if (data.seedQuantity && typeof data.seedQuantity !== 'number') {
    issues.push(`Seed quantity should be number, got ${typeof data.seedQuantity}`);
  }

  const isValid = issues.length === 0;

  logger.debug(`${logPrefix} Data structure validation complete`, {
    isValid,
    issues,
    issueCount: issues.length
  });

  return { isValid, issues };
};