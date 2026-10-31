import { LoaderCircle } from "lucide-react";

export default function Loading() {
  return (
    <section className="feedback-panel" role="status" aria-live="polite">
      <LoaderCircle className="size-6 animate-spin text-primary" aria-hidden="true" />
      <h1 className="text-xl font-semibold">Loading your workspace</h1>
      <p className="text-sm text-muted-foreground">
        Getting the latest records. Results will appear when they are ready.
      </p>
    </section>
  );
}
