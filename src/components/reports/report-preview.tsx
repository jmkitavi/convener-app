"use client";

import type { Cell, ReportChart, ReportSnapshot } from "@/lib/reports/contracts";
import { FixturePointsChart } from "@/components/fixture-chart";
import { PlayerHandicapChart } from "@/components/player-handicap-chart";

export function formatReportCell(value: Cell, type?: string) {
  if (value === null) return "\u2014";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return type === "percent" ? `${(value * 100).toFixed(1)}%` : Number.isInteger(value) ? String(value) : value.toFixed(2);
  return value;
}

function ChartPreview({ chart }: { chart: ReportChart }) {
  if(chart.fixturePoints)return <figure className="report-chart report-source-chart">
    <figcaption>{chart.title}</figcaption>
    <FixturePointsChart fixtures={chart.fixturePoints} readOnly referenceTargetsVisible={!!chart.targets} />
  </figure>;
  if(chart.handicapHistory)return <figure className="report-chart report-source-chart">
    <figcaption>{chart.title}</figcaption>
    {chart.handicapHistory.length?<PlayerHandicapChart points={chart.handicapHistory} />:<p>No recorded handicaps to chart for this selection.</p>}
    {chart.notes.map(note=><p key={note} className="report-note">{note}</p>)}
  </figure>;
  const values = chart.series.flatMap(series => series.values.filter((value): value is number => value !== null));
  const max = chart.domain?.[1] ?? Math.max(chart.percent ? 1 : 0, ...values.map(Math.abs), 1);
  return <figure className="report-chart">
    <figcaption>{chart.title}</figcaption>
    {!chart.labels.length && <p>No data to chart for this selection.</p>}
    <div className="report-series-key">{chart.series.map(series => <span key={series.name}><i style={{ background: series.color }} />{series.name}</span>)}
      {chart.referenceLines?.map(line=><span key={line.name}>{line.name}: {line.value}</span>)}
      {chart.targets&&<span>{chart.targets.name}</span>}
    </div>
    {chart.labels.map((label, index) => <div key={index} className="report-chart-row">
      <span>{label}</span>
      <div>{chart.series.map(series => <div key={series.name} className="report-bar-row">
        <div className="report-bar-track"><span style={{ width: `${Math.abs(series.values[index] ?? 0) / max * 100}%`, background: series.color }} />
          {chart.referenceLines?.map(line=><i key={line.name} title={`${line.name}: ${line.value}`} style={{left:`${line.value/max*100}%`,borderColor:line.color}} />)}
          {chart.targets&&chart.targets.values[index]!==null&&<i title={`${chart.targets.name}: ${chart.targets.values[index]}`} style={{left:`${chart.targets.values[index]!/max*100}%`,borderColor:chart.targets.color}} />}
        </div>
        <span>{formatReportCell(series.values[index] ?? null, chart.percent ? "percent" : "number")}</span>
      </div>)}</div>
    </div>)}
    {chart.notes.map(note => <p key={note} className="report-note">{note}</p>)}
  </figure>;
}

export function ReportPreview({ snapshot }: { snapshot: ReportSnapshot }) {
  return <article className="report-document">
    <header><p className="report-kicker">Conveners desk</p><h1>{snapshot.title}</h1>
      <p>Generated {new Date(snapshot.generatedAt).toLocaleString("en-GB")} · {snapshot.scope === "ndc" ? "NDC only" : "All (internal)"}</p>
      {snapshot.filters.map(filter => <p key={filter} className="report-note">{filter}</p>)}
    </header>
    {snapshot.sections.map((section, index) => <section key={`${section.id}-${index}`} className="report-section">
      <h2>{section.title}</h2>
      {section.notes.map(note => <p className="report-note" key={note}>{note}</p>)}
      {snapshot.showCharts && section.charts.map(chart => <ChartPreview key={chart.id} chart={chart} />)}
      {snapshot.showTables && section.tables.map(table => <div key={table.id} className="report-table-block">
        <h3>{table.title} <small>({table.rows.length} rows)</small></h3>
        {!table.rows.length ? <p>No matching records.</p> : <div className="report-table-scroll"><table>
          <thead><tr>{table.columns.map((column,index) => <th key={index}>{column.label}</th>)}</tr></thead>
          <tbody>{table.rows.map((row,index) => <tr key={index}>{table.columns.map((column,i) => <td key={i}>{formatReportCell(row[i] ?? null,column.type)}</td>)}</tr>)}</tbody>
        </table></div>}
      </div>)}
    </section>)}
  </article>;
}
