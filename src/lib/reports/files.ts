import type { Cell, Column, ReportSnapshot, ReportTable } from "./contracts";

export const MAX_REPORT_ROWS = 20_000;
const MAX_REPORT_CELLS = 250_000;
const MAX_TEXT_LENGTH = 32_767;

/** Export limits fail explicitly: data is never silently clipped to fit a file. */
export function assertTableBudget(table: ReportTable): void {
  if (!table.columns.length || table.columns.length > 100) {
    throw new Error("Report tables must have between 1 and 100 columns.");
  }
  if (table.rows.length > MAX_REPORT_ROWS || table.rows.length * table.columns.length > MAX_REPORT_CELLS) {
    throw new Error("Report exceeds the export budget (20,000 rows or 250,000 cells). Narrow the filters.");
  }
  let textLength = 0;
  for (const column of table.columns) { assertText(column.label); textLength += column.label.length; }
  for (const row of table.rows) {
    if (row.length !== table.columns.length) throw new Error(`Table "${table.title}" has an invalid row width.`);
    for (const cell of row) {
      if (typeof cell === "string") { assertText(cell); textLength += cell.length; }
      if (typeof cell === "number" && !Number.isFinite(cell)) throw new Error("Report contains a non-finite number.");
    }
    if (textLength > 4_000_000) throw new Error("Report text exceeds the 4 million-character export budget. Narrow the filters.");
  }
}

function assertText(text: string): void {
  if (text.length > MAX_TEXT_LENGTH) throw new Error("Report text exceeds the 32,767-character cell limit.");
}

export function assertReportBudget(snapshot: ReportSnapshot): void {
  let rows = 0;
  let cells = 0;
  let textLength = 0;
  let entries = 0;
  let objects = 0;
  const text = (value: string) => { assertText(value); textLength += value.length; entries++; };
  text(snapshot.title);
  text(snapshot.generatedAt);
  snapshot.filters.forEach(text);
  for (const section of snapshot.sections) {
    text(section.title);
    section.notes.forEach(text);
    for (const table of section.tables) {
      objects++;
      assertTableBudget(table);
      rows += table.rows.length;
      cells += table.rows.length * table.columns.length;
      text(table.title);
      table.columns.forEach(column => text(column.label));
      table.rows.forEach(row => row.forEach(cell => { if (typeof cell === "string") text(cell); }));
    }
    for (const chart of section.charts) {
      objects++;
      rows += chart.labels.length;
      cells += chart.labels.length * chart.series.length;
      text(chart.title);
      chart.labels.forEach(text);
      chart.notes.forEach(text);
      for (const series of chart.series) {
        text(series.name);
        if (series.values.length !== chart.labels.length || series.values.some(value => value !== null && !Number.isFinite(value))) {
          throw new Error(`Chart "${chart.title}" has invalid series data.`);
        }
      }
    }
  }
  if (rows > MAX_REPORT_ROWS || cells > MAX_REPORT_CELLS || textLength > 4_000_000 || entries > 300_000 || objects > 200 || snapshot.sections.length > 50) {
    throw new Error("Report exceeds the export budget (20,000 rows, 250,000 cells, 4 million text characters or 200 tables/charts). Narrow the filters.");
  }
}

export function scopeLabel(scope: ReportSnapshot["scope"]): string {
  return scope === "all" ? "All teams" : "NDC";
}

export function displayCell(cell: Cell, column?: Column): string {
  if (cell === null) return "Unavailable";
  if (typeof cell === "number" && column?.type === "percent") {
    return `${Number((cell * 100).toFixed(2))}%`;
  }
  return String(cell);
}

export function reportFilename(title: string, extension: string): string {
  const ext = extension.replace(/^\./, "").toLowerCase();
  if (!/^[a-z0-9]{1,10}$/.test(ext)) throw new Error("Invalid report file extension.");
  const name = title.normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f-\u009f<>:"/\\|?*\u202a-\u202e\u2066-\u2069]/g, "-")
    .replace(/\s+/g, " ").replace(/^[.\s-]+|[.\s-]+$/g, "")
    .slice(0, 100).replace(/[.\s-]+$/g, "") || "report";
  const safe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(name) ? `report-${name}` : name;
  return `${safe}.${ext}`;
}

export function downloadFile(blob: Blob, filename: string): void {
  if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") {
    throw new Error("File downloads require a browser.");
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  try {
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    // Let the browser consume the download before releasing its backing URL.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
