import type { ReportSnapshot, ReportTable } from "./contracts";
import { assertReportBudget, displayCell, downloadFile, reportFilename, scopeLabel } from "./files";

export async function createPdf(snapshot: ReportSnapshot): Promise<Uint8Array> {
  assertReportBudget(snapshot);
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const wide = snapshot.sections.some(section => section.tables.some(table => table.columns.length > 6));
  const doc = new jsPDF({ orientation: wide ? "landscape" : "portrait", unit: "pt", format: "a4", compress: true });
  doc.setProperties({ title: snapshot.title, subject: `${scopeLabel(snapshot.scope)} report`, creator: "Conveners desk", author: "Conveners desk" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const left = 40;
  const top = 54;
  const bottom = pageHeight - 44;
  const contentWidth = pageWidth - left * 2;
  let y = top;

  function space(height: number): void {
    if (y + height > bottom) { doc.addPage(); y = top; }
  }

  function paragraph(value: string, size = 10, bold = false): void {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(21, 51, 74);
    const lines: string[] = doc.splitTextToSize(value || " ", contentWidth);
    const lineHeight = size * 1.35;
    for (const line of lines) {
      space(lineHeight);
      doc.text(line, left, y + size);
      y += lineHeight;
    }
    y += 6;
  }

  function table(table: ReportTable, sectionTitle: string): void {
    const maxColumns = wide ? 8 : 6;
    const bands: number[][] = [];
    if (table.columns.length <= maxColumns) bands.push(table.columns.map((_, i) => i));
    else for (let start = 1; start < table.columns.length; start += maxColumns - 1) {
      bands.push([0, ...table.columns.slice(start, start + maxColumns - 1).map((_, i) => start + i)]);
    }
    for (const [bandIndex, indices] of bands.entries()) {
      const heading = `${sectionTitle} / ${table.title}${bands.length > 1 ? ` (column group ${bandIndex + 1} of ${bands.length}; first column repeated)` : ""}`;
      space(85);
      autoTable(doc, {
        startY: y,
        margin: { top, bottom: 44, left, right: left },
        tableWidth: contentWidth,
        head: [
          [{ content: heading, colSpan: indices.length }],
          indices.map(index => table.columns[index].label),
        ],
        body: table.rows.length
          ? table.rows.map(row => indices.map(index => displayCell(row[index], table.columns[index])))
          : [[{ content: "No rows for the selected filters.", colSpan: indices.length }]],
        theme: "grid",
        showHead: "everyPage",
        rowPageBreak: "auto",
        styles: {
          font: "helvetica", fontSize: 9, cellPadding: 5, overflow: "linebreak",
          textColor: [21, 51, 74], lineColor: [216, 228, 233], lineWidth: 0.4,
          valign: "top", cellWidth: contentWidth / indices.length,
        },
        headStyles: { fillColor: [20, 125, 128], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [244, 249, 250] },
        didParseCell(data) {
          if (data.section === "head" && data.row.index === 0) data.cell.styles.fillColor = [21, 51, 74];
        },
      });
      y = (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
    }
  }

  paragraph(snapshot.title, 22, true);
  paragraph(`Scope: ${scopeLabel(snapshot.scope)}`, 11, true);
  paragraph(`Generated at: ${snapshot.generatedAt}`);
  if (snapshot.filters.length) {
    paragraph("Filters", 11, true);
    snapshot.filters.forEach(filter => paragraph(filter));
  } else paragraph("Filters: none");
  paragraph("Unavailable values are not zero. Percentages use numeric fractions (0.5 = 50%).", 9);
  for (const section of snapshot.sections) {
    space(50);
    paragraph(section.title, 16, true);
    section.notes.forEach(note => paragraph(`Note: ${note}`));
    if (snapshot.showTables) for (const item of section.tables) table(item, section.title);
    if (snapshot.showCharts) for (const chart of section.charts) {
      space(65);
      paragraph(chart.title, 12, true);
      chart.notes.forEach(note => paragraph(`Chart note: ${note}`));
      if (typeof document !== "undefined" && typeof Image !== "undefined") {
        const { chartPng } = await import("./chart-image");
        const blob = await chartPng(chart, snapshot);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const properties = doc.getImageProperties(bytes);
        const availableHeight = bottom - top;
        const scale = Math.min(contentWidth / properties.width, availableHeight / properties.height);
        const width = properties.width * scale;
        const height = properties.height * scale;
        // Tall full-data charts are tiled over pages at a readable width, not shrunk to one page.
        const readableScale = contentWidth / properties.width;
        const fullHeight = properties.height * readableScale;
        if (height === fullHeight || fullHeight <= availableHeight) {
          space(height + 12);
          doc.addImage(bytes, "PNG", left, y, width, height);
          y += height + 16;
        } else {
          // A PDF clipping region keeps every part of a tall image, without DOM capture.
          let consumed = 0;
          while (consumed < fullHeight) {
            space(80);
            const sliceHeight = Math.min(bottom - y, fullHeight - consumed);
            doc.saveGraphicsState();
            doc.rect(left, y, contentWidth, sliceHeight);
            doc.clip();
            doc.discardPath();
            doc.addImage(bytes, "PNG", left, y - consumed, contentWidth, fullHeight);
            doc.restoreGraphicsState();
            consumed += sliceHeight;
            y += sliceHeight + 12;
            if (consumed < fullHeight) { doc.addPage(); y = top; }
          }
        }
      } else {
        paragraph("Chart source data (image rendering requires a browser).", 9);
        table({
          id: chart.id,
          title: chart.title,
          columns: [{ label: "Category" }, ...chart.series.map(series => ({ label: series.name, type: chart.percent ? "percent" as const : "number" as const }))],
          rows: chart.labels.map((label, i) => [label, ...chart.series.map(series => series.values[i])]),
        }, section.title);
      }
    }
  }
  const count = doc.getNumberOfPages();
  for (let page = 1; page <= count; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(82, 105, 118);
    doc.text(`Conveners desk | ${scopeLabel(snapshot.scope)}`, left, 28);
    doc.setDrawColor(216, 228, 233);
    doc.line(left, pageHeight - 33, pageWidth - left, pageHeight - 33);
    doc.text(`Page ${page} of ${count}`, pageWidth - left, pageHeight - 19, { align: "right" });
  }
  return new Uint8Array(doc.output("arraybuffer"));
}

export async function downloadPdf(snapshot: ReportSnapshot): Promise<void> {
  const bytes = await createPdf(snapshot);
  downloadFile(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), reportFilename(snapshot.title, "pdf"));
}
