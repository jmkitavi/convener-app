import { loadInsightData } from "@/lib/insight-data";
import { getDataScope } from "@/lib/data-scope";
import { AnalyticsFrame } from "@/components/analytics-view";
import { AnalyticsQuality } from "@/components/analytics-quality";
import type { AnalyticsPageProps } from "@/components/analytics-navigation";

export default async function DataQualityPage({ searchParams }: AnalyticsPageProps) {
  const [data, params, scope] = await Promise.all([loadInsightData(), searchParams, getDataScope()]);
  const queue = params.queue === "results" || params.queue === "handicaps" || params.queue === "roster" ? params.queue : "all";
  return (
    <AnalyticsFrame title="A complete record. A clearer picture." description="Close the gaps before drawing conclusions from the recorded results."
      scope={scope}>
      <AnalyticsQuality data={data} scope={scope} queue={queue} />
    </AnalyticsFrame>
  );
}
