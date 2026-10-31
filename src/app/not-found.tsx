import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="feedback-panel">
      <FileQuestion className="size-7 text-muted-foreground" aria-hidden="true" />
      <p className="page-eyebrow">Page not found</p>
      <h1 className="page-title">That destination isn&apos;t available</h1>
      <p className="text-muted-foreground">
        The address may be incorrect, or the record may no longer exist.
      </p>
      <Button render={<Link href="/" />}>Back to Conveners desk</Button>
    </section>
  );
}
