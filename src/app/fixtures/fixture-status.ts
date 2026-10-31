export function fixtureStatus(fixture: { date: string; wins: number; losses: number; halved: number; total: number; pending: number }, today: string) {
  const completed = fixture.wins + fixture.losses + fixture.halved;
  if (completed > 0) return fixture.pending > 0 ? "partial" : "recorded";
  return fixture.total === 0 && fixture.date >= today ? "scheduled" : "noresults";
}
