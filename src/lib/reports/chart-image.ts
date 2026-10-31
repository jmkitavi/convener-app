import type { ReportChart, ReportSnapshot } from "./contracts";
import { downloadFile, reportFilename, scopeLabel } from "./files";
import { fixtureLocationColors } from "@/lib/chart-colors";

type ChartContext = Pick<ReportSnapshot, "scope" | "generatedAt" | "filters">;
const WIDTH = 1600;
const MAX_HEIGHT = 8192;
const COLORS = ["#147d80", "#15334a", "#b26335", "#5767a3", "#a14c71", "#477c47", "#766139", "#506e86", "#94552c", "#705a91", "#3b7c69", "#8d5968"];
const xml = (value: string): string => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]!)
  .replace(/[^\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/gu, "\ufffd");

function wrap(value: string, length: number): string[] {
  const lines: string[] = [];
  for (const paragraph of value.split(/\r\n|\r|\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      if (line && line.length + word.length + 1 > length) { lines.push(line); line = ""; }
      let rest = word;
      while (rest.length > length) {
        if (line) { lines.push(line); line = ""; }
        lines.push(rest.slice(0, length));
        rest = rest.slice(length);
      }
      if (rest) line += `${line ? " " : ""}${rest}`;
    }
    lines.push(line);
  }
  return lines;
}

function text(value: string, x: number, y: number, options = "", size = 18): string {
  return `<text x="${x}" y="${y}" font-size="${size}" ${options}>${xml(value)}</text>`;
}

function valueLabel(value: number | null, percent?: boolean): string {
  if (value === null) return "Unavailable";
  const number = percent ? value * 100 : value;
  return `${Number(number.toFixed(2)).toLocaleString("en-GB", { maximumFractionDigits: 2 })}${percent ? "%" : ""}`;
}

function render(chart: ReportChart, snapshot: ChartContext): { svg: string; width: number; height: number } {
  const references = chart.referenceLines ?? [];
  const targets = chart.targets ? [chart.targets] : [];
  const legends = chart.legend ?? chart.series;
  if (chart.labels.length > 200 || chart.series.length > 12 || !chart.series.length) {
    throw new Error("Chart export supports up to 200 categories and 12 series. Narrow the report filters.");
  }
  if (references.length > 12) throw new Error("Chart export supports up to 12 reference lines.");
  if (legends.length > 12) throw new Error("Chart export supports up to 12 legend entries.");
  if (chart.domain && (chart.domain.length !== 2 || !chart.domain.every(Number.isFinite) || chart.domain[0] >= chart.domain[1])) {
    throw new Error("Chart domain must contain two finite, increasing bounds.");
  }
  if (references.some(reference => !Number.isFinite(reference.value))) throw new Error("Chart reference lines must have finite values.");
  const strings = [chart.title, snapshot.generatedAt, ...snapshot.filters, ...chart.labels, ...chart.notes,
    ...chart.series.map(series => series.name), ...legends.map(legend=>legend.name),
    ...chart.series.flatMap(series=>series.pointLabels??[]), ...references.map(reference => reference.name), ...targets.map(target => target.name)];
  if (strings.some(value => value.length > 32_767) || strings.reduce((sum, value) => sum + value.length, 0) > 100_000) {
    throw new Error("Chart labels exceed the text budget. Narrow the report filters.");
  }
  for (const series of [...chart.series, ...targets]) {
    if (series.values.length !== chart.labels.length || series.values.some(value => value !== null && !Number.isFinite(value))) {
      throw new Error("Chart series must have one finite number or null per category.");
    }
    for(const series of chart.series){
      if((series.pointColors&&series.pointColors.length!==chart.labels.length)||(series.pointLabels&&series.pointLabels.length!==chart.labels.length)){
        throw new Error("Chart point styles must have one entry per category.");
      }
    }
  }
  const colors = chart.series.map((series, i) => /^#[0-9a-f]{6}$/i.test(series.color) ? series.color : COLORS[i]);
  const referenceColors = references.map((reference, i) => /^#[0-9a-f]{6}$/i.test(reference.color) ? reference.color : COLORS[(i + 1) % COLORS.length]);
  const targetColors = targets.map((target, i) => /^#[0-9a-f]{6}$/i.test(target.color) ? target.color : COLORS[(i + 2) % COLORS.length]);
  const parts: string[] = [];
  let cursor = 55;
  const paragraph = (value: string, size = 18, bold = false) => {
    for (const line of wrap(value, Math.floor(1420 / (size * 0.6)))) {
      parts.push(text(line, 70, cursor, bold ? 'font-weight="700"' : "", size));
      cursor += size + 8;
    }
  };
  paragraph(chart.title, 30, true);
  paragraph(`Scope: ${scopeLabel(snapshot.scope)} | Generated: ${snapshot.generatedAt}`, 18);
  for (const filter of snapshot.filters) paragraph(`Filter: ${filter}`, 17);
  if (!snapshot.filters.length) paragraph("Filters: none", 17);
  cursor += 10;
  legends.forEach((legend, i) => {
    const color=/^#[0-9a-f]{6}$/i.test(legend.color)?legend.color:COLORS[i%COLORS.length];
    const lines = wrap(legend.name, 110);
    parts.push(`<rect x="70" y="${cursor - 16}" width="20" height="20" rx="3" fill="${color}"/>`);
    lines.forEach(line => { parts.push(text(line, 104, cursor)); cursor += 26; });
  });
  const markerLegend = (label: string, color: string, dash: string) => {
    parts.push(`<line x1="70" y1="${cursor - 6}" x2="95" y2="${cursor - 6}" stroke="${color}" stroke-width="3" stroke-dasharray="${dash}"/>`);
    wrap(label, 110).forEach(line => { parts.push(text(line, 104, cursor)); cursor += 26; });
  };
  references.forEach((reference, i) => markerLegend(`Guide: ${reference.name} (${valueLabel(reference.value, chart.percent)})`, referenceColors[i], "8 6"));
  targets.forEach((target, i) => markerLegend(`Target: ${target.name} (per-category dashed markers)`, targetColors[i], "5 4"));
  cursor += 20;
  const allValues = [...chart.series, ...targets].flatMap(series => series.values.filter((value): value is number => value !== null));
  allValues.push(...references.map(reference => reference.value));
  let minimum = chart.domain?.[0] ?? Math.min(0, ...allValues);
  let maximum = chart.domain?.[1] ?? Math.max(chart.percent ? 1 : 0, ...allValues);
  if (minimum === maximum) maximum = minimum + 1;
  // Scaling before subtraction also handles very large, finite positive/negative data.
  const magnitude = Math.max(Math.abs(minimum), Math.abs(maximum), 1);
  minimum /= magnitude;
  maximum /= magnitude;
  const plotLeft = 160;
  const plotWidth = WIDTH - plotLeft - 70;
  const captions = [
    "Missing values are unavailable, not zero. Line gaps indicate missing values; each panel continues the same full dataset.",
    ...(chart.domain ? [`Fixed axis domain: ${valueLabel(chart.domain[0], chart.percent)} to ${valueLabel(chart.domain[1], chart.percent)}. Values outside these bounds are clipped to the plotting area.`] : []),
    ...(references.length ? ["Dashed reference guides span each panel; their names and values appear in the legend."] : []),
    ...(targets.length ? ["Dashed target markers apply to individual categories, not recorded results. Unavailable targets have no marker."] : []),
    ...(chart.percent ? ["Percentages use numeric fractions: 0.5 is displayed as 50%."] : []),
    ...chart.notes.map(note => `Note: ${note}`),
  ];
  const footerHeight = captions.reduce((sum, caption) => sum + wrap(caption, Math.floor(1420 / (17 * 0.6))).length * 25, 0)
    + (!chart.labels.length ? 26 : 0) + 35;
  const preferredPanelSize=chart.fixturePoints||chart.handicapHistory?Math.min(14,chart.labels.length):8;
  const minimumPanelSize = Math.max(2, Math.min(preferredPanelSize, Math.floor(24 / chart.series.length)));
  const maximumPanelSize = Math.max(minimumPanelSize, Math.min(14, Math.floor(36 / chart.series.length)));
  const panelsFor = (size: number) => {
    const panels = [];
    for (let offset = 0; offset < chart.labels.length; offset += size) {
      const labels = chart.labels.slice(offset, offset + size);
      const slot = plotWidth / labels.length;
      const wrapped = labels.map(label => wrap(label, Math.max(6, Math.floor((slot - 12) / 9))));
      panels.push({ offset, labels, slot, wrapped, labelLines: Math.max(...wrapped.map(lines => lines.length)) });
    }
    return panels;
  };
  let layout: { panels: ReturnType<typeof panelsFor>; plotHeight: number } | undefined;
  // Keep labels at their original font size; first pack more categories, then reduce only plot height.
  for (const plotHeight of [290, 260, 240]) {
    for (let size = minimumPanelSize; size <= maximumPanelSize; size++) {
      const panels = panelsFor(size);
      const height = cursor + footerHeight + panels.reduce((sum, panel) => sum + 120 + plotHeight + panel.labelLines * 22, 0);
      if (height <= MAX_HEIGHT) { layout = { panels, plotHeight }; break; }
    }
    if (layout) break;
  }
  if (!layout) throw new Error("Chart exceeds the readable image size limit (1600 × 8192). Narrow the report filters.");
  const { plotHeight } = layout;
  for (const { offset, labels, slot, wrapped } of layout.panels) {
    const plotTop = cursor + 25;
    const plotBottom = plotTop + plotHeight;
    const clipId = `report-plot-${offset}`;
    const clip = `clip-path="url(#${clipId})"`;
    parts.push(`<defs><clipPath id="${clipId}"><rect x="${plotLeft}" y="${plotTop - 1}" width="${plotWidth}" height="${plotHeight + 2}"/></clipPath></defs>`);
    const y = (value: number) => plotBottom - ((value / magnitude - minimum) / (maximum - minimum)) * plotHeight;
    const zero = Math.min(plotBottom, Math.max(plotTop, y(0)));
    for (let tick = 0; tick <= 4; tick++) {
      const normalized = minimum + (maximum - minimum) * tick / 4;
      const tickY = plotBottom - plotHeight * tick / 4;
      parts.push(`<line x1="${plotLeft}" y1="${tickY}" x2="${plotLeft + plotWidth}" y2="${tickY}" stroke="#d7e3e8"/>`);
      parts.push(text(valueLabel(normalized * magnitude, chart.percent), plotLeft - 16, tickY + 6, 'text-anchor="end"', 15));
    }
    parts.push(text(chart.percent ? "Percent (%)" : "Value", plotLeft, plotTop - 14, 'font-weight="700"', 16));
    parts.push(`<line x1="${plotLeft}" y1="${plotTop}" x2="${plotLeft}" y2="${plotBottom}" stroke="#15334a"/>`);
    parts.push(`<line x1="${plotLeft}" y1="${zero}" x2="${plotLeft + plotWidth}" y2="${zero}" stroke="#15334a"/>`);
    labels.forEach((label, local) => {
      const x = plotLeft + slot * (local + 0.5);
      wrapped[local].forEach((line, i) => parts.push(text(line, x, plotBottom + 30 + i * 22, 'text-anchor="middle"', 17)));
    });
    chart.series.forEach((series, s) => {
      let path = "";
      let connected = false;
      const points: string[] = [];
      labels.forEach((label, local) => {
        const value = series.values[offset + local];
        const groupWidth = slot * 0.8;
        const barWidth = groupWidth / chart.series.length;
        const x = chart.kind === "bar"
          ? plotLeft + slot * local + slot * 0.1 + (s + 0.5) * barWidth
          : plotLeft + slot * (local + 0.5);
        const tooltip = `<title>${xml(`${series.name} / ${label}: ${valueLabel(value, chart.percent)}`)}</title>`;
        if (value === null) {
          connected = false;
          if (chart.kind === "bar") parts.push(text("N/A", x, Math.min(plotBottom - 8, zero - 8), 'text-anchor="middle" fill="#627580"', 12));
          return;
        }
        const pointY = y(value);
        const pointColor=series.pointColors?.[offset+local];
        const color=pointColor&&/^#[0-9a-f]{6}$/i.test(pointColor)?pointColor:colors[s];
        if (chart.kind === "bar") {
          parts.push(`<rect x="${x - barWidth * 0.4}" y="${Math.min(pointY, zero)}" width="${barWidth * 0.8}" height="${Math.max(1, Math.abs(pointY - zero))}" fill="${color}" ${clip}>${tooltip}</rect>`);
          const labelY = Math.max(plotTop + 15, Math.min(plotBottom - 6, value >= 0 ? pointY - 7 : pointY + 18));
          parts.push(text(valueLabel(value, chart.percent), x, labelY, 'text-anchor="middle"', 13));
          const state=series.pointLabels?.[offset+local];
          if(state){
            const inside=Math.abs(pointY-zero)>=22;
            const fill=inside?(color===fixtureLocationColors.away?"#493219":"#ffffff"):"#15334a";
            parts.push(text(state,x,inside?zero-8:plotBottom+14,`text-anchor="middle" fill="${fill}" font-weight="700"`,12));
          }
        } else {
          path += `${connected ? "L" : "M"}${x},${pointY} `;
          connected = true;
          points.push(`<circle cx="${x}" cy="${pointY}" r="5" fill="${color}" stroke="#ffffff" stroke-width="2" ${clip}>${tooltip}</circle>`);
          points.push(text(valueLabel(value, chart.percent), x, Math.max(plotTop + 15, Math.min(plotBottom - 6, pointY - 10 - (s % 3) * 17)), `text-anchor="middle" fill="${colors[s]}"`, 13));
        }
      });
      if (path) parts.push(`<path d="${path}" fill="none" stroke="${colors[s]}" stroke-width="3" ${clip}/>`);
      parts.push(...points);
    });
    references.forEach((reference, i) => {
      const guideY = y(reference.value);
      parts.push(`<line data-reference-index="${i}" x1="${plotLeft}" y1="${guideY}" x2="${plotLeft + plotWidth}" y2="${guideY}" stroke="${referenceColors[i]}" stroke-width="2" stroke-dasharray="8 6" ${clip}><title>${xml(`${reference.name}: ${valueLabel(reference.value, chart.percent)}`)}</title></line>`);
      if (guideY >= plotTop && guideY <= plotBottom) {
        parts.push(text(`${reference.name}: ${valueLabel(reference.value, chart.percent)}`, plotLeft + plotWidth - 8, Math.max(plotTop + 17, guideY - 8), `text-anchor="end" fill="${referenceColors[i]}"`, 15));
      }
    });
    targets.forEach((target, i) => {
      labels.forEach((label, local) => {
        const value = target.values[offset + local];
        if (value === null) return;
        const targetY = y(value);
        const x = plotLeft + slot * local + slot * 0.1;
        parts.push(`<line data-target-index="${i}" data-category-index="${offset + local}" x1="${x}" y1="${targetY}" x2="${x + slot * 0.8}" y2="${targetY}" stroke="${targetColors[i]}" stroke-width="3" stroke-dasharray="5 4" ${clip}><title>${xml(`${target.name} / ${label}: ${valueLabel(value, chart.percent)}`)}</title></line>`);
      });
    });
    cursor = plotBottom + 30 + Math.max(...wrapped.map(lines => lines.length)) * 22;
    parts.push(text(`Category (${offset + 1}–${offset + labels.length} of ${chart.labels.length})`, plotLeft + plotWidth / 2, cursor, 'text-anchor="middle" font-weight="700"', 16));
    cursor += 65;
  }
  if (!chart.labels.length) paragraph("No categories available for the selected filters.");
  captions.forEach(caption => paragraph(caption, 17));
  const height = Math.ceil(cursor + 35);
  if (height > MAX_HEIGHT) throw new Error("Chart exceeds the readable image size limit (1600 × 8192). Narrow the report filters.");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-labelledby="chart-title chart-description"><title id="chart-title">${xml(chart.title)}</title><desc id="chart-description">${xml(`${scopeLabel(snapshot.scope)}. ${chart.notes.join(" ")} All ${chart.labels.length} categories; unavailable values are not zero.`)}</desc><rect width="100%" height="100%" fill="#ffffff"/><g font-family="Arial, Helvetica, sans-serif" fill="#15334a">${parts.join("")}</g></svg>`;
  return { svg, width: WIDTH, height };
}

export function chartSvg(chart: ReportChart, snapshot: ChartContext): string {
  return render(chart, snapshot).svg;
}

export async function chartPng(chart: ReportChart, snapshot: ChartContext): Promise<Blob> {
  if (typeof document === "undefined" || typeof Image === "undefined" || typeof URL.createObjectURL !== "function") {
    throw new Error("PNG chart export requires a browser with canvas support.");
  }
  const { svg, width, height } = render(chart, snapshot);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The browser cannot create a chart canvas.");
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { image.onload = null; image.onerror = null; reject(new Error("Chart image loading timed out.")); }, 15_000);
      image.onload = () => { clearTimeout(timer); resolve(); };
      image.onerror = () => { clearTimeout(timer); reject(new Error("The browser could not load the standalone chart image.")); };
      try { image.src = url; }
      catch (error) { clearTimeout(timer); reject(error); }
    });
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Chart PNG encoding timed out.")), 15_000);
      try {
        canvas.toBlob(blob => {
          clearTimeout(timer);
          if (blob) resolve(blob);
          else reject(new Error("The browser could not encode the chart PNG."));
        }, "image/png");
      } catch (error) { clearTimeout(timer); reject(error); }
    });
  } finally {
    image.onload = null;
    image.onerror = null;
    image.src = "";
    URL.revokeObjectURL(url);
    canvas.width = 0;
    canvas.height = 0;
  }
}

export async function downloadChart(chart: ReportChart, snapshot: ChartContext): Promise<void> {
  downloadFile(await chartPng(chart, snapshot), reportFilename(`${chart.title} - ${scopeLabel(snapshot.scope)}`, "png"));
}
