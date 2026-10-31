"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReportPreview } from "@/components/reports/report-preview";
import { ExportActions } from "@/components/reports/export-actions";
import { useReportContext } from "@/components/reports/report-provider";
import { buildReport } from "@/lib/reports/datasets";
import { getReportSource } from "@/lib/reports/request";
import { reportCatalog, reportConfigSchema, type ReportConfig, type ReportSnapshot, type ReportSource, type SectionId } from "@/lib/reports/contracts";

export function ReportBuilder({ source, scope }: { source: ReportSource; scope: "ndc" | "all" }) {
  const params = useSearchParams();
  const context = useReportContext();
  const [config,setConfig] = useState<ReportConfig>(() => {
    try { return reportConfigSchema.parse(JSON.parse(params.get("config") ?? '{"sections":["season","squad","pairings","home-away"]}')); }
    catch { return reportConfigSchema.parse({sections:["season","squad","pairings","home-away"]}); }
  });
  const [snapshot,setSnapshot] = useState<ReportSnapshot | null>(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  function change(patch: Partial<ReportConfig>) { setConfig(previous=>({...previous,...patch}));setSnapshot(null);setError(""); }
  function toggle(id: SectionId) {
    change({sections:config.sections.includes(id)?config.sections.filter(value=>value!==id):[...config.sections,id]});
  }
  function move(index: number, direction: number) {
    const sections=[...config.sections];
    [sections[index],sections[index+direction]]=[sections[index+direction],sections[index]];
    change({sections});
  }
  async function preview() {
    setBusy(true);setError("");setSnapshot(null);
    try {
      if(!config.sections.length)throw new Error("Select at least one report section.");
      if(!config.charts&&!config.tables)throw new Error("Include charts, tables, or both.");
      const {source:fresh,scope:current}=await getReportSource();
      if(current!==scope)throw new Error("Results scope changed. Reload the builder.");
      const next=buildReport(fresh,scope,config);
      for(const id of config.sections.filter(value=>value.startsWith("lineup-"))) {
        if(!context?.staged||context.staged.scope!==scope||context.staged.section.id!==id)
          throw new Error("Open the lineup tool, generate recommendations, then use Customize / combine sections to include them.");
        const index=config.sections.indexOf(id);
        next.sections.splice(index,0,context.staged.section);
      }
      setSnapshot(next);
    } catch(problem) {setError(problem instanceof Error?problem.message:"Could not prepare report.");}
    finally {setBusy(false);}
  }
  const current=snapshot?.scope===scope?snapshot:null;
  return <div className="page-shell screen-desk">
    <PageHeader title="Reports, ready to share." eyebrow="Conveners desk / Reports"
      description="Choose sections, preview a fixed snapshot, then download PDF, Excel, CSV datasets or chart images. Contacts, private notes and uploaded slips are never included." />
    <p className="desk-note">Scope: <strong>{scope==="ndc"?"NDC only":"All (internal)"}</strong>. Use the header to change it app-wide. Date range uses fixture dates, inclusively. Player selection filters player evidence, not the team scoring denominator. Generated recommendations retain their tool inputs; builder filters do not recalculate them. No saved templates or automatic delivery.</p>
    <div className="desk-two-column items-start">
      <section className="desk-panel desk-stack">
        <h2 className="font-semibold">Report sections</h2>
        <p className="text-sm text-muted-foreground">Select sections below, then order the selected sections.</p>
        <div className="grid gap-2">
          {reportCatalog.map(([id,label])=><label key={id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={config.sections.includes(id)} onChange={()=>toggle(id)} />{label}
          </label>)}
        </div>
        <div className="report-builder-sections" aria-label="Report section order">
          {config.sections.map((id,index)=><div key={id}><span className="min-w-0 flex-1 text-sm">{index+1}. {reportCatalog.find(([key])=>key===id)![1]}</span>
            <Button size="sm" variant="outline" aria-label={`Move ${id} up`} disabled={index===0} onClick={()=>move(index,-1)}>Up</Button>
            <Button size="sm" variant="outline" aria-label={`Move ${id} down`} disabled={index===config.sections.length-1} onClick={()=>move(index,1)}>Down</Button>
          </div>)}
        </div>
      </section>
      <section className="desk-panel desk-stack">
        <h2 className="font-semibold">Selection and presentation</h2>
        <div className="report-builder-options">
          <label>Report title<Input value={config.title} maxLength={120} onChange={event=>change({title:event.target.value})} /></label>
          <label>From fixture date<Input type="date" value={config.from??""} onChange={event=>change({from:event.target.value||undefined})} /></label>
          <label>To fixture date<Input type="date" value={config.to??""} onChange={event=>change({to:event.target.value||undefined})} /></label>
          <label>Location (applicable sections)<select className="report-select" value={config.location} onChange={event=>change({location:event.target.value as ReportConfig["location"]})}>
            <option value="all">All locations</option><option value="home">Home</option><option value="away">Away</option>
          </select></label>
          <label>Minimum appearances (pairs, leaders, home/away)<Input type="number" min={1} max={1000} value={config.minimum} onChange={event=>change({minimum:Number(event.target.value)})} /></label>
          <label>Search (squad, clubs and fixtures)<Input value={config.search} onChange={event=>change({search:event.target.value})} /></label>
          <label>Roster status<select className="report-select" value={config.status} onChange={event=>change({status:event.target.value as ReportConfig["status"]})}>
            <option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option>
          </select></label>
          <label>Roster / comparison sort<select className="report-select" value={config.sort} onChange={event=>change({sort:event.target.value})}>
            {["name","handicap","appearances","record","yield","away","home-edge"].map(value=><option value={value} key={value}>{value}</option>)}
          </select></label>
          <label>Sort direction<select className="report-select" value={config.direction} onChange={event=>change({direction:event.target.value as "asc"|"desc"})}><option value="asc">Ascending</option><option value="desc">Descending</option></select></label>
          <label>Player profile detail<select className="report-select" value={config.profileTab} onChange={event=>change({profileTab:event.target.value as ReportConfig["profileTab"]})}>
            {["overview","history","partners","handicaps","venues"].map(value=><option value={value} key={value}>{value}</option>)}
          </select></label>
          <label>Data quality queue<select className="report-select" value={config.queue} onChange={event=>change({queue:event.target.value as ReportConfig["queue"]})}>
            {["all","results","handicaps","roster"].map(value=><option value={value} key={value}>{value}</option>)}
          </select></label>
          <div className="grid gap-1.5 text-sm"><label htmlFor="report-players">Players (none = all; required for individual profiles)</label>
            <select id="report-players" multiple size={5} aria-label="Select report players" className="rounded-lg border bg-card p-2" value={config.playerIds.map(String)} onChange={event=>change({playerIds:[...event.target.selectedOptions].map(option=>Number(option.value))})}>
              {source.players.map(player=><option value={player.id} key={player.id}>{player.name}</option>)}
            </select>
            <Button size="sm" variant="outline" onClick={()=>change({playerIds:[]})}>Clear player selection</Button>
          </div>
          <div className="grid gap-1.5 text-sm"><label htmlFor="report-fixtures">Fixtures (none = all in date range)</label>
            <select id="report-fixtures" multiple size={5} aria-label="Select report fixtures" className="rounded-lg border bg-card p-2" value={config.fixtureIds.map(String)} onChange={event=>change({fixtureIds:[...event.target.selectedOptions].map(option=>Number(option.value))})}>
              {source.fixtures.map(fixture=><option value={fixture.id} key={fixture.id}>{fixture.date} · {fixture.opponentClubName}</option>)}
            </select>
            <Button size="sm" variant="outline" onClick={()=>change({fixtureIds:[]})}>Clear fixture selection</Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label><input type="checkbox" checked={config.charts} onChange={event=>change({charts:event.target.checked})} /> Include charts</label>
          <label><input type="checkbox" checked={config.tables} onChange={event=>change({tables:event.target.checked})} /> Include tables</label>
        </div>
        <p className="text-xs text-muted-foreground">These options control PDF, preview and print. CSV and Excel always retain the underlying data tables; Excel also includes chart data when charts are enabled.</p>
        <Button disabled={busy} onClick={preview}>{busy?"Preparing snapshot…":"Preview report"}</Button>
        {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
      </section>
    </div>
    {current&&<section className="desk-stack">
      <ExportActions key={current.generatedAt} snapshot={current} />
      <ReportPreview snapshot={current} />
    </section>}
  </div>;
}
