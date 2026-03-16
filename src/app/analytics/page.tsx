import { getAllMatches } from "@/lib/actions";
import type { MatchWithDetails } from "@/lib/analytics";
import { AnalyticsClient } from "@/components/analytics-client";

export default async function AnalyticsPage() {
  const result = await getAllMatches();
  const allMatches = (result.data ?? []) as MatchWithDetails[];

  return <AnalyticsClient allMatches={allMatches} />;
}
