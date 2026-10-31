import { Suspense } from "react";
import { ResultsImport } from "@/components/results-import";

export default function ImportPage() {
  return <Suspense fallback={<div className="page-shell screen-desk import-workspace"><section className="desk-panel p-5" role="status"><h1 className="text-xl font-semibold">Loading results import</h1><p className="text-sm text-muted-foreground">Getting import settings and any saved draft…</p></section></div>}><ResultsImport /></Suspense>;
}
