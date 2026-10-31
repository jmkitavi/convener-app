import { loadInsightData } from "@/lib/insight-data";
import { AnalyticsClient } from "@/components/analytics-client";
import { getDataScope } from "@/lib/data-scope";

export default async function AnalyticsPage() {
  const [data, scope] = await Promise.all([loadInsightData(), getDataScope()]);
  return <AnalyticsClient data={data} scope={scope} />;
}
