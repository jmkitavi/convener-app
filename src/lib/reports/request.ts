"use server";

import { headers } from "next/headers";
import { getDataScope } from "@/lib/data-scope";
import { loadReportSource } from "./load";

export async function getReportSource() {
  const request = await headers();
  const host = request.get("host") ?? "";
  const hostname = host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.split(":")[0];
  if (!["localhost", "127.0.0.1", "[::1]"].includes(hostname)) throw new Error("Reports are local-only until authentication is configured.");
  if (request.get("sec-fetch-site") === "cross-site") throw new Error("Cross-origin reports are not allowed.");
  const origin = request.get("origin");
  if (origin && new URL(origin).host !== host) throw new Error("Cross-origin reports are not allowed.");
  return { source: await loadReportSource(), scope: await getDataScope() };
}
