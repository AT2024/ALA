/**
 * Finalization Helper Functions
 *
 * Extracted from treatmentController.ts to eliminate duplicate code in
 * verifyAndFinalize() and autoFinalize() functions.
 *
 * These helpers handle:
 * - Merging processed and unused applicators for PDF generation
 * - Generating and storing treatment PDFs with email sending
 */

import { Treatment, TreatmentPdf } from '../models';
import {
  generateTreatmentPdf,
  generateRemovalPdf,
  ContinuationInfo,
  RemovalPdfData,
  RemovalApplicatorGroup,
  DiscrepancyClarification,
  SignatureDetails as PdfSignatureDetails
} from '../services/pdfGenerationService';
import { sendSignedPdf, getPdfRecipientEmail } from '../services/emailService';
import logger from './logger';

/**
 * Usage type for applicators (matches pdfGenerationService expectations)
 */
export type ApplicatorUsageType = 'full' | 'faulty' | 'none' | 'sealed';

/**
 * Applicator structure for PDF generation
 */
export interface ApplicatorForPdf {
  id: string;
  serialNumber: string;
  applicatorType?: string;
  seedQuantity: number;
  usageType: ApplicatorUsageType;
  insertionTime: string;
  insertedSeedsQty?: number;
  comments?: string;
}

/**
 * Signature details for PDF signing
 */
export interface SignatureDetails {
  type: 'alphatau_verified' | 'hospital_auto';
  signerName: string;
  signerEmail: string;
  signerPosition: string;
  signedAt: Date;
}

/**
 * Result from PDF generation and email sending
 */
export interface FinalizationResult {
  pdfId: string | null;
  emailStatus: string | null;
}

/**
 * Merge processed applicators with unused available applicators for PDF generation
 *
 * This creates a complete list of all applicators assigned to a treatment,
 * marking unused ones as "sealed" with "Not used" comments.
 *
 * @param processedApplicators - Applicators that were actually used/processed
 * @param availableApplicators - All available applicators for the treatment (includes unused)
 * @returns Combined array of all applicators formatted for PDF
 *
 * @example
 * const allApplicators = mergeApplicatorsForPdf(processed, available);
 */
export function mergeApplicatorsForPdf(
  processedApplicators: any[],
  availableApplicators: any[] | undefined
): ApplicatorForPdf[] {
  // Get serial numbers of processed applicators to identify unused ones
  const processedSerials = new Set(processedApplicators.map((a) => a.serialNumber));

  // Map unused applicators (those in available but not processed)
  const unusedApplicators: ApplicatorForPdf[] = (availableApplicators || [])
    .filter((a) => !processedSerials.has(a.serialNumber))
    .map((a) => ({
      id: a.id,
      serialNumber: a.serialNumber,
      applicatorType: a.applicatorType,
      seedQuantity: a.seedQuantity,
      usageType: 'sealed' as const,
      insertionTime: '',
      insertedSeedsQty: 0,
      comments: 'Not used',
    }));

  // Combine processed applicators (formatted) with unused ones
  const allApplicators: ApplicatorForPdf[] = [
    ...processedApplicators.map((app): ApplicatorForPdf => ({
      id: app.id,
      serialNumber: app.serialNumber,
      applicatorType: app.applicatorType,
      seedQuantity: app.seedQuantity,
      usageType: app.usageType as ApplicatorUsageType,
      insertionTime: app.insertionTime,
      insertedSeedsQty: app.insertedSeedsQty,
      comments: app.comments,
    })),
    ...unusedApplicators,
  ];

  return allApplicators;
}

/**
 * Calculate days since insertion for removal treatments
 */
function calculateDaysSinceInsertion(insertionDate: Date | string): number {
  const insertion = typeof insertionDate === 'string' ? new Date(insertionDate) : insertionDate;
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - insertion.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Build RemovalPdfData from treatment and applicators for PDF generation
 *
 * This transforms the treatment data and applicator list into the format
 * required by generateRemovalPdf, including grouping applicators by seed count
 * and calculating progress percentages.
 *
 * @param treatment - The removal treatment being finalized
 * @param applicators - All applicators associated with the treatment
 * @returns RemovalPdfData structure for PDF generation
 */
export function buildRemovalPdfData(
  treatment: Treatment,
  applicators: ApplicatorForPdf[]
): RemovalPdfData {
  // Group applicators by seed quantity for the tracking table
  const groupsMap: Record<number, { apps: ApplicatorForPdf[], removed: number }> = {};

  applicators.forEach(app => {
    const seedCount = app.seedQuantity;
    if (!groupsMap[seedCount]) {
      groupsMap[seedCount] = { apps: [], removed: 0 };
    }
    groupsMap[seedCount].apps.push(app);

    // Count removed applicators based on usageType
    // For removal treatments, 'full' means fully removed
    if (app.usageType === 'full') {
      groupsMap[seedCount].removed++;
    }
  });

  // Convert to RemovalApplicatorGroup array
  // Parse group comments from treatment if available
  const treatmentData = treatment as any;
  const groupComments: Record<number, string> = treatmentData.groupComments
    ? (typeof treatmentData.groupComments === 'string'
        ? JSON.parse(treatmentData.groupComments)
        : treatmentData.groupComments)
    : {};

  const applicatorGroups: RemovalApplicatorGroup[] = Object.entries(groupsMap)
    .map(([seedCountStr, data]) => {
      const seedCount = parseInt(seedCountStr, 10);
      const totalApplicators = data.apps.length;
      const removedApplicators = data.removed;
      const totalSources = totalApplicators * seedCount;
      const removedSources = removedApplicators * seedCount;
      const progressPercent = totalApplicators > 0
        ? Math.round((removedApplicators / totalApplicators) * 100)
        : 0;

      return {
        seedCount,
        totalApplicators,
        removedApplicators,
        totalSources,
        removedSources,
        progressPercent,
        comment: groupComments[seedCount] || undefined
      };
    })
    .sort((a, b) => b.seedCount - a.seedCount); // Sort by seed count descending

  // Calculate totals
  const totalSourcesFromGroups = applicatorGroups.reduce((sum, g) => sum + g.totalSources, 0);
  const removedSourcesFromGroups = applicatorGroups.reduce((sum, g) => sum + g.removedSources, 0);

  // Individual seeds data
  const individualSeedsRemoved = treatmentData.individualSeedsRemoved || 0;
  const individualSeedComment = treatmentData.individualSeedComment || undefined;

  // Total sources may be stored in treatment or calculated from applicators
  const totalSourcesInserted = treatmentData.seedQuantity || totalSourcesFromGroups;
  const totalSourcesRemoved = removedSourcesFromGroups + individualSeedsRemoved;
  const sourcesNotRemoved = totalSourcesInserted - totalSourcesRemoved;
  const isRemovedEqualInserted = sourcesNotRemoved === 0;

  // Parse discrepancy clarification if present
  let discrepancyClarification: DiscrepancyClarification | undefined;
  if (treatmentData.discrepancyClarification) {
    discrepancyClarification = typeof treatmentData.discrepancyClarification === 'string'
      ? JSON.parse(treatmentData.discrepancyClarification)
      : treatmentData.discrepancyClarification;
  }

  // Build the RemovalPdfData structure
  return {
    treatment: {
      id: treatment.id,
      type: treatment.type,
      subjectId: treatment.subjectId,
      site: treatment.site,
      date: treatment.date instanceof Date ? treatment.date.toISOString() : String(treatment.date),
      surgeon: treatment.surgeon,
      activityPerSeed: treatment.activityPerSeed,
      patientName: treatment.patientName,
      daysSinceInsertion: calculateDaysSinceInsertion(treatment.date),
      seedQuantity: totalSourcesInserted
    },
    applicatorGroups,
    individualSeeds: {
      total: individualSeedsRemoved > 0 ? individualSeedsRemoved : 0,
      removed: individualSeedsRemoved,
      comment: individualSeedComment
    },
    procedureForm: {
      removalDate: treatmentData.removalDate
        ? (treatmentData.removalDate instanceof Date
            ? treatmentData.removalDate.toISOString()
            : treatmentData.removalDate)
        : new Date().toISOString(),
      allSourcesSameDate: treatmentData.allSourcesSameDate !== false,
      additionalRemovalDate: treatmentData.additionalRemovalDate
        ? (treatmentData.additionalRemovalDate instanceof Date
            ? treatmentData.additionalRemovalDate.toISOString()
            : treatmentData.additionalRemovalDate)
        : undefined,
      reasonNotSameDate: treatmentData.reasonNotSameDate,
      topGeneralComments: treatmentData.topGeneralComments,
      removalGeneralComments: treatmentData.removalGeneralComments
    },
    discrepancy: {
      sourcesNotRemoved,
      isRemovedEqualInserted,
      clarification: discrepancyClarification
    },
    summary: {
      totalSourcesInserted,
      totalSourcesRemoved
    }
  };
}

/**
 * Generate PDF, store in database, and send via email
 *
 * This is the core finalization logic extracted from both verifyAndFinalize()
 * and autoFinalize() to eliminate ~60 lines of duplicate code.
 *
 * Generates PDF for both insertion and removal treatments.
 *
 * @param treatment - The treatment being finalized
 * @param allApplicators - All applicators (processed + unused)
 * @param signatureDetails - Signature information for the PDF
 * @param continuationInfo - Optional continuation info for linked treatments
 * @returns Object with pdfId and emailStatus
 *
 * @example
 * const result = await finalizeAndSendPdf(treatment, applicators, signature, contInfo);
 */
export async function finalizeAndSendPdf(
  treatment: Treatment,
  allApplicators: ApplicatorForPdf[],
  signatureDetails: SignatureDetails,
  continuationInfo?: ContinuationInfo
): Promise<FinalizationResult> {
  let pdfBuffer: Buffer;

  // Generate PDF based on treatment type
  if (treatment.type === 'removal') {
    // Build removal PDF data and generate removal-specific PDF
    const removalData = buildRemovalPdfData(treatment, allApplicators);
    pdfBuffer = await generateRemovalPdf(removalData, signatureDetails as PdfSignatureDetails);
    logger.info(`Removal PDF generated for treatment ${treatment.id}, size: ${pdfBuffer.length} bytes`);
  } else {
    // Generate standard insertion treatment PDF
    pdfBuffer = await generateTreatmentPdf(
      {
        id: treatment.id,
        type: treatment.type,
        subjectId: treatment.subjectId,
        site: treatment.site,
        date: treatment.date instanceof Date ? treatment.date.toISOString() : String(treatment.date),
        surgeon: treatment.surgeon,
        activityPerSeed: treatment.activityPerSeed,
        patientName: treatment.patientName,
      },
      allApplicators,
      signatureDetails,
      continuationInfo
    );
  }

  // Store PDF in database
  const treatmentPdf = await TreatmentPdf.create({
    treatmentId: treatment.id,
    pdfData: pdfBuffer,
    pdfSizeBytes: pdfBuffer.length,
    signatureType: signatureDetails.type,
    signerName: signatureDetails.signerName,
    signerEmail: signatureDetails.signerEmail,
    signerPosition: signatureDetails.signerPosition,
    signedAt: signatureDetails.signedAt,
    emailStatus: 'pending',
  });

  // Send PDF to clinic email
  const recipientEmail = getPdfRecipientEmail();
  try {
    await sendSignedPdf(recipientEmail, pdfBuffer, treatment.id, signatureDetails);
    treatmentPdf.emailSentAt = new Date();
    treatmentPdf.emailSentTo = recipientEmail;
    treatmentPdf.emailStatus = 'sent';
    await treatmentPdf.save();
    logger.info(`PDF sent to ${recipientEmail} for treatment ${treatment.id}`);
  } catch (emailError: any) {
    logger.error(`Failed to send PDF email: ${emailError.message}`);
    treatmentPdf.emailStatus = 'failed';
    await treatmentPdf.save();
    // Don't fail the whole operation - PDF is stored
  }

  return {
    pdfId: treatmentPdf.id,
    emailStatus: treatmentPdf.emailStatus,
  };
}
