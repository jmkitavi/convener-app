import type { Cell, ReportSnapshot, ReportTable } from "./contracts";
import { assertReportBudget, assertTableBudget, downloadFile, reportFilename } from "./files";

function csvCell(value: Cell): string {
  let text = value === null ? "" : String(value);
  // Only strings are untrusted spreadsheet expressions; numeric negatives stay numeric.
  if (typeof value === "string" && /^[\s\p{Cc}\p{Cf}]*[=+\-@]/u.test(value)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function tableCsv(table: ReportTable): string {
  assertTableBudget(table);
  return [
    table.columns.map(column => csvCell(column.label)).join(","),
    ...table.rows.map(row => row.map(csvCell).join(",")),
  ].join("\r\n") + "\r\n";
}

export async function downloadCsv(snapshot: ReportSnapshot, tableId: string): Promise<void> {
  assertReportBudget(snapshot);
  const table = snapshot.sections.flatMap(section => section.tables).find(item => item.id === tableId);
  if (!table) throw new Error("The requested report table does not exist.");
  downloadFile(new Blob(["\ufeff", tableCsv(table)], { type: "text/csv;charset=utf-8" }), reportFilename(`${snapshot.title} - ${table.title}`, "csv"));
}
