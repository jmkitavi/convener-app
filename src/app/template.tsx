import { getReportSource } from "@/lib/reports/request";
import { ReportSourceRegistration } from "@/components/reports/report-provider";

export default async function Template({ children }: { children: React.ReactNode }) {
  const data = await getReportSource().catch(() => null);
  return <>
    <ReportSourceRegistration source={data?.source ?? null} scope={data?.scope ?? "ndc"} />
    {children}
  </>;
}
