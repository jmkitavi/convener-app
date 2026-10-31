import { pool } from "@/db";
import { rows, transaction } from "@/db/connection";
import type { ReportSource } from "./contracts";

export async function loadReportSource(): Promise<ReportSource> {
  return transaction(pool, async (connection) => {
    await connection.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY");
    const fixtures = await rows<ReportSource["fixtures"][number]>(connection, `SELECT f.id, f.date, f.home_away AS "homeAway",
      f.opponent_club_id AS "opponentClubId", c.name AS "opponentClubName",
      f.team_name AS "teamName", f.opponent_team_name AS "opponentTeamName",
      COALESCE(NULLIF(TRIM(f.venue_name), ''), CASE WHEN f.home_away='home'
        THEN 'Kenya Air Force Golf Club' ELSE c.name END) AS "venueName"
      FROM fixtures f JOIN opponent_clubs c ON c.id=f.opponent_club_id ORDER BY f.date,f.id`);
    const fixtureMap = new Map(fixtures.map(fixture => [fixture.id, fixture]));
    const matches = await rows<Omit<ReportSource["matches"][number], "fixtureDate" | "homeAway" | "venueName" | "opponentClubId" | "opponentClubName" | "notes">>(connection, `SELECT m.id,m.fixture_id AS "fixtureId",
      m.player1_id AS "player1Id",m.player2_id AS "player2Id",p1.name AS "player1Name",p2.name AS "player2Name",
      m.player1_handicap AS "player1Handicap",m.player2_handicap AS "player2Handicap",
      m.opponent1_name AS "opponent1Name",m.opponent2_name AS "opponent2Name",
      m.opponent1_id AS "opponent1Id",m.opponent2_id AS "opponent2Id",
      o1.name AS "opponent1PlayerName",o2.name AS "opponent2PlayerName",
      m.opponent1_handicap AS "opponent1Handicap",m.opponent2_handicap AS "opponent2Handicap",
      m.result,m.margin,m.match_order AS "matchOrder"
      FROM matches m JOIN players p1 ON p1.id=m.player1_id JOIN players p2 ON p2.id=m.player2_id
      LEFT JOIN players o1 ON o1.id=m.opponent1_id LEFT JOIN players o2 ON o2.id=m.opponent2_id
      ORDER BY m.fixture_id,m.match_order NULLS FIRST,m.id`);
    return {
      fixtures,
      matches: matches.map(match => {
        const fixture = fixtureMap.get(match.fixtureId);
        if (!fixture) throw new Error("A report match references an unavailable fixture.");
        return { ...match, fixtureDate: fixture.date, homeAway: fixture.homeAway, venueName: fixture.venueName,
          opponentClubId: fixture.opponentClubId, opponentClubName: fixture.opponentClubName, notes: null };
      }),
      players: await rows<ReportSource["players"][number]>(connection, 'SELECT id,name,active,default_handicap AS "defaultHandicap" FROM players ORDER BY name,id'),
      clubs: await rows<ReportSource["clubs"][number]>(connection, 'SELECT id,name,par,slope_rating AS "slopeRating",course_rating AS "courseRating" FROM opponent_clubs ORDER BY name,id'),
    };
  });
}
