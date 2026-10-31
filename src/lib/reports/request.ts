"use server";

import { headers } from "next/headers";
import { getDataScope } from "@/lib/data-scope";
import { loadReportSource } from "./load";
import { assertAppRequest } from "@/lib/request-origin";

export async function getReportSource() {
  const request = await headers();
  const host = request.get("host") ?? "";
  assertAppRequest(host, request);
  return { source: await loadReportSource(), scope: await getDataScope() };
}
