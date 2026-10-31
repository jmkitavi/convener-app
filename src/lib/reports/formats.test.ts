import assert from "node:assert/strict";
import test from "node:test";
import type { ReportChart, ReportSnapshot, ReportTable } from "./contracts";
import { chartSvg } from "./chart-image";
import { downloadCsv, tableCsv } from "./csv";
import { reportFilename } from "./files";
import { createPdf } from "./pdf";
import { createWorkbook } from "./xlsx";

function snapshot(tables: ReportTable[] = [], charts: ReportChart[] = []): ReportSnapshot {
  return {
    title: "Season evidence report", scope: "ndc", generatedAt: "2026-10-29T05:30:00.000Z",
    filters: ["Season: 2026", "Location: home"],
    sections: [{ id: "season", title: "Season overview", notes: ["Provisional results are identified."], tables, charts }],
    showCharts: true, showTables: true,
  };
}

function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (char === '"') {
      if (quoted && csv[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell); cell = "";
    } else if ((char === "\r" || char === "\n") && !quoted) {
      if (char === "\r" && csv[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  assert.equal(quoted, false);
  if (row.length || cell) rows.push([...row, cell]);
  return rows;
}

test("CSV round trips commas, quotes, Unicode, newlines and nulls without losing numeric signs", () => {
  const table: ReportTable = {
    id: "table", title: "Evidence", columns: [{ label: "Name" }, { label: "Value" }, { label: "Missing" }],
    rows: [
      ['Díaz, "NDC"\r\nsecond line', -2.5, null],
      ["zero", 0, false], ["positive", 3.2, true],
    ],
  };
  assert.deepEqual(parseCsv(tableCsv(table)), [
    ["Name", "Value", "Missing"], ['Díaz, "NDC"\r\nsecond line', "-2.5", ""],
    ["zero", "0", "false"], ["positive", "3.2", "true"],
  ]);
});

test("CSV neutralizes text formulas including leading whitespace, controls and format controls", () => {
  const payloads = ["=SUM(1,2)", "+123", "-4", "@SUM(A1)", " \t\u0000=HYPERLINK(\"https://invalid\")",
    "\r\n-2+3", "\uFEFF=1+1", "\u200b@SUM(A1)", "\u007f+1"];
  const table: ReportTable = {
    id: "formulas", title: "Untrusted", columns: [{ label: " =header" }],
    rows: [...payloads.map(payload => [payload]), [-2], [0], [3], ["ordinary text"]],
  };
  const rows = parseCsv(tableCsv(table));
  assert.equal(rows[0][0], "' =header");
  payloads.forEach((payload, i) => assert.equal(rows[i + 1][0], `'${payload}`));
  assert.deepEqual(rows.slice(payloads.length + 1), [["-2"], ["0"], ["3"], ["ordinary text"]]);
});

test("CSV downloads include a UTF-8 BOM and reject missing tables", async () => {
  const table: ReportTable = { id: "csv", title: "Names", columns: [{ label: "Player" }], rows: [["Zoë"]] };
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const create = URL.createObjectURL;
  const revoke = URL.revokeObjectURL;
  let downloaded: Blob | undefined;
  let filename = "";
  let removed = false;
  Object.defineProperty(globalThis, "document", { configurable: true, value: {
    createElement: () => ({ style: {}, set download(value: string) { filename = value; }, click() {}, remove() { removed = true; } }),
    body: { appendChild() {} },
  } });
  URL.createObjectURL = (blob: Blob) => { downloaded = blob; return "blob:test"; };
  URL.revokeObjectURL = () => {};
  try {
    await downloadCsv(snapshot([table]), "csv");
    assert.ok(downloaded);
    assert.deepEqual([...new Uint8Array(await downloaded.arrayBuffer()).slice(0, 3)], [0xef, 0xbb, 0xbf]);
    assert.match(filename, /\.csv$/);
    assert.equal(removed, true);
    await assert.rejects(downloadCsv(snapshot([table]), "missing"), /does not exist/);
  } finally {
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
    else Reflect.deleteProperty(globalThis, "document");
    URL.createObjectURL = create;
    URL.revokeObjectURL = revoke;
  }
});

test("filenames are safe on common filesystems with bounded names and a validated extension", () => {
  assert.equal(reportFilename("Season overview", ".XLSX"), "Season overview.xlsx");
  assert.equal(reportFilename("...", "csv"), "report.csv");
  assert.equal(reportFilename("CON", "pdf"), "report-CON.pdf");
  const name = reportFilename("../../NDC: report / \u0000 ? * " + "x".repeat(300), "png");
  assert.doesNotMatch(name, /[/\\<>:"|?*\u0000-\u001f]/);
  assert.ok(name.length <= 104);
  assert.throws(() => reportFilename("report", "../csv"), /extension/);
});

test("Excel reopens with metadata, typed percent/date/zero/null and literal formula-like strings", async () => {
  const table: ReportTable = {
    id: "typed", title: "Metadata",
    columns: [{ label: "Player" }, { label: "Rate", type: "percent" }, { label: "Date", type: "date" },
      { label: "Missing", type: "number" }, { label: "Count", type: "number" }, { label: "Active" }],
    rows: [
      ["=HYPERLINK(\"https://invalid\", \"click\")", 0.5, "2026-10-29", null, 0, true],
      [" \t@SUM(A1)", -0.25, "2026-02-30", null, -2, false],
    ],
  };
  const chart: ReportChart = { id: "chart", title: "Rates", kind: "bar", labels: ["A", "B"],
    series: [{ name: "Win rate", values: [0.5, null], color: "#147d80" }], percent: true, notes: ["Completed matches only."] };
  const report = snapshot([table,
    { ...table, id: "duplicate", title: "metadata" },
    { ...table, id: "unsafe", title: "'Bad/name:*?[]".repeat(5) },
    { ...table, id: "reserved", title: "History" },
    { ...table, id: "quoted", title: "   'Quoted name'   " },
  ], [chart]);
  const before = structuredClone(report);
  const bytes = await createWorkbook(report);
  const { default: ExcelJS } = await import("exceljs");
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(new Uint8Array(bytes).buffer);
  assert.equal(book.title, report.title);
  const metadata = book.getWorksheet("Metadata")!;
  assert.equal(metadata.getCell("B1").value, report.title);
  assert.equal(metadata.getCell("B2").value, "NDC");
  assert.equal((metadata.getCell("B3").value as Date).toISOString(), report.generatedAt);
  assert.ok(JSON.stringify(metadata.getSheetValues()).includes("Season: 2026"));
  const sheet = book.worksheets[1];
  assert.equal(sheet.getCell("A2").value, table.rows[0][0]);
  assert.equal(sheet.getCell("A2").type, ExcelJS.ValueType.String);
  assert.equal(sheet.getCell("A3").value, " \t@SUM(A1)");
  assert.equal(sheet.getCell("B2").value, 0.5);
  assert.equal(sheet.getCell("B2").numFmt, "0.00%");
  assert.equal((sheet.getCell("C2").value as Date).toISOString(), "2026-10-29T00:00:00.000Z");
  assert.equal(sheet.getCell("C3").value, "2026-02-30");
  assert.equal(sheet.getCell("D2").value, null);
  assert.equal(sheet.getCell("E2").value, 0);
  assert.equal(sheet.getCell("E3").value, -2);
  assert.equal(sheet.getCell("F2").value, true);
  assert.equal(sheet.views[0].state, "frozen");
  const names = book.worksheets.map(item => item.name);
  assert.equal(new Set(names.map(name => name.toLowerCase())).size, names.length);
  names.forEach(name => { assert.ok(name.length <= 31); assert.doesNotMatch(name, /[\\/*?:[\]]/); assert.notEqual(name.toLowerCase(), "history"); });
  const chartSheet = book.worksheets.at(-1)!;
  assert.equal(chartSheet.getCell("B2").value, 0.5);
  assert.equal(chartSheet.getCell("B2").numFmt, "0.00%");
  assert.equal(chartSheet.getCell("B3").value, null);
  book.eachSheet(item => item.eachRow(row => row.eachCell(cell => {
    assert.notEqual(cell.type, ExcelJS.ValueType.Formula);
    assert.notEqual(cell.type, ExcelJS.ValueType.Hyperlink);
  })));
  assert.deepEqual(report, before);
});

test("exports enforce the total 20,000-row budget rather than silently truncating", async () => {
  const table: ReportTable = { id: "many", title: "Rows", columns: [{ label: "Count" }], rows: Array.from({ length: 10_001 }, () => [0]) };
  const report = snapshot([table, { ...table, id: "second" }]);
  await assert.rejects(createWorkbook(report), /20,000 rows/);
  await assert.rejects(createPdf(report), /20,000 rows/);
  assert.throws(() => tableCsv({ ...table, rows: Array.from({ length: 20_001 }, () => [0]) }), /20,000 rows/);
  assert.equal(parseCsv(tableCsv({ ...table, rows: Array.from({ length: 20_000 }, () => [0]) })).length, 20_001);
});

test("PDF text is selectable across pages with repeated table headers, metadata, notes and column bands", async () => {
  const table: ReportTable = {
    id: "results", title: "Results evidence", columns: [{ label: "Player" }, { label: "Win rate", type: "percent" }, { label: "Context" }],
    rows: Array.from({ length: 140 }, (_, i) => [`Player ${i + 1}`, i === 0 ? 0 : 0.5, i === 0 ? null : "Completed recorded matches only."]),
  };
  const columns = Array.from({ length: 12 }, (_, i) => ({ label: `Metric ${i + 1}` }));
  const report = snapshot([table, { id: "wide", title: "Wide evidence", columns, rows: [columns.map((_, i) => `Wide value ${i + 1}`)] },
    { id: "long", title: "Long context", columns: [{ label: "Long note" }], rows: [[`${"Detailed context ".repeat(600)}END OF LONG CONTEXT`]] }]);
  report.sections[0].notes.push("Missing evidence must not be interpreted as a zero score.");
  report.showCharts = false;
  const bytes = await createPdf(report);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({ data: bytes, useSystemFonts: true, disableFontFace: true, verbosity: 0 });
  try {
    const pdf = await task.promise;
    assert.ok(pdf.numPages >= 4);
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map(item => "str" in item ? item.str : "").join(" "));
    }
    const allText = pages.join("\n");
    for (const value of ["Season evidence report", "Scope: NDC", "Generated at:", "Season: 2026", "Location: home",
      "Missing evidence must not", "Player 140", "Win rate", "0%", "50%", "Unavailable", "Wide value 12", "END OF LONG CONTEXT"]) {
      assert.ok(allText.includes(value), `Missing selectable PDF text: ${value}`);
    }
    assert.ok(pages.filter(page => page.includes("Results evidence") && page.includes("Win rate") && page.includes("Player")).length >= 3);
    columns.forEach(column => assert.ok(allText.includes(column.label)));
    pages.forEach((page, i) => assert.ok(page.includes(`Page ${i + 1} of ${pages.length}`)));
  } finally {
    await task.destroy();
  }
});

test("standalone chart SVG escapes labels, includes all categories and distinguishes zero/null percentages", () => {
  const chart: ReportChart = {
    id: "safe", title: '<script>alert("title")</script>', kind: "bar", percent: true,
    labels: ["A & B", "<unsafe>", "Zero"], series: [{ name: 'Rate "quoted"', values: [0.5, null, 0], color: "url(https://invalid)" }],
    notes: ["Only <completed> matches."],
  };
  const svg = chartSvg(chart, { ...snapshot(), scope: "all", filters: ['Player: <unsafe> & "private"'] });
  assert.match(svg, /fill="#ffffff"/);
  assert.match(svg, /Scope: All teams/);
  assert.match(svg, /&lt;script&gt;/);
  assert.match(svg, /A &amp; B/);
  assert.match(svg, /Rate &quot;quoted&quot;/);
  assert.match(svg, />50%<\/text>/);
  assert.match(svg, />0%<\/text>/);
  assert.match(svg, />N\/A<\/text>/);
  assert.match(svg, /all 3 categories/i);
  assert.doesNotMatch(svg, /<script>|<unsafe>|url\(https|<foreignObject|<image/);
  const line = chartSvg({ ...chart, kind: "line", series: [{ name: "Trend", color: "#147d80", values: [0, null, 1] }] }, snapshot());
  const path = line.match(/<path d="([^"]+)"/)?.[1] ?? "";
  assert.equal((path.match(/M/g) ?? []).length, 2);
  assert.doesNotMatch(path, /L/);
  assert.throws(() => chartSvg({ ...chart, labels: Array(201).fill("category") }, snapshot()), /200 categories/);
  assert.throws(() => chartSvg({ ...chart, series: [{ ...chart.series[0], values: [0] }] }, snapshot()), /one finite number or null/);
});

test("chart exports preserve fixed bounds, even-split guides and nullable per-category target markers", () => {
  const chart: ReportChart = {
    id: "season", title: "Season points", kind: "bar", labels: ["Home", "Away", "Final"],
    series: [{ name: "Team points", values: [15, 10, 5], color: "#147d80" }], notes: [],
    domain: [0, 30],
    referenceLines: [{ name: "Even split", value: 15, color: "#15334a" }],
    targets: { name: 'Target <reference> & "context"', values: [18, null, 0], color: "url(https://invalid)" },
  };
  const svg = chartSvg(chart, snapshot());
  assert.match(svg, />30<\/text>/);
  assert.match(svg, /Fixed axis domain: 0 to 30/);
  assert.match(svg, /height="145" fill="#147d80"/);
  assert.match(svg, /Guide: Even split \(15\)/);
  assert.match(svg, /Target: Target &lt;reference&gt; &amp; &quot;context&quot;/);
  assert.match(svg, /Unavailable targets have no marker/);
  assert.doesNotMatch(svg, /url\(https|<reference>/);
  const guide = svg.match(/<line data-reference-index="0"[^>]+>/)?.[0] ?? "";
  assert.match(guide, /stroke-dasharray="8 6"/);
  const guideY = Number(guide.match(/y1="([^"]+)"/)?.[1]);
  const markers = [...svg.matchAll(/<line data-target-index="0" data-category-index="(\d+)"[^>]+>/g)];
  assert.deepEqual(markers.map(marker => Number(marker[1])), [0, 2]);
  const markerY = (index: number) => Number(markers[index][0].match(/y1="([^"]+)"/)?.[1]);
  assert.ok(Math.abs(markerY(0) - (guideY - 29)) < 0.000001);
  assert.ok(Math.abs(markerY(1) - (guideY + 145)) < 0.000001);
  markers.forEach(marker => assert.match(marker[0], /stroke-dasharray="5 4"/));
  const withoutTargets = chartSvg({ ...chart, targets: undefined }, snapshot());
  assert.doesNotMatch(withoutTargets, /data-target-index|per-category dashed markers/);
  assert.match(withoutTargets, /data-reference-index/);
});

test("chart domain and marker validation rejects invalid bounds or data without expanding fixed axes", () => {
  const chart: ReportChart = {
    id: "bounds", title: "Bounds", kind: "line", labels: ["First", "Second"],
    series: [{ name: "Points", values: [10, 15], color: "#147d80" }], notes: [],
    domain: [0, 30], targets: { name: "Target", values: [35, null], color: "#b26335" },
  };
  const svg = chartSvg(chart, snapshot());
  assert.match(svg, /Fixed axis domain: 0 to 30/);
  assert.match(svg, /Values outside these bounds are clipped/);
  assert.match(svg, /data-target-index="0"[^>]+clip-path="url\(#report-plot-0\)"/);
  for (const domain of [[30, 0], [15, 15], [0, Infinity], [NaN, 30]] as [number, number][]) {
    assert.throws(() => chartSvg({ ...chart, domain }, snapshot()), /finite, increasing bounds/);
  }
  assert.throws(() => chartSvg({ ...chart, targets: { ...chart.targets!, values: [1] } }, snapshot()), /one finite number or null/);
  assert.throws(() => chartSvg({ ...chart, referenceLines: [{ name: "Guide", value: NaN, color: "#15334a" }] }, snapshot()), /finite values/);
});

test("dense roster and full partnership charts fit bounded images without dropping labels or values", () => {
  const context = {
    ...snapshot(),
    filters: Array.from({ length: 8 }, (_, i) => `Filter ${i + 1}: completed results drive performance; all selected fixtures and participants remain in the full dataset.`),
  };
  for (const count of [83, 148, 172, 200]) {
    const labels = Array.from({ length: count }, (_, i) => `Player ${i + 1} Example / Partner ${i + 1} Name`);
    const chart: ReportChart = {
      id: `dense-${count}`, title: "Complete partnership evidence", kind: "bar", labels,
      series: [{ name: "Adjusted yield", values: labels.map((_, i) => i / count), color: "#147d80" }],
      percent: true, notes: ["All partnerships are included, not just leaders."],
    };
    const svg = chartSvg(chart, context);
    const dimensions = svg.match(/^<svg[^>]*width="(\d+)" height="(\d+)"/);
    assert.ok(dimensions);
    assert.equal(Number(dimensions[1]), 1600);
    assert.ok(Number(dimensions[2]) <= 8192, `Oversized ${count}-category chart`);
    labels.forEach(label => assert.ok(svg.includes(`<title>Adjusted yield / ${label}:`), `Missing category: ${label}`));
    assert.match(svg, new RegExp(`of ${count}\\)`));
    assert.match(svg, /font-size="17"/);
    if (count >= 148) assert.ok((svg.match(/Category \(/g) ?? []).length < Math.ceil(count / 8));
  }
});

test("adaptive chart packing retains the image bound when labels cannot fit legibly", () => {
  const labels = Array.from({ length: 200 }, (_, i) => `${i}: ${"longword ".repeat(30)}`);
  const chart: ReportChart = {
    id: "oversized-labels", title: "Long labels", kind: "bar", labels,
    series: [{ name: "Count", values: labels.map(() => 1), color: "#147d80" }], notes: [],
  };
  assert.throws(() => chartSvg(chart, snapshot()), /1600 × 8192/);
});

test("source-chart point colors, fixture states and handicap bounds survive image exports",()=>{
  const chart:ReportChart={
    id:"handicap",title:"Handicap history",kind:"line",labels:["2026-02-08","2026-03-08"],
    series:[{name:"Handicap",values:[8.4,7.6],color:"#296e66",pointColors:["#b13d3d","#3e7055"]}],
    legend:[{name:"Loss",color:"#b13d3d"},{name:"Win",color:"#3e7055"}],domain:[6.6,9.4],notes:[],
  };
  const svg=chartSvg(chart,snapshot());
  assert.match(svg,/<circle[^>]+fill="#b13d3d"/);
  assert.match(svg,/<circle[^>]+fill="#3e7055"/);
  assert.match(svg,/Fixed axis domain: 6.6 to 9.4/);
  const bars=chartSvg({...chart,kind:"bar",domain:[0,30],series:[{...chart.series[0],pointColors:["#3f7058","#d59c48"],pointLabels:["W","L"]}]},snapshot());
  assert.match(bars,/<rect[^>]+fill="#3f7058"/);
  assert.match(bars,/<rect[^>]+fill="#d59c48"/);
  assert.match(bars,/>W<\/text>/);
  assert.match(bars,/>L<\/text>/);
  assert.throws(()=>chartSvg({...chart,series:[{...chart.series[0],pointColors:[]}]},snapshot()),/one entry per category/);
  const safe=chartSvg({...chart,kind:"bar",series:[{...chart.series[0],pointColors:["url(https://invalid)","#3e7055"],pointLabels:["<script>","W"]}]},snapshot());
  assert.doesNotMatch(safe,/url\(https|<script>/);
  assert.match(safe,/&lt;script&gt;/);
});
