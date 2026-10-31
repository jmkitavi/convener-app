"use client";

import { useId, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  type BarShapeProps,
  type TooltipContentProps,
} from "recharts";
import type { FixtureResult } from "@/lib/analytics";
import type { FixtureEvidence } from "@/lib/insights";
import { useReportView } from "@/components/reports/report-provider";
import { fixtureLocationColors as locationColors } from "@/lib/chart-colors";

const referenceTargets = { home: 22, away: 16 };
const shortDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

function fixtureDate(date: string) {
  return shortDate.format(new Date(`${date.slice(0, 10)}T00:00:00Z`));
}

function shortOpponent(name: string) {
  const short = name.replace(/\s+(?:Golf\s+)?(?:Club|Course)$/i, "");
  return short.length > 14 ? `${short.slice(0, 13)}…` : short;
}

function fixtureState(fixture: FixtureEvidence) {
  if (fixture.provisional) return "Provisional";
  return fixture.result === "win" ? "Won" : fixture.result === "draw" ? "Drawn" : fixture.result === "loss" ? "Lost" : "Incomplete";
}

function stateMarker(fixture: FixtureEvidence) {
  return fixture.provisional || !fixture.result ? "P" : fixture.result === "win" ? "W" : fixture.result === "draw" ? "D" : "L";
}

function PointsTooltip({ active, payload }: TooltipContentProps) {
  const fixture = payload?.[0]?.payload as FixtureEvidence | undefined;
  if (!active || !fixture) return null;
  return (
    <div className="max-w-[260px] rounded-lg border border-[#dce3d6] bg-[#203d31] p-3 text-xs leading-relaxed text-white shadow-lg">
      <div className="font-semibold">{fixture.opponentClubName}</div>
      <div>{fixture.date.slice(0, 10)} · {fixture.homeAway} · {fixture.venueName || "Venue not recorded"}</div>
      <div className="mt-1 font-semibold">{fixtureState(fixture)}</div>
      <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-4">
        <dt>Team points</dt><dd className="text-right">{fixture.teamPoints.toFixed(2)}</dd>
        <dt>Opponent points</dt><dd className="text-right">{fixture.opponentPoints.toFixed(2)}</dd>
        <dt>Available maximum</dt><dd className="text-right">{fixture.availablePoints.toFixed(2)}</dd>
        <dt>Completed matches</dt><dd className="text-right">{fixture.completed}</dd>
        <dt>Pending matches</dt><dd className="text-right">{fixture.pending}</dd>
      </dl>
      <div className="mt-2 text-[#d6e1d0]">
        Actual even split: {(fixture.availablePoints / 2).toFixed(2)} points.
        {" "}{fixture.weight.toFixed(2)} points per win (two-point cap).
      </div>
      {fixture.provisional && <div className="mt-1 text-[#f3d9a7]">Provisional: pending matches may change the allocation and score. No final W/D/L.</div>}
    </div>
  );
}

function PointsBar({ x, y, width, height, payload, background, showTargets }: BarShapeProps & { showTargets: boolean }) {
  const fixture = payload as FixtureEvidence;
  const target = fixture.homeAway === "neutral" ? null : referenceTargets[fixture.homeAway];
  const targetY = background && background.y !== null && target !== null
    ? background.y + background.height * (1 - target / 30)
    : null;
  const color = locationColors[fixture.homeAway];
  return (
    <g>
      <rect x={x} y={height === 0 ? y - 2 : y} width={width} height={Math.max(height, 2)} fill={color} rx={2} fillOpacity={fixture.provisional ? 0.65 : 1} />
      <text x={x + width / 2} y={y - 9} textAnchor="middle" fill="#344b3b" fontSize={11} fontWeight={600}>
        {fixture.teamPoints.toFixed(2)}
      </text>
      <text x={x + width / 2} y={height >= 22 ? y + height - 7 : y + height + 14} textAnchor="middle" fill={height >= 22 ? (fixture.homeAway === "away" ? "#493219" : "#ffffff") : "#53614c"} fontSize={10} fontWeight={700}>
        {stateMarker(fixture)}
      </text>
      {showTargets && targetY !== null && (
        <line x1={x - 3} x2={x + width + 3} y1={targetY} y2={targetY} stroke="#9c6a28" strokeWidth={2} strokeDasharray="4 3" />
      )}
    </g>
  );
}

export function FixturePointsChart({ fixtures, readOnly = false, referenceTargetsVisible = false }: { fixtures: FixtureEvidence[]; readOnly?: boolean; referenceTargetsVisible?: boolean }) {
  const [selectedLocation, setLocation] = useState<"all" | "home" | "away">("all");
  const [selectedTargets, setShowTargets] = useState(false);
  const location = readOnly ? "all" : selectedLocation;
  const showTargets = readOnly ? referenceTargetsVisible : selectedTargets;
  useReportView(readOnly ? undefined : {filters:{location,referenceTargets:showTargets}});
  const descriptionId = useId();
  const referenceId = useId();
  const recorded = fixtures.filter((fixture) => fixture.completed > 0);
  const data = recorded
    .filter((fixture) => location === "all" || fixture.homeAway === location)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  const excluded = fixtures.length - recorded.length;

  return (
    <div className="fixture-points-chart w-full min-w-0 max-w-full text-[#53614c]">
      {!readOnly && <div className="mb-1 flex justify-end">
        <div className="inline-flex rounded-lg border border-[#dce3d6] bg-[#f7f8f2] p-0.5" role="group" aria-label="Filter fixture points by location">
          {(["all", "home", "away"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={location === value}
              onClick={() => setLocation(value)}
              className={`min-h-8 rounded-md px-3 text-[11px] font-medium capitalize transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3f7058] ${location === value ? "bg-[#203d31] text-white shadow-sm" : "text-[#64715e] hover:bg-[#e8ede2]"}`}
              style={{ backgroundColor: location === value ? "#203d31" : "transparent", color: location === value ? "#ffffff" : "#64715e" }}
            >
              {value}
            </button>
          ))}
        </div>
      </div>}
      <span className="sr-only" aria-live="polite">{data.length} fixtures shown. {location} locations.</span>
      {data.length ? (
        <div
          className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain rounded-sm focus-visible:outline-2 focus-visible:outline-[#3f7058]"
          style={{ minWidth: 0, maxWidth: "100%", overflowX: "auto" }}
          role="region"
          tabIndex={0}
          aria-label="Team points by fixture. Use arrow keys to explore; scroll horizontally for more fixtures."
          aria-describedby={descriptionId}
        >
          <div style={{ height: 280, minWidth: Math.max(360, data.length * 48 + 44) }}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data} accessibilityLayer margin={{ top: 32, right: 16, left: 0, bottom: 4 }} barCategoryGap="18%" barSize={40}>
                <CartesianGrid vertical={false} stroke="#edf0e7" />
                <XAxis
                  dataKey="id"
                  interval={0}
                  axisLine={false}
                  tickLine={false}
                  height={68}
                  tick={({ x, y, payload }) => {
                    const fixture = data.find((entry) => entry.id === payload.value);
                    if (!fixture) return <g />;
                    return (
                      <g transform={`translate(${x},${y})`}>
                        <text y={24} textAnchor="end" transform="rotate(-28)" fill="#43543e" fontSize={10}>{shortOpponent(fixture.opponentClubName)}</text>
                        <text y={53} textAnchor="middle" fill="#69766b" fontSize={9}>{fixtureDate(fixture.date)}</text>
                      </g>
                    );
                  }}
                />
                <YAxis domain={[0, 30]} ticks={[0, 15, 30]} width={30} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#76836b" }} />
                <ReferenceLine y={15} stroke="#b5a886" strokeDasharray="4 4" />
                <Tooltip content={PointsTooltip} cursor={{ fill: "#e8ede2", fillOpacity: 0.4 }} />
                <Bar dataKey="teamPoints" name="Team points" isAnimationActive={false} shape={(props: BarShapeProps) => <PointsBar {...props} showTargets={showTargets} />} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <p className="flex min-h-[230px] items-center justify-center px-4 text-center text-sm text-[#69766b]" role="status">
          {recorded.length ? `No ${location} fixtures with recorded results in this scope.` : "No recorded results in this scope yet. Fixtures with only pending matches are not plotted."}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#edf0e7] pt-3 text-[11px]">
        {(["home", "away", "neutral"] as const).map((value) => (
          <span key={value} className="inline-flex items-center gap-1.5 capitalize">
            <i className="inline-block size-2 rounded-full" style={{ display: "inline-block", width: 8, height: 8, flexShrink: 0, borderRadius: "50%", backgroundColor: locationColors[value] }} aria-hidden="true" />{value}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5"><i className="inline-block w-3.5 border-t border-dashed border-[#b5a886]" style={{ display: "inline-block", width: 14, flexShrink: 0, borderTop: "1px dashed #b5a886" }} aria-hidden="true" />15 pts: full-field even split</span>
        {!readOnly && <button
          type="button"
          aria-pressed={showTargets}
          aria-controls={referenceId}
          onClick={() => setShowTargets((value) => !value)}
          className="min-h-8 text-[#786443] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3f7058] sm:ml-auto"
        >
          {showTargets ? "Hide reference targets" : "Show reference targets"}
        </button>}
      </div>
      <p id={descriptionId} className="mt-2 text-[10px] leading-relaxed text-[#69766b]">
        Team points only, on a fixed 0–30 scale. W won · D drawn · L lost · P provisional/incomplete.
        {" "}15 is an even split only when 30 points are available; smaller fields retain the two-point-per-match cap.
        {excluded > 0 && ` ${excluded} fixture${excluded === 1 ? "" : "s"} without completed matches excluded.`}
      </p>
      <p id={referenceId} hidden={!showTargets} className="mt-2 rounded-md bg-[#fff8e9] px-3 py-2 text-[11px] leading-relaxed text-[#7a623d]">
        Dashed reference targets: 22 home / 16 away, from the PDF mockup. Unverified thresholds, not predictions or official bonus points; they do not change totals. No neutral target is defined.
      </p>
      <div className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)", whiteSpace: "nowrap" }}>
        <table>
          <caption>Fixture points chart data, {location} locations. Only fixtures with completed matches.</caption>
          <thead><tr><th scope="col">Opponent</th><th scope="col">Date</th><th scope="col">Location</th><th scope="col">Venue</th><th scope="col">State</th><th scope="col">Team points</th><th scope="col">Opponent points</th><th scope="col">Available maximum</th><th scope="col">Completed matches</th><th scope="col">Pending matches</th><th scope="col">Actual even split</th></tr></thead>
          <tbody>
            {data.map((fixture) => (
              <tr key={fixture.id}>
                <th scope="row">{fixture.opponentClubName}</th><td>{fixture.date.slice(0, 10)}</td><td>{fixture.homeAway}</td><td>{fixture.venueName || "Venue not recorded"}</td>
                <td>{fixtureState(fixture)}</td><td>{fixture.teamPoints.toFixed(2)}</td><td>{fixture.opponentPoints.toFixed(2)}</td><td>{fixture.availablePoints.toFixed(2)}</td>
                <td>{fixture.completed}</td><td>{fixture.pending}</td><td>{(fixture.availablePoints / 2).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function FixtureChart({ fixtures }: { fixtures: FixtureResult[] }) {
  const data = [...fixtures].reverse().map((f) => ({
    name: f.opponentClubName.length > 12
      ? f.opponentClubName.slice(0, 12) + "…"
      : f.opponentClubName,
    Wins: f.wins,
    Losses: f.losses,
    Halved: f.halved,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        <Bar dataKey="Wins" fill="var(--home)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Losses" fill="var(--desk-navy)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Halved" fill="var(--away)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
