import { DashboardClient } from "@/components/dashboard-client";
import { loadInsightData } from "@/lib/insight-data";
import { getDataScope } from "@/lib/data-scope";

export default async function DashboardPage() {
  const [data, scope] = await Promise.all([loadInsightData(), getDataScope()]);
  return <DashboardClient data={data} scope={scope} />;
}
