import type { DraftData, FixtureOption, PlayerOption, Review } from "@/lib/results-import/contracts";
import { initialReview, resolveReviewIdentities } from "@/lib/results-import/normalize";

export function chooseFixture(review: Review, fixture: FixtureOption, players: PlayerOption[]): Review {
  return resolveReviewIdentities({
    ...review, fixtureId: fixture.id, clubId: fixture.opponentClubId, date: fixture.date,
    homeAway: fixture.homeAway, venueName: fixture.venueName ?? review.venueName,
    teamName: fixture.teamName ?? review.teamName,
    opponentTeamName: fixture.opponentTeamName ?? review.opponentTeamName,
    internal: /Kenya Air\s*force/i.test(fixture.clubName),
    rows: review.rows.map((row) => ({ ...row, matchId: null, reviewed: false })),
  }, players);
}

export function restoreDraftReview(data: DraftData, players: PlayerOption[], fixture?: FixtureOption): Review | null {
  let review = data.review ?? (data.extraction ? initialReview(data.extraction, players, "right") : null);
  if (!review) return null;
  if (fixture && !data.review) review = chooseFixture(review, fixture, players);
  return data.preview ? review : resolveReviewIdentities(review, players);
}
