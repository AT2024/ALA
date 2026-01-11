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
import { generateTreatmentPdf, ContinuationInfo } from '../services/pdfGenerationService';
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
  // Preserve usageType from frontend (e.g., 'full' for removed applicators in removal workflow)
  const unusedApplicators: ApplicatorForPdf[] = (availableApplicators || [])
    .filter((a) => !processedSerials.has(a.serialNumber))
    .map((a) => ({
      id: a.id,
      serialNumber: a.serialNumber,
      applicatorType: a.applicatorType,
      seedQuantity: a.seedQuantity,
      usageType: (a.usageType as ApplicatorUsageType) || 'sealed',
      insertionTime: a.insertionTime || '',
      insertedSeedsQty: a.insertedSeedsQty || 0,
      comments: a.comments || 'Not used',
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
 * Generate PDF, store in database, and send via email
 *
 * This is the core finalization logic extracted from both verifyAndFinalize()
 * and autoFinalize() to eliminate ~60 lines of duplicate code.
 *
 * Only generates/sends for insertion treatments (not removal).
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
  // Skip PDF generation for removal treatments
  if (treatment.type === 'removal') {
    logger.info(`Skipping PDF generation for removal treatment ${treatment.id}`);
    return { pdfId: null, emailStatus: null };
  }

  // Generate PDF with signature
  const pdfBuffer = await generateTreatmentPdf(
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
