import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import logger from '../utils/logger';

// PDF Document Configuration - matches frontend
const PDF_DOCUMENT_NUMBER = 'FR-4001-01E ';
const PDF_VERSION = 'V.01';

// Colors
const HEADER_BLUE = '#428bca';

// Removal-specific colors matching frontend Tailwind classes
const REMOVAL_GREEN = '#22c55e';    // green-600 - complete state
const REMOVAL_GREEN_LIGHT = '#dcfce7'; // green-100 - complete row background
const REMOVAL_PRIMARY = '#428bca';  // primary - in-progress
const REMOVAL_ORANGE = '#f97316';   // orange-500 - individual seeds
const REMOVAL_RED = '#dc2626';      // red-600 - discrepancy/error
const REMOVAL_AMBER = '#f59e0b';    // amber-500 - warning
const REMOVAL_AMBER_LIGHT = '#fffbeb'; // amber-50 - warning background
const REMOVAL_AMBER_BORDER = '#fcd34d'; // amber-300 - warning border
const GRAY_BACKGROUND = '#e5e7eb';  // gray-200 - progress bar background
const GRAY_TEXT = '#6b7280';        // gray-500 - labels

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

/**
 * Draw a progress bar with configurable colors
 */
function drawProgressBar(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  height: number,
  progress: number,
  options: { isComplete?: boolean; isIndividual?: boolean } = {}
): void {
  const { isComplete = false, isIndividual = false } = options;

  // Background bar (gray, rounded)
  doc.fillColor(GRAY_BACKGROUND);
  doc.roundedRect(x, y, width, height, height / 2).fill();

  // Progress fill
  const progressWidth = Math.min(width * (progress / 100), width);
  if (progressWidth > 0) {
    const barColor = isComplete ? REMOVAL_GREEN : isIndividual ? REMOVAL_ORANGE : REMOVAL_PRIMARY;
    doc.fillColor(barColor);
    doc.roundedRect(x, y, progressWidth, height, height / 2).fill();
  }

  // Reset fill color
  doc.fillColor('black');
}

/**
 * Draw removal PDF header with logo and title
 */
function drawRemovalHeader(doc: PDFKit.PDFDocument, _startY: number): number {
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

  // Title
  doc.fontSize(20).font('Helvetica-Bold');
  doc.text('Removal Procedure Report', 0, 55, { align: 'center' });

  doc.fontSize(12).font('Helvetica');
  doc.text(`Generated: ${formatDate(new Date())}`, 0, 80, { align: 'center' });

  return _startY;
}

/**
 * Draw treatment information section (4-column grid like frontend)
 */
function drawRemovalTreatmentInfo(
  doc: PDFKit.PDFDocument,
  treatment: RemovalTreatment,
  startY: number
): number {
  let y = startY;

  // Section title
  doc.fontSize(14).font('Helvetica-Bold').fillColor('black');
  doc.text('Treatment Information', 50, y);
  y += 20;

  // Draw border around section
  doc.strokeColor('#e5e7eb').lineWidth(1);
  doc.roundedRect(50, y, 742, 75, 4).stroke();
  y += 10;

  // Info grid (4 columns, 2 rows)
  const fields = [
    ['Patient ID', treatment.patientName || treatment.subjectId],
    ['Date of Insertion', formatDate(treatment.date, false)],
    ['Total Sources', treatment.seedQuantity?.toString() || 'N/A'],
    ['Total Activity', treatment.activityPerSeed && treatment.seedQuantity
      ? `${(treatment.activityPerSeed * treatment.seedQuantity).toFixed(1)} µCi` : 'N/A'],
    ['Surgeon', treatment.surgeon || 'N/A'],
    ['Site', formatSiteName(treatment.site)],
    ['Days Since Insertion', `${treatment.daysSinceInsertion} days`],
    ['Type', 'Removal']
  ];

  // Draw in 4-column grid
  const colWidth = 180;
  fields.forEach((field, index) => {
    const col = index % 4;
    const row = Math.floor(index / 4);
    const fieldX = 60 + col * colWidth;
    const rowY = y + row * 30;

    doc.fontSize(9).font('Helvetica').fillColor(GRAY_TEXT);
    doc.text(field[0], fieldX, rowY);
    doc.fontSize(10).font('Helvetica-Bold').fillColor('black');
    doc.text(field[1], fieldX, rowY + 11);
  });

  return y + 70;
}

/**
 * Draw source removal tracking table with progress bars
 */
function drawRemovalTrackingTable(
  doc: PDFKit.PDFDocument,
  data: RemovalPdfData,
  startY: number
): number {
  let y = startY + 15;

  // Section title
  doc.fontSize(14).font('Helvetica-Bold').fillColor('black');
  doc.text('Source Removal Tracking', 50, y);
  y += 20;

  // Table configuration
  const headers = ['Group', 'Total Sources', 'Removed', 'Progress', 'Comment'];
  const colWidths = [200, 100, 80, 150, 212];
  const rowHeight = 28;
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);

  // Draw header row
  doc.fillColor(HEADER_BLUE);
  doc.rect(50, y, tableWidth, 22).fill();

  doc.fillColor('white').fontSize(9).font('Helvetica-Bold');
  let headerX = 50;
  headers.forEach((header, i) => {
    doc.text(header, headerX + 5, y + 6, { width: colWidths[i] - 10 });
    headerX += colWidths[i];
  });
  y += 22;

  // Draw applicator groups
  data.applicatorGroups.forEach((group, index) => {
    const isComplete = group.removedApplicators >= group.totalApplicators;

    // Row background
    if (isComplete) {
      doc.fillColor(REMOVAL_GREEN_LIGHT);
      doc.rect(50, y, tableWidth, rowHeight).fill();
    } else if (index % 2 === 1) {
      doc.fillColor('#f9fafb');
      doc.rect(50, y, tableWidth, rowHeight).fill();
    }

    // Row border
    doc.strokeColor('#e5e7eb').lineWidth(0.5);
    doc.rect(50, y, tableWidth, rowHeight).stroke();

    // Cell content
    doc.fillColor('black').fontSize(9).font('Helvetica');
    let cellX = 50;

    // Group description
    const groupLabel = `${group.totalApplicators} applicator${group.totalApplicators !== 1 ? 's' : ''} x ${group.seedCount} source${group.seedCount !== 1 ? 's' : ''}`;
    doc.text(groupLabel, cellX + 5, y + 9, { width: colWidths[0] - 10 });
    cellX += colWidths[0];

    // Total sources
    doc.text(group.totalSources.toString(), cellX + 5, y + 9, { width: colWidths[1] - 10, align: 'center' });
    cellX += colWidths[1];

    // Removed
    doc.text(group.removedSources.toString(), cellX + 5, y + 9, { width: colWidths[2] - 10, align: 'center' });
    cellX += colWidths[2];

    // Progress bar + percentage
    drawProgressBar(doc, cellX + 5, y + 10, 96, 8, group.progressPercent, { isComplete });
    doc.fillColor('black').fontSize(8);
    doc.text(`${group.progressPercent}%`, cellX + 105, y + 9);
    cellX += colWidths[3];

    // Comment
    doc.fontSize(8).fillColor('black');
    doc.text(group.comment || '-', cellX + 5, y + 9, { width: colWidths[4] - 10 });

    y += rowHeight;
  });

  // Individual seeds row (if applicable)
  if (data.individualSeeds.total > 0) {
    const individualProgress = data.individualSeeds.total > 0
      ? Math.round((data.individualSeeds.removed / data.individualSeeds.total) * 100)
      : 0;
    const isComplete = data.individualSeeds.removed >= data.individualSeeds.total;

    // Row background
    if (isComplete) {
      doc.fillColor(REMOVAL_GREEN_LIGHT);
      doc.rect(50, y, tableWidth, rowHeight).fill();
    }

    // Row border
    doc.strokeColor('#e5e7eb').lineWidth(0.5);
    doc.rect(50, y, tableWidth, rowHeight).stroke();

    doc.fillColor('black').fontSize(9).font('Helvetica');
    let cellX = 50;

    doc.text('Individual sources', cellX + 5, y + 9);
    cellX += colWidths[0];
    doc.text(data.individualSeeds.total.toString(), cellX + 5, y + 9, { width: colWidths[1] - 10, align: 'center' });
    cellX += colWidths[1];
    doc.text(data.individualSeeds.removed.toString(), cellX + 5, y + 9, { width: colWidths[2] - 10, align: 'center' });
    cellX += colWidths[2];

    drawProgressBar(doc, cellX + 5, y + 10, 96, 8, individualProgress, { isComplete, isIndividual: !isComplete });
    doc.fillColor('black').fontSize(8);
    doc.text(`${individualProgress}%`, cellX + 105, y + 9);
    cellX += colWidths[3];

    doc.fontSize(8).text(data.individualSeeds.comment || '-', cellX + 5, y + 9, { width: colWidths[4] - 10 });
    y += rowHeight;
  }

  // Summary footer
  y += 8;
  const totalRemoved = data.summary.totalSourcesRemoved;
  const totalInserted = data.summary.totalSourcesInserted;
  const isAllRemoved = totalRemoved === totalInserted;

  doc.fontSize(11).font('Helvetica-Bold').fillColor(isAllRemoved ? REMOVAL_GREEN : 'black');
  doc.text(`Total: ${totalRemoved} / ${totalInserted} sources removed`, 50, y);

  return y + 20;
}

/**
 * Draw removal procedure form section
 */
function drawRemovalProcedureForm(
  doc: PDFKit.PDFDocument,
  data: RemovalPdfData,
  startY: number
): number {
  let y = startY + 10;

  // Check for page break
  if (y > doc.page.height - 280) {
    doc.addPage();
    y = 50;
  }

  // Section title
  doc.fontSize(14).font('Helvetica-Bold').fillColor('black');
  doc.text('Removal Procedure Form', 50, y);
  y += 25;

  const form = data.procedureForm;

  // General Notes (if present)
  if (form.topGeneralComments) {
    // Draw info box
    doc.fillColor('#eff6ff');
    const boxHeight = Math.min(50, 30 + Math.ceil(form.topGeneralComments.length / 100) * 12);
    doc.roundedRect(50, y, 742, boxHeight, 4).fill();
    doc.strokeColor(REMOVAL_PRIMARY).lineWidth(1).roundedRect(50, y, 742, boxHeight, 4).stroke();

    doc.fontSize(10).font('Helvetica-Bold').fillColor(REMOVAL_PRIMARY);
    doc.text('General Notes:', 60, y + 8);
    doc.font('Helvetica').fillColor('black');
    doc.text(form.topGeneralComments, 60, y + 20, { width: 720 });
    y += boxHeight + 10;
  }

  // Form fields
  doc.fontSize(10).font('Helvetica-Bold').fillColor('black');

  // 1. Date of removal
  doc.text('1. Date of removal procedure:', 50, y);
  doc.font('Helvetica').text(formatDate(form.removalDate, false), 220, y);
  y += 18;

  // 2. Total sources removed
  doc.font('Helvetica-Bold').text('2. Total number of sources removed:', 50, y);
  doc.font('Helvetica').fillColor(GRAY_TEXT).text(`${data.summary.totalSourcesRemoved} (auto-calculated)`, 250, y);
  y += 18;

  // 3. All sources same date
  doc.font('Helvetica-Bold').fillColor('black').text('3. Were all sources removed on the same date?', 50, y);
  const sameDateColor = form.allSourcesSameDate ? REMOVAL_GREEN : REMOVAL_RED;
  doc.font('Helvetica').fillColor(sameDateColor).text(form.allSourcesSameDate ? 'Yes' : 'No', 320, y);
  y += 18;

  // Conditional: additional date + reason
  if (!form.allSourcesSameDate) {
    doc.fillColor('black').font('Helvetica');
    if (form.additionalRemovalDate) {
      doc.text(`   Additional removal date: ${formatDate(form.additionalRemovalDate, false)}`, 60, y);
      y += 16;
    }
    if (form.reasonNotSameDate) {
      doc.text(`   Reason: ${form.reasonNotSameDate}`, 60, y, { width: 680 });
      y += 18;
    }
  }

  // 4. Removed = Inserted check
  y += 5;
  doc.font('Helvetica-Bold').fillColor('black');
  doc.text('4. Is removed equal to inserted?', 50, y);

  const discrepancy = data.discrepancy;
  const statusColor = discrepancy.isRemovedEqualInserted ? REMOVAL_GREEN : REMOVAL_RED;
  const statusIcon = discrepancy.isRemovedEqualInserted ? '✓' : '✗';
  const statusText = discrepancy.isRemovedEqualInserted
    ? 'Yes'
    : `No - ${discrepancy.sourcesNotRemoved} source${discrepancy.sourcesNotRemoved !== 1 ? 's' : ''} not removed`;
  doc.font('Helvetica').fillColor(statusColor).text(`${statusIcon} ${statusText}`, 270, y);
  y += 25;

  // Discrepancy clarification section
  if (!discrepancy.isRemovedEqualInserted && discrepancy.clarification) {
    y = drawDiscrepancySection(doc, discrepancy.clarification, discrepancy.sourcesNotRemoved, y);
  }

  // General comments
  if (form.removalGeneralComments) {
    y += 5;
    doc.font('Helvetica-Bold').fillColor('black');
    doc.text('General comments:', 50, y);
    y += 14;
    doc.font('Helvetica').text(form.removalGeneralComments, 50, y, { width: 700 });
    y += 25;
  }

  return y;
}

/**
 * Draw discrepancy clarification section
 */
function drawDiscrepancySection(
  doc: PDFKit.PDFDocument,
  clarification: DiscrepancyClarification,
  sourcesNotRemoved: number,
  startY: number
): number {
  let y = startY;

  // Warning box header
  doc.fillColor(REMOVAL_AMBER_LIGHT);
  doc.roundedRect(50, y, 742, 35, 4).fill();
  doc.strokeColor(REMOVAL_AMBER_BORDER).lineWidth(1).roundedRect(50, y, 742, 35, 4).stroke();

  doc.fontSize(11).font('Helvetica-Bold').fillColor('#92400e');
  doc.text('! Discrepancy Details', 65, y + 8);
  doc.fontSize(9).font('Helvetica').fillColor('#78350f');
  doc.text(`${sourcesNotRemoved} source${sourcesNotRemoved !== 1 ? 's' : ''} not removed. Clarification below:`, 65, y + 22);
  y += 45;

  // Categories
  const categories = [
    { key: 'lost', label: 'Lost', catData: clarification.lost },
    { key: 'retrievedToSite', label: 'Retrieved to site', catData: clarification.retrievedToSite },
    { key: 'removalFailure', label: 'Removal failure (remained in tissue)', catData: clarification.removalFailure },
    { key: 'other', label: 'Other', catData: clarification.other }
  ];

  doc.fontSize(9).font('Helvetica');
  categories.forEach(cat => {
    if (cat.catData.checked) {
      doc.fillColor('black');
      doc.text(`[X] ${cat.label}:`, 60, y);
      doc.text(`Amount: ${cat.catData.amount}`, 280, y);
      if (cat.catData.comment) {
        doc.text(`Comment: ${cat.catData.comment}`, 380, y, { width: 400 });
      }
      if (cat.key === 'other' && (cat.catData as DiscrepancyOther).description) {
        y += 14;
        doc.text(`   Description: ${(cat.catData as DiscrepancyOther).description}`, 60, y, { width: 680 });
      }
      y += 16;
    }
  });

  // Validation footer
  const totalClarified =
    (clarification.lost.checked ? clarification.lost.amount : 0) +
    (clarification.retrievedToSite.checked ? clarification.retrievedToSite.amount : 0) +
    (clarification.removalFailure.checked ? clarification.removalFailure.amount : 0) +
    (clarification.other.checked ? clarification.other.amount : 0);

  const isValid = totalClarified === sourcesNotRemoved;
  y += 5;
  doc.fillColor(isValid ? REMOVAL_GREEN : REMOVAL_RED).font('Helvetica-Bold');
  doc.text(`Total clarified: ${totalClarified} / ${sourcesNotRemoved}`, 60, y);
  if (!isValid) {
    doc.fillColor(REMOVAL_RED).font('Helvetica');
    doc.text(` - Must equal ${sourcesNotRemoved}`, 200, y);
  }
  y += 20;

  return y;
}

/**
 * Draw removal summary section
 */
function drawRemovalSummary(
  doc: PDFKit.PDFDocument,
  summary: RemovalPdfData['summary'],
  discrepancy: RemovalPdfData['discrepancy'],
  startY: number
): number {
  let y = startY + 10;

  // Check for page break
  if (y > doc.page.height - 120) {
    doc.addPage();
    y = 50;
  }

  // Section title
  doc.fontSize(14).font('Helvetica-Bold').fillColor('black');
  doc.text('Summary', 50, y);
  y += 25;

  // Summary box
  const isComplete = discrepancy.isRemovedEqualInserted;
  const boxColor = isComplete ? '#dcfce7' : '#fef2f2';
  const borderColor = isComplete ? REMOVAL_GREEN : REMOVAL_RED;
  const textColor = isComplete ? '#166534' : '#991b1b';

  doc.fillColor(boxColor);
  doc.roundedRect(50, y, 400, 50, 4).fill();
  doc.strokeColor(borderColor).lineWidth(1).roundedRect(50, y, 400, 50, 4).stroke();

  doc.fontSize(12).font('Helvetica-Bold').fillColor(textColor);
  doc.text(`Total Sources Removed: ${summary.totalSourcesRemoved} / ${summary.totalSourcesInserted}`, 65, y + 12);

  const sumStatusText = isComplete
    ? '✓ All sources accounted for'
    : '✗ Discrepancy - see clarification above';
  doc.fontSize(10).font('Helvetica').text(sumStatusText, 65, y + 32);

  return y + 65;
}

/**
 * Draw signature block for removal PDF
 */
function drawRemovalSignatureBlock(
  doc: PDFKit.PDFDocument,
  signatureDetails: SignatureDetails,
  startY: number
): void {
  let y = startY + 15;

  // Check for page break
  if (y + 110 > doc.page.height - 50) {
    doc.addPage();
    y = 50;
  }

  const signatureTypeText = signatureDetails.type === 'hospital_auto'
    ? 'Hospital User (Auto-signed)'
    : 'Alpha Tau Verified';

  // Signature box
  const boxWidth = 400;
  const boxHeight = 90;
  const boxX = (doc.page.width - boxWidth) / 2;

  doc.strokeColor('#333333').lineWidth(2);
  doc.rect(boxX, y, boxWidth, boxHeight).stroke();

  // Signature header
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#333333');
  doc.text('DOCUMENT DIGITALLY SIGNED', boxX, y + 10, {
    width: boxWidth,
    align: 'center'
  });

  // Signature details
  doc.fontSize(10).font('Helvetica');
  const signatureY = y + 30;
  doc.text(`Signer: ${signatureDetails.signerName}`, boxX + 20, signatureY);
  doc.text(`Position: ${signatureDetails.signerPosition}`, boxX + 20, signatureY + 14);
  doc.text(`Email: ${signatureDetails.signerEmail}`, boxX + 20, signatureY + 28);
  doc.text(`Date: ${formatSignatureDate(signatureDetails.signedAt)}`, boxX + 20, signatureY + 42);

  // Signature type indicator
  doc.fontSize(9).fillColor(signatureDetails.type === 'alphatau_verified' ? '#28a745' : '#6c757d');
  doc.text(`[${signatureTypeText}]`, boxX + 250, signatureY + 14);

  y += boxHeight + 15;

  // Signature footnote
  doc.fontSize(8).fillColor('#666666').font('Helvetica');
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

  // Calculate total seeds inserted
  let totalSeeds = 0;
  fullUseApplicators.forEach(a => {
    totalSeeds += a.seedQuantity;
  });
  faultyApplicators.forEach(a => {
    totalSeeds += a.insertedSeedsQty || 0;
  });

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
        layout: 'landscape',
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

      // Draw all sections
      let yPosition = 110;

      // Header with logo and title
      drawRemovalHeader(doc, yPosition);

      // Treatment Information (4-column grid)
      yPosition = drawRemovalTreatmentInfo(doc, data.treatment, yPosition);

      // Source Removal Tracking Table with progress bars
      yPosition = drawRemovalTrackingTable(doc, data, yPosition);

      // Removal Procedure Form
      yPosition = drawRemovalProcedureForm(doc, data, yPosition);

      // Summary
      yPosition = drawRemovalSummary(doc, data.summary, data.discrepancy, yPosition);

      // Digital Signature Block
      drawRemovalSignatureBlock(doc, signatureDetails, yPosition);

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
