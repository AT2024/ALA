import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import logger from '../utils/logger';

// PDF Document Configuration - matches frontend
const PDF_DOCUMENT_NUMBER = 'FR-4001-01E ';
const PDF_VERSION = 'V.01';

// Colors
const HEADER_BLUE = '#428bca';


export interface Treatment {
  id: string;
  type: 'insertion' | 'removal' | 'pancreas_insertion' | 'prostate_insertion' | 'skin_insertion';
  subjectId: string;
  site: string;
  date: string;
  surgeon?: string;
  activityPerSeed?: number;
  patientName?: string;
}

export interface Applicator {
  id: string;
  serialNumber: string;
  applicatorType?: string;
  seedQuantity: number;
  usageType: 'full' | 'faulty' | 'none' | 'sealed';
  status?: 'SEALED' | 'OPENED' | 'LOADED' | 'INSERTED' | 'FAULTY' | 'DISPOSED' | 'DISCHARGED' | 'DEPLOYMENT_FAILURE' | null;
  insertionTime: string;
  insertedSeedsQty?: number;
  comments?: string;
  catalog?: string;
  seedLength?: number;
}

export interface TreatmentSummary {
  timeInsertionStarted: string;
  totalApplicatorUse: number;
  faultyApplicator: number;
  notUsedApplicators: number;
  totalDartSeedsInserted: number;
  seedsInsertedBy: string;
  totalActivity: number;
}

export interface SignatureDetails {
  type: 'hospital_auto' | 'alphatau_verified';
  signerName: string;
  signerEmail: string;
  signerPosition: string;
  signedAt: Date;
}

export interface ContinuationInfo {
  parentTreatmentId: string;
  parentPdfCreatedAt: Date;
}

// ===== REMOVAL PDF TYPES =====

export interface DiscrepancyCategory {
  checked: boolean;
  amount: number;
  comment: string;
}

export interface DiscrepancyOther extends DiscrepancyCategory {
  description: string;
}

export interface DiscrepancyClarification {
  lost: DiscrepancyCategory;
  retrievedToSite: DiscrepancyCategory;
  removalFailure: DiscrepancyCategory;
  other: DiscrepancyOther;
}

export interface RemovalApplicatorGroup {
  seedCount: number;
  totalApplicators: number;
  removedApplicators: number;
  totalSources: number;
  removedSources: number;
  progressPercent: number;
  comment?: string;
}

export interface RemovalTreatment extends Treatment {
  daysSinceInsertion: number;
  seedQuantity?: number;
}

export interface RemovalPdfData {
  treatment: RemovalTreatment;
  applicatorGroups: RemovalApplicatorGroup[];
  individualSeeds: {
    total: number;
    removed: number;
    comment?: string;
  };
  procedureForm: {
    removalDate: string;
    allSourcesSameDate: boolean;
    additionalRemovalDate?: string;
    reasonNotSameDate?: string;
    topGeneralComments?: string;
    removalGeneralComments?: string;
  };
  discrepancy: {
    sourcesNotRemoved: number;
    isRemovedEqualInserted: boolean;
    clarification?: DiscrepancyClarification;
  };
  summary: {
    totalSourcesInserted: number;
    totalSourcesRemoved: number;
  };
}

/**
 * Format a date for display with 3-letter month abbreviation
 */
function formatDate(date: Date | string, includeTime = true): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) {
    return 'N/A';
  }

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(d.getDate()).padStart(2, '0');
  const month = months[d.getMonth()];
  const year = d.getFullYear();

  if (!includeTime) {
    return `${day}.${month}.${year}`;
  }

  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

/**
 * Format a date for signature block (more detailed)
 */
function formatSignatureDate(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(date.getDate()).padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
}

/**
 * Format site name for display (handles backward compatibility)
 * - If site has a number in parentheses at the end, strip it
 * - Otherwise return as-is
 */
function formatSiteName(site: string): string {
  if (!site) return 'N/A';
  // Match pattern: "Hospital Name (123456)" -> extract "Hospital Name"
  const match = site.match(/^(.+?)\s*\(\d+\)$/);
  if (match) {
    return match[1].trim();
  }
  return site;
}

/**
 * Draw a table with headers and rows
 */
function drawTable(
  doc: PDFKit.PDFDocument,
  startY: number,
  headers: string[],
  rows: string[][],
  columnWidths: number[],
  options: { headerColor?: string; alternateRowColor?: string; onPageAdded?: () => void } = {}
): number {
  const { headerColor = HEADER_BLUE, alternateRowColor = '#f5f5f5', onPageAdded } = options;
  const startX = 50;
  const rowHeight = 20;
  const cellPadding = 5;

  let currentY = startY;

  // Draw header row
  doc.fillColor(headerColor);
  doc.rect(startX, currentY, columnWidths.reduce((a, b) => a + b, 0), rowHeight).fill();

  doc.fillColor('white').fontSize(9).font('Helvetica-Bold');
  let headerX = startX;
  headers.forEach((header, i) => {
    doc.text(header, headerX + cellPadding, currentY + cellPadding, {
      width: columnWidths[i] - cellPadding * 2,
      height: rowHeight - cellPadding * 2
    });
    headerX += columnWidths[i];
  });

  currentY += rowHeight;

  // Draw data rows
  doc.font('Helvetica').fontSize(8);
  rows.forEach((row, rowIndex) => {
    // Check if we need a new page
    if (currentY + rowHeight > doc.page.height - 80) {
      doc.addPage();
      if (onPageAdded) onPageAdded();
      currentY = 60; // Start below the header
    }

    // Alternate row color
    if (rowIndex % 2 === 1) {
      doc.fillColor(alternateRowColor);
      doc.rect(startX, currentY, columnWidths.reduce((a, b) => a + b, 0), rowHeight).fill();
    }

    // Draw row border
    doc.strokeColor('#dddddd').lineWidth(0.5);
    doc.rect(startX, currentY, columnWidths.reduce((a, b) => a + b, 0), rowHeight).stroke();

    // Draw cell text - no ellipsis with landscape layout providing adequate width
    doc.fillColor('black');
    let cellX = startX;
    row.forEach((cell, i) => {
      doc.text(cell, cellX + cellPadding, currentY + cellPadding, {
        width: columnWidths[i] - cellPadding * 2,
        height: rowHeight - cellPadding * 2
      });
      cellX += columnWidths[i];
    });

    currentY += rowHeight;
  });

  return currentY;
}

// ===== REMOVAL PDF DRAWING FUNCTIONS =====
// Layout matches the official "DaRT Removal Procedure" Word form (QSR-40001-01_V6_TC.docx)

/**
 * Draw removal PDF header with logo and doc number
 */
function drawRemovalHeader(doc: PDFKit.PDFDocument): number {
  // Add Alpha Tau logo (top-left corner)
  const localLogoPath = path.join(process.cwd(), '..', 'frontend', 'public', 'alphataulogo.png');
  const dockerLogoPath = path.join(process.cwd(), 'assets', 'alphataulogo.png');
  const logoPath = fs.existsSync(localLogoPath) ? localLogoPath : dockerLogoPath;
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 50, 15, { width: 100 });
  }

  // Document number and version
  doc.fontSize(10).font('Helvetica').fillColor('black');
  doc.text(PDF_DOCUMENT_NUMBER, 0, 20, { align: 'center' });
  doc.fontSize(8).text(PDF_VERSION, 0, 32, { align: 'center' });

  return 55;
}

/**
 * Draw removal form Table 1: main numbered form fields
 * Matches the Word document 2-column table layout
 */
function drawRemovalFormTable(
  doc: PDFKit.PDFDocument,
  data: RemovalPdfData,
  startY: number
): number {
  const startX = 50;
  const tableWidth = 495;
  const col1Width = 295;
  const col2Width = 200;
  const rowHeight = 18;
  const cellPadding = 5;
  let y = startY;

  const form = data.procedureForm;
  const summary = data.summary;
  const discrepancy = data.discrepancy;

  // Helper: draw a 2-column bordered row
  const drawRow = (rowY: number, height: number) => {
    doc.strokeColor('#000000').lineWidth(0.5);
    doc.rect(startX, rowY, tableWidth, height).stroke();
    doc.moveTo(startX + col1Width, rowY).lineTo(startX + col1Width, rowY + height).stroke();
  };

  // Helper: draw a full-width bordered row (no column divider)
  const drawFullWidthRow = (rowY: number, height: number) => {
    doc.strokeColor('#000000').lineWidth(0.5);
    doc.rect(startX, rowY, tableWidth, height).stroke();
  };

  // Row 0: Title row — bold, full-width
  const titleRowHeight = 24;
  drawFullWidthRow(y, titleRowHeight);
  doc.fontSize(11).font('Helvetica-Bold').fillColor('black');
  doc.text('DaRT Removal Procedure (complete if applicable)', startX + cellPadding, y + 6, {
    width: tableWidth - cellPadding * 2
  });
  y += titleRowHeight;

  // Row 1: Numbered items 1-4, each in its own sub-row
  const items = [
    { label: '1. Date of removal procedure:', value: formatDate(form.removalDate, false) },
    { label: '2. Total number of sources removed:', value: summary.totalSourcesRemoved.toString() },
    { label: '3. Were all sources removed on the same date?', value: form.allSourcesSameDate ? 'Yes' : 'No' },
    { label: '4. Is removed equal to inserted?', value: discrepancy.isRemovedEqualInserted ? 'Yes' : 'No' }
  ];

  items.forEach(item => {
    drawRow(y, rowHeight);
    doc.fontSize(9).font('Helvetica').fillColor('black');
    doc.text(item.label, startX + cellPadding, y + 4, { width: col1Width - cellPadding * 2 });
    doc.text(item.value, startX + col1Width + cellPadding, y + 4, { width: col2Width - cellPadding * 2 });
    y += rowHeight;
  });

  // Row 2: Empty separator
  const separatorHeight = 10;
  drawFullWidthRow(y, separatorHeight);
  y += separatorHeight;

  // Row 3: "If no, please answer questions a-d:" header
  const ifNoRowHeight = 20;
  drawFullWidthRow(y, ifNoRowHeight);
  doc.fontSize(9).font('Helvetica-Bold').fillColor('black');
  doc.text('If no, please answer questions a-d:', startX + cellPadding, y + 5, {
    width: tableWidth - cellPadding * 2
  });
  y += ifNoRowHeight;

  // Row 4: a. Total sources not removed
  drawRow(y, rowHeight);
  doc.fontSize(9).font('Helvetica').fillColor('black');
  doc.text('a. Total sources not removed:', startX + cellPadding, y + 4, { width: col1Width - cellPadding * 2 });
  doc.text(
    discrepancy.isRemovedEqualInserted ? '' : discrepancy.sourcesNotRemoved.toString(),
    startX + col1Width + cellPadding, y + 4, { width: col2Width - cellPadding * 2 }
  );
  y += rowHeight;

  // Row 5: b. Specify reason
  drawRow(y, rowHeight);
  doc.text('b. Specify reason:', startX + cellPadding, y + 4, { width: col1Width - cellPadding * 2 });
  doc.text(
    form.reasonNotSameDate || '',
    startX + col1Width + cellPadding, y + 4, { width: col2Width - cellPadding * 2 }
  );
  y += rowHeight;

  // Row 6: c. Additional date
  drawRow(y, rowHeight);
  doc.text('c. Additional date:', startX + cellPadding, y + 4, { width: col1Width - cellPadding * 2 });
  doc.text(
    form.additionalRemovalDate ? formatDate(form.additionalRemovalDate, false) : '',
    startX + col1Width + cellPadding, y + 4, { width: col2Width - cellPadding * 2 }
  );
  y += rowHeight;

  // Rows 7-10: Empty spacer rows
  for (let i = 0; i < 4; i++) {
    drawFullWidthRow(y, rowHeight);
    y += rowHeight;
  }

  return y;
}

/**
 * Draw clarification Table 2 rows 0-4: "d. Please clarify" with checkboxes
 * Matches the Word document 6-column layout with vertical merge
 */
function drawClarificationTable(
  doc: PDFKit.PDFDocument,
  discrepancy: RemovalPdfData['discrepancy'],
  startY: number
): number {
  const startX = 50;
  const tableWidth = 495;
  const clarifyWidth = 165;   // cols 0-1 (merged)
  const checkWidth = 120;     // col 2
  const amountWidth = 100;    // cols 3-4 (merged)
  const commentWidth = 110;   // col 5
  const rowHeight = 20;
  const cellPadding = 5;
  let y = startY;

  const clarification = discrepancy.clarification;

  const categories = [
    { label: 'Lost', data: clarification?.lost },
    { label: 'Retrieved to site', data: clarification?.retrievedToSite },
    { label: 'Removal failure', data: clarification?.removalFailure },
    { label: 'Other', data: clarification?.other, isOther: true }
  ];

  const totalRows = 5; // 1 header + 4 category rows
  const blockHeight = rowHeight * totalRows;

  // Outer border
  doc.strokeColor('#000000').lineWidth(0.5);
  doc.rect(startX, y, tableWidth, blockHeight).stroke();

  // Column X positions
  const col2X = startX + clarifyWidth;
  const col3X = col2X + checkWidth;
  const col4X = col3X + amountWidth;

  // Vertical dividers (full height of block)
  doc.moveTo(col2X, y).lineTo(col2X, y + blockHeight).stroke();
  doc.moveTo(col3X, y).lineTo(col3X, y + blockHeight).stroke();
  doc.moveTo(col4X, y).lineTo(col4X, y + blockHeight).stroke();

  // Horizontal dividers for rows 1-4 (only across cols 2-5, not through merged cols 0-1)
  for (let i = 1; i < totalRows; i++) {
    doc.moveTo(col2X, y + i * rowHeight).lineTo(startX + tableWidth, y + i * rowHeight).stroke();
  }

  // Cols 0-1: "d. Please clarify:" — vertically merged across all 5 rows
  doc.fontSize(9).font('Helvetica-Bold').fillColor('black');
  doc.text('d. Please clarify:', startX + cellPadding, y + cellPadding, {
    width: clarifyWidth - cellPadding * 2
  });

  // Row 0 column headers
  doc.fontSize(8).font('Helvetica-Bold').fillColor('black');
  doc.text('Check all that applies:', col2X + cellPadding, y + 5, { width: checkWidth - cellPadding * 2 });
  doc.text('Amount of sources:', col3X + cellPadding, y + 5, { width: amountWidth - cellPadding * 2 });
  doc.text('Comment:', col4X + cellPadding, y + 5, { width: commentWidth - cellPadding * 2 });

  // Rows 1-4: category data
  doc.fontSize(8).font('Helvetica').fillColor('black');
  categories.forEach((cat, index) => {
    const rowY = y + (index + 1) * rowHeight;
    const isChecked = cat.data?.checked || false;
    const checkbox = isChecked ? '[X]' : '[  ]';

    // Checkbox + label
    let label = cat.label;
    if (cat.isOther && (cat.data as DiscrepancyOther)?.description) {
      label = `Other: ${(cat.data as DiscrepancyOther).description}`;
    }
    doc.text(`${checkbox} ${label}`, col2X + cellPadding, rowY + 5, { width: checkWidth - cellPadding * 2 });

    // Amount
    doc.text(
      isChecked ? (cat.data?.amount?.toString() || '0') : '',
      col3X + cellPadding, rowY + 5, { width: amountWidth - cellPadding * 2 }
    );

    // Comment
    doc.text(
      isChecked ? (cat.data?.comment || '') : '',
      col4X + cellPadding, rowY + 5, { width: commentWidth - cellPadding * 2 }
    );
  });

  y += blockHeight;
  return y;
}

/**
 * Draw Table 2 rows 5-7: surgeon, general comments, and signature
 * Matches the Word document signature section layout
 */
function drawRemovalSignatureSection(
  doc: PDFKit.PDFDocument,
  data: RemovalPdfData,
  signatureDetails: SignatureDetails,
  startY: number
): void {
  const startX = 50;
  const tableWidth = 495;
  const rowHeight = 20;
  const cellPadding = 5;
  let y = startY;

  // Check for page break
  if (y + 90 > doc.page.height - 50) {
    doc.addPage();
    y = 50;
  }

  // Row 5: "Sources removed by (full name):" | surgeon name
  const labelWidth = 200;
  const valueWidth = tableWidth - labelWidth;
  doc.strokeColor('#000000').lineWidth(0.5);
  doc.rect(startX, y, tableWidth, rowHeight).stroke();
  doc.moveTo(startX + labelWidth, y).lineTo(startX + labelWidth, y + rowHeight).stroke();

  doc.fontSize(9).font('Helvetica-Bold').fillColor('black');
  doc.text('Sources removed by (full name):', startX + cellPadding, y + 5, { width: labelWidth - cellPadding * 2 });
  doc.font('Helvetica');
  doc.text(data.treatment.surgeon || '', startX + labelWidth + cellPadding, y + 5, { width: valueWidth - cellPadding * 2 });
  y += rowHeight;

  // Row 6: "General comments:" + text (full-width)
  const commentsText = data.procedureForm.removalGeneralComments || '';
  const commentsRowHeight = commentsText.length > 60 ? 36 : rowHeight;
  doc.strokeColor('#000000').lineWidth(0.5);
  doc.rect(startX, y, tableWidth, commentsRowHeight).stroke();

  doc.fontSize(9).font('Helvetica-Bold').fillColor('black');
  doc.text('General comments:', startX + cellPadding, y + 5);
  if (commentsText) {
    doc.font('Helvetica');
    doc.text(commentsText, startX + 120, y + 5, { width: tableWidth - 120 - cellPadding });
  }
  y += commentsRowHeight;

  // Row 7: Name / Signature / Date (3 sections)
  const nameWidth = 165;
  const sigWidth = 195;
  const dateWidth = tableWidth - nameWidth - sigWidth; // 135
  const sigRowHeight = 28;

  doc.strokeColor('#000000').lineWidth(0.5);
  doc.rect(startX, y, tableWidth, sigRowHeight).stroke();
  doc.moveTo(startX + nameWidth, y).lineTo(startX + nameWidth, y + sigRowHeight).stroke();
  doc.moveTo(startX + nameWidth + sigWidth, y).lineTo(startX + nameWidth + sigWidth, y + sigRowHeight).stroke();

  // Name
  doc.fontSize(8).font('Helvetica-Bold').fillColor('black');
  doc.text('Name:', startX + cellPadding, y + 4);
  doc.font('Helvetica').fontSize(8);
  doc.text(signatureDetails.signerName, startX + cellPadding, y + 15, { width: nameWidth - cellPadding * 2 });

  // Signature
  doc.font('Helvetica-Bold').fontSize(8);
  doc.text('Signature:', startX + nameWidth + cellPadding, y + 4);
  doc.font('Helvetica').fontSize(7);
  doc.text(
    `Digitally signed by ${signatureDetails.signerName} (${signatureDetails.signerEmail})`,
    startX + nameWidth + cellPadding, y + 15,
    { width: sigWidth - cellPadding * 2 }
  );

  // Date
  doc.font('Helvetica-Bold').fontSize(8);
  doc.text('Date:', startX + nameWidth + sigWidth + cellPadding, y + 4);
  doc.font('Helvetica').fontSize(8);
  doc.text(
    formatSignatureDate(signatureDetails.signedAt),
    startX + nameWidth + sigWidth + cellPadding, y + 15,
    { width: dateWidth - cellPadding * 2 }
  );

  y += sigRowHeight;

  // Footnote
  y += 10;
  doc.fontSize(7).fillColor('#666666').font('Helvetica');
  doc.text(
    'This document was electronically signed through the ALA Medical Treatment Tracking System.',
    0, y, { align: 'center' }
  );
}

/**
 * Calculate treatment summary from applicators
 */
export function calculateSummary(
  treatment: Treatment,
  applicators: Applicator[]
): TreatmentSummary {
  const fullUseApplicators = applicators.filter(a => a.usageType === 'full');
  const faultyApplicators = applicators.filter(a => a.usageType === 'faulty');
  // Count both 'none' and 'sealed' as not used
  const notUsedApplicators = applicators.filter(a => a.usageType === 'none' || a.usageType === 'sealed');

  // Find earliest insertion time
  const insertionTimes = applicators
    .filter(a => a.insertionTime && !isNaN(new Date(a.insertionTime).getTime()))
    .map(a => new Date(a.insertionTime).getTime());
  const earliestTime = insertionTimes.length > 0
    ? new Date(Math.min(...insertionTimes)).toISOString()
    : '';

  const totalSeeds = applicators
    .filter(a => a.status === 'INSERTED')
    .reduce((sum, a) => sum + a.seedQuantity, 0);

  // Calculate total activity
  const activityPerSeed = treatment.activityPerSeed || 0;
  const totalActivity = totalSeeds * activityPerSeed;

  return {
    timeInsertionStarted: earliestTime,
    totalApplicatorUse: fullUseApplicators.length + faultyApplicators.length,
    faultyApplicator: faultyApplicators.length,
    notUsedApplicators: notUsedApplicators.length,
    totalDartSeedsInserted: totalSeeds,
    seedsInsertedBy: treatment.surgeon || 'N/A',
    totalActivity
  };
}

/**
 * Generate a treatment PDF report with digital signature
 * @param treatment - Treatment data
 * @param applicators - List of applicators
 * @param signatureDetails - Signature information
 * @param continuationInfo - Optional info if this is a continuation treatment
 */
export async function generateTreatmentPdf(
  treatment: Treatment,
  applicators: Applicator[],
  signatureDetails: SignatureDetails,
  continuationInfo?: ContinuationInfo
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        logger.info(`PDF generated successfully, size: ${pdfBuffer.length} bytes`);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);

      // Helper function to draw page header on new pages
      // NOTE: Do NOT use doc.on('pageAdded') as it causes infinite recursion (stack overflow)
      const drawPageHeader = () => {
        // Draw document number in header
        doc.fontSize(10).font('Helvetica').fillColor('black');
        doc.text(PDF_DOCUMENT_NUMBER, 0, 20, { align: 'center' });
        doc.fontSize(8).text(PDF_VERSION, 0, 32, { align: 'center' });
      };

      // Calculate summary
      const summary = calculateSummary(treatment, applicators);

      // ===== HEADER =====
      // Add Alpha Tau logo (top-left corner)
      // Smart path: works in both local dev and Docker production
      // Local: process.cwd() is backend folder, logo is in ../frontend/public/
      // Docker: logo is copied to ./assets/ during build
      const localLogoPath = path.join(process.cwd(), '..', 'frontend', 'public', 'alphataulogo.png');
      const dockerLogoPath = path.join(process.cwd(), 'assets', 'alphataulogo.png');
      const logoPath = fs.existsSync(localLogoPath) ? localLogoPath : dockerLogoPath;
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 15, { width: 100 });
      }

      // Draw document number and version (also drawn on subsequent pages via pageAdded event)
      doc.fontSize(10).font('Helvetica').fillColor('black');
      doc.text(PDF_DOCUMENT_NUMBER, 0, 20, { align: 'center' });
      doc.fontSize(8).text(PDF_VERSION, 0, 32, { align: 'center' });

      doc.fontSize(20).font('Helvetica-Bold');
      doc.text('Medical Treatment Report', 0, 55, { align: 'center' });

      doc.fontSize(12).font('Helvetica');
      doc.text(`Generated: ${formatDate(new Date())}`, 0, 80, { align: 'center' });

      // ===== CONTINUATION NOTICE (if applicable) =====
      let yPosition = 110;

      if (continuationInfo) {
        // Draw amber/orange notice box for continuation treatments
        const noticeBoxWidth = 400;
        const noticeBoxHeight = 45;
        const noticeBoxX = (doc.page.width - noticeBoxWidth) / 2;

        // Box background and border
        doc.strokeColor('#f97316').lineWidth(2);
        doc.fillColor('#fff7ed');
        doc.rect(noticeBoxX, yPosition, noticeBoxWidth, noticeBoxHeight).fillAndStroke();

        // Notice title
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#c2410c');
        doc.text('CONTINUATION TREATMENT', noticeBoxX, yPosition + 8, {
          width: noticeBoxWidth,
          align: 'center'
        });

        // Notice details
        doc.fontSize(9).font('Helvetica').fillColor('#7c2d12');
        doc.text(
          `Original treatment PDF created at ${formatSignatureDate(continuationInfo.parentPdfCreatedAt)}`,
          noticeBoxX + 10, yPosition + 25, {
            width: noticeBoxWidth - 20,
            align: 'center'
          }
        );

        yPosition += noticeBoxHeight + 20;
      }

      // ===== TREATMENT INFORMATION =====
      doc.fontSize(16).font('Helvetica-Bold').fillColor('black');
      doc.text('Treatment Information', 50, yPosition);
      yPosition += 25;

      doc.fontSize(11).font('Helvetica');
      const treatmentInfo: [string, string][] = [
        ['Patient ID:', treatment.patientName || treatment.subjectId],
        ['Site:', formatSiteName(treatment.site)],
        ['Treatment Type:', treatment.type.charAt(0).toUpperCase() + treatment.type.slice(1).replace('_', ' ')],
        ['Treatment Date:', formatDate(treatment.date, false)]
        // Surgeon removed - already shown as "Inserted By" in Treatment Summary
      ];

      treatmentInfo.forEach(([label, value]) => {
        doc.font('Helvetica-Bold').text(label, 50, yPosition, { continued: true });
        doc.font('Helvetica').text(` ${value}`, { continued: false });
        yPosition += 18;
      });

      // ===== PROCESSED APPLICATORS TABLE =====
      yPosition += 15;
      doc.fontSize(16).font('Helvetica-Bold');
      doc.text('Processed Applicators', 50, yPosition);
      yPosition += 20;

      // Sort applicators by seed quantity (descending)
      const sortedApplicators = [...applicators].sort((a, b) => b.seedQuantity - a.seedQuantity);

      // Updated headers with Catalog and Length columns
      const tableHeaders = ['Serial', 'Catalog', 'Type', 'Sources', 'Length', 'Time', 'Usage', 'Inserted', 'Comments'];

      // Dynamic column width calculation - proportional widths with minimums
      // Available width for content (A4 landscape = 842pt, margins 50pt each side = 742pt usable)
      const CONTENT_WIDTH = 742;

      // Column configurations with minimum widths and flex weights
      // Landscape mode provides 742pt - widths increased to show full content
      const columnConfig = [
        { minWidth: 70, flex: 1.0 },   // Serial - full serial numbers
        { minWidth: 100, flex: 1.2 },  // Catalog - FLEX-00101-FG etc
        { minWidth: 110, flex: 1.3 },  // Type - "Alpha Flex Applicator"
        { minWidth: 45, flex: 0.6 },   // Sources
        { minWidth: 45, flex: 0.6 },   // Length
        { minWidth: 100, flex: 1.1 },  // Time - "06.Jan.2026 10:41"
        { minWidth: 55, flex: 0.7 },   // Usage - "Full use"
        { minWidth: 50, flex: 0.6 },   // Inserted
        { minWidth: 100, flex: 1.2 }   // Comments - user notes
      ];

      // Calculate dynamic column widths
      const totalMinWidth = columnConfig.reduce((sum, c) => sum + c.minWidth, 0);
      const totalFlex = columnConfig.reduce((sum, c) => sum + c.flex, 0);
      const remainingWidth = Math.max(0, CONTENT_WIDTH - totalMinWidth);

      const columnWidths = columnConfig.map(c =>
        Math.floor(c.minWidth + (c.flex / totalFlex) * remainingWidth)
      );

      const tableRows = sortedApplicators.map(applicator => [
        applicator.serialNumber,
        applicator.catalog || 'N/A',
        applicator.applicatorType || 'N/A',
        applicator.seedQuantity.toString(),
        applicator.seedLength ? `${applicator.seedLength}` : '-',
        applicator.insertionTime && !isNaN(new Date(applicator.insertionTime).getTime())
          ? formatDate(applicator.insertionTime)
          : 'N/A',
        applicator.usageType === 'full' ? 'Full use'
          : applicator.usageType === 'faulty' ? 'Faulty'
          : applicator.usageType === 'sealed' ? 'Not Used'
          : 'No Use',
        applicator.usageType === 'full'
          ? applicator.seedQuantity.toString()
          : applicator.usageType === 'faulty'
          ? (applicator.insertedSeedsQty || 0).toString()
          : '0',
        applicator.comments || '-'
      ]);

      yPosition = drawTable(doc, yPosition, tableHeaders, tableRows, columnWidths, {
        onPageAdded: drawPageHeader
      });

      // ===== TREATMENT SUMMARY =====
      yPosition += 20;

      // Check if we need a new page for summary
      if (yPosition + 120 > doc.page.height - 80) {
        doc.addPage();
        drawPageHeader();
        yPosition = 60; // Start below the header
      }

      doc.fontSize(16).font('Helvetica-Bold').fillColor('black');
      doc.text('Treatment Summary', 50, yPosition);
      yPosition += 25;

      doc.fontSize(11);
      const summaryItems: [string, string][] = [
        ['Time Started:', formatDate(summary.timeInsertionStarted)],
        ['Applicators Used:', summary.totalApplicatorUse.toString()],
        ['Faulty:', summary.faultyApplicator.toString()],
        ['Not Used:', summary.notUsedApplicators.toString()],
        ['Sources Inserted:', summary.totalDartSeedsInserted.toString()],
        ['Total Activity:', `${summary.totalActivity.toFixed(2)} µCi`],
        ['Inserted By:', summary.seedsInsertedBy]
      ];

      // Draw summary in two columns with proper positioning (no overlap)
      const leftColumn = summaryItems.slice(0, 4);
      const rightColumn = summaryItems.slice(4);

      const leftX = 50;
      const leftValueX = 180; // Fixed position for left column values
      const rightX = 300;
      const rightValueX = 430; // Fixed position for right column values
      let leftY = yPosition;
      let rightY = yPosition;
      const lineHeight = 20; // Increased line height to prevent overlap

      leftColumn.forEach(([label, value]) => {
        doc.font('Helvetica-Bold').text(label, leftX, leftY, { width: 125, lineBreak: false });
        doc.font('Helvetica').text(value, leftValueX, leftY, { width: 110, lineBreak: false });
        leftY += lineHeight;
      });

      rightColumn.forEach(([label, value]) => {
        doc.font('Helvetica-Bold').text(label, rightX, rightY, { width: 125, lineBreak: false });
        doc.font('Helvetica').text(value, rightValueX, rightY, { width: 110, lineBreak: false });
        rightY += lineHeight;
      });

      yPosition = Math.max(leftY, rightY);

      // ===== DIGITAL SIGNATURE BLOCK =====
      yPosition += 30;

      // Check if we need a new page for signature
      if (yPosition + 100 > doc.page.height - 60) {
        doc.addPage();
        drawPageHeader();
        yPosition = 60; // Start below the header
      }

      const signatureTypeText = signatureDetails.type === 'hospital_auto'
        ? 'Hospital User (Auto-signed)'
        : 'Alpha Tau Verified';

      // Signature box
      const boxWidth = 400;
      const boxHeight = 90;
      const boxX = (doc.page.width - boxWidth) / 2;

      doc.strokeColor('#333333').lineWidth(2);
      doc.rect(boxX, yPosition, boxWidth, boxHeight).stroke();

      // Signature header
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#333333');
      doc.text('DOCUMENT DIGITALLY SIGNED', boxX, yPosition + 10, {
        width: boxWidth,
        align: 'center'
      });

      // Signature details
      doc.fontSize(10).font('Helvetica');
      const signatureY = yPosition + 30;
      doc.text(`Signer: ${signatureDetails.signerName}`, boxX + 20, signatureY);
      doc.text(`Position: ${signatureDetails.signerPosition}`, boxX + 20, signatureY + 14);
      doc.text(`Email: ${signatureDetails.signerEmail}`, boxX + 20, signatureY + 28);
      doc.text(`Date: ${formatSignatureDate(signatureDetails.signedAt)}`, boxX + 20, signatureY + 42);

      // Signature type indicator
      doc.fontSize(9).fillColor(signatureDetails.type === 'alphatau_verified' ? '#28a745' : '#6c757d');
      doc.text(`[${signatureTypeText}]`, boxX + 250, signatureY + 14);

      yPosition += boxHeight + 15;

      // Signature footnote
      doc.fontSize(8).fillColor('#666666').font('Helvetica');
      doc.text(
        'This document was electronically signed through the ALA Medical Treatment Tracking System.',
        0, yPosition, { align: 'center' }
      );

      // Finalize the PDF
      doc.end();

    } catch (error) {
      logger.error('Error generating PDF:', error);
      reject(error);
    }
  });
}

/**
 * Generate a removal procedure PDF report with digital signature
 * Mirrors the SeedRemoval page layout with progress bars and visual styling
 *
 * @param data - Removal PDF data including treatment, applicator groups, form data
 * @param signatureDetails - Signature information for the PDF
 */
export async function generateRemovalPdf(
  data: RemovalPdfData,
  signatureDetails: SignatureDetails
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'portrait',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        logger.info(`Removal PDF generated successfully, size: ${pdfBuffer.length} bytes`);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);

      // Header with logo and doc number
      let yPosition = drawRemovalHeader(doc);

      // Table 1: Main form with numbered fields
      yPosition = drawRemovalFormTable(doc, data, yPosition);

      // Table 2a: Clarification section (rows 0-4)
      yPosition = drawClarificationTable(doc, data.discrepancy, yPosition);

      // Table 2b: Signature section (rows 5-7)
      drawRemovalSignatureSection(doc, data, signatureDetails, yPosition);

      // Finalize the PDF
      doc.end();

    } catch (error) {
      logger.error('Error generating removal PDF:', error);
      reject(error);
    }
  });
}

export default {
  generateTreatmentPdf,
  generateRemovalPdf,
  calculateSummary
};
