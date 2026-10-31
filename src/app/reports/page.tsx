import { getReportSource } from "@/lib/reports/request";
import { ReportBuilder } from "./report-builder";

export default async function ReportsPage() {
  const { source, scope } = await getReportSource();
  return <ReportBuilder source={source} scope={scope} />;
}
