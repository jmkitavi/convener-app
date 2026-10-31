const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function assertAppRequest(host: string, requestHeaders: Headers, protocol?: string) {
  const hostname = host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.split(":")[0];
  const configured = (process.env.CONVENER_ALLOWED_ORIGINS ?? "").split(",").filter(Boolean).map(value => new URL(value.trim()).origin);
  const vercelOrigins = [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
    .filter((value): value is string => Boolean(value)).map(value => `https://${value}`);
  const allowed = new Set([...configured, ...vercelOrigins]);
  const origin = `${protocol ?? (localHosts.has(hostname) ? "http:" : "https:")}//${host}`;
  if (!localHosts.has(hostname) && !allowed.has(origin)) throw new Error("This app origin is not configured.");
  if (requestHeaders.get("sec-fetch-site") === "cross-site") throw new Error("Cross-origin requests are not allowed.");
  const supplied = requestHeaders.get("origin");
  if (supplied && supplied !== origin) throw new Error("Cross-origin requests are not allowed.");
}
