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
import type { FixtureResult } from "@/lib/analytics";

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
        <Bar dataKey="Wins" fill="#059669" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Losses" fill="#f87171" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Halved" fill="#fbbf24" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
