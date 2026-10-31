import type { Cell, Column, ReportSnapshot } from "./contracts";
import { assertReportBudget, downloadFile, reportFilename, scopeLabel } from "./files";

function worksheetName(title: string, used: Set<string>): string {
  const base = title.replace(/[\u0000-\u001f\u007f[\]*?:/\\]/g, " ").trim().replace(/^'+|'+$/g, "").trim() || "Data";
  let name = base.slice(0, 31).replace(/'+$/g, "") || "Data";
  let suffix = 1;
  while (used.has(name.toLocaleLowerCase("en-US")) || name.toLowerCase() === "history") {
    const tail = ` (${++suffix})`;
    name = `${base.slice(0, 31 - tail.length).replace(/'+$/g, "")}${tail}`;
  }
  used.add(name.toLocaleLowerCase("en-US"));
  return name;
}

function typedValue(value: Cell, column: Column): Cell | Date {
  if (typeof value === "string" && column.type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value) return date;
  }
  return value;
}

export async function createWorkbook(snapshot: ReportSnapshot): Promise<Uint8Array> {
  assertReportBudget(snapshot);
  const { default: ExcelJS } = await import("exceljs");
  const book = new ExcelJS.Workbook();
  book.creator = "Conveners desk";
  book.title = snapshot.title;
  book.subject = `${scopeLabel(snapshot.scope)} report`;
  const generated = new Date(snapshot.generatedAt);
  if (Number.isFinite(generated.getTime())) book.created = generated;
  const used = new Set(["metadata"]);
  const metadata = book.addWorksheet("Metadata");
  metadata.columns = [{ width: 25 }, { width: 100 }];
  metadata.addRows([
    ["Report", snapshot.title],
    ["Scope", scopeLabel(snapshot.scope)],
    ["Generated at", Number.isFinite(generated.getTime()) ? generated : snapshot.generatedAt],
    ["Filters", snapshot.filters.length ? "Listed below" : "None"],
    ["Missing values", "Blank cells represent unavailable data, not zero."],
    ["Percentages", "Numeric fractions stored with percentage formatting."],
    ["Chart previews", snapshot.showCharts ? "Included as complete source-data worksheets" : "Not requested"],
  ]);
  snapshot.filters.forEach(filter => metadata.addRow(["Filter", filter]));
  metadata.getCell("B3").numFmt = "yyyy-mm-dd hh:mm:ss";
  let index = 0;
  for (const section of snapshot.sections) {
    metadata.addRow(["Section", section.title]);
    section.notes.forEach(note => metadata.addRow(["Note", note]));
    for (const table of section.tables) {
      const sheet = book.addWorksheet(worksheetName(table.title, used));
      metadata.addRow(["Table", `${section.title}: ${table.title} [${sheet.name}]`]);
      sheet.addRow(table.columns.map(column => column.label));
      for (const row of table.rows) sheet.addRow(row.map((cell, i) => typedValue(cell, table.columns[i])));
      sheet.columns.forEach((column, i) => {
        column.width = Math.min(60, Math.max(14, table.columns[i].label.length + 3));
        if (table.columns[i].type === "percent") column.numFmt = "0.00%";
        else if (table.columns[i].type === "date") column.numFmt = "yyyy-mm-dd";
        else if (table.columns[i].type === "number") column.numFmt = "0.##########";
      });
      sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: table.columns.length } };
      sheet.views = [{ state: "frozen", ySplit: 1 }];
      sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF15334A" } };
      sheet.eachRow(row => { row.alignment = { vertical: "top", wrapText: true }; });
      index++;
    }
    if (snapshot.showCharts) for (const chart of section.charts) {
      const sheet = book.addWorksheet(worksheetName(`${chart.title} chart`, used));
      metadata.addRow(["Chart data", `${chart.title} [${sheet.name}]`]);
      chart.notes.forEach(note => metadata.addRow(["Chart note", note]));
      sheet.addRow(["Category", ...chart.series.map(series => series.name)]);
      chart.labels.forEach((label, i) => sheet.addRow([label, ...chart.series.map(series => series.values[i])]));
      sheet.columns.forEach((column, i) => { column.width = i === 0 ? 45 : 24; if (i && chart.percent) column.numFmt = "0.00%"; });
      sheet.views = [{ state: "frozen", ySplit: 1 }];
      sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF15334A" } };
      sheet.eachRow(row => { row.alignment = { vertical: "top", wrapText: true }; });
    }
  }
  if (!index) metadata.addRow(["Tables", "No tabular data in this report."]);
  metadata.getColumn(1).font = { bold: true, color: { argb: "FF15334A" } };
  metadata.eachRow(row => { row.alignment = { vertical: "top", wrapText: true }; });
  const buffer = await book.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

export async function downloadExcel(snapshot: ReportSnapshot): Promise<void> {
  const bytes = await createWorkbook(snapshot);
  downloadFile(new Blob([new Uint8Array(bytes)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), reportFilename(snapshot.title, "xlsx"));
}
