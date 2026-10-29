import { z } from "zod";

const text = z.string().trim().max(500);
const handicap = z.number().finite().min(-8).max(54).nullable();
const extractedPlayer = z.object({ name: text.nullable(), handicap });

export const extractionSchema = z.object({
  date: z.string().nullable(),
  leftTeam: text.nullable(),
  rightTeam: text.nullable(),
  venue: text.nullable(),
  warnings: z.array(text).max(100),
  rows: z.array(z.object({
    page: z.number().int().min(1).max(5),
    order: z.number().int().min(1).max(200).nullable(),
    tee: text.nullable(),
    left: z.array(extractedPlayer).length(2),
    right: z.array(extractedPlayer).length(2),
    leftResult: text.nullable(),
    rightResult: text.nullable(),
    warnings: z.array(text).max(20),
  })).max(200),
});

export type Extraction = z.infer<typeof extractionSchema>;
export type Outcome = "win" | "loss" | "halved" | "pending";
export type Side = "left" | "right";

export const personSchema = z.object({
  id: z.number().int().positive().nullable(),
  name: z.string().trim().max(200),
  handicap,
  create: z.boolean(),
  clearHandicap: z.boolean().optional(),
  identitySource: z.enum(["automatic", "manual"]).optional(),
});

export const reviewSchema = z.object({
  fixtureId: z.number().int().positive().nullable(),
  clubId: z.number().int().positive().nullable(),
  newClubName: z.string().trim().max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Choose a valid date"),
  homeAway: z.enum(["home", "away", "neutral"]),
  venueName: z.string().trim().min(1).max(200),
  teamName: z.string().trim().min(1).max(200),
  opponentTeamName: z.string().trim().min(1).max(200),
  side: z.enum(["left", "right"]),
  internal: z.boolean(),
  fixtureConfirmed: z.literal(true),
  rows: z.array(z.object({
    key: z.string().max(100),
    page: z.number().int().min(1).max(5),
    order: z.number().int().min(1).max(200).nullable(),
    selected: z.boolean(),
    reviewed: z.boolean(),
    players: z.tuple([personSchema, personSchema]),
    opponents: z.tuple([personSchema, personSchema]),
    result: z.enum(["win", "loss", "halved", "pending"]).nullable(),
    margin: z.string().trim().max(30).nullable(),
    notes: z.string().max(2000),
    // Match IDs are always revalidated against this fixture on the server.
    matchId: z.number().int().positive().nullable(),
    clearMargin: z.boolean().optional(),
    clearNotes: z.boolean().optional(),
  })).min(1).max(200),
});

export type Review = z.infer<typeof reviewSchema>;
export const draftReviewSchema = reviewSchema.extend({
  date: z.string().max(10),
  venueName: z.string().trim().max(200),
  teamName: z.string().trim().max(200),
  opponentTeamName: z.string().trim().max(200),
});
export type ReviewRow = Review["rows"][number];
export type Person = z.infer<typeof personSchema>;
export type PlayerOption = { id: number; name: string; defaultHandicap: number; active: boolean };
export type FixtureOption = {
  id: number; date: string; opponentClubId: number; homeAway: "home" | "away" | "neutral";
  venueName: string | null; teamName: string | null; opponentTeamName: string | null;
  clubName: string;
};
export type ExistingMatch = {
  id: number; fixture_id: number; player1_id: number; player2_id: number;
  player1_handicap: number | null; player2_handicap: number | null;
  opponent1_name: string; opponent2_name: string;
  opponent1_handicap: number | null; opponent2_handicap: number | null;
  opponent1_id: number | null; opponent2_id: number | null;
  result: string; margin: string | null; match_order: number | null; notes: string | null;
};
export type ProposedRow = {
  key: string; operation: "add" | "update" | "unchanged";
  matchId: number | null; before: ExistingMatch | null; changes: string[];
  after: Record<string, string | number | null>;
};
export type Preview = {
  version: string; rows: ProposedRow[]; fixtureSnapshot: string | null;
};
export type DraftData = {
  pageCount: number; extraction?: Extraction; extractionError?: string;
  review?: Review; preview?: Preview; model?: string; extractionVersion: number;
  matchLinks?: { key: string; matchId: number }[];
};
