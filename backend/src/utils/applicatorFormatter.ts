import { priorityService } from '../services/priorityService';
import logger from './logger';

export interface FormattedApplicator {
  id: string;
  serialNumber: string;
  treatmentId: string;
  seedQuantity: number;
  usageType: string;
  insertionTime: string;
  comments: string;
  image: string | null;
  addedBy: string;
  isRemoved: boolean;
  removalComments: string | null;
  removalImage: string | null;
  removedBy: string | null;
  removalTime: string | null;
  applicatorType: string;
  insertedSeedsQty: number;
  catalog: string | null;
  seedLength: number | null;
}

export interface FormatApplicatorOptions {
  treatmentId: string;
  priorityIdPrefix: string | null;
  defaultUserId: string;
  seedLength: number | null;
}

/**
 * Format and enrich applicators with catalog lookup
 * Consolidates duplicate code from getTreatmentApplicators
 */
export async function formatAndEnrichApplicators(
  applicators: any[],
  options: FormatApplicatorOptions
): Promise<FormattedApplicator[]> {
  const { treatmentId, priorityIdPrefix, defaultUserId, seedLength } = options;

  const formattedApplicators = await Promise.all(applicators.map(async (app: any) => {
    // Get catalog - try PARTNAME first, then look up from PARTS table using PARTDES
    let catalog = app.PARTNAME || app.catalog || null;

    if (!catalog && app.PARTDES) {
      try {
        catalog = await priorityService.getPartNameFromDescription(app.PARTDES);
      } catch (e: any) {
        logger.warn(`Catalog lookup failed for ${app.SERNUM} with PARTDES "${app.PARTDES}": ${e.message}`);
      }
    }

    return {
      id: app.SIBD_REPPRODPAL || `${priorityIdPrefix || 'unknown'}-${app.SERNUM}`,
      serialNumber: app.SERNUM,
      treatmentId: treatmentId,
      seedQuantity: app.INTDATA2 || 0,
      usageType: app.USINGTYPE || 'full',
      insertionTime: app.INSERTIONDATE || new Date().toISOString(),
      comments: app.INSERTIONCOMMENTS || '',
      image: app.EXTFILENAME || null,
      addedBy: app.INSERTEDREPORTEDBY || defaultUserId,
      isRemoved: false,
      removalComments: null,
      removalImage: null,
      removedBy: null,
      removalTime: null,
      applicatorType: app.PARTDES || app.PARTNAME || 'Unknown Applicator',
      insertedSeedsQty: app.INSERTEDSEEDSQTY || app.INTDATA2 || 0,
      catalog: catalog,
      seedLength: seedLength || app.SIBD_SEEDLEN || null
    };
  }));

  // Log summary of missing data
  const missingCatalog = formattedApplicators.filter(a => !a.catalog).length;
  if (missingCatalog > 0 || !seedLength) {
    logger.warn(`Enrichment: ${missingCatalog} applicators without catalog, seedLength=${seedLength}`);
  }

  return formattedApplicators;
}

/**
 * Fetch seed length from order details
 */
export async function fetchSeedLength(orderName: string): Promise<number | null> {
  try {
    const orderDetails = await priorityService.getOrderDetails(orderName);
    return orderDetails?.SIBD_SEEDLEN || null;
  } catch (error) {
    logger.warn(`Could not fetch order details for seed length: ${error}`);
    return null;
  }
}
