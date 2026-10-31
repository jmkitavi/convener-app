import type { ReactNode } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DataScope } from "@/lib/insights";

export function AnalyticsFrame({ title, description, scope, actions, children }: {
  title: string; description: string; scope: DataScope; actions?: ReactNode; children: ReactNode;
}) {
  return (
    <div className="page-shell screen-desk">
      <PageHeader title={title} description={description} eyebrow="Conveners desk · Analytics"
        actions={actions} />
      <p className="data-note">
        {scope === "ndc" ? "NDC only · Internal fixtures excluded." : "All history · Includes internal fixtures and linked players on either side."}
        {" "}Completed results only unless a pending or provisional state is explicitly shown.
      </p>
      {children}
    </div>
  );
}

export function AnalyticsPanel({ title, description, children }: {
  title: string; description?: string; children: ReactNode;
}) {
  return (
    <section className="desk-panel min-w-0 space-y-4 p-4 sm:p-6">
      <div className="desk-panel-header">
        <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export function AnalyticsTable({ label, headings, children, empty }: {
  label: string; headings: string[]; children: ReactNode; empty?: string;
}) {
  return (
    <Table aria-label={label}>
      <TableHeader><TableRow>{headings.map((heading) => <TableHead key={heading}>{heading}</TableHead>)}</TableRow></TableHeader>
      <TableBody>{empty
        ? <TableRow><TableCell colSpan={headings.length} className="whitespace-normal text-muted-foreground">{empty}</TableCell></TableRow>
        : children}</TableBody>
    </Table>
  );
}

export function AnalyticsFilters({ scope, minimum, location, sort, minimumLabel = "Minimum appearances" }: {
  scope: DataScope; minimum?: number; location?: "all" | "home" | "away";
  sort?: "away" | "home-edge"; minimumLabel?: string;
}) {
  const inputClass = "h-10 rounded-md border bg-background px-3 text-sm text-foreground";
  return (
    <form method="get" className="desk-toolbar filter-bar flex flex-wrap items-end gap-3">
      <input type="hidden" name="scope" value={scope} />
      {location !== undefined && <label className="grid gap-1 text-sm">
        Location
        <select name="location" defaultValue={location} className={inputClass}>
          <option value="all">All locations</option><option value="home">Home</option><option value="away">Away</option>
        </select>
      </label>}
      {minimum !== undefined && <label className="grid gap-1 text-sm">
        {minimumLabel}
        <input name="min" type="number" min={1} max={1000} step={1} defaultValue={minimum}
          className={`${inputClass} w-28`} />
      </label>}
      {sort !== undefined && <label className="grid gap-1 text-sm">
        Sort players by
        <select name="sort" defaultValue={sort} className={inputClass}>
          <option value="away">Away result yield</option><option value="home-edge">Largest home edge</option>
        </select>
      </label>}
      <button type="submit" className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Apply filters</button>
    </form>
  );
}

export const percent = (fraction: number) => `${(fraction * 100).toFixed(1)}%`;
export const points = (value: number) => value.toFixed(2);

export function AnalyticsAction({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="inline-flex h-10 items-center justify-center rounded-md border bg-card px-4 text-sm font-medium hover:bg-muted">{children}</Link>;
}

export function AnalyticsStats({ items }: { items: { label: string; value: ReactNode; detail: string }[] }) {
  return <section className="desk-stats" aria-label="Analysis summary">
    {items.map((item) => <div key={item.label} className="desk-stat">
      <p className="desk-stat-label">{item.label}</p>
      <p className="desk-stat-value numeric">{item.value}</p>
      <p className="desk-stat-detail">{item.detail}</p>
    </div>)}
  </section>;
}

export function AnalyticsProgress({ value, label, tone = "home" }: {
  value: number; label: string; tone?: "home" | "away" | "neutral";
}) {
  return <progress className="desk-progress h-2 w-full" data-tone={tone}
    max={100} value={Math.max(0, Math.min(100, value))} aria-label={label} />;
}
