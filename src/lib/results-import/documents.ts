import sharp from "sharp";
import { Worker } from "node:worker_threads";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

export const MAX_UPLOAD = 20 * 1024 * 1024;
export const MAX_PAGE = 1024 * 1024;
export const MAX_PAGES = 5;

export async function boundedBody(request: Request, limit: number) {
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > limit) throw new Error("Upload exceeds 20 MB.");
  if (!request.body) throw new Error("No upload received.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) throw new Error("Request is too large.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return Buffer.concat(chunks);
}

export function detectFormat(buffer: Buffer): "pdf" | "image" {
  if (buffer.subarray(0, 5).toString() === "%PDF-") return "pdf";
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
      (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255)) return "image";
  throw new Error("Choose a PDF, JPEG or PNG file.");
}

async function normalizeImage(buffer: Buffer) {
  const image = sharp(buffer, { limitInputPixels: 24_000_000, failOn: "warning", animated: false });
  const metadata = await image.metadata();
  if ((metadata.pages ?? 1) > 1) throw new Error("Animated/multipage images are not supported.");
  if (!metadata.width || !metadata.height || Math.min(metadata.width, metadata.height) < 400) {
    throw new Error("This image is too small to read. Upload a clearer scan.");
  }
  // Keep resolution fixed while adjusting compression; never shrink text to meet the byte cap.
  for (const quality of [90, 82, 74]) {
    const output = await image.clone().rotate().resize({
      width: 2600, height: 3400, fit: "inside", withoutEnlargement: true,
    }).flatten({ background: "white" }).jpeg({ quality, mozjpeg: true }).toBuffer();
    if (output.length <= MAX_PAGE) return output;
  }
  throw new Error("Cannot keep this page readable within 1 MB. Crop the slip or use a better scan.");
}

async function renderPdf(buffer: Buffer): Promise<Buffer[]> {
  const resolveModule = createRequire(`${process.cwd()}/package.json`);
  // Isolate PDF decoding/rendering so hostile or broken documents have a hard deadline.
  const worker = new Worker(`
    const { parentPort, workerData } = require("node:worker_threads");
    (async () => {
      const canvas = await import(workerData.canvasModule);
      globalThis.DOMMatrix = canvas.DOMMatrix;
      globalThis.ImageData = canvas.ImageData;
      globalThis.Path2D = canvas.Path2D;
      const pdfjs = await import(workerData.pdfModule);
      const task = pdfjs.getDocument({data: new Uint8Array(workerData.buffer), isEvalSupported: false,
        useSystemFonts: false, standardFontDataUrl: workerData.standardFonts, maxImageSize: 24000000});
      const pdf = await task.promise;
      if (pdf.numPages > 5) throw Error("PDFs must contain at most 5 pages.");
      const pages = [];
      for (let number = 1; number <= pdf.numPages; number++) {
        const page = await pdf.getPage(number);
        const base = page.getViewport({ scale: 1 });
        if (!Number.isFinite(base.width) || !Number.isFinite(base.height) ||
            base.width <= 0 || base.height <= 0) throw Error("Invalid PDF page dimensions.");
        const scale = Math.min(2600/base.width, 3400/base.height, 4);
        const viewport = page.getViewport({ scale });
        const surface = canvas.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        await page.render({canvasContext: surface.getContext("2d"), viewport,
          canvas: surface, background: "white"}).promise;
        pages.push(surface.toBuffer("image/png"));
        page.cleanup();
      }
      await task.destroy();
      parentPort.postMessage({pages});
    })().catch(error => parentPort.postMessage({error: error.message}));
  `, {
    eval: true,
    workerData: {
      buffer,
      canvasModule: pathToFileURL(resolveModule.resolve("@napi-rs/canvas")).href,
      pdfModule: pathToFileURL(resolveModule.resolve("pdfjs-dist/legacy/build/pdf.mjs")).href,
      standardFonts: `${join(dirname(resolveModule.resolve("pdfjs-dist/legacy/build/pdf.mjs")), "..", "..", "standard_fonts")}/`,
    },
    resourceLimits: { maxOldGenerationSizeMb: 256 },
  });
  return new Promise((resolve, reject) => {
    let finished = false;
    const timer = setTimeout(() => {
      void worker.terminate();
      reject(new Error("PDF processing timed out. Try a simpler scan."));
    }, 45_000);
    worker.once("message", (message: { pages?: Uint8Array[]; error?: string }) => {
      finished = true;
      clearTimeout(timer);
      void worker.terminate();
      if (message.error || !message.pages?.length) reject(new Error(message.error ?? "No PDF pages found."));
      else resolve(message.pages.map((page) => Buffer.from(page)));
    });
    worker.once("error", (error) => { clearTimeout(timer); reject(error); });
    worker.once("exit", () => {
      clearTimeout(timer);
      if (!finished) reject(new Error("PDF processing stopped. Try another scan."));
    });
  });
}

export async function prepareDocument(buffer: Buffer) {
  if (!buffer.length || buffer.length > MAX_UPLOAD) throw new Error("File must be between 1 byte and 20 MB.");
  const format = detectFormat(buffer);
  const pages = format === "pdf" ? await renderPdf(buffer) : [buffer];
  return Promise.all(pages.map(normalizeImage));
}
