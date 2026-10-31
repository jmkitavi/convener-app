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
  wins: "#477c6a",
  losses: "#223f50",
  halved: "#d59c48",
};

export function HandicapChart({ buckets, mode = "both" }: { buckets: HandicapBucket[]; mode?: "both" | "samples" }) {
  const data = buckets.map((b) => ({
    name: b.label,
    "Result yield %": b.played > 0 ? Math.round(((b.wins + b.halved * 0.5) / b.played) * 1000) / 10 : null,
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
      {mode === "both" && <div className="h-64 min-w-0" role="img" aria-label="Result yield by recorded index gap; exact values and samples are in the full bucket records table.">
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
            <Bar dataKey="Result yield %" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={index}
                  fill={
                    (entry["Result yield %"] ?? 0) >= 50 ? COLORS.wins : COLORS.losses
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>}

      <div className="h-64 min-w-0" role="img" aria-label="Wins, halves and losses by recorded index gap; exact counts are in the full bucket records table.">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" fontSize={12} />
            <YAxis fontSize={12} allowDecimals={false} />
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
