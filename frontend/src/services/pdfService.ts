import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

// PDF Document Configuration
const PDF_DOCUMENT_NUMBER = 'QSR-4001-01-E';
const PDF_VERSION = 'V.01';

interface Treatment {
  id: string;
  type: 'insertion' | 'removal' | 'pancreas_insertion' | 'prostate_insertion' | 'skin_insertion';
  subjectId: string;
  site: string;
  date: string;
  surgeon?: string;
  activityPerSeed?: number;
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


export class PDFService {
  static generateTreatmentReport(
    treatment: Treatment,
    processedApplicators: Applicator[],
    summary: TreatmentSummary
  ): void {
    const doc = new jsPDF();
    
    // Set font
    doc.setFont('helvetica');

    // Header with Document Number and Version
    doc.setFontSize(10);
    doc.text(PDF_DOCUMENT_NUMBER, 105, 15, { align: 'center' });

    doc.setFontSize(8);
    doc.text(PDF_VERSION, 105, 20, { align: 'center' });

    doc.setFontSize(20);
    doc.text('Medical Treatment Report', 105, 32, { align: 'center' });

    doc.setFontSize(12);
    doc.text(`Generated: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 105, 42, { align: 'center' });

    // Treatment Information Section
    let yPosition = 58;
    doc.setFontSize(16);
    doc.text('Treatment Information', 20, yPosition);
    yPosition += 10;
    
    doc.setFontSize(12);
    const treatmentInfo = [
      ['Patient ID:', treatment.patientName || treatment.subjectId],
      ['Site:', treatment.site],
      ['Treatment Type:', treatment.type.charAt(0).toUpperCase() + treatment.type.slice(1)],
      ['Treatment Date:', treatment.date],
      ['Surgeon:', treatment.surgeon || 'N/A']
    ];
    
    treatmentInfo.forEach(([label, value]) => {
      doc.text(label, 20, yPosition);
      doc.text(value, 80, yPosition);
      yPosition += 8;
    });
    
    // Processed Applicators Table
    yPosition += 10;
    doc.setFontSize(16);
    doc.text('Processed Applicators', 20, yPosition);
    yPosition += 5;
    
    const tableData = processedApplicators
      .sort((a, b) => b.seedQuantity - a.seedQuantity)
      .map(applicator => [
        applicator.serialNumber,
        applicator.applicatorType || 'N/A',
        applicator.seedQuantity.toString(),
        applicator.insertionTime && !isNaN(new Date(applicator.insertionTime).getTime()) 
          ? format(new Date(applicator.insertionTime), 'dd.MM.yyyy HH:mm')
          : 'N/A',
        applicator.usageType === 'full' ? 'Full use' 
          : applicator.usageType === 'faulty' ? 'Faulty' 
          : 'No Use',
        applicator.usageType === 'full' 
          ? applicator.seedQuantity.toString()
          : applicator.usageType === 'faulty'
          ? (applicator.insertedSeedsQty || 0).toString()
          : '0',
        applicator.comments || '-'
      ]);
    
    autoTable(doc, {
      startY: yPosition + 5,
      head: [['Serial Number', 'Type', 'Seeds Qty', 'Time', 'Usage Type', 'Inserted Seeds', 'Comments']],
      body: tableData,
      styles: {
        fontSize: 10,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [66, 139, 202],
        textColor: 255,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      columnStyles: {
        0: { cellWidth: 25 }, // Serial Number
        1: { cellWidth: 20 }, // Type
        2: { cellWidth: 15 }, // Seeds Qty
        3: { cellWidth: 25 }, // Time
        4: { cellWidth: 20 }, // Usage Type
        5: { cellWidth: 15 }, // Inserted Seeds
        6: { cellWidth: 30 }, // Comments
      },
      margin: { left: 20, right: 20 },
    });
    
    // Treatment Summary Section
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    
    // Check if we need a new page for the summary
    const pageHeight = doc.internal.pageSize.height;
    let summaryY;
    if (finalY + 80 > pageHeight - 40) { // 80 for summary content + 40 for margins/footer
      doc.addPage();
      doc.setFontSize(16);
      doc.text('Treatment Summary', 20, 30);
      summaryY = 40;
    } else {
      doc.setFontSize(16);
      doc.text('Treatment Summary', 20, finalY);
      summaryY = finalY + 10;
    }
    
    doc.setFontSize(12);
    
    // Summary data as table to prevent text overlap
    const summaryTableData = [
      [
        'Time Treatment Started:', 
        summary.timeInsertionStarted && !isNaN(new Date(summary.timeInsertionStarted).getTime())
          ? format(new Date(summary.timeInsertionStarted), 'dd.MM.yyyy HH:mm')
          : 'N/A',
        'Total Seeds Inserted:', 
        summary.totalDartSeedsInserted.toString()
      ],
      [
        'Total Applicators Used:', 
        summary.totalApplicatorUse.toString(),
        'Total Activity:', 
        `${summary.totalActivity.toFixed(2)} µCi`
      ],
      [
        'Faulty Applicators:', 
        summary.faultyApplicator.toString(),
        'Seeds Inserted By:', 
        summary.seedsInsertedBy
      ],
      [
        'Not Used Applicators:', 
        summary.notUsedApplicators.toString(),
        '', 
        ''
      ]
    ];

    autoTable(doc, {
      startY: summaryY,
      body: summaryTableData,
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 45 }, // Left labels
        1: { cellWidth: 45 }, // Left values
        2: { fontStyle: 'bold', cellWidth: 45 }, // Right labels
        3: { cellWidth: 45 } // Right values
      },
      styles: {
        fontSize: 11,
        cellPadding: 3,
      },
      theme: 'plain', // No borders or background
      margin: { left: 20, right: 20 },
    });
    
    // Footer
    doc.setFontSize(10);
    doc.text('Generated by Accountability Log Application', 105, doc.internal.pageSize.height - 20, { align: 'center' });
    
    // Generate filename with patient ID and timestamp
    const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
    const filename = `Treatment_Report_${treatment.patientName || treatment.subjectId}_${timestamp}.pdf`;
    
    // Download the PDF
    doc.save(filename);
  }
  
  static generateApplicatorReport(applicators: Applicator[]): void {
    const doc = new jsPDF();
    
    // Set font
    doc.setFont('helvetica');
    
    // Header
    doc.setFontSize(20);
    doc.text('Applicator Report', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Generated: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 105, 30, { align: 'center' });
    
    // Applicators Table
    const yPosition = 50;
    const tableData = applicators
      .sort((a, b) => b.seedQuantity - a.seedQuantity)
      .map(applicator => [
        applicator.serialNumber,
        applicator.applicatorType || 'N/A',
        applicator.seedQuantity.toString(),
        applicator.insertionTime && !isNaN(new Date(applicator.insertionTime).getTime()) 
          ? format(new Date(applicator.insertionTime), 'dd.MM.yyyy HH:mm')
          : 'N/A',
        applicator.usageType === 'full' ? 'Full use' 
          : applicator.usageType === 'faulty' ? 'Faulty' 
          : 'No Use',
        applicator.usageType === 'full' 
          ? applicator.seedQuantity.toString()
          : applicator.usageType === 'faulty'
          ? (applicator.insertedSeedsQty || 0).toString()
          : '0',
        applicator.comments || '-'
      ]);
    
    autoTable(doc, {
      startY: yPosition,
      head: [['Serial Number', 'Type', 'Seeds Qty', 'Time', 'Usage Type', 'Inserted Seeds', 'Comments']],
      body: tableData,
      styles: {
        fontSize: 10,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [66, 139, 202],
        textColor: 255,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      columnStyles: {
        0: { cellWidth: 25 }, // Serial Number
        1: { cellWidth: 20 }, // Type
        2: { cellWidth: 15 }, // Seeds Qty
        3: { cellWidth: 25 }, // Time
        4: { cellWidth: 20 }, // Usage Type
        5: { cellWidth: 15 }, // Inserted Seeds
        6: { cellWidth: 30 }, // Comments
      },
      margin: { left: 20, right: 20 },
    });
    
    // Footer
    doc.setFontSize(10);
    doc.text('Generated by Accountability Log Application', 105, doc.internal.pageSize.height - 20, { align: 'center' });
    
    // Generate filename with timestamp
    const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
    const filename = `Applicator_Report_${timestamp}.pdf`;
    
    // Download the PDF
    doc.save(filename);
  }
}