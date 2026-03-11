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
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const matches = sqliteTable("matches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fixtureId: integer("fixture_id").notNull().references(() => fixtures.id, { onDelete: "cascade" }),
  player1Id: integer("player1_id").notNull().references(() => players.id),
  player2Id: integer("player2_id").notNull().references(() => players.id),
  player1Handicap: real("player1_handicap").notNull(),
  player2Handicap: real("player2_handicap").notNull(),
  opponent1Name: text("opponent1_name").notNull(),
  opponent2Name: text("opponent2_name").notNull(),
  opponent1Handicap: real("opponent1_handicap").notNull(),
  opponent2Handicap: real("opponent2_handicap").notNull(),
  result: text("result", { enum: ["win", "loss", "halved"] }).notNull(),
  margin: text("margin"),
  matchOrder: integer("match_order"),
  notes: text("notes"),
});
