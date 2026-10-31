/* global dashboardData */
(async () => {
  "use strict";
  const app = document.getElementById("app");
  app.textContent = "Loading current league data...";
  let data;
  try {
    data = await dashboardData;
  } catch {
    app.textContent = "Unable to load current league data. Refresh to try again.";
    return;
  }
  const escape = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  for (const f of data.fixtures) {
    f.name = escape(f.name);
    f.short = escape(f.short);
  }
  for (const p of [...data.players, ...data.insights.travelPlayers, ...Object.values(data.insights.leaders).flat()]) p.name = escape(p.name);
  for (const p of data.pairs) p.names = p.names.map(escape);
  const insights = data.insights;
  const captain = document.body.dataset.view === "captain";
  const colorStudy = document.body.dataset.variation === "color";
  const clubhouseHref = colorStudy ? "/mockups/clubhouse-color.html" : "/mockups/dashboard.html";
  const finished = data.fixtures.filter((f) => f.total > 0);
  const missing = data.fixtures.filter((f) => f.total === 0 && !f.future);
  const sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0);
  const points = sum(finished, "points");
  const maximum = sum(finished, "maximum");
  const divide = (n, d) => d ? n / d : 0;
  const rate = (divide(points, maximum) * 100).toFixed(1);
  const latest = finished.at(-1);
  const lastFive = finished.slice(-5);
  const money = (n) => n.toFixed(2).replace(/\.00$/, "");
  const date = (value) => new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const initials = (name) => name.split(" ").map((part) => part[0]).slice(0, 2).join("");
  const status = (f) => f.wins > f.losses ? "win" : f.wins < f.losses ? "loss" : "halved";
  const outcome = (f) => ({ win: "Won", loss: "Lost", halved: "Drawn" })[status(f)];
  const teamYield = divide(sum(finished, "wins") + sum(finished, "halved") * 0.5, sum(finished, "total"));
  let chartFilter = "all";
  let showTargets = false;
  function venueRecord(location) {
    const fixtures = finished.filter((f) => f.home_away === location);
    return { points: sum(fixtures, "points"), max: sum(fixtures, "maximum"), count: fixtures.length };
  }
  const homeRecord = venueRecord("home");
  const awayRecord = venueRecord("away");
  const icons = {
    flag: '<path d="M5 21V3m0 1c5-4 9 4 14 0v9c-5 4-9-4-14 0"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-12 5h.01M12 16h.01M16 16h.01"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m2-16a3 3 0 0 1 0 6m2 3a5 5 0 0 1 2 4v3"/>',
    chart: '<path d="M4 3v17h17M8 15l4-5 4 2 5-7"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3"/>',
    upload: '<path d="M12 16V3m-5 5 5-5 5 5M3 15v5a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>'
  };
  const icon = (name, cls = "") => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.flag}</svg>`;
  const link = (href, label, cls = "text-link") => `<a class="${cls}" href="${href}">${label}${icon("arrow")}</a>`;
  const form = (p) => `<span class="form-dots" aria-label="Recent results, oldest to newest">${p.form.map((r) => `<span class="form-dot ${r}" title="${r === "win" ? "Won" : r === "loss" ? "Lost" : "Halved"}">${r === "win" ? "W" : r === "loss" ? "L" : "H"}</span>`).join("")}</span>`;

  function prototypeBar() {
    const concepts = [
      ["/mockups/dashboard.html", "Clubhouse", !captain && !colorStudy],
      ["/mockups/clubhouse-color.html", "Clubhouse · color", colorStudy],
      ["/mockups/conveners.html", "Conveners desk", captain]
    ];
    return `<div class="prototype-bar"><span><span class="prototype-dot"></span> DESIGN STUDY <span class="prototype-detail">/ Real data. No live edits.</span></span><nav aria-label="Dashboard concepts">${concepts.map(([href, label, active]) => `<a class="${active ? "selected" : ""}"${active ? ' aria-current="page"' : ""} href="${href}">${label}</a>`).join("")}</nav></div>`;
  }
  function brand() {
    return `<a class="brand" href="/mockups/dashboard.html"><span class="brand-mark">${icon("flag")}</span><span>convener<span class="brand-sub">KENYA AIR FORCE GOLF CLUB</span></span></a>`;
  }
  function navigation() {
    const items = [["grid", captain ? "Conveners desk" : "Overview", captain ? "/mockups/conveners.html" : clubhouseHref], ["calendar", "Fixtures & results", "/fixtures"], ["users", "The squad", "/players"], ["chart", "Performance", "/analytics"], ["target", "Pairing insights", "/analytics/pairings"]];
    return `<nav class="main-nav" aria-label="Main navigation">${items.map(([i, label, href], n) => `<a href="${href}" aria-label="${label}" class="${n === 0 ? "active" : ""}">${icon(i)}<span>${label}</span>${n === 1 ? `<b>${data.fixtures.length}</b>` : ""}</a>`).join("")}</nav>`;
  }
  function sidebar() {
    return `<aside class="sidebar">${brand()}<p class="nav-caption">TEAM WORKSPACE</p>${navigation()}<div class="sidebar-bottom"><div class="club-monogram">KA</div><p>Top Guns<strong>Nairobi District League</strong></p><span class="status-light" title="Local workspace"></span></div></aside>`;
  }
  function header() {
    return `<header class="page-header"><div><div class="eyebrow">${captain ? "TEAM INTELLIGENCE" : "THE CLUBHOUSE"} <span class="tiny-divider"></span> NDC 2026</div><h1>${captain ? "Conveners desk" : "Your season, at a glance."}</h1><p>${captain ? "Turn the scorecards into your next good decision." : "The results, the people, and what needs your attention."}</p></div><a class="button primary" href="/fixtures/import">${icon("plus")} Record results</a></header>`;
  }
  function seasonHero() {
    const wins = finished.filter((f) => status(f) === "win").length;
    const draws = finished.filter((f) => status(f) === "halved").length;
    return `<section class="season-hero" aria-labelledby="season-title"><div class="hero-copy"><div class="eyebrow inverse"><span class="live-dot"></span> TOP GUNS / 2026 SEASON</div><h2 id="season-title">Every point tells a story.</h2><p>${(points / finished.length).toFixed(2)} points per fixture. An even split is 15.</p><div class="hero-score">${points.toFixed(2)}<span>/ ${maximum} pts</span></div><div class="hero-progress" role="meter" aria-label="League points captured" aria-valuenow="${rate}" aria-valuemin="0" aria-valuemax="100"><span style="width:${rate}%"></span></div><div class="hero-caption"><span>${rate}% of available points captured</span><span>${finished.length} fixtures with results</span></div></div><div class="hero-side"><div class="hero-rings" aria-hidden="true"></div><span class="eyebrow inverse">FIXTURE RECORD</span><div class="record-numbers"><div><b>${wins}</b><span>Won</span></div><div><b>${draws}</b><span>Drawn</span></div><div><b>${finished.length - wins - draws}</b><span>Lost</span></div></div><div class="hero-footnote">${icon("info")} Based on recorded fixtures only.<br>Not a league-table ranking.</div></div></section>`;
  }
  function metrics() {
    return `<section class="metrics" aria-label="Season overview">
      <article class="metric"><span class="metric-icon">${icon("flag")}</span><div class="metric-label">Pairs matches recorded</div><div class="metric-value">${sum(finished, "total")}<span>matches</span></div><div class="metric-foot"><span class="green-text">${sum(finished, "wins")} W</span><span>${sum(finished, "halved")} H</span><span class="red-text">${sum(finished, "losses")} L</span></div></article>
      <article class="metric"><span class="metric-icon">${icon("users")}</span><div class="metric-label">Squad participation</div><div class="metric-value">${data.fielded}<span>/ ${data.roster} players</span></div><div class="metric-foot">${data.roster - data.fielded} roster players yet to play in the league</div></article>
      <article class="metric"><span class="metric-icon">${icon("calendar")}</span><div class="metric-label">Results coverage</div><div class="metric-value">${finished.length}<span>/ ${data.fixtures.length} fixtures</span></div><div class="metric-foot"><span class="attention-dot"></span>${missing.length} past fixtures still need results</div></article>
    </section>`;
  }
  function performance() {
    const earlyAway = finished.filter((f) => f.home_away === "away").slice(0, 3);
    const recentAway = finished.filter((f) => f.home_away === "away").slice(-2);
    const home = finished.filter((f) => f.home_away === "home");
    const karen = finished.find((f) => f.id === 10);
    return `<section class="panel performance"><div class="panel-heading"><div><div class="eyebrow">THE BIG PICTURE</div><h2>Points across the season</h2><p>Home or away. Won, drawn or lost. One 30-point scale.</p></div><div class="segmented" role="group" aria-label="Filter performance chart"><button data-chart-filter="all" aria-pressed="true" class="selected">All</button><button data-chart-filter="home" aria-pressed="false">Home</button><button data-chart-filter="away" aria-pressed="false">Away</button></div></div><div id="performance-chart" class="chart-container" tabindex="0" aria-label="Fixture points chart; scroll horizontally on small screens"></div><div class="chart-legend"><span><i class="legend-dot home"></i>Home</span><span><i class="legend-dot away"></i>Away</span><span><i class="legend-line"></i>15 pts: even split</span><button class="target-toggle" data-target-toggle aria-pressed="false">Show reference targets</button></div><p class="reference-warning" id="reference-warning" hidden>Reference targets: ${insights.referenceTargets.home} home / ${insights.referenceTargets.away} away, from your PDF. These are unverified bonus thresholds; they do not change totals.</p><div class="trend-notes"><div><span>AWAY, RECENTLY</span><strong>${recentAway.map((f) => money(f.points)).join(" & ")} pts</strong><p>Last two away fixtures; the first three returned ${earlyAway.map((f) => money(f.points)).join(", ")}.</p></div><div><span>HOME, FIRST TO LATEST</span><strong>${money(home[0].points)} <i>&rarr;</i> ${money(home.at(-1).points)} pts</strong><p>${home.map((f) => money(f.points)).join(" / ")} across ${home.length} home fixtures.</p></div><div><span>FIELD SIZE MATTERS</span><strong>${(30 / karen.total).toFixed(2)} <small>pts / win</small></strong><p>Karen had ${karen.total} matches; a 15-match fixture awards 2 points per win.</p></div></div></section>`;
  }
  function renderChart(filter = chartFilter) {
    chartFilter = filter;
    const rows = finished.filter((f) => filter === "all" || f.home_away === filter);
    const host = document.getElementById("performance-chart");
    host.innerHTML = `<div class="chart" style="--bars:${rows.length}"><div class="chart-y"><span>30</span><span>15</span><span>0</span></div><div class="chart-plot"><div class="chart-grid"><span></span><span class="draw-line"><em>Even split</em></span><span></span></div><div class="chart-bars">${rows.map((f) => `<a class="chart-bar ${status(f)} ${f.home_away}" href="/fixtures/${f.id}" style="--height:${f.points / 30 * 100}%" aria-label="${f.short}: ${money(f.points)} of 30 points, ${outcome(f)}, ${f.home_away}, ${date(f.date)}"><span class="chart-tooltip">${f.short} <b>${money(f.points)} / 30</b><small>${date(f.date)} / ${f.home_away} / ${outcome(f)}</small><small>${f.total} matches / ${Math.min(2, 30 / f.total).toFixed(2)} pts per win</small></span>${showTargets ? `<span class="bar-target" style="bottom:${insights.referenceTargets[f.home_away] / f.points * 100}%" aria-hidden="true"></span>` : ""}<span class="bar-top">${money(f.points)}</span><span class="bar-fill"></span><span class="bar-outcome ${status(f)}">${{ win: "W", loss: "L", halved: "D" }[status(f)]}</span><span class="bar-label">${f.short}</span><span class="bar-location">${date(f.date)}</span></a>`).join("")}</div></div></div>`;
    document.querySelectorAll("[data-chart-filter]").forEach((button) => {
      const selected = button.dataset.chartFilter === filter;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }
  function homeAway() {
    return `<section class="panel home-away"><div class="eyebrow">WHERE WE PLAY</div><h2>A stronger home record.</h2><p>Points capture, not outright match win rate.</p>${[["Home", homeRecord], ["Away", awayRecord]].map(([label, r]) => `<div class="venue-stat"><div><span>${icon("pin")}${label} <small>${(r.points / r.count).toFixed(1)} pts / fixture</small></span><strong>${(r.points / r.max * 100).toFixed(1)}<small>%</small></strong></div><div class="track"><span style="width:${r.points / r.max * 100}%"></span></div><p>${money(r.points)} / ${r.max} pts <span>${r.count} fixtures</span></p></div>`).join("")}<div class="insight-note">${icon("chart")} <span>Home fixtures supplied <strong>${(homeRecord.points / points * 100).toFixed(0)}% of season points</strong> from ${homeRecord.count} of ${finished.length} fixtures. Different opponents and team selections mean we cannot isolate the cause.</span></div>${link("/analytics/venues", "Explore venue performance")}</section>`;
  }
  function recentResults() {
    return `<section class="panel recent"><div class="panel-heading"><div><div class="eyebrow">FRESH FROM THE SCORECARD</div><h2>Recent results</h2></div>${link("/fixtures", "All fixtures")}</div><div class="table-scroll"><table class="results-table"><thead><tr><th>Opponent</th><th>Match record</th><th>Points</th><th>Result</th></tr></thead><tbody>${[...lastFive].reverse().map((f) => `<tr><td><a href="/fixtures/${f.id}" class="fixture-name"><span class="club-avatar">${f.short.slice(0, 2).toUpperCase()}</span><span><strong>${f.name}</strong><small>${date(f.date)} <span class="muted-dot">/</span> ${f.home_away === "home" ? "Home" : "Away"}</small></span></a></td><td class="match-record">${f.wins}W <span>${f.losses}L ${f.halved}H</span></td><td class="score-cell">${money(f.points)}<span> / 30</span></td><td><span class="result-badge ${status(f)}">${outcome(f)}</span></td></tr>`).join("")}</tbody></table></div></section>`;
  }
  function players(extended = false) {
    return `<section class="panel player-panel"><div class="panel-heading"><div><div class="eyebrow">PEOPLE BEHIND THE POINTS</div><h2>Players to watch</h2></div>${link("/analytics", "Player insights")}</div><p class="section-description">Season result yield; minimum 3 league appearances.</p><div class="player-list">${data.players.slice(0, extended ? 6 : 4).map((p, i) => `<a href="/players/${p.id}" class="player-row"><span class="player-avatar shade-${i % 3}">${initials(p.name)}</span><span class="player-name"><strong>${p.name}</strong><small>${p.played} played <span class="muted-dot">/</span> ${p.wins}W ${p.losses}L ${p.halved}H</small></span><span class="player-yield"><strong>${p.rate.toFixed(0)}<small>%</small></strong>${form(p)}</span></a>`).join("")}</div><div class="subtle-note">Yield = (wins + half of draws) / appearances.<br>Form runs left to right, oldest to newest. Small samples matter.</div></section>`;
  }
  function leaderboard() {
    return `<section class="panel points-leaders"><div class="panel-heading"><div><div class="eyebrow">CONTRIBUTION, NOT JUST PERCENTAGES</div><h2>Who brings home the points?</h2></div></div><p>Pair points credited to each partner; these are not extra team points.</p><div class="leaderboard-controls"><span>Minimum 3 appearances in the selected scope</span><div class="segmented" role="group" aria-label="Filter player points"><button data-leader-filter="all" aria-pressed="true" class="selected">All</button><button data-leader-filter="home" aria-pressed="false">Home</button><button data-leader-filter="away" aria-pressed="false">Away</button></div></div><div id="point-leaders" aria-live="polite"></div><div class="subtle-note">Points per appearance adjusts for field size. A 100% record over 3 matches need not be the largest season contribution.</div></section>`;
  }
  function renderLeaders(scope = "all") {
    const players = insights.leaders[scope];
    document.getElementById("point-leaders").innerHTML = `<table class="leader-table"><caption class="sr-only">${scope} points contributors</caption><thead><tr><th>Player</th><th>Played</th><th>Pts / app.</th><th>Points</th></tr></thead><tbody>${players.map((p, i) => `<tr><td><a href="/players/${p.id}"><span class="leader-rank">${i + 1}</span><span><strong>${p.name}</strong><span class="leader-track"><i style="width:${p.points / players[0].points * 100}%"></i></span></span></a></td><td>${p.played}</td><td>${p.perMatch.toFixed(2)}</td><td><strong>${p.points.toFixed(2)}</strong></td></tr>`).join("")}</tbody></table>`;
    document.querySelectorAll("[data-leader-filter]").forEach((button) => {
      const selected = button.dataset.leaderFilter === scope;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }
  function attention(compact = false) {
    return `<section class="${compact ? "attention-strip" : "panel action-panel"}"><div class="attention-heading"><span class="attention-icon">${icon("calendar")}</span><div><div class="eyebrow">${compact ? "A LITTLE HOUSEKEEPING" : "YOUR NEXT TWO ACTIONS"}</div><h2>Close the gaps in the season.</h2><p>These past fixtures have no results. They are not upcoming games.</p></div><span class="count-badge">${missing.length}</span></div><div class="missing-fixtures">${missing.map((f) => `<a class="missing-fixture" href="/fixtures/import?fixtureId=${f.id}"><span class="date-tile"><b>${new Date(`${f.date}T12:00:00`).getDate()}</b><small>${new Date(`${f.date}T12:00:00`).toLocaleDateString("en-GB", { month: "short" })}</small></span><span><strong>${f.name}</strong><small>${f.home_away === "home" ? "Home fixture" : "Away fixture"} / No results recorded</small></span><span class="record-action">Add results ${icon("arrow")}</span></a>`).join("")}</div></section>`;
  }
  function pairings() {
    const prior = insights.pairCoverage.priorMatches;
    const adjusted = (pair) => (pair.wins + pair.halved * 0.5 + prior * teamYield) / (pair.played + prior) * 100;
    const pairs = [...data.pairs].sort((a, b) => adjusted(b) - adjusted(a) || b.points - a.points);
    return `<section class="panel pairings"><div class="panel-heading"><div><div class="eyebrow">CHEMISTRY, WITH EVIDENCE</div><h2>Partnerships worth revisiting</h2></div>${link("/analytics/pairings", "All pairings")}</div><p class="section-description">Sample-adjusted yield, rather than a misleading 100% after two games.</p><div class="pairing-list">${pairs.map((p) => `<div class="pairing-row"><span class="pair-rating"><strong>${adjusted(p).toFixed(0)}<span>%</span></strong><small>ADJUSTED</small></span><div class="pair-players">${p.names.map((name, j) => `<a href="/players/${p.ids[j]}">${name}</a>`).join('<span class="pair-plus">+</span>')}<small>${p.played} together / ${p.wins}W ${p.losses}L ${p.halved}H / ${p.points.toFixed(2)} pts</small></div><span class="sample-badge">${p.played} matches<br>${p.played < 3 ? "Early evidence" : "Still a small sample"}</span></div>`).join("")}</div><div class="pair-coverage">${icon("users")}<span>Only <strong>${insights.pairCoverage.repeated} of ${insights.pairCoverage.total} partnerships</strong> have played together at least twice. Repeated combinations build better evidence.</span></div><details class="method-note"><summary>How the adjusted yield works</summary><p>100 &times; (wins + half of draws + ${prior} &times; team yield) / (appearances + ${prior}). Team yield is ${(teamYield * 100).toFixed(1)}%. This is a proposed dashboard measure, not the live pairing engine's rating or a predicted win probability. Even three appearances are not enough to call a pair proven.</p></details></section>`;
  }
  function captainSummary() {
    return `<section class="captain-summary"><div class="captain-total"><div class="eyebrow inverse">2026 / RECORDED LEAGUE POINTS</div><div>${points.toFixed(2)}<span>/ ${maximum}</span></div><p>${rate}% captured across ${finished.length} fixtures<br><strong>${(points / finished.length).toFixed(2)} pts / fixture</strong> / 15 is an even split</p></div><div class="captain-insight"><span class="summary-label">${icon("chart")} THE SEASON SIGNAL</span><h2>Better at home.<br>Room to grow away.</h2><p>Home: ${(homeRecord.points / homeRecord.count).toFixed(1)} pts per fixture.<br>Away: ${(awayRecord.points / awayRecord.count).toFixed(1)}. Compare the selections, not just the scores.</p>${link("#selection-insights", "Explore selection insights", "button light")}</div><div class="latest-result"><span class="eyebrow inverse">LATEST RESULT / ${date(latest.date).toUpperCase()}</span><div class="latest-opponent">${latest.short}<span>Away fixture</span></div><div class="latest-score">${money(latest.points)}<i>:</i>${money(30 - latest.points)}</div><span class="result-badge ${status(latest)}">${outcome(latest)}</span>${link(`/fixtures/${latest.id}`, "Open scorecard")}</div></section>`;
  }
  function travelPanel() {
    return `<section class="panel travel-panel"><div class="eyebrow">WHO TRAVELS WELL?</div><h2>Choose with the venue in mind.</h2><p>${insights.travelPlayers.length} players have at least 2 home and 2 away appearances. Draws count as half a win.</p><div class="segmented travel-controls" role="group" aria-label="Compare player home and away records"><button data-travel-filter="away" class="selected" aria-pressed="true">Away record</button><button data-travel-filter="home-edge" aria-pressed="false">Biggest home edge</button></div><div id="travel-comparison" aria-live="polite"></div><div class="subtle-note">The display shows six players at a time. Different opponents, partners and sample sizes affect results; this is a selection cue, not a forecast.</div></section>`;
  }
  function renderTravel(scope = "away") {
    const rows = [...insights.travelPlayers].sort((a, b) => scope === "home-edge"
      ? (b.homeYield - b.awayYield) - (a.homeYield - a.awayYield) || b.homePlayed - a.homePlayed
      : b.awayYield - a.awayYield || b.awayPlayed - a.awayPlayed);
    document.getElementById("travel-comparison").innerHTML = `<table class="travel-table"><thead><tr><th>Player</th><th>Home yield</th><th>Away yield</th></tr></thead><tbody>${rows.slice(0, 6).map((p) => `<tr><td><a href="/players/${p.id}">${p.name}</a></td>${[["home", p.homeYield, p.homePlayed], ["away", p.awayYield, p.awayPlayed]].map(([place, yieldRate, played]) => `<td><div class="travel-rate"><strong>${yieldRate.toFixed(0)}%</strong><small>${played} played</small></div><div class="travel-track ${place}"><span style="width:${yieldRate}%"></span></div></td>`).join("")}</tr>`).join("")}</tbody></table>`;
    document.querySelectorAll("[data-travel-filter]").forEach((button) => {
      const selected = button.dataset.travelFilter === scope;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }
  function handicapPanel() {
    const h = insights.handicap;
    return `<section class="panel handicap-panel"><div class="eyebrow">MATCH-UP CONTEXT</div><h2>Index gap and result yield</h2><p>Our combined recorded handicap index minus theirs.</p><div class="handicap-buckets">${h.buckets.map((bucket) => `<div class="handicap-row"><span><strong>${bucket.label.replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</strong><small>${bucket.played} matches</small></span><div class="handicap-track"><span style="width:${bucket.yieldRate}%"></span></div><b>${bucket.yieldRate.toFixed(0)}%</b></div>`).join("")}</div><div class="subtle-note">Yield = (wins + half of draws) / matches. ${h.known} complete records; ${h.missing} incomplete records excluded.<br>Average gap: +${h.homeMean} home (${h.homeCount} matches), +${h.awayMean} away (${h.awayCount}). Index differences are not playing strokes and cannot prove what caused a result.</div></section>`;
  }
  function closeMatchPanel() {
    const close = insights.closeLosses;
    return `<section class="panel close-panel"><div class="eyebrow">A PRACTICE CONVERSATION</div><h2>Small margins, meaningful points.</h2><div class="close-stats"><div><strong>${close.count}</strong><span>losses by 1 or 2 holes</span></div><div><strong>${close.oneUp}</strong><span>of those recorded as 1UP</span></div><div><strong>~${close.oneUpDrawGain.toFixed(1)}</strong><span>points if those ${close.oneUp} became draws</span></div></div><p>Illustration only: change each recorded 1UP loss to a half, using that fixture's points per match. This is not a forecast or a claim that the last hole decided each game.</p><div class="subtle-note">${close.unknownMargins} other league losses have no margin and are excluded.</div></section>`;
  }
  function selectionInsights() {
    return `<details class="selection-insights" id="selection-insights"><summary><span><span class="eyebrow">GO ONE LEVEL DEEPER</span><strong>Selection and match-up insights</strong><small>${insights.travelPlayers.length} home/away comparisons / ${insights.handicap.known} complete handicap records / ${insights.closeLosses.count} close losses</small></span><span class="expand-insights">Explore ${icon("plus")}</span></summary><div class="selection-grid">${travelPanel()}<div>${handicapPanel()}${closeMatchPanel()}</div></div></details>`;
  }
  function matchPlanning() {
    return `<section class="match-planning"><div><span class="eyebrow">WHEN THE NEXT FIXTURE IS READY</span><h2>Take the insights into your lineup.</h2><p>No future fixture is currently scheduled. No availability or submission deadlines have been assumed.</p></div><div>${link("/analytics/suggest", "Home lineup", "button planning-button")}${link("/analytics/counter", "Away counter-pairing", "button planning-button")}${link("/fixtures/new", "Schedule a fixture")}</div></section>`;
  }
  function footer() {
    return `<footer class="page-footer"><span>${icon("flag")} Kenya Air Force Golf Club <span class="footer-divider">/</span> Top Guns</span><span>NDC only. Internal fixtures excluded from season totals. Snapshot: ${data.asOf}.</span></footer><details class="design-notes"><summary>About this mockup</summary><p>This is a static, read-only snapshot of your database, not the live dashboard. Chart and ranking filters work; navigation opens existing app pages. No league position, player availability or upcoming fixture is invented. Points contributors need at least 3 appearances in the selected scope. The proposed sample-adjusted pair measure is separate from the live lineup engine. Optional reference-target ticks use the PDF's 22-home / 16-away thresholds; no bonus points are awarded or included. Refreshing this mockup does not refresh its data.</p></details>`;
  }
  function qualityNote() {
    const pending = sum(insights.pending, "matches");
    return `<section class="panel data-todo" id="data-todo"><div class="panel-heading"><div><div class="eyebrow">BETTER INPUTS, SHARPER DECISIONS</div><h2>A small data to-do list</h2></div><span class="count-badge">4 areas</span></div><div class="todo-grid"><a href="/analytics/handicaps"><strong>${data.missingHandicaps}</strong><span>league matches with unknown handicaps</span><small>Review coverage ${icon("arrow")}</small></a><a href="/fixtures"><strong>${missing.length}</strong><span>past league fixtures with no results</span><small>Open fixtures ${icon("arrow")}</small></a><a href="/fixtures/${insights.pending[0].id}"><strong>${pending}</strong><span>pending internal results, separate from NDC</span><small>Resolve January results ${icon("arrow")}</small></a><a href="/players"><strong>${data.roster - data.fielded}<small> / ${data.roster}</small></strong><span>roster players yet to appear in NDC; not necessarily inactive</span><small>Review the squad ${icon("arrow")}</small></a></div></section>`;
  }
  if (captain) {
    app.innerHTML = `${prototypeBar()}<div class="captain-shell"><header class="captain-nav">${brand()}${navigation()}<span class="season-chip"><span class="live-dot"></span>NDC season 2026</span></header><main class="captain-main">${header()}${captainSummary()}<div class="captain-workgrid"><div class="captain-primary">${performance()}${pairings()}</div><div class="captain-secondary">${leaderboard()}${homeAway()}</div></div>${selectionInsights()}${attention(true)}${matchPlanning()}${qualityNote()}${footer()}</main></div>`;
  } else {
    app.innerHTML = `${prototypeBar()}<div class="app-shell">${sidebar()}<main class="clubhouse-main"><div class="utility-bar"><span>Workspace <span>/</span> Season overview</span><span class="season-chip">${icon("calendar")} NDC league <b>2026</b></span></div>${header()}${seasonHero()}${metrics()}<div class="overview-grid"><div class="overview-primary">${performance()}${recentResults()}${pairings()}</div><div class="overview-secondary">${leaderboard()}${homeAway()}${players()}</div></div>${selectionInsights()}${attention(true)}${matchPlanning()}${qualityNote()}${footer()}</main></div>`;
  }
  renderChart();
  renderLeaders();
  renderTravel();
  document.querySelectorAll("[data-chart-filter]").forEach((button) => button.addEventListener("click", () => renderChart(button.dataset.chartFilter)));
  document.querySelectorAll("[data-leader-filter]").forEach((button) => button.addEventListener("click", () => renderLeaders(button.dataset.leaderFilter)));
  document.querySelectorAll("[data-travel-filter]").forEach((button) => button.addEventListener("click", () => renderTravel(button.dataset.travelFilter)));
  document.querySelector("[data-target-toggle]").addEventListener("click", (event) => {
    showTargets = !showTargets;
    event.currentTarget.setAttribute("aria-pressed", String(showTargets));
    event.currentTarget.textContent = showTargets ? "Hide reference targets" : "Show reference targets";
    document.getElementById("reference-warning").hidden = !showTargets;
    renderChart();
  });
  document.querySelector('a[href="#selection-insights"]')?.addEventListener("click", () => {
    document.getElementById("selection-insights").open = true;
  });
})();
