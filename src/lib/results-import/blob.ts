import { del, get, list, put } from "@vercel/blob";
import { boundedBody } from "./documents";

export function blobConfiguration() {
  const prefix = process.env.VERCEL_ENV === "production" ? "BLOB" : "PREVIEW_BLOB";
  const token = process.env[`${prefix}_READ_WRITE_TOKEN`];
  const storeId = process.env[`${prefix}_STORE_ID`];
  if (!token || token === "[SENSITIVE]" || !storeId) throw new Error(`${prefix} upload storage is not configured.`);
  return { token, storeId };
}

export function sourcePrefix(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/.test(id)) throw new Error("Invalid import ID.");
  return `results-imports/${id}/`;
}

export async function readSource(pathname: string, limit: number) {
  const result = await get(pathname, { ...blobConfiguration(), access: "private", useCache: false });
  if (!result || result.statusCode !== 200) throw new Error("Source file not found.");
  if (result.blob.size > limit) { await result.stream.cancel(); throw new Error("Source file is too large."); }
  return boundedBody(new Request("https://storage.invalid", { method: "POST", body: result.stream, duplex: "half" } as RequestInit), limit);
}

export async function writePage(id: string, number: number, bytes: Buffer) {
  return put(`${sourcePrefix(id)}${number}.jpg`, bytes, {
    ...blobConfiguration(), access: "private", contentType: "image/jpeg", addRandomSuffix: false, allowOverwrite: false,
  });
}

export async function deleteSources(id: string) {
  let cursor: string | undefined;
  do {
    const result = await list({ ...blobConfiguration(), prefix: sourcePrefix(id), cursor });
    if (result.blobs.length) await del(result.blobs.map(blob => blob.pathname), blobConfiguration());
    cursor = result.hasMore ? result.cursor : undefined;
  } while (cursor);
}

export const sourceStorage = {
  read: readSource,
  writePage,
  deleteSources,
  deleteFile: (pathname: string) => del(pathname, blobConfiguration()),
};
