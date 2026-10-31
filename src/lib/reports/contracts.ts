import { z } from "zod";
import type { InsightData, FixtureEvidence } from "@/lib/insights";
import type { HandicapHistoryPoint } from "@/components/player-handicap-chart";

export const reportCatalog = [
  ["season", "Season overview"], ["squad", "Squad performance"], ["player", "Player performance"],
  ["pairings", "Partnership performance"], ["home-away", "Home vs away"], ["leaderboards", "Contribution leaders"],
  ["venues", "Venue performance"], ["handicaps", "Handicap context"], ["fixtures", "Fixture inventory"],
  ["scorecard", "Match scorecards"], ["quality", "Data quality"], ["close-losses", "Close losses"],
  ["clubs", "Clubs and courses"], ["lineup-home", "Home pairing recommendations"], ["lineup-away", "Away matchup recommendations"],
] as const;
export type SectionId = typeof reportCatalog[number][0];
const ids = reportCatalog.map(([id]) => id) as [SectionId, ...SectionId[]];
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value =>
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, "Choose a valid date");
export const reportConfigSchema = z.object({
  title: z.string().trim().min(1).max(120).default("Conveners desk report"),
  sections: z.array(z.enum(ids)).min(1).max(ids.length).refine(values => new Set(values).size === values.length),
  from: date.optional(), to: date.optional(),
  playerIds: z.array(z.number().int().positive()).max(500).default([]),
  fixtureIds: z.array(z.number().int().positive()).max(1000).default([]),
  location: z.enum(["all", "home", "away"]).default("all"),
  minimum: z.number().int().min(1).max(1000).default(1),
  sort: z.string().max(40).default("name"),
  direction: z.enum(["asc", "desc"]).default("asc"),
  search: z.string().max(200).default(""),
  status: z.enum(["all", "active", "inactive"]).default("all"),
  queue: z.enum(["all", "results", "handicaps", "roster"]).default("all"),
  profileTab: z.enum(["overview", "history", "partners", "handicaps", "venues"]).default("overview"),
  referenceTargets: z.boolean().default(false),
  charts: z.boolean().default(true), tables: z.boolean().default(true),
}).refine(value => !value.from || !value.to || value.from <= value.to, "Start date must be on or before end date");
export type ReportConfig = z.infer<typeof reportConfigSchema>;
export type Cell = string | number | boolean | null;
export type Column = { label: string; type?: "number" | "percent" | "date" };
export type ReportTable = { id: string; title: string; columns: Column[]; rows: Cell[][] };
export type ReportChart = {
  id: string; title: string; kind: "bar" | "line"; labels: string[];
  series: { name: string; values: (number | null)[]; color: string; pointColors?: string[]; pointLabels?: string[] }[];
  legend?: { name: string; color: string }[];
  fixturePoints?: FixtureEvidence[];
  handicapHistory?: HandicapHistoryPoint[];
  domain?: [number, number];
  referenceLines?: { name: string; value: number; color: string }[];
  targets?: { name: string; values: (number | null)[]; color: string };
  percent?: boolean; notes: string[];
};
export type ReportSection = { id: SectionId; title: string; notes: string[]; tables: ReportTable[]; charts: ReportChart[] };
export type ReportSnapshot = {
  title: string; generatedAt: string; scope: "ndc" | "all"; filters: string[];
  sections: ReportSection[]; showCharts: boolean; showTables: boolean;
};
export type ReportSource = Omit<InsightData, "players" | "fixtures"> & {
  players: (InsightData["players"][number] & { defaultHandicap: number })[];
  fixtures: (InsightData["fixtures"][number] & { teamName?: string | null; opponentTeamName?: string | null })[];
  clubs: { id: number; name: string; par: number | null; slopeRating: number | null; courseRating: number | null }[];
};
