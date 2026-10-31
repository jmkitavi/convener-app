import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { jsPDF } from "jspdf";
import { detectFormat, MAX_PAGE, MAX_UPLOAD, prepareDocument } from "./documents";

test("rejects disguised, oversized and unreadable uploads", async () => {
  assert.throws(() => detectFormat(Buffer.from("<html>not an image</html>")));
  await assert.rejects(prepareDocument(Buffer.alloc(MAX_UPLOAD + 1)), /20 MB/);
  await assert.rejects(prepareDocument(Buffer.from("%PDF-corrupt")), /PDF/);
  const tiny = await sharp({ create: { width: 100, height: 100, channels: 3, background: "white" } }).png().toBuffer();
  await assert.rejects(prepareDocument(tiny), /too small/);
});

test("normalizes a readable photo to bounded metadata-free JPEG", async () => {
  const source = await sharp({ create: { width: 1200, height: 1600, channels: 3, background: "white" } })
    .withMetadata({ orientation: 6 }).jpeg().toBuffer();
  const pages = await prepareDocument(source);
  assert.equal(pages.length, 1);
  assert.ok(pages[0].length <= MAX_PAGE);
  const metadata = await sharp(pages[0]).metadata();
  assert.equal(metadata.format, "jpeg");
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.orientation, undefined);
});

function pdf(pageCount: number) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${Array.from({ length: pageCount }, (_, i) => `${i + 3} 0 R`).join(" ")}] /Count ${pageCount} >>`,
    ...Array.from({ length: pageCount }, () => "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>"),
  ];
  let output = "%PDF-1.4\n";
  const offsets = [0];
  for (const [i, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(output));
    output += `${i + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  output += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  return Buffer.from(`${output}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
}

test("renders PDF pages locally and rejects more than five pages", async () => {
  const pages = await prepareDocument(pdf(1));
  assert.equal(pages.length, 1);
  assert.equal((await sharp(pages[0]).metadata()).format, "jpeg");
  await assert.rejects(prepareDocument(pdf(6)), /at most 5 pages/);
});

test("renders non-embedded PDF text using packaged standard fonts", async () => {
  const document = new jsPDF();
  document.text("Results: paired match WIN 2&1", 20, 30);
  const [page] = await prepareDocument(Buffer.from(document.output("arraybuffer")));
  const statistics = await sharp(page).stats();
  assert.ok(statistics.channels.every(channel => channel.min < 100 && channel.stdev > 1));
});
