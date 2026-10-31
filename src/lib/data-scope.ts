"use server";

import { cookies } from "next/headers";
import type { DataScope } from "./insights";

export async function getDataScope(): Promise<DataScope> {
  return (await cookies()).get("convener-data-scope")?.value === "all" ? "all" : "ndc";
}

export async function setDataScope(scope: DataScope) {
  if (scope !== "ndc" && scope !== "all") throw new Error("Invalid results scope");
  (await cookies()).set("convener-data-scope", scope, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
