import { loadInsightData } from "@/lib/insight-data";
import { getMockupData } from "@/lib/mockup-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    return Response.json(getMockupData(await loadInsightData()), { headers });
  } catch {
    return Response.json({ error: "Unable to load current league data. Refresh to try again." }, { status: 500, headers });
  }
}
