"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { handicapResultColors } from "@/lib/chart-colors";

export type HandicapHistoryPoint = { date: string; handicap: number; result: "win" | "loss" | "halved" };

function ResultDot({ cx, cy, payload }: { cx?: number; cy?: number; payload?: HandicapHistoryPoint }) {
  if (cx == null || cy == null || !payload) return null;
  return <circle cx={cx} cy={cy} r={5} fill={handicapResultColors[payload.result]} stroke="white" strokeWidth={2} />;
}

export function PlayerHandicapChart({ points }: { points: HandicapHistoryPoint[] }) {
  return <div className="h-64" style={{ height: 256, minWidth: 0 }} aria-label="Recorded handicap history line chart">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={points} margin={{ top: 8, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="date" tickFormatter={date => new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} fontSize={11} />
        <YAxis domain={["dataMin - 1", "dataMax + 1"]} fontSize={11} />
        <Tooltip labelFormatter={label => new Date(String(label)).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} formatter={value => [Number(value).toFixed(1), "Handicap"]} />
        <Line type="monotone" dataKey="handicap" stroke="var(--primary)" strokeWidth={2} dot={<ResultDot />} activeDot={{ r: 6 }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  </div>;
}
