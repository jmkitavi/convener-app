(() => {
  "use strict";
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const escape = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  const icons = {
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m2-16a3 3 0 0 1 0 6m2 3a5 5 0 0 1 2 4v3"/>',
    chart: '<path d="M4 3v17h17M8 15l4-5 4 2 5-7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    upload: '<path d="M12 16V3m-5 5 5-5 5 5M3 15v5h18v-5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
    pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3"/>',
    flag: '<path d="M5 21V3m0 1c5-4 9 4 14 0v9c-5 4-9-4-14 0"/>',
    edit: '<path d="m16 3 5 5-12 12-6 1 1-6Z"/><path d="m14 5 5 5"/>',
    download: '<path d="M12 3v13m-5-5 5 5 5-5M3 17v4h18v-4"/>'
  };
  const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.chart}</svg>`;
  const routes = [
    ["/fixtures", "Fixtures & results", "Fixtures", "calendar"], ["/fixtures/new", "New fixture", "Fixtures", "plus"], ["/fixtures/1", "Fixture scorecard", "Fixtures", "flag"],
    ["/fixtures/import", "Import · upload", "Results import", "upload"], ["/fixtures/import/review", "Import · review", "Results import", "check"], ["/fixtures/import/preview", "Import · preview", "Results import", "flag"],
    ["/players", "Squad roster", "People & clubs", "users"], ["/players/1", "Player profile", "People & clubs", "users"], ["/clubs", "Clubs management", "People & clubs", "pin"],
    ["/analytics", "Analytics overview", "Performance", "chart"], ["/analytics/pairings", "Partnerships", "Performance", "users"], ["/analytics/venues", "Venues", "Performance", "pin"],
    ["/analytics/handicaps", "Handicaps", "Performance", "chart"], ["/analytics/leaderboards", "Points leaders", "Performance", "flag"], ["/analytics/home-away", "Home & away", "Performance", "pin"], ["/analytics/data-quality", "Data quality", "Performance", "check"],
    ["/analytics/suggest", "Home pairing tool", "Selection tools", "target"], ["/analytics/counter", "Away counter tool", "Selection tools", "target"]
  ];
  const roster = [
    {name:"Alex Mwangi",hc:8.4,played:8,points:12,rate:75,form:"WWDLW",active:true},
    {name:"Daniel Otieno",hc:12.1,played:7,points:10,rate:71,form:"WLWWW",active:true},
    {name:"Elias Kamau",hc:15.7,played:8,points:9,rate:56,form:"LWDWL",active:true},
    {name:"Felix Njoroge",hc:6.8,played:6,points:8,rate:67,form:"WWLWD",active:true},
    {name:"Isaac Wekesa",hc:19.2,played:6,points:7,rate:58,form:"DWWLL",active:true},
    {name:"Jonah Kariuki",hc:11.5,played:5,points:6,rate:60,form:"WLWLW",active:true},
    {name:"Leon Kimani",hc:22.3,played:4,points:4,rate:50,form:"WLLW",active:true},
    {name:"Noah Barasa",hc:17.6,played:4,points:3,rate:38,form:"LDWL",active:true},
    {name:"Owen Maina",hc:9.6,played:3,points:3,rate:50,form:"WDL",active:true},
    {name:"Peter Kibet",hc:24.1,played:2,points:2,rate:50,form:"WL",active:false}
  ];
  const fixtures = [
    {name:"Cedar Valley",date:"14 Nov 2026",venue:"Home",status:"Scheduled",points:"—",record:"Lineup not set"},
    {name:"Highland Ridge",date:"31 Oct 2026",venue:"Away",status:"Scheduled",points:"—",record:"12 players selected"},
    {name:"Lakeside Golf Club",date:"17 Oct 2026",venue:"Home",status:"Missing",points:"—",record:"Results required"},
    {name:"Acacia Park",date:"03 Oct 2026",venue:"Away",status:"Lost",points:"12",record:"3W · 5L · 2H"},
    {name:"Cedar Valley",date:"19 Sep 2026",venue:"Home",status:"Won",points:"21",record:"6W · 2L · 2H"},
    {name:"Highland Ridge",date:"05 Sep 2026",venue:"Away",status:"Drawn",points:"15",record:"4W · 4L · 2H"},
    {name:"Lakeside Golf Club",date:"22 Aug 2026",venue:"Home",status:"Won",points:"18",record:"5W · 3L · 2H"},
    {name:"Acacia Park",date:"08 Aug 2026",venue:"Away",status:"Lost",points:"9",record:"2W · 6L · 2H"},
    {name:"Highland Ridge",date:"12 Jul 2026",venue:"Away",status:"Missing",points:"—",record:"Results required"},
    {name:"Highland Ridge",date:"11 Jul 2026",venue:"Home",status:"Won",points:"21",record:"6W · 2L · 2H"},
    {name:"Acacia Park",date:"27 Jun 2026",venue:"Home",status:"Won",points:"18",record:"5W · 3L · 2H"},
    {name:"Lakeside Golf Club",date:"13 Jun 2026",venue:"Away",status:"Lost",points:"12",record:"3W · 5L · 2H"}
  ];
  let matches = [
    ["Alex Mwangi + Daniel Otieno","M. Reed + T. Vale","Won","2 & 1"],
    ["Elias Kamau + Felix Njoroge","J. Cole + B. West","Won","3 & 2"],
    ["Isaac Wekesa + Jonah Kariuki","S. Lake + P. Gray","Halved","All square"],
    ["Leon Kimani + Noah Barasa","R. Dale + C. North","Lost","1 down"],
    ["Owen Maina + Peter Kibet","A. Hill + D. Ford","Won","2 up"]
  ];
  const state = { fixtureFilter:"All", fixtureQuery:"", playerQuery:"", playerFilter:"Active", profileTab:"Overview", scope:"All", quality:"All", selected:new Set([0,1,2,3,4,5,6,7]), generated:false, counterStage:0, counterOrder:[0,1,2,3,4,5,6,7], reviewFixed:false, importComplete:false, uploaded:"", profileId:0, clubQuery:"", fixtureClub:"Cedar Valley", fixtureDate:"2026-09-19", fixtureVenue:"Home", notes:"A measured start, with three partnerships bringing home wins. Wind picked up after the turn." };
  const opponents=[["Mason Reed","Theo Vale",7.2,14.6],["Jasper Cole","Blake West",10.3,18.1],["Seth Lake","Perry Gray",13.4,21],["Robin Dale","Casey North",9.8,16.7]];
  const counterPlayer = i => roster[state.counterOrder[i]];
  let current = "/fixtures";
  let toastTimer;
  const initials = (n) => n.split(" ").slice(0,2).map(p=>p[0]).join("");
  const badge = (text, cls = text.toLowerCase()) => `<span class="badge ${cls}"><i></i>${escape(text)}</span>`;
  const go = (path, label, cls = "btn", glyph = "") => `<a class="${cls}" href="#${path}">${glyph ? icon(glyph) : ""}${label}</a>`;
  const button = (label, action, cls = "btn", glyph = "", extra = "") => `<button type="button" class="${cls}" data-action="${action}" ${extra}>${glyph ? icon(glyph) : ""}${label}</button>`;
  const heading = (eyebrow,title,description,actions="") => `<div class="page-head"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${description}</p></div><div class="actions">${actions}</div></div>`;
  const panelHead = (title,subtitle="",actions="") => `<div class="panel-head"><div><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ""}</div>${actions}</div>`;
  const note = (text,amber=false) => `<div class="note${amber?" amber":""}">${icon("info")}<span>${text}</span></div>`;
  const table = (heads,rows,caption) => `<div class="table-wrap" tabindex="0" aria-label="${caption}; scroll table horizontally if needed"><table><caption class="sr-only">${caption}</caption><thead><tr>${heads.map(h=>`<th scope="col">${h}</th>`).join("")}</tr></thead><tbody>${rows.join("") || `<tr><td colspan="${heads.length}"><div class="empty"><strong>No matching sample records</strong>Try another search or filter.</div></td></tr>`}</tbody></table></div>`;
  const stat = (label,value,detail) => `<article class="stat"><span>${label}</span><strong>${value}</strong><small>${detail}</small></article>`;
  const stats = (items) => `<div class="stat-grid">${items.map(x=>stat(...x)).join("")}</div>`;
  const segmented = (items,selected,action) => `<div class="segmented" role="group" aria-label="${action==="scope"?"Filter venue scope":action==="fixtures-filter"?"Filter fixture status":"Filter records"}">${items.map(x=>`<button class="${x===selected?"selected":""}" aria-pressed="${x===selected}" data-action="${action}" data-value="${x}">${x}</button>`).join("")}</div>`;
  const search = (label,id,value) => `<label class="search">${icon("search")}<span class="sr-only">${label}</span><input id="${id}" type="search" placeholder="${label}" value="${escape(value)}" autocomplete="off"></label>`;
  const field = (label,content,full=false) => `<label class="field${full?" full":""}">${label}${content}</label>`;
  const options = (values,selected) => values.map(v=>`<option${v===selected?" selected":""}>${escape(v)}</option>`).join("");
  const formDots = p => `<span class="dots" aria-label="Recent form: ${p.form.split("").map(x=>({W:"win",D:"draw",L:"loss"})[x]).join(", ")}">${p.form.split("").map(x=>`<span class="${x.toLowerCase()}">${x}</span>`).join("")}</span>`;
  const playerName = (p,i=0) => `<a class="cell-name" href="#/players/${i+1}"><span class="avatar">${initials(p.name)}</span><span><strong>${escape(p.name)}</strong><small>Handicap ${p.hc.toFixed(1)}</small></span></a>`;
  const scopeToolbar = () => `<div class="toolbar">${segmented(["All","Home","Away"],state.scope,"scope")}<span class="muted" style="font-size:10px;margin-left:auto">Season 2026 · Sample results</span></div>`;
  const scopeFactor = () => state.scope==="Home"?.65:state.scope==="Away"?.35:1;
  const summary = (items) => `<section class="summary" aria-label="Screen summary">${items.map(([l,v,d])=>`<div><div class="eyebrow">${l}</div><strong>${v}</strong><p>${d}</p></div>`).join("")}</section>`;
  function fixtureList(){
    const filtered=fixtures.filter(f=>(state.fixtureFilter==="All"||state.fixtureFilter==="Recorded"&&["Won","Lost","Drawn"].includes(f.status)||f.status===state.fixtureFilter)&&`${f.name} ${f.venue}`.toLowerCase().includes(state.fixtureQuery.toLowerCase()));
    return heading("THE SEASON / FIXTURES","Fixtures & results","Every fixture, from the first tee to the final scorecard.",go("/fixtures/import","Import results","btn","upload")+go("/fixtures/new","New fixture","btn primary","plus"))+
      stats([["Season fixtures","12","8 recorded · 2 scheduled"],["Results coverage","80%","8 of 10 past fixtures"],["Points captured","126","Of 240 available points"],["Needs attention","2","Past fixtures without results"]])+
      `<section class="panel">${panelHead("Season schedule","Home or away. One consistent record of the season.")}<div class="toolbar">${search("Search opponent or venue","fixture-search",state.fixtureQuery)}${segmented(["All","Scheduled","Recorded","Missing"],state.fixtureFilter,"fixtures-filter")}</div><div id="fixture-rows">${fixtureTable(filtered)}</div><div class="panel-foot">Showing ${filtered.length} synthetic fixtures · Points are normalized to a 30-point fixture scale.</div></section>`;
  }
  function fixtureTable(rows){return table(["Opponent","Date / venue","Match record","Points","Status",""],rows.map(f=>`<tr><td><a class="cell-name" href="#/fixtures/1"><span class="avatar club">${initials(f.name)}</span><span><strong>${f.name}</strong><small>Nairobi District League</small></span></a></td><td>${f.date}<small>${badge(f.venue)}</small></td><td class="muted">${f.record}</td><td><strong>${f.points}</strong>${f.points!=="—"?"<small>/ 30 points</small>":""}</td><td>${badge(f.status)}</td><td>${f.status==="Missing"?go("/fixtures/import","Add results","btn small"):go("/fixtures/1","View","btn small")}</td></tr>`),"Fixture schedule");}
  function newFixture(){
    return heading("FIXTURES / NEW","Plan the next fixture.","Set the details now. Add your lineup and results when you’re ready.",go("/fixtures","Back to fixtures","btn"))+
      `<div class="two-col"><form class="panel" id="fixture-form">${panelHead("Fixture details","A little preparation makes match day simpler.")}<div class="form-grid">${field("Opponent club *",`<select name="club" required><option value="">Select a club</option>${options(["Cedar Valley","Highland Ridge","Lakeside Golf Club","Acacia Park"])}</select>`)}${field("Fixture date *",'<input type="date" name="date" value="2026-11-14" required>')}${field("Home or away *",`<select name="venue">${options(["Home","Away"])}</select>`)}${field("Competition",`<select name="competition">${options(["Nairobi District League","Friendly"])}</select>`)}${field("First tee time",'<input type="time" name="time" value="08:00">')}${field("Expected pairs",'<input type="number" name="pairs" min="1" max="30" value="10">')}${field("Convener’s notes",'<textarea name="notes" placeholder="Meeting point, travel arrangements, or selection notes…"></textarea>',true)}</div><div class="form-footer"><p>Design preview · Saved only in memory.</p><div class="actions">${go("/fixtures","Cancel") }<button class="btn primary" type="submit">${icon("check")}Create sample fixture</button></div></div></form><aside class="panel">${panelHead("Before the first tee")}${note("Fixtures begin as <strong>scheduled</strong>. A past date without matches will appear in the results queue.")}<dl class="detail-list"><div><dt>Season</dt><dd>2026</dd></div><div><dt>Home club</dt><dd>Falcon Hills GC</dd></div><div><dt>Scoring</dt><dd>Pairs matchplay</dd></div><div><dt>Available points</dt><dd>30 per fixture</dd></div></dl><div class="panel-foot">Your selection tools remain separate from the official scorecard.</div></aside></div>`;
  }
  function scorecard(){
    const won=matches.filter(m=>m[2]==="Won").length,draw=matches.filter(m=>m[2]==="Halved").length;
    return heading("FIXTURES / SCORECARD",`Falcon Hills vs ${escape(state.fixtureClub)}`,`${new Date(state.fixtureDate+"T12:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})} · Falcon Hills Golf Club · ${state.fixtureVenue} fixture`,button("Edit fixture","edit-fixture","btn","edit")+button("Add match","add-match","btn primary","plus"))+
      summary([["FIXTURE RESULT",`${won*2+draw} <small>/ ${matches.length*2} match points</small>`,`${won} won · ${draw} halved · ${matches.length-won-draw} lost · Sample scorecard`],["PAIRS RECORDED",`${matches.length} <small>matches</small>`,"Five illustrative pairings shown"],["VENUE","Home","Falcon Hills · NDC 2026"]])+
      `<div class="two-col"><section class="panel">${panelHead("The scorecard","Record the result from our team’s perspective.",button("Export CSV","export-scorecard","btn small","download"))}${table(["#","Our pairing / opponents","Result","Score",""],matches.map((m,i)=>`<tr><td class="muted">${i+1}</td><td><strong>${escape(m[0])}</strong><small>vs ${escape(m[1])}</small></td><td>${badge(m[2],m[2]==="Halved"?"drawn":m[2].toLowerCase())}</td><td>${escape(m[3])}</td><td>${button("Edit","edit-match","btn small","edit",`data-index="${i}" aria-label="Edit match ${i+1}"`)}</td></tr>`),"Fixture match scorecard")}<div class="panel-foot">Pair match points shown here: win = 2, halve = 1. This illustrative subset is not a full normalized fixture total.</div></section><div class="stack"><section class="panel">${panelHead("Match-day notes")}<p class="subtext">${escape(state.notes)}</p><div class="panel-foot">Added by the sample convener · Local preview</div>${button("Edit notes","edit-notes","btn ghost","edit")}</section><section class="panel">${panelHead("Next steps")}<div class="list-row">${icon("users")}<div class="row-body"><strong>Review the partnerships</strong><small>See the season beyond one result.</small></div>${go("/analytics/pairings","Explore","btn small")}</div><div class="list-row">${icon("upload")}<div class="row-body"><strong>Have a full scorecard?</strong><small>Preview the import flow.</small></div>${go("/fixtures/import","Import","btn small")}</div></section></div></div>`;
  }
  const steps=(active)=>`<div class="steps" aria-label="Import progress">${["Upload","Review","Preview"].map((x,i)=>`<div class="step${i===active?" active":""}"${i===active?' aria-current="step"':""}><span>${i<active?"✓":i+1}</span>${x}</div>`).join("")}</div>`;
  function importUpload(){
    return heading("RESULTS / IMPORT","From scorecard to season record.","A careful review before anything becomes part of the season.",go("/fixtures","Back to fixtures","btn"))+steps(0)+
      `<div class="two-col"><section class="panel">${panelHead("Upload a results sheet","Choose a file locally, or explore the built-in synthetic example.")}<div class="form-grid">${field("Attach to fixture",`<select id="import-fixture">${options(["Lakeside Golf Club · 17 Oct · Home","Cedar Valley · 19 Sep · Home"])}</select>`,true)}</div><div class="dropzone" style="margin-top:20px">${icon("upload")}<h3>A scorecard, ready for review.</h3><p>PDF or image · Preview only<br>No file leaves your device. No OCR service is called.</p><label for="import-file" class="sr-only">Choose a sample scorecard file</label><input id="import-file" class="file-input" type="file" accept=".pdf,.png,.jpg,.jpeg"><span id="file-status" class="subtext">${state.uploaded?escape(state.uploaded)+" selected locally":"Or use the sample scorecard below."}</span></div><div class="form-footer"><p>Sample data is used regardless of the file selected.</p>${go("/fixtures/import/review","Explore sample review","btn primary","arrow")}</div></section><aside class="panel">${panelHead("A deliberate import flow")}<div class="list-row">${badge("1","home")}<div class="row-body"><strong>Choose your scorecard</strong><small>Connect it to the correct fixture.</small></div></div><div class="list-row">${badge("2","home")}<div class="row-body"><strong>Check every pairing</strong><small>Resolve names and confirm results.</small></div></div><div class="list-row">${badge("3","home")}<div class="row-body"><strong>Preview the final record</strong><small>Nothing is committed in this design study.</small></div></div>${note("This gallery deliberately makes <strong>no API calls</strong>, including AI, uploads or database writes.")}</aside></div>`;
  }
  function importReview(){
    const sourceRows=matches.map((m,i)=>`<tr><td>${i+1}</td><td>${escape(m[0])}</td><td>${escape(m[2])}<small>${escape(m[3])}</small></td></tr>`);
    const reviewRows=matches.map((m,i)=>`<div class="list-row"><span class="muted">${i+1}</span><div class="row-body"><strong>${escape(m[0])}</strong><small>${escape(m[2])} · ${escape(m[3])}${i===2&&!state.reviewFixed?" · Name confirmation required":""}</small></div>${i===2&&!state.reviewFixed?button("Confirm","resolve-name","btn small"):button("Edit","review-edit","btn small","",`data-index="${i}" aria-label="Edit imported row ${i+1}"`)}</div>`).join("");
    return heading("RESULTS / IMPORT","A second look, before the save.","Lakeside Golf Club · 17 October 2026 · Home",go("/fixtures/import","Change file","btn"))+steps(1)+
      `${state.reviewFixed?note("<strong>All sample names resolved.</strong> The pairings are ready to preview."):note("<strong>1 name needs your attention.</strong> “J. Kariuki” has been suggested as Jonah Kariuki. Confirm the match below.",true)}<div class="two-col equal"><section class="panel">${panelHead("Sample source document","Synthetic scorecard · Not an uploaded file")}<div class="document"><div class="document-head">NAIROBI DISTRICT LEAGUE<strong>Falcon Hills × Lakeside</strong><small>17 October 2026 · Home</small></div>${table(["Pair","Falcon Hills","Result"],sourceRows,"Synthetic document extract")}<p class="subtext" style="text-align:center;margin-top:25px">Fictional design-study document</p></div></section><section class="panel">${panelHead("Review extracted rows","Edit a row locally or confirm the suggested name.")}${reviewRows}<div class="form-footer"><p>${state.reviewFixed?matches.length:matches.length-1} of ${matches.length} rows ready</p>${state.reviewFixed?go("/fixtures/import/preview","Continue to preview","btn primary","arrow"):'<button class="btn primary" disabled title="Confirm the suggested name first">Confirm name to continue</button>'}</div></section></div>`;
  }
  function importPreview(){
    return heading("RESULTS / IMPORT",state.importComplete?"Sample import complete.":"Everything in its right place.",state.importComplete?"The sample result is now marked complete in this tab. No database was changed.":"A final check of what the sample import would add.",go("/fixtures/import/review","Back to review","btn"))+steps(2)+
      summary([["IMPORT SUMMARY","5 <small>pair matches</small>","Lakeside Golf Club · 17 Oct 2026"],["RESULTS CHECKED","3W · 1H · 1L","All names matched · No duplicate sample rows"],["DESTINATION","Home","Falcon Hills · NDC 2026"]])+
      `<section class="panel">${panelHead("Ready for the season record","Sample preview — this action never writes to the app.",badge(state.importComplete?"Completed locally":"Ready","ready"))}${table(["Our pairing","Opponent pairing","Result","Match score"],matches.map(m=>`<tr><td><strong>${escape(m[0])}</strong></td><td class="muted">${escape(m[1])}</td><td>${badge(m[2],m[2]==="Halved"?"drawn":m[2].toLowerCase())}</td><td>${escape(m[3])}</td></tr>`),"Import preview")}${note("<strong>Safe by design.</strong> “Complete sample import” only changes the local preview. No upload, production save or external transmission occurs.")}<div class="form-footer">${button("Start again","reset-import","btn")}<div class="actions">${state.importComplete?go("/fixtures/1","Open sample scorecard","btn primary","arrow"):button("Complete sample import","complete-import","btn primary","check")}</div></div></section>`;
  }
  function squad(){
    const rows=roster.map((p,i)=>({...p,id:i})).filter(p=>(state.playerFilter==="All"||p.active===(state.playerFilter==="Active"))&&p.name.toLowerCase().includes(state.playerQuery.toLowerCase()));
    return heading("THE PEOPLE / SQUAD","The people behind the points.","A considered view of your players, their form and their season.",button("Add player","add-player","btn primary","plus"))+
      stats([["Squad members",String(roster.length),`${roster.filter(p=>p.active).length} active players`],["Fielded this season","10","Across 8 recorded fixtures"],["Median handicap","12.1","Active roster only"],["Available next fixture","8","Illustrative availability"]])+
      `<section class="panel">${panelHead("Season roster","Player yield is wins plus half of draws, divided by appearances.")}<div class="toolbar">${search("Search player name","player-search",state.playerQuery)}${segmented(["Active","Inactive","All"],state.playerFilter,"players-filter")}</div>${table(["Player","Appearances","Points","Yield","Recent form","Status"],rows.map(p=>`<tr><td>${playerName(p,p.id)}</td><td>${p.played}</td><td><strong>${p.points.toFixed(2)}</strong></td><td>${p.rate}%</td><td>${formDots(p)}</td><td>${badge(p.active?"Active":"Inactive",p.active?"home":"pending")}</td></tr>`),"Squad roster")}<div class="panel-foot">Recent form runs oldest to newest. Points are credited to both partners and must not be summed as team totals.</div></section>`;
  }
  function playerProfile(){
    const p=roster[state.profileId]||roster[0];
    return `<div class="profile-hero"><span class="avatar">${initials(p.name)}</span><div><div class="eyebrow">THE SQUAD / PLAYER PROFILE</div><h1>${escape(p.name)}</h1><p>Falcon Hills Golf Club · Handicap ${p.hc.toFixed(1)} · ${p.active?"Active squad":"Inactive squad"}</p></div><div class="actions">${button("Edit player","edit-player","btn","edit")}${go("/players","The squad","btn")}</div></div><div class="tabs" role="tablist" aria-label="Player profile sections">${["Overview","Matches","Partnerships","Handicap history"].map(x=>`<button role="tab" aria-selected="${state.profileTab===x}" aria-controls="profile-content" id="tab-${x.replaceAll(" ","-")}" class="${state.profileTab===x?"selected":""}" data-action="profile-tab" data-value="${x}">${x}</button>`).join("")}</div><div id="profile-content" role="tabpanel" aria-labelledby="tab-${state.profileTab.replaceAll(" ","-")}">${profileContent(p)}</div>`;
  }
  function profileContent(p){
    if(state.profileTab==="Matches") return `<section class="panel">${panelHead("A season, match by match","Illustrative recent appearances.")}${table(["Fixture","Partner","Result","Points"],fixtures.slice(3).map((f,i)=>`<tr><td>${go("/fixtures/1",f.name,"")}<small>${f.date} · ${f.venue}</small></td><td>${escape(roster[(state.profileId+i+1)%roster.length].name)}</td><td>${badge(i%3?"Won":"Lost")}</td><td>${i%3?"2.00":"0.00"}</td></tr>`),"Player matches")}</section>`;
    if(state.profileTab==="Partnerships") return pairingPanel(p.name);
    if(state.profileTab==="Handicap history") return `<section class="panel">${panelHead("A steady handicap journey","Illustrative snapshots, not a connected handicap service.")}${chart(["May","Jun","Jul","Aug","Sep","Oct"],[p.hc+2,p.hc+1.6,p.hc+1.1,p.hc+.4,p.hc+.2,p.hc],30)}<div class="panel-foot">Handicap index snapshots shown for design purposes. Current index: ${p.hc.toFixed(1)}.</div></section>`;
    return stats([["Season points",p.points.toFixed(2),"Pair points credited per player"],["Appearances",String(p.played),"Recorded league matches"],["Result yield",`${p.rate}%`,"Wins + half of draws / played"],["Handicap index",p.hc.toFixed(1),"Sample current index"]])+`<div class="two-col"><section class="panel">${panelHead("A stronger rhythm at home","Points per appearance, not an outcome prediction.")}${chart(["Home","Away"],[1.75,1.1],2)}${note("A small sample tells part of the story. Opponent strength and partner selection also matter.")}</section><section class="panel">${panelHead("Season notebook")}<dl class="detail-list"><div><dt>Preferred format</dt><dd>Fourball matchplay</dd></div><div><dt>Availability</dt><dd>Available · 14 Nov</dd></div><div><dt>Last appearance</dt><dd>03 Oct · Away</dd></div></dl><div style="margin-top:24px">${formDots(p)}</div><p class="subtext">Oldest → newest · W win / D draw / L loss</p><div class="panel-foot">Synthetic profile. Contact and membership details are intentionally not included.</div></section></div>`;
  }
  const clubs=[["Cedar Valley","Ridge County","72 / 129","2"],["Highland Ridge","North District","71 / 125","2"],["Lakeside Golf Club","Lake County","72 / 132","2"],["Acacia Park","East District","73 / 130","2"]];
  function clubScreen(){
    const rows=clubs.map((c,i)=>({c,i})).filter(({c})=>c[0].toLowerCase().includes(state.clubQuery.toLowerCase()));
    return heading("THE LEAGUE / CLUBS","Know the opposition.","A tidy address book for the clubs on your season schedule.",button("Add club","add-club","btn primary","plus"))+
      `<div class="two-col"><section class="panel">${panelHead("Opponent clubs","Synthetic clubs and course information.")}<div class="toolbar">${search("Search clubs","club-search",state.clubQuery)}</div>${table(["Club / location","Course par / slope","Fixtures",""],rows.map(({c,i})=>`<tr><td><span class="cell-name"><span class="avatar club">${initials(c[0])}</span><span><strong>${escape(c[0])}</strong><small>${escape(c[1])}</small></span></span></td><td>${escape(c[2])}</td><td>${c[3]}</td><td>${button("Manage","edit-club","btn small","edit",`data-index="${i}" aria-label="Manage ${escape(c[0])}"`)}</td></tr>`),"Opponent clubs")}</section><aside class="panel">${panelHead("Your home club")}<span class="avatar club" style="width:45px;height:48px;font-size:13px;margin-bottom:17px">FH</span><h2>Falcon Hills Golf Club</h2><p class="subtext">Nairobi District League · 2026</p><dl class="detail-list" style="margin-top:23px"><div><dt>Home course</dt><dd>Falcon Hills</dd></div><div><dt>Par / slope</dt><dd>72 / 128</dd></div><div><dt>Team name</dt><dd>The Falcons</dd></div></dl><div class="panel-foot">Fictional clubs used throughout this preview. No club data is read from the live app.</div></aside></div>`;
  }
  const analyticCards=[
    ["Partnerships","Repeated chemistry, with the sample size in view.","/analytics/pairings","users","24 partnerships · 8 repeated"],
    ["Venue performance","See where the season’s points are won.","/analytics/venues","pin","4 opponent venues"],
    ["Handicap insights","A balanced squad, beyond a single number.","/analytics/handicaps","chart","10 sample handicap indexes"],
    ["Points leaders","Contribution and consistency side by side.","/analytics/leaderboards","flag","Minimum 3 appearances"],
    ["Home & away","Two very different parts of the same season.","/analytics/home-away","pin","Home 65% · Away 40%"],
    ["Data quality","Better decisions begin with a complete record.","/analytics/data-quality","check","2 results gaps to resolve"],
    ["Home pairing tool","Build a considered lineup for the next fixture.","/analytics/suggest","target","Local sample suggestions"],
    ["Away counter tool","Respond to an opponent’s ordered lineup.","/analytics/counter","target","Three-step lineup workspace"]
  ];
  function analyticsHub(){
    return heading("TEAM INTELLIGENCE / ANALYTICS","Make the next decision a better one.","The season’s patterns, with their limitations kept in view.",go("/analytics/data-quality","Check data quality","btn","check"))+
      summary([["POINTS CAPTURED","126 <small>/ 240 pts</small>","52.5% of available points · 8 recorded fixtures"],["AT HOME","65<small>%</small>","78 of 120 points · 4 fixtures"],["ON THE ROAD","40<small>%</small>","48 of 120 points · 4 fixtures"]])+
      `<div class="eyebrow" style="margin:27px 0 17px">A CLEARER PICTURE OF THE SEASON</div><div class="cards">${analyticCards.map(([title,desc,path,glyph,foot])=>`<a class="insight-card" href="#${path}">${icon(glyph)}<h2>${title}</h2><p>${desc}</p><small class="muted">${foot}</small><span>Explore ${icon("arrow")}</span></a>`).join("")}</div>`;
  }
  function pairingPanel(name=""){
    const pairs=[[name||"Alex Mwangi","Daniel Otieno",5,4,1,0,82],[name||"Elias Kamau","Felix Njoroge",4,2,1,1,63],[name||"Isaac Wekesa","Jonah Kariuki",3,2,0,1,61],[name||"Leon Kimani","Noah Barasa",2,1,0,1,52]];
    const offset=state.scope==="Home"?5:state.scope==="Away"?-8:0;
    return `<section class="panel">${panelHead("Partnerships worth revisiting","Adjusted yield keeps short, unbeaten runs in perspective.")}${table(["Partnership","Played","Record","Raw yield","Adjusted"],pairs.map((p,i)=>`<tr><td><strong>${escape(p[0])}</strong><small>+ ${escape(p[1])}</small></td><td>${Math.max(1,p[2]-(state.scope!=="All"?1:0))}</td><td class="muted">${p[3]}W · ${p[4]}H · ${p[5]}L</td><td>${Math.round((p[3]+p[4]*.5)/p[2]*100)}%</td><td><strong style="color:var(--green)">${p[6]+offset}%</strong><small>${i<2?"Repeated pairing":"Small sample"}</small></td></tr>`),"Partnership analysis")}${note("Adjusted yield shrinks small samples toward the team average. It is an exploratory measure, <strong>not a predicted win probability</strong>.")}<details class="panel-foot"><summary>How to read this table</summary><p style="margin-top:10px">Raw yield = (wins + half of halves) / appearances. The illustrative adjusted measure adds three prior matches at the sample team yield. Home/away scopes update the sample ranking; no live analytics service is used.</p></details></section>`;
  }
  function pairings(){
    return heading("PERFORMANCE / PARTNERSHIPS","Chemistry, with evidence.","Look beyond the unbeaten pairing that has only played once.",go("/analytics/suggest","Build a home lineup","btn primary","target"))+scopeToolbar()+
      stats([["Unique pairings","24","Across recorded sample matches"],["Repeated partnerships","8","At least 2 appearances"],["Most established","5 matches","Mwangi + Otieno"],["Coverage","33%","Pairings tested more than once"]])+pairingPanel()+`<div class="screen-caption">${icon("info")}Scope filters show illustrative adjusted values. Individual result records remain an all-season reference.</div>`;
  }
  function chart(labels,values,max=30){
    return `<div class="chart-bars" role="img" aria-label="${escape(labels.map((l,i)=>`${l}: ${values[i]}`).join("; "))}">${values.map((v,i)=>`<div class="bar${i%2?" away":""}" style="--height:${Math.max(3,Math.min(100,v/max*100))}%"><b>${Number.isInteger(v)?v:v.toFixed(1)}</b><span>${labels[i]}</span></div>`).join("")}</div><div class="legend"><span><i></i>Home / primary</span><span><i class="away"></i>Away / comparison</span></div>`;
  }
  function venues(){
    const factor=state.scope==="Home"?1.2:state.scope==="Away"?.8:1;
    return heading("PERFORMANCE / VENUES","Different courses. Different stories.","Points capture gives every fixture the same 30-point frame.",go("/analytics/home-away","Home & away","btn"))+scopeToolbar()+
      `<div class="two-col"><section class="panel">${panelHead("Points by opponent venue","Synthetic averages per recorded fixture.")}${chart(["Cedar","Highland","Lakeside","Acacia"],[19.5,15,18,10.5].map(x=>x*factor))}<div class="panel-foot">30 points available per fixture. Opponent and selection differences limit comparisons.</div></section><section class="panel">${panelHead("Course notebook","Results capture · Selected venue scope")}${[["Cedar Valley",65],["Highland Ridge",50],["Lakeside Golf Club",60],["Acacia Park",35]].map(([n,v])=>`<div class="venue"><div><span>${n}</span><strong>${Math.round(v*factor)}<small>%</small></strong></div><div class="meter"><span style="width:${Math.min(100,v*factor)}%"></span></div><p><span>2 sample fixtures</span><span>${(v*.3*factor).toFixed(1)} pts / fixture</span></p></div>`).join("")}</section></div>${note("Venue performance describes the recorded sample. It does not isolate a course effect or account for opponent strength.")}`;
  }
  function handicaps(){
    return heading("PERFORMANCE / HANDICAPS","Balance the squad, not just the numbers.","Handicap distribution and observed results, without overstating the link.",go("/players","Explore the squad","btn","users"))+
      stats([["Squad median","13.9","Illustrative current indexes"],["Lowest index","6.8","Felix Njoroge"],["Highest index","24.1","Peter Kibet"],["Index coverage","100%","10 of 10 sample players"]])+
      `<div class="two-col equal"><section class="panel">${panelHead("A useful spread of abilities","Current sample roster, grouped by index.")}<div class="distribution">${[["0 – 9.9",3],["10 – 14.9",2],["15 – 19.9",3],["20+",2]].map(([n,v])=>`<div><span>${n}</span><div class="meter"><span style="width:${v/4*100}%"></span></div><strong>${v}</strong></div>`).join("")}</div><div class="panel-foot">Index bands use current snapshots, not historical playing handicaps.</div></section><section class="panel">${panelHead("Results by handicap band","Illustrative yield; match context still matters.")}${table(["Index band","Appearances","Yield"],[["0–9.9",17,"65%"],["10–14.9",12,"67%"],["15–19.9",18,"51%"],["20+",6,"50%"]].map(r=>`<tr>${r.map(v=>`<td>${v}</td>`).join("")}</tr>`),"Handicap band results")}${note("Small samples and partner effects mean this is <strong>not a selection rule</strong>. Use the scorecards alongside the indexes.")}</section></div>`;
  }
  function leaders(){
    const f=scopeFactor();
    return heading("PERFORMANCE / POINTS LEADERS","Contribution, not just percentages.","Pair points credited to each partner. Never add these to the team total.",button("Export sample CSV","export-leaders","btn","download"))+scopeToolbar()+
      `<section class="panel">${panelHead("The season’s points contributors","Minimum 3 all-season appearances. Scope values are illustrative.")}${table(["Rank / player","Played","Points / app.","Yield","Total points"],roster.filter(p=>p.played>=3).slice(0,8).map((p,i)=>`<tr><td><div class="cell-name"><span class="muted" style="width:13px">${i+1}</span>${playerName(p,i)}</div></td><td>${Math.max(1,Math.round(p.played*f))}</td><td>${(p.points*f/Math.max(1,Math.round(p.played*f))).toFixed(2)}</td><td>${Math.max(0,p.rate+(state.scope==="Home"?8:state.scope==="Away"?-10:0))}%</td><td><strong>${(p.points*f).toFixed(2)}</strong></td></tr>`),"Points contributors")}<div class="panel-foot">Points per appearance adjusts for participation, but not opponent strength. A short perfect run need not be the largest contribution.</div></section>`;
  }
  function homeAway(){
    return heading("PERFORMANCE / HOME & AWAY","A stronger record on familiar ground.","Points capture, not outright match win rate. Context matters.",go("/analytics/venues","View venues","btn","pin"))+
      summary([["POINTS CAPTURE GAP","+25 <small>percentage pts</small>","Home 65% · Away 40%"],["HOME POINTS","78 <small>/ 120</small>","Four recorded fixtures"],["AWAY POINTS","48 <small>/ 120</small>","Four recorded fixtures"]])+
      `<div class="two-col equal"><section class="panel">${panelHead("Two sides of the season","Same point scale. Different opponents and selections.")}${[["Home",65,78,19.5],["Away",40,48,12]].map(([n,v,p,avg])=>`<div class="venue"><div><span>${badge(n)}</span><strong>${v}<small>%</small></strong></div><div class="meter ${n.toLowerCase()}"><span style="width:${v}%"></span></div><p><span>${p} / 120 points</span><span>${avg} points / fixture</span></p></div>`).join("")}${note("Home supplied <strong>62% of captured points</strong>. This is descriptive evidence, not proof of home advantage.")}</section><section class="panel">${panelHead("Travel-ready players","Illustrative away yield · Minimum 3 appearances.")}${roster.slice(0,4).map((p,i)=>`<a href="#/players/${i+1}" class="list-row"><span class="avatar">${initials(p.name)}</span><div class="row-body"><strong>${p.name}</strong><small>${4-i%2} away appearances · Sample results</small></div><span class="number">${67-i*8}%<small>AWAY YIELD</small></span></a>`).join("")}</section></div>`;
  }
  function dataQuality(){
    const issues=[["Missing fixture results","Lakeside Golf Club · 17 Oct · Home","Results","/fixtures/import","Add results"],["Missing fixture results","Highland Ridge · 12 Jul · Away","Results","/fixtures/import","Add results"],["Name confirmation","J. Kariuki → Jonah Kariuki · Sample import","Names","/fixtures/import/review","Review names"]];
    const filtered=issues.filter(x=>state.quality==="All"||x[2]===state.quality);
    return heading("PERFORMANCE / DATA QUALITY","A complete record. A clearer picture.","Close the gaps before drawing conclusions from the season.",button("Recheck sample","recheck","btn","check"))+
      stats([["Results coverage","80%","8 of 10 past fixtures"],["Names matched",state.reviewFixed?"100%":"98%","One sample alias to confirm"],["Handicap coverage","100%","10 current sample indexes"],["Open checks",state.reviewFixed?"2":"3","No live data is inspected"]])+
      `<section class="panel">${panelHead("A little housekeeping","Fix the record, then revisit the story.")}<div class="toolbar">${segmented(["All","Results","Names"],state.quality,"quality-filter")}</div>${filtered.filter(x=>x[2]!=="Names"||!state.reviewFixed).map(([title,desc,,path,label])=>`<div class="quality-row"><div><strong>${title}</strong><p>${desc}</p></div>${go(path,label,"btn small")}</div>`).join("")||'<div class="empty"><strong>No open checks in this category</strong>The sample names are resolved.</div>'}</section><div class="two-col equal" style="margin-top:20px"><section class="panel">${panelHead("Checks that pass")}<div class="list-row">${icon("check")}<div class="row-body"><strong>No duplicate sample matches</strong><small>Pairings and fixture references are consistent.</small></div></div><div class="list-row">${icon("check")}<div class="row-body"><strong>All sample players have indexes</strong><small>Current handicap coverage is complete.</small></div></div></section><section class="panel">${panelHead("What the checks don’t tell you")}<p class="subtext">A structurally complete record can still contain an incorrect score. Confirm the source scorecard, especially before using results for selection.</p><div class="panel-foot">This is a fictional data-quality workspace, not a scan of the production database.</div></section></div>`;
  }
  function suggest(){
    return heading("SELECTION TOOLS / HOME","Build a lineup with intention.","Select available players, then explore sensible sample partnerships.",go("/analytics/pairings","Partnership evidence","btn","users"))+
      `<div class="tool-layout"><section class="panel">${panelHead("Who’s available?","Select an even number of players for a complete lineup.",badge(`${state.selected.size} selected`,"home"))}<div class="form-grid">${field("Fixture",`<select id="suggest-fixture">${options(["Cedar Valley · 14 Nov · Home","Lakeside Golf Club · Sample home fixture"])}</select>`)}${field("Selection emphasis",`<select id="pairing-emphasis">${options(["Balanced partnerships","Repeat proven pairings","Explore new partnerships"])}</select>`)}</div><div class="selection-grid">${roster.filter(p=>p.active).map((p,i)=>`<label><input type="checkbox" data-player="${i}" ${state.selected.has(i)?"checked":""}><span class="avatar">${initials(p.name)}</span><span>${p.name}<small>HI ${p.hc.toFixed(1)} · ${p.played} appearances</small></span></label>`).join("")}</div><div class="form-footer"><p>Rules and suggestions are illustrative.</p>${button("Suggest sample pairings","generate-pairs","btn primary","target")}</div></section><section class="panel">${panelHead(state.generated?"A lineup to discuss":"Your selection workspace",state.generated?"Sample combinations, not a predictive model.":"Choose available players to see the next step.")}${state.generated?pairSlots():`<div class="empty">${icon("users")}<strong style="margin-top:14px">Good pairings start with availability.</strong>Select your players, then generate a local sample lineup.</div>`}${state.generated?`<div class="form-footer">${button("Shuffle pairings","shuffle-pairs","btn small")}${button("Save sample lineup","save-lineup","btn primary small","check")}</div>`:""}${note("No AI or server is called. Pairings are a <strong>local design simulation</strong> and must not be treated as selection advice.")}</section></div>`;
  }
  function pairSlots(){
    const players=[...state.selected].map(i=>roster[i]);
    return players.reduce((html,p,i)=>i%2?html:html+`<div class="pair-slot"><span class="position">${Math.floor(i/2)+1}</span><div><strong>${p.name}</strong><small>+ ${players[i+1]?.name||"Unpaired"}</small></div>${badge(`HI ${((p.hc+(players[i+1]?.hc||0))/2).toFixed(1)}`,"home")}</div>`,"");
  }
  function counter(){
    return heading("SELECTION TOOLS / AWAY","Meet their lineup with a plan.","An ordered response, with every decision still in your hands.",go("/analytics/suggest","Home pairing tool","btn"))+
      `<div class="steps" aria-label="Counter tool progress">${["Opponent lineup","Our response","Review & save"].map((x,i)=>`<div class="step${state.counterStage===i?" active":""}" ${state.counterStage===i?'aria-current="step"':""}><span>${i+1}</span>${x}</div>`).join("")}</div>${counterContent()}`;
  }
  function counterContent(){
    const opponentName=i=>`${escape(opponents[i][0])} + ${escape(opponents[i][1])}`;
    if(state.counterStage===0) {
      const pairs=opponents.map((p,i)=>`<div class="pair-slot"><span class="position">${i+1}</span><div><strong>${opponentName(i)}</strong><small>Handicap indexes ${p[2].toFixed(1)} / ${p[3].toFixed(1)}</small></div>${button("Edit","opponent-edit","btn small","",`data-index="${i}"`)}</div>`).join("");
      return `<div class="two-col"><section class="panel">${panelHead("Read the opposition","A fictional four-pair visiting lineup.")}<div class="form-grid">${field("Opponent club",`<select id="counter-club">${options(["Highland Ridge","Cedar Valley","Lakeside Golf Club"])}</select>`)}${field("Fixture date",'<input type="date" value="2026-10-31">')}</div><div style="margin-top:20px">${pairs}</div><div class="form-footer"><p>Local sample lineup · No opponent upload.</p>${button("Build our response","counter-next","btn primary","arrow")}</div></section><aside class="panel">${panelHead("Order changes the question")}<p class="subtext">Away selection responds to a declared opponent order. Keep the fixture context, available players and handicap balance visible.</p>${note("This preview uses four synthetic opponent pairs. It does not analyze real opponents or predict outcomes.")}<dl class="detail-list"><div><dt>Opponent pairs</dt><dd>4</dd></div><div><dt>Required players</dt><dd>8</dd></div><div><dt>Response status</dt><dd>Not generated</dd></div></dl></aside></div>`;
    }
    if(state.counterStage===1) {
      const pairs=[0,1,2,3].map(i=>`<div class="pair-slot"><span>POSITION ${i+1} / VS ${opponentName(i)}</span><strong>${escape(counterPlayer(i*2).name)} + ${escape(counterPlayer(i*2+1).name)}</strong><small>Combined index ${(counterPlayer(i*2).hc+counterPlayer(i*2+1).hc).toFixed(1)} · Sample balance</small><div class="actions" style="margin-top:14px">${button("Swap pairing","counter-swap","btn small","",`data-index="${i}"`)}${badge("Ready","home")}</div></div>`).join("");
      return `<section class="panel">${panelHead("A response you can rearrange","Sample order. Use the move buttons to explore alternatives.",button("Rebuild sample","counter-rebuild","btn small","target"))}<div class="counter-grid">${pairs}</div>${note("No simulated success percentage is shown. These sample pairings illustrate the workflow, not a model-backed recommendation.")}<div class="form-footer">${button("Back to opponent","counter-back","btn")}${button("Review response","counter-next","btn primary","arrow")}</div></section>`;
    }
    const rows=[0,1,2,3].map(i=>`<tr><td>${i+1}</td><td><strong>${escape(counterPlayer(i*2).name)} + ${escape(counterPlayer(i*2+1).name)}</strong><small>Combined index ${(counterPlayer(i*2).hc+counterPlayer(i*2+1).hc).toFixed(1)}</small></td><td class="muted">${opponentName(i)}</td></tr>`);
    return `<section class="panel">${panelHead("Ready for the team conversation","Highland Ridge · 31 October 2026 · Away",badge("Sample draft","away"))}${table(["Order","Our pairing","Opponent pairing"],rows,"Counter lineup review")}<label class="field" style="margin-top:20px">Convener’s notes<textarea placeholder="What should the team know before the first tee?"></textarea></label><div class="form-footer">${button("Back to response","counter-back","btn")}<div class="actions">${button("Export sample CSV","export-counter","btn","download")}${button("Save sample draft","save-lineup","btn primary","check")}</div></div><div class="panel-foot">Saving affects this tab’s preview only. Nothing is sent to the app, opponents or players.</div></section>`;
  }
  const renderers={"/fixtures":fixtureList,"/fixtures/new":newFixture,"/fixtures/1":scorecard,"/fixtures/import":importUpload,"/fixtures/import/review":importReview,"/fixtures/import/preview":importPreview,"/players":squad,"/players/1":playerProfile,"/clubs":clubScreen,"/analytics":analyticsHub,"/analytics/pairings":pairings,"/analytics/venues":venues,"/analytics/handicaps":handicaps,"/analytics/leaderboards":leaders,"/analytics/home-away":homeAway,"/analytics/data-quality":dataQuality,"/analytics/suggest":suggest,"/analytics/counter":counter};
  function buildNavigation(){
    let group="";
    $("#route-nav").innerHTML=routes.map(([path,label,g,glyph])=>{const title=group!==g?`<div class="group-label">${g.toUpperCase()}</div>`:"";group=g;return `${title}<a href="#${path}" data-route="${path}">${icon(glyph)}${label}</a>`;}).join("");
    $("#mobile-route").innerHTML=routes.map(([p,l,g])=>`<option value="${p}">${g} / ${l}</option>`).join("");
  }
  function render(){
    const raw=decodeURIComponent(location.hash.slice(1)||"/fixtures");
    const playerMatch=raw.match(/^\/players\/(\d+)$/);
    current=playerMatch?"/players/1":renderers[raw]?raw:"/fixtures";
    if(playerMatch)state.profileId=Math.min(roster.length-1,Math.max(0,Number(playerMatch[1])-1));
    const info=routes.find(r=>r[0]===current);
    const productionPath=current.startsWith("/fixtures/import")?"/fixtures/import":raw.startsWith("/players/")?"/players/[id]":current==="/fixtures/1"?"/fixtures/[id]":current;
    $("#screen").innerHTML=`<div class="breadcrumb"><a href="#/analytics">Workspace</a><span>/</span><span>${info[2]}</span><code>Route preview: ${escape(productionPath)}</code></div>${renderers[current]()}<div class="screen-caption">${icon("info")}DESIGN PREVIEW · Fictional sample data. All controls operate locally; nothing is written to production.</div>`;
    $$("[data-route]").forEach(a=>{const active=a.dataset.route===current;a.classList.toggle("active",active);if(active)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current");});
    $$("[data-family]").forEach(a=>{const active=current.split("/")[1]===a.dataset.family;a.classList.toggle("active",active);if(active)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current");});
    $("#mobile-route").value=current;
    document.title=`${info[1]} · Convener design previews`;
  }
  function notify(message){$("#toast").textContent=message;$("#toast").classList.add("visible");clearTimeout(toastTimer);toastTimer=setTimeout(()=>$("#toast").classList.remove("visible"),4000);}
  let previousFocus;
  function modal(title,body,kind="generic"){
    previousFocus=document.activeElement;
    const dialog=$("#dialog");
    dialog.innerHTML=`<div class="dialog-head"><h2 id="dialog-title">${title}</h2><button type="button" data-action="close-dialog" aria-label="Close dialog">×</button></div><form id="modal-form" data-kind="${kind}" class="dialog-body">${note("Design preview · Changes are local to this tab.")}${body}<div class="form-footer">${button("Cancel","close-dialog","btn")}<button class="btn primary" type="submit">${icon("check")}Save sample changes</button></div></form>`;
    dialog.showModal();
  }
  function closeModal(){ $("#dialog").close();if(previousFocus?.isConnected)previousFocus.focus(); }
  function matchModal(index){
    const m=index>=0?matches[index]:["","","Won",""];
    modal(index>=0?"Edit pair match":"Add a pair match",`<input type="hidden" name="index" value="${index}"><div class="form-grid">${field("Our first player *",`<select name="one" required>${options(roster.map(p=>p.name),m[0].split(" + ")[0])}</select>`)}${field("Our second player *",`<select name="two" required>${options(roster.map(p=>p.name),m[0].split(" + ")[1]||roster[1].name)}</select>`)}${field("Opponent pairing *",`<input name="opponents" value="${escape(m[1])}" placeholder="First player + second player" required>`,true)}${field("Result *",`<select name="result">${options(["Won","Halved","Lost"],m[2])}</select>`)}${field("Match score *",`<input name="score" value="${escape(m[3])}" placeholder="e.g. 2 & 1" required>` )}</div>`,"match");
  }
  function exportCSV(filename,rows){
    const csv=rows.map(row=>row.map(cell=>`"${String(cell).replaceAll('"','""')}"`).join(",")).join("\r\n");
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
    const a=document.createElement("a");a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);notify("Synthetic sample CSV exported locally.");
  }
  document.addEventListener("click",event=>{
    if(event.target.closest(".skip")){event.preventDefault();$("#screen").focus();return;}
    const el=event.target.closest("[data-action]");if(!el)return;
    const action=el.dataset.action,index=Number(el.dataset.index);
    const rerender=(message)=>{render();if(message)notify(message);};
    switch(action){
      case "fixtures-filter":state.fixtureFilter=el.dataset.value;rerender();break;
      case "players-filter":state.playerFilter=el.dataset.value;rerender();break;
      case "profile-tab":state.profileTab=el.dataset.value;rerender();$(`[role=tab][data-value="${state.profileTab}"]`)?.focus();break;
      case "scope":state.scope=el.dataset.value;rerender();break;
      case "quality-filter":state.quality=el.dataset.value;rerender();break;
      case "close-dialog":closeModal();break;
      case "add-match":matchModal(-1);break;
      case "edit-match":matchModal(index);break;
      case "review-edit":matchModal(index);break;
      case "resolve-name":state.reviewFixed=true;rerender("Jonah Kariuki confirmed in the sample import.");break;
      case "complete-import":state.importComplete=true;rerender("Sample import completed. No production data was changed.");break;
      case "reset-import":state.reviewFixed=false;state.importComplete=false;state.uploaded="";location.hash="/fixtures/import";break;
      case "edit-fixture":modal("Edit fixture details",`<div class="form-grid">${field("Opponent",`<select name="club">${options(clubs.map(c=>c[0]),state.fixtureClub)}</select>`)}${field("Date",`<input name="date" type="date" value="${state.fixtureDate}" required>`)}${field("Venue",`<select name="venue">${options(["Home","Away"],state.fixtureVenue)}</select>`)}</div>`,"fixture");break;
      case "edit-notes":modal("Match-day notes",field("Notes",`<textarea name="notes">${escape(state.notes)}</textarea>`),"notes");break;
      case "add-player":case "edit-player":{
        const p=action==="edit-player"?roster[state.profileId]:null;
        modal(p?"Edit player":"Add a squad member",`<input type="hidden" name="index" value="${p?state.profileId:-1}"><div class="form-grid">${field("Full name *",`<input name="name" value="${escape(p?.name||"")}" required maxlength="60">`,true)}${field("Handicap index *",`<input name="hc" type="number" min="-10" max="54" step=".1" value="${p?.hc||18}" required>`)}${field("Squad status",`<select name="active">${options(["Active","Inactive"],p&&!p.active?"Inactive":"Active")}</select>`)}</div>`,"player");break;
      }
      case "add-club":case "edit-club":{
        const c=action==="edit-club"?clubs[index]:null;
        modal(c?"Manage opponent club":"Add an opponent club",`<input type="hidden" name="index" value="${c?index:-1}"><div class="form-grid">${field("Club name *",`<input name="name" value="${escape(c?.[0]||"")}" required maxlength="60">`,true)}${field("Location",`<input name="location" value="${escape(c?.[1]||"")}">`)}${field("Par / slope",`<input name="course" value="${escape(c?.[2]||"72 / 128")}">`)}</div>`,"club");break;
      }
      case "recheck":notify("Local sample checks complete. No production database was accessed.");break;
      case "generate-pairs":if(state.selected.size<2||state.selected.size%2){notify("Select an even number of players, at least two.");break;}state.generated=true;rerender("Sample pairings generated locally.");break;
      case "shuffle-pairs":{const ids=[...state.selected];ids.push(ids.shift());state.selected=new Set(ids);rerender("Sample pairings rearranged.");break;}
      case "save-lineup":notify("Sample lineup saved in this tab only. No live lineup was changed.");break;
      case "counter-next":state.counterStage=Math.min(2,state.counterStage+1);rerender();break;
      case "counter-back":state.counterStage=Math.max(0,state.counterStage-1);rerender();break;
      case "counter-rebuild":case "counter-swap":{const n=action==="counter-swap"?index:0;const next=(n+1)%4;[state.counterOrder[n*2],state.counterOrder[next*2]]=[state.counterOrder[next*2],state.counterOrder[n*2]];[state.counterOrder[n*2+1],state.counterOrder[next*2+1]]=[state.counterOrder[next*2+1],state.counterOrder[n*2+1]];rerender("Local response order updated.");break;}
      case "opponent-edit":{const p=opponents[index];modal("Edit opponent sample pairing",`<input type="hidden" name="index" value="${index}"><div class="form-grid">${field("First opponent",`<input name="one" value="${escape(p[0])}" required>`)}${field("Second opponent",`<input name="two" value="${escape(p[1])}" required>`)}${field("First handicap",`<input name="hc1" type="number" min="-10" max="54" value="${p[2]}" step=".1">`)}${field("Second handicap",`<input name="hc2" type="number" min="-10" max="54" value="${p[3]}" step=".1">`)}</div>`,"opponent");break;}
      case "export-scorecard":exportCSV("convener-sample-scorecard.csv",[["Our pairing","Opponents","Result","Score"],...matches]);break;
      case "export-leaders":exportCSV("convener-sample-leaders.csv",[["Player","Appearances","Points"],...roster.map(p=>[p.name,p.played,p.points])]);break;
      case "export-counter":exportCSV("convener-sample-away-lineup.csv",[["Position","Player 1","Player 2"],...[0,1,2,3].map(i=>[i+1,counterPlayer(i*2).name,counterPlayer(i*2+1).name])]);break;
    }
  });
  document.addEventListener("input",event=>{
    const el=event.target;
    const key={"fixture-search":"fixtureQuery","player-search":"playerQuery","club-search":"clubQuery"}[el.id];
    if(key){state[key]=el.value;const pos=el.selectionStart;render();const next=$("#"+el.id);next.focus();next.setSelectionRange(pos,pos);}
  });
  document.addEventListener("change",event=>{
    const el=event.target;
    if(el.id==="mobile-route"){location.hash=el.value;return;}
    if(el.dataset.player!==undefined){const id=Number(el.dataset.player);if(el.checked)state.selected.add(id);else state.selected.delete(id);state.generated=false;render();$(`[data-player="${id}"]`)?.focus();return;}
    if(el.id==="import-file"){state.uploaded=el.files?.[0]?.name||"";$("#file-status").textContent=state.uploaded?`${state.uploaded} selected. No file was uploaded.`:"Or use the sample scorecard below.";notify("File stays on your device. The review uses built-in synthetic data.");return;}
    if(el.tagName==="SELECT"&&el.closest("#screen"))notify("Sample selection updated locally.");
  });
  document.addEventListener("submit",event=>{
    event.preventDefault();
    if(event.target.id==="fixture-form"){
      const data=new FormData(event.target);
      fixtures.unshift({name:String(data.get("club")),date:new Date(String(data.get("date"))+"T12:00:00").toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}),venue:String(data.get("venue")),status:"Scheduled",points:"—",record:"Lineup not set"});
      state.fixtureFilter="All";state.fixtureQuery="";location.hash="/fixtures";notify("Sample fixture created in this tab only.");return;
    }
    if(event.target.id==="modal-form"){
      const data=new FormData(event.target),kind=event.target.dataset.kind;
      if(kind==="match"){
        if(data.get("one")===data.get("two")){notify("Choose two different players for a pairing.");return;}
        const row=[`${data.get("one")} + ${data.get("two")}`,String(data.get("opponents")),String(data.get("result")),String(data.get("score"))];
        const i=Number(data.get("index"));if(i<0)matches.push(row);else matches[i]=row;
      }else if(kind==="notes"){
        state.notes=String(data.get("notes"));
      }else if(kind==="fixture"){
        state.fixtureClub=String(data.get("club"));state.fixtureDate=String(data.get("date"));state.fixtureVenue=String(data.get("venue"));
      }else if(kind==="opponent"){
        opponents[Number(data.get("index"))]=[String(data.get("one")),String(data.get("two")),Number(data.get("hc1")),Number(data.get("hc2"))];
      }else if(kind==="player"){
        const i=Number(data.get("index")),p={name:String(data.get("name")),hc:Number(data.get("hc")),active:data.get("active")==="Active"};
        if(i<0)roster.push({...p,played:0,points:0,rate:0,form:""});else Object.assign(roster[i],p);
      }else if(kind==="club"){
        const i=Number(data.get("index")),row=[String(data.get("name")),String(data.get("location")),String(data.get("course")),i<0?"0":clubs[i][3]];
        if(i<0)clubs.push(row);else clubs[i]=row;
      }
      closeModal();render();notify("Sample changes saved locally. No production data was changed.");
    }
  });
  $("#dialog").addEventListener("click",event=>{if(event.target===$("#dialog")){const rect=event.target.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closeModal();}});
  document.addEventListener("keydown",event=>{
    const tab=event.target.closest('[role="tab"]');if(!tab||!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
    event.preventDefault();const tabs=$$('[role="tab"]'),i=tabs.indexOf(tab);tabs[event.key==="Home"?0:event.key==="End"?tabs.length-1:(i+(event.key==="ArrowRight"?1:-1)+tabs.length)%tabs.length].click();
  });
  window.addEventListener("hashchange",()=>{render();window.scrollTo({top:0,behavior:"instant"});$("#screen").focus({preventScroll:true});});
  buildNavigation();render();
})();
