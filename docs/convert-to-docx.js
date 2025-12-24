/**
 * Convert ALA_SRS.md to Word Document
 * Usage: node docs/convert-to-docx.js
 */

const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType } = require('docx');
const { marked } = require('marked');

// Read the markdown file
const mdPath = path.join(__dirname, 'ALA_SRS.md');
const markdown = fs.readFileSync(mdPath, 'utf-8');

// Parse markdown into tokens
const tokens = marked.lexer(markdown);

// Convert tokens to docx elements
const children = [];

function parseInlineText(text) {
    // Simple inline parsing for bold and code
    const runs = [];
    let remaining = text;

    while (remaining.length > 0) {
        // Check for bold
        const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
        if (boldMatch && remaining.indexOf(boldMatch[0]) === 0) {
            runs.push(new TextRun({ text: boldMatch[1], bold: true }));
            remaining = remaining.slice(boldMatch[0].length);
            continue;
        }

        // Check for inline code
        const codeMatch = remaining.match(/`([^`]+)`/);
        if (codeMatch && remaining.indexOf(codeMatch[0]) === 0) {
            runs.push(new TextRun({ text: codeMatch[1], font: 'Courier New', size: 20 }));
            remaining = remaining.slice(codeMatch[0].length);
            continue;
        }

        // Find next special character
        const nextBold = remaining.indexOf('**');
        const nextCode = remaining.indexOf('`');
        let nextSpecial = remaining.length;
        if (nextBold > 0) nextSpecial = Math.min(nextSpecial, nextBold);
        if (nextCode > 0) nextSpecial = Math.min(nextSpecial, nextCode);

        if (nextSpecial > 0) {
            runs.push(new TextRun({ text: remaining.slice(0, nextSpecial) }));
            remaining = remaining.slice(nextSpecial);
        } else {
            runs.push(new TextRun({ text: remaining }));
            break;
        }
    }

    return runs.length > 0 ? runs : [new TextRun({ text })];
}

function processToken(token) {
    switch (token.type) {
        case 'heading':
            const headingLevel = {
                1: HeadingLevel.HEADING_1,
                2: HeadingLevel.HEADING_2,
                3: HeadingLevel.HEADING_3,
                4: HeadingLevel.HEADING_4,
                5: HeadingLevel.HEADING_5,
                6: HeadingLevel.HEADING_6,
            }[token.depth] || HeadingLevel.HEADING_1;

            children.push(new Paragraph({
                text: token.text,
                heading: headingLevel,
                spacing: { before: 240, after: 120 },
            }));
            break;

        case 'paragraph':
            children.push(new Paragraph({
                children: parseInlineText(token.text),
                spacing: { after: 120 },
            }));
            break;

        case 'list':
            token.items.forEach((item, index) => {
                children.push(new Paragraph({
                    children: parseInlineText(item.text),
                    bullet: token.ordered ? undefined : { level: 0 },
                    numbering: token.ordered ? { reference: 'default-numbering', level: 0 } : undefined,
                    spacing: { after: 60 },
                }));
            });
            break;

        case 'table':
            const tableRows = [];

            // Header row
            if (token.header && token.header.length > 0) {
                tableRows.push(new TableRow({
                    tableHeader: true,
                    children: token.header.map(cell => new TableCell({
                        children: [new Paragraph({
                            children: [new TextRun({ text: cell.text, bold: true })],
                        })],
                        shading: { fill: 'E0E0E0' },
                    })),
                }));
            }

            // Data rows
            if (token.rows) {
                token.rows.forEach(row => {
                    tableRows.push(new TableRow({
                        children: row.map(cell => new TableCell({
                            children: [new Paragraph({
                                children: parseInlineText(cell.text),
                            })],
                        })),
                    }));
                });
            }

            if (tableRows.length > 0) {
                children.push(new Table({
                    rows: tableRows,
                    width: { size: 100, type: WidthType.PERCENTAGE },
                }));
                children.push(new Paragraph({ text: '' })); // Spacer
            }
            break;

        case 'code':
            // Code block
            const codeLines = token.text.split('\n');
            codeLines.forEach(line => {
                children.push(new Paragraph({
                    children: [new TextRun({
                        text: line || ' ',
                        font: 'Courier New',
                        size: 18,
                    })],
                    shading: { fill: 'F5F5F5' },
                    spacing: { after: 0 },
                }));
            });
            children.push(new Paragraph({ text: '' })); // Spacer
            break;

        case 'hr':
            children.push(new Paragraph({
                text: '',
                border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '999999' } },
                spacing: { before: 120, after: 120 },
            }));
            break;

        case 'space':
            // Skip
            break;

        default:
            // For any unhandled token types, try to extract text
            if (token.text) {
                children.push(new Paragraph({
                    children: parseInlineText(token.text),
                    spacing: { after: 120 },
                }));
            }
    }
}

// Process all tokens
tokens.forEach(processToken);

// Create document
const doc = new Document({
    title: 'ALA Software Requirements Specification',
    description: 'Software Requirements Specification for Accountability Log Application',
    creator: 'Alpha Tau Medical',
    sections: [{
        properties: {},
        children: children,
    }],
});

// Generate and save
const outputPath = path.join(__dirname, 'ALA_SRS.docx');
Packer.toBuffer(doc).then(buffer => {
    fs.writeFileSync(outputPath, buffer);
    console.log(`Word document created: ${outputPath}`);
}).catch(err => {
    console.error('Error creating document:', err);
    process.exit(1);
});
