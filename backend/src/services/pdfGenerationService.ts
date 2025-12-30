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
      height: rowHeight - cellPadding * 2,
      ellipsis: true
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

    // Draw cell text
    doc.fillColor('black');
    let cellX = startX;
    row.forEach((cell, i) => {
      // Don't truncate Serial (0) and Catalog (1) columns - they must show full values
      const noEllipsis = i === 0 || i === 1;
      doc.text(cell, cellX + cellPadding, currentY + cellPadding, {
        width: columnWidths[i] - cellPadding * 2,
        height: rowHeight - cellPadding * 2,
        ellipsis: !noEllipsis
      });
      cellX += columnWidths[i];
    });

    currentY += rowHeight;
  });

  return currentY;
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
 */
export async function generateTreatmentPdf(
  treatment: Treatment,
  applicators: Applicator[],
  signatureDetails: SignatureDetails
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
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

      // ===== TREATMENT INFORMATION =====
      let yPosition = 110;
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
      // Available width for content (A4 = 595pt, margins 50pt each side = 495pt usable)
      const CONTENT_WIDTH = 495;

      // Column configurations with minimum widths and flex weights
      // Catalog column increased for full PARTNAME values like "FLEX-00101-FG"
      const columnConfig = [
        { minWidth: 45, flex: 1.0 },   // Serial
        { minWidth: 85, flex: 1.5 },   // Catalog - increased from 50/1.1 for full values
        { minWidth: 65, flex: 1.1 },   // Type - reduced from 75/1.4
        { minWidth: 25, flex: 0.5 },   // Seeds
        { minWidth: 28, flex: 0.5 },   // Length
        { minWidth: 50, flex: 0.9 },   // Time
        { minWidth: 35, flex: 0.6 },   // Usage
        { minWidth: 32, flex: 0.5 },   // Inserted
        { minWidth: 45, flex: 0.9 }    // Comments - reduced from 55/1.3
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

export default {
  generateTreatmentPdf,
  calculateSummary
};
