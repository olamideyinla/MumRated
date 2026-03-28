import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'

export interface PdfSection {
  title: string
  headers: string[]
  rows: string[][]
  note?: string
}

export interface PdfReportOptions {
  title: string
  subtitle?: string
  dateRange?: string
  farmName: string
  sections: PdfSection[]
}

export function buildPdf(options: PdfReportOptions): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const margin = 14
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = margin

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.setFillColor(45, 106, 79) // primary green
  doc.rect(0, 0, pageWidth, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(options.farmName, margin, 12)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(options.title, margin, 20)
  if (options.dateRange) {
    doc.setFontSize(9)
    doc.text(options.dateRange, pageWidth - margin, 20, { align: 'right' })
  }
  doc.setTextColor(0, 0, 0)
  y = 36

  // ── Subtitle ────────────────────────────────────────────────────────────────
  if (options.subtitle) {
    doc.setFontSize(9)
    doc.setTextColor(100, 100, 100)
    doc.text(options.subtitle, margin, y)
    y += 6
  }

  // ── Sections ────────────────────────────────────────────────────────────────
  for (const section of options.sections) {
    if (y > 260) { doc.addPage(); y = margin }

    // Section title
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(45, 106, 79)
    doc.text(section.title.toUpperCase(), margin, y)
    doc.setDrawColor(45, 106, 79)
    doc.line(margin, y + 1, pageWidth - margin, y + 1)
    y += 6
    doc.setTextColor(0, 0, 0)

    // Table
    if (section.rows.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [section.headers],
        body: section.rows,
        margin: { left: margin, right: margin },
        headStyles: { fillColor: [45, 106, 79], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [240, 248, 244] },
        didDrawPage: (data) => { y = data.cursor?.y ?? y },
      })
      y = (doc as any).lastAutoTable.finalY + 4
    }

    if (section.note) {
      doc.setFontSize(8)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(120, 120, 120)
      doc.text(section.note, margin, y)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 0, 0)
      y += 5
    }

    y += 4
  }

  // ── Footer on all pages ──────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `AgriManagerX  •  Generated ${format(new Date(), 'dd MMM yyyy HH:mm')}  •  Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 6,
      { align: 'center' }
    )
  }

  return doc
}

export function downloadPdf(filename: string, options: PdfReportOptions): void {
  const doc = buildPdf(options)
  doc.save(filename)
}
