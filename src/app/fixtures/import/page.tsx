import { Suspense } from "react";
import { ResultsImport } from "@/components/results-import";

export default function ImportPage() {
  return <Suspense fallback={<p>Loading results import...</p>}><ResultsImport /></Suspense>;
}
