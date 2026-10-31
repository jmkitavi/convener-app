"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import type { ReportSnapshot } from "@/lib/reports/contracts";
import { Button } from "@/components/ui/button";
import { ReportPreview } from "./report-preview";

export function ExportActions({ snapshot }: { snapshot: ReportSnapshot }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [printing, setPrinting] = useState(false);
  const tables = snapshot.sections.flatMap(section => section.tables);
  const charts = snapshot.sections.flatMap(section => section.charts).filter(chart => chart.labels.length > 0);
  const [tableId, setTableId] = useState("");
  const [chartId, setChartId] = useState("");
  async function run(label: string, action: () => Promise<void>) {
    setBusy(label); setError("");
    try { await action(); } catch (problem) { setError(problem instanceof Error ? problem.message : "Export failed. Please retry."); }
    finally { setBusy(""); }
  }
  function print() {
    setPrinting(true);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const finish = () => setPrinting(false);
      window.addEventListener("afterprint", finish, { once: true });
      window.print();
      setPrinting(false);
    }));
  }
  return <div className="report-export-actions">
    <div className="flex flex-wrap items-end gap-3">
      <Button disabled={!!busy} onClick={() => run("PDF", async () => (await import("@/lib/reports/pdf")).downloadPdf(snapshot))}>Download PDF</Button>
      <Button variant="outline" disabled={!!busy} onClick={() => run("Excel", async () => (await import("@/lib/reports/xlsx")).downloadExcel(snapshot))}>Download Excel</Button>
      <Button variant="outline" disabled={!!busy} onClick={print}>Print view</Button>
      <label className="grid gap-1 text-sm">CSV dataset
        <select aria-label="CSV dataset" className="report-select" value={tableId || tables[0]?.id || ""} onChange={event => setTableId(event.target.value)}>
          {tables.map(table => <option value={table.id} key={table.id}>{table.title} ({table.rows.length})</option>)}
        </select>
      </label>
      <Button variant="outline" disabled={!!busy || !tables.length} onClick={() => run("CSV", async () => (await import("@/lib/reports/csv")).downloadCsv(snapshot, tableId || tables[0].id))}>Download CSV</Button>
      {!!charts.length && <>
        <label className="grid gap-1 text-sm">Chart image
          <select aria-label="Chart image" className="report-select" value={chartId || charts[0].id} onChange={event => setChartId(event.target.value)}>
            {charts.map(chart => <option value={chart.id} key={chart.id}>{chart.title}</option>)}
          </select>
        </label>
        <Button variant="outline" disabled={!!busy} onClick={() => run("PNG", async () => {
          const chart = charts.find(entry => entry.id === (chartId || charts[0].id));
          if (!chart) throw new Error("Choose a chart.");
          await (await import("@/lib/reports/chart-image")).downloadChart(chart,snapshot);
        })}>Download PNG</Button>
      </>}
    </div>
    {busy && <p role="status" className="mt-2 text-sm">Preparing {busy}…</p>}
    {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    {printing && createPortal(<div className="report-print-root"><ReportPreview snapshot={snapshot} /></div>,document.body)}
  </div>;
}
