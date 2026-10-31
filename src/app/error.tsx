"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="feedback-panel" role="alert">
      <AlertCircle className="size-7 text-destructive" aria-hidden="true" />
      <h1 className="page-title">We couldn&apos;t load this page</h1>
      <p className="text-muted-foreground">
        The records are unavailable right now. This does not mean there are no
        results, and no records have been changed by this failed page load.
      </p>
      <div className="page-actions">
        <Button onClick={reset}>Try again</Button>
        <Link href="/" className="text-sm font-medium text-primary underline underline-offset-4">
          Back to Conveners desk
        </Link>
      </div>
    </section>
  );
}
