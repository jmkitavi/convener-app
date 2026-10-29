import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const players = sqliteTable("players", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  defaultHandicap: real("default_handicap").notNull().default(18),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const opponentClubs = sqliteTable("opponent_clubs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  par: integer("par"),
  slopeRating: real("slope_rating"),
  courseRating: real("course_rating"),
});

export const fixtures = sqliteTable("fixtures", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  opponentClubId: integer("opponent_club_id").notNull().references(() => opponentClubs.id),
  homeAway: text("home_away", { enum: ["home", "away", "neutral"] }).notNull().default("home"),
  notes: text("notes"),
  venueName: text("venue_name"),
  teamName: text("team_name"),
  opponentTeamName: text("opponent_team_name"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const matches = sqliteTable("matches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fixtureId: integer("fixture_id").notNull().references(() => fixtures.id, { onDelete: "cascade" }),
  player1Id: integer("player1_id").notNull().references(() => players.id),
  player2Id: integer("player2_id").notNull().references(() => players.id),
  player1Handicap: real("player1_handicap"),
  player2Handicap: real("player2_handicap"),
  opponent1Name: text("opponent1_name").notNull(),
  opponent2Name: text("opponent2_name").notNull(),
  opponent1Handicap: real("opponent1_handicap"),
  opponent2Handicap: real("opponent2_handicap"),
  opponent1Id: integer("opponent1_id").references(() => players.id),
  opponent2Id: integer("opponent2_id").references(() => players.id),
  result: text("result", { enum: ["win", "loss", "halved", "pending"] }).notNull(),
  margin: text("margin"),
  matchOrder: integer("match_order"),
  notes: text("notes"),
});

export const resultImports = sqliteTable("result_imports", {
  id: text("id").primaryKey(),
  status: text("status").notNull(),
  data: text("data").notNull(),
  sourceHash: text("source_hash").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
  commitResult: text("commit_result"),
});

export const opponentLineups = sqliteTable("opponent_lineups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  fixtureId: integer("fixture_id").references(() => fixtures.id),
  clubId: integer("club_id").references(() => opponentClubs.id),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const opponentLineupPairs = sqliteTable("opponent_lineup_pairs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  lineupId: integer("lineup_id").notNull().references(() => opponentLineups.id, { onDelete: "cascade" }),
  matchOrder: integer("match_order").notNull(),
  opp1Name: text("opp1_name").notNull(),
  opp1Handicap: real("opp1_handicap").notNull(),
  opp2Name: text("opp2_name").notNull(),
  opp2Handicap: real("opp2_handicap").notNull(),
  isRedMatch: integer("is_red_match", { mode: "boolean" }).notNull().default(false),
});
