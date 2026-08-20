const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  Header,
  Footer,
  PageNumber,
  ShadingType
} = require('docx');

function parseMarkdownToDocx(mdContent, title, editionColor) {
  const lines = mdContent.split('\n');
  const children = [];

  // Theme colors
  const primaryColor = editionColor === 'bisnis' ? '0D5C3A' : '4338CA'; // Emerald / Indigo
  const accentColor = editionColor === 'bisnis' ? '059669' : '6366F1';
  const tableHeaderBg = editionColor === 'bisnis' ? 'E6F4EA' : 'EEF2FF';
  const calloutBg = 'FEF3C7'; // Amber / Yellow highlight for Image placeholders
  const disclaimerBg = 'FEE2E2'; // Red / Pink highlight for disclaimer

  let inTable = false;
  let tableRows = [];
  let inDisclaimer = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // Check Table
    if (line.startsWith('|') && line.endsWith('|')) {
      // Check if it's separator line |---|---|
      if (/^\|[\s\-:|]+\|$/.test(line)) {
        continue;
      }
      inTable = true;
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      tableRows.push(cells);
      continue;
    } else if (inTable) {
      // Flush table
      if (tableRows.length > 0) {
        children.push(buildTable(tableRows, tableHeaderBg));
        children.push(new Paragraph({ text: '', spacing: { after: 120 } }));
        tableRows = [];
      }
      inTable = false;
    }

    if (!line) {
      children.push(new Paragraph({ text: '', spacing: { after: 80 } }));
      continue;
    }

    // Disclaimer boundary check
    if (line.includes('DISCLAIMER & PEMBERITAHUAN PENTING')) {
      inDisclaimer = true;
    }

    // Image placeholder check
    if (line.startsWith('[GAMBAR:') && line.endsWith(']')) {
      const imgDesc = line.replace(/^\[GAMBAR:\s*/, '').replace(/\]$/, '');
      children.push(buildImagePlaceholderBox(imgDesc));
      children.push(new Paragraph({ text: '', spacing: { after: 120 } }));
      continue;
    }

    // Heading 1
    if (line.startsWith('# ')) {
      const text = line.replace('# ', '').trim();
      children.push(new Paragraph({
        text: text,
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { before: 240, after: 200 },
        run: {
          font: 'Arial',
          size: 36, // 18pt
          bold: true,
          color: primaryColor,
        }
      }));
      continue;
    }

    // Heading 2
    if (line.startsWith('## ')) {
      const text = line.replace('## ', '').trim();
      inDisclaimer = text.includes('DISCLAIMER');
      children.push(new Paragraph({
        text: text,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 360, after: 160 },
        run: {
          font: 'Arial',
          size: 28, // 14pt
          bold: true,
          color: primaryColor,
        }
      }));
      continue;
    }

    // Heading 3
    if (line.startsWith('### ')) {
      const text = line.replace('### ', '').trim();
      children.push(new Paragraph({
        text: text,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 120 },
        run: {
          font: 'Arial',
          size: 24, // 12pt
          bold: true,
          color: accentColor,
        }
      }));
      continue;
    }

    // Blockquote / Alerts (> ...)
    if (line.startsWith('> ')) {
      const text = line.replace('> ', '').trim();
      children.push(buildQuoteBox(text));
      continue;
    }

    // Bullet points
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const text = line.replace(/^[-*]\s+/, '').trim();
      children.push(new Paragraph({
        children: parseFormattedText(text),
        bullet: { level: 0 },
        spacing: { after: 60 }
      }));
      continue;
    }

    // Numbered list
    if (/^\d+\.\s+/.test(line)) {
      const text = line.replace(/^\d+\.\s+/, '').trim();
      children.push(new Paragraph({
        children: parseFormattedText(text),
        bullet: { level: 0 },
        spacing: { after: 60 }
      }));
      continue;
    }

    // Code block marker
    if (line.startsWith('```')) {
      continue;
    }

    // Regular paragraph
    children.push(new Paragraph({
      children: parseFormattedText(line),
      spacing: { after: 100 },
    }));
  }

  // End of file table check
  if (inTable && tableRows.length > 0) {
    children.push(buildTable(tableRows, tableHeaderBg));
  }

  return new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Arial',
            size: 22, // 11pt
            color: '1F2937', // zinc-800
          },
          paragraph: {
            spacing: { line: 276, before: 0, after: 100 }, // 1.15 line spacing
          }
        }
      }
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              bottom: 1440,
              left: 1440,
              right: 1440,
            }
          }
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: title,
                    font: 'Arial',
                    size: 16, // 8pt
                    color: '9CA3AF',
                    italics: true,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'Halaman ',
                    font: 'Arial',
                    size: 18,
                    color: '6B7280',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: 'Arial',
                    size: 18,
                    color: '6B7280',
                  }),
                  new TextRun({
                    text: ' dari ',
                    font: 'Arial',
                    size: 18,
                    color: '6B7280',
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    font: 'Arial',
                    size: 18,
                    color: '6B7280',
                  }),
                ],
              }),
            ],
          }),
        },
        children: children,
      },
    ],
  });
}

function parseFormattedText(text) {
  const runs = [];
  // Regex for bold **text** or code `text` or normal text
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);

  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith('**') && part.endsWith('**')) {
      runs.push(new TextRun({
        text: part.slice(2, -2),
        bold: true,
        font: 'Arial',
      }));
    } else if (part.startsWith('`') && part.endsWith('`')) {
      runs.push(new TextRun({
        text: part.slice(1, -1),
        font: 'Consolas',
        size: 20,
        color: 'BE185D', // Pink-700 for inline code
        shading: {
          type: ShadingType.CLEAR,
          fill: 'F3F4F6',
        }
      }));
    } else {
      runs.push(new TextRun({
        text: part,
        font: 'Arial',
      }));
    }
  }

  return runs;
}

function buildTable(rows, headerBg) {
  const docxRows = rows.map((row, rIndex) => {
    const isHeader = rIndex === 0;
    return new TableRow({
      tableHeader: isHeader,
      children: row.map(cellText => {
        return new TableCell({
          width: {
            size: Math.floor(9000 / row.length),
            type: WidthType.DXA,
          },
          shading: isHeader ? {
            type: ShadingType.CLEAR,
            fill: headerBg,
          } : undefined,
          margins: {
            top: 120,
            bottom: 120,
            left: 150,
            right: 150,
          },
          children: [
            new Paragraph({
              children: parseFormattedText(cellText),
              alignment: AlignmentType.LEFT,
              run: {
                bold: isHeader,
                font: 'Arial',
                size: 20,
              }
            })
          ]
        });
      })
    });
  });

  return new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
      left: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
      right: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'E5E7EB' },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: 'E5E7EB' },
    },
    rows: docxRows,
  });
}

function buildImagePlaceholderBox(desc) {
  return new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    borders: {
      top: { style: BorderStyle.DASHED, size: 8, color: 'F59E0B' },
      bottom: { style: BorderStyle.DASHED, size: 8, color: 'F59E0B' },
      left: { style: BorderStyle.DASHED, size: 8, color: 'F59E0B' },
      right: { style: BorderStyle.DASHED, size: 8, color: 'F59E0B' },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: {
              type: ShadingType.CLEAR,
              fill: 'FEF3C7', // Amber-100
            },
            margins: {
              top: 180,
              bottom: 180,
              left: 200,
              right: 200,
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: '📸 TEMPAT MENARUH GAMBAR / SCREENSHOT',
                    bold: true,
                    color: 'B45309', // Amber-700
                    font: 'Arial',
                    size: 22,
                  }),
                ],
                spacing: { after: 60 }
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: desc,
                    italics: true,
                    color: '78350F', // Amber-900
                    font: 'Arial',
                    size: 20,
                  }),
                ]
              })
            ]
          })
        ]
      })
    ]
  });
}

function buildQuoteBox(text) {
  return new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      left: { style: BorderStyle.SINGLE, size: 16, color: '3B82F6' }, // Blue left border
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: {
              type: ShadingType.CLEAR,
              fill: 'F0F9FF', // Sky-50
            },
            margins: {
              top: 100,
              bottom: 100,
              left: 150,
              right: 150,
            },
            children: [
              new Paragraph({
                children: parseFormattedText(text),
                spacing: { after: 0 }
              })
            ]
          })
        ]
      })
    ]
  });
}

async function main() {
  console.log('Generating Word Documents (.docx)...');

  // 1. Bisnis
  const mdBisnisPath = path.join(__dirname, '../docs/buku-panduan-bisnis.md');
  const mdBisnis = fs.readFileSync(mdBisnisPath, 'utf8');
  const docBisnis = parseMarkdownToDocx(mdBisnis, 'Buku Panduan WA Bot Bisnis AI', 'bisnis');
  const outBisnisPath = path.join(__dirname, '../docs/Buku_Panduan_Lengkap_WA_Bot_Bisnis_AI.docx');
  const bufferBisnis = await Packer.toBuffer(docBisnis);
  fs.writeFileSync(outBisnisPath, bufferBisnis);
  console.log(`✅ File Bisnis berhasil dibuat: ${outBisnisPath}`);

  // 2. Personal
  const mdPersonalPath = path.join(__dirname, '../docs/buku-panduan-personal.md');
  const mdPersonal = fs.readFileSync(mdPersonalPath, 'utf8');
  const docPersonal = parseMarkdownToDocx(mdPersonal, 'Buku Panduan WA Asisten Pribadi AI', 'personal');
  const outPersonalPath = path.join(__dirname, '../docs/Buku_Panduan_Lengkap_WA_Asisten_Pribadi_AI.docx');
  const bufferPersonal = await Packer.toBuffer(docPersonal);
  fs.writeFileSync(outPersonalPath, bufferPersonal);
  console.log(`✅ File Personal berhasil dibuat: ${outPersonalPath}`);
}

main().catch(err => {
  console.error('Error generating docx:', err);
  process.exit(1);
});
