"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { buildReport, configForPath } from "@/lib/reports/datasets";
import type { ReportSnapshot } from "@/lib/reports/contracts";
import { useReportContext } from "./report-provider";
import { ExportActions } from "./export-actions";
import { ReportPreview } from "./report-preview";

export function ReportToolbar({ scope }: { scope: "ndc" | "all" }) {
  const pathname = usePathname();
  const params = useSearchParams();
  return <CurrentReportToolbar key={`${pathname}?${params.toString()}:${scope}`} scope={scope} />;
}

function CurrentReportToolbar({ scope }: { scope: "ndc" | "all" }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const context = useReportContext();
  const [snapshot, setSnapshot] = useState<ReportSnapshot | null>(null);
  const [open, setOpen] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const config = configForPath(pathname,new URLSearchParams(params.toString()));
  if (!config) return null;
  const view = context?.views[pathname];
  const filters = { ...config,...view?.filters };
  const needsLineup = config.sections.some(id=>id.startsWith("lineup-"));
  const ready = !!context?.source && view?.ready !== false && (!needsLineup || !!view?.section);
  async function preview() {
    setBusy(true);setError("");setOpen(true);setSnapshot(null);
    try {
      if(!context?.source)throw new Error("Reporting data could not be loaded. Reload the page to retry.");
      const next = buildReport(context.source,scope,filters);
      if(view?.section) next.sections.push(view.section);
      setSnapshot(next);
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Could not load report."); }
    finally {setBusy(false);}
  }
  function customize() {
    context?.stage(view?.section ? {scope,section:view.section} : null);
    setOpen(false);
    router.push(`/reports?config=${encodeURIComponent(JSON.stringify(filters))}`);
  }
  return <div className="report-page-toolbar">
    <Button size="sm" variant="outline" disabled={busy || !ready} onClick={preview}>Export report</Button>
    <Link href="/reports" className="text-sm text-muted-foreground hover:underline">Build a report</Link>
    {context?.sourceReady&&!context.source&&<span className="text-xs text-destructive">Report data unavailable. Reload to retry.</span>}
    {needsLineup && !ready && <span className="text-xs text-muted-foreground">Generate recommendations to export them.</span>}
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="report-dialog">
        <DialogHeader><DialogTitle>Export {config.title}</DialogTitle><DialogDescription>Read-only snapshot of current matching records and view filters. All matching rows are included, not just visible rows. Downloads use this fixed preview.</DialogDescription></DialogHeader>
        {busy && <p role="status">Preparing report preview…</p>}
        {error && <p role="alert" className="text-destructive">{error}</p>}
        {snapshot && <>
          <ExportActions key={snapshot.generatedAt} snapshot={snapshot} />
          <Button size="sm" variant="outline" onClick={customize}>Customize / combine sections</Button>
          <ReportPreview snapshot={snapshot} />
        </>}
      </DialogContent>
    </Dialog>
  </div>;
}
