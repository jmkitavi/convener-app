"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import type { HandicapBucket } from "@/lib/analytics";

const COLORS = {
  wins: "#059669",
  losses: "#f87171",
  halved: "#fbbf24",
};

export function HandicapChart({ buckets }: { buckets: HandicapBucket[] }) {
  const data = buckets.map((b) => ({
    name: b.label,
    "Win Rate %": b.played > 0 ? Math.round(b.winRate * 1000) / 10 : 0,
    Wins: b.wins,
    Losses: b.losses,
    Halved: b.halved,
    Played: b.played,
  }));

  const hasData = data.some((d) => d.Played > 0);
  if (!hasData) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        No data to chart yet.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* Win rate bar chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" fontSize={12} />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v: number) => `${v}%`}
              fontSize={12}
            />
            <Tooltip formatter={(value) => `${value}%`} />
            <Bar dataKey="Win Rate %" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={index}
                  fill={
                    entry["Win Rate %"] >= 50 ? COLORS.wins : COLORS.losses
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Stacked W/L/H chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip />
            <Legend />
            <Bar
              dataKey="Wins"
              stackId="a"
              fill={COLORS.wins}
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="Losses"
              stackId="a"
              fill={COLORS.losses}
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="Halved"
              stackId="a"
              fill={COLORS.halved}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
