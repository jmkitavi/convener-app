import { pgTable, text, integer, doublePrecision, boolean } from "drizzle-orm/pg-core";

export const players = pgTable("players", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  defaultHandicap: doublePrecision("default_handicap").notNull().default(18),
  active: boolean("active").notNull().default(true),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const opponentClubs = pgTable("opponent_clubs", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  name: text("name").notNull(),
  par: integer("par"),
  slopeRating: doublePrecision("slope_rating"),
  courseRating: doublePrecision("course_rating"),
});

export const fixtures = pgTable("fixtures", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  date: text("date").notNull(),
  opponentClubId: integer("opponent_club_id").notNull().references(() => opponentClubs.id),
  homeAway: text("home_away", { enum: ["home", "away", "neutral"] }).notNull().default("home"),
  notes: text("notes"),
  venueName: text("venue_name"),
  teamName: text("team_name"),
  opponentTeamName: text("opponent_team_name"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const matches = pgTable("matches", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  fixtureId: integer("fixture_id").notNull().references(() => fixtures.id, { onDelete: "cascade" }),
  player1Id: integer("player1_id").notNull().references(() => players.id),
  player2Id: integer("player2_id").notNull().references(() => players.id),
  player1Handicap: doublePrecision("player1_handicap"),
  player2Handicap: doublePrecision("player2_handicap"),
  opponent1Name: text("opponent1_name").notNull(),
  opponent2Name: text("opponent2_name").notNull(),
  opponent1Handicap: doublePrecision("opponent1_handicap"),
  opponent2Handicap: doublePrecision("opponent2_handicap"),
  opponent1Id: integer("opponent1_id").references(() => players.id),
  opponent2Id: integer("opponent2_id").references(() => players.id),
  result: text("result", { enum: ["win", "loss", "halved", "pending"] }).notNull(),
  margin: text("margin"),
  matchOrder: integer("match_order"),
  notes: text("notes"),
});

export const resultImports = pgTable("result_imports", {
  id: text("id").primaryKey(),
  status: text("status").notNull(),
  data: text("data").notNull(),
  sourceHash: text("source_hash").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
  commitResult: text("commit_result"),
});

export const opponentLineups = pgTable("opponent_lineups", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  name: text("name").notNull(),
  fixtureId: integer("fixture_id").references(() => fixtures.id),
  clubId: integer("club_id").references(() => opponentClubs.id),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const opponentLineupPairs = pgTable("opponent_lineup_pairs", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  lineupId: integer("lineup_id").notNull().references(() => opponentLineups.id, { onDelete: "cascade" }),
  matchOrder: integer("match_order").notNull(),
  opp1Name: text("opp1_name").notNull(),
  opp1Handicap: doublePrecision("opp1_handicap").notNull(),
  opp2Name: text("opp2_name").notNull(),
  opp2Handicap: doublePrecision("opp2_handicap").notNull(),
  isRedMatch: boolean("is_red_match").notNull().default(false),
});
