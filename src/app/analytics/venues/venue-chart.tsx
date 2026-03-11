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
} from "recharts";
import type { VenueRecord } from "@/lib/analytics";

const COLORS = {
  wins: "#059669",
  losses: "#f87171",
  halved: "#fbbf24",
};

export function VenueChart({ venues }: { venues: VenueRecord[] }) {
  const data = venues.map((v) => ({
    name: v.venueName,
    Wins: v.wins,
    Losses: v.losses,
    Halved: v.halved,
    "Win Rate %": Math.round(v.winRate * 1000) / 10,
  }));

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        No data to chart yet.
      </p>
    );
  }

  return (
    <div className="h-72">
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
  );
}
