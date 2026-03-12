import { db } from "./index";
import { matches } from "./schema";

// Thika Sports Club opponent names
const thikaOpponents = [
  ["James Mwangi", "Peter Njuguna"],
  ["Samuel Kariuki", "Daniel Odhiambo"],
  ["Francis Mutua", "Joseph Kamau"],
  ["Robert Otieno", "Charles Waweru"],
  ["David Kimani", "Stephen Maina"],
  ["Patrick Karanja", "George Mburu"],
  ["Richard Waithaka", "Henry Ngugi"],
  ["Michael Ouma", "John Gathoni"],
  ["Andrew Macharia", "Philip Wanjiku"],
  ["Thomas Ndirangu", "Albert Ochieng"],
  ["Martin Gitau", "Bernard Kuria"],
  ["Emmanuel Ndung'u", "Isaac Kipchoge"],
  ["Lawrence Kibet", "Paul Rotich"],
  ["Simon Muturi", "Dennis Mwenda"],
  ["Alex Njenga", "Brian Thuo"],
];

// Royal Nairobi opponent names
const royalOpponents = [
  ["William Odera", "Kenneth Muthoni"],
  ["Christopher Njoroge", "Vincent Oluoch"],
  ["Timothy Wekesa", "Nicholas Omondi"],
  ["Edward Githinji", "Mark Kamande"],
  ["Anthony Mwangi", "Douglas Kipkorir"],
  ["Geoffrey Kiptoo", "Julius Ogutu"],
  ["Peter Njeru", "Benjamin Odinga"],
  ["Collins Wanyonyi", "Denis Mugambi"],
  ["Harrison Onyango", "Steven Muiruri"],
  ["Maxwell Kiprono", "Oscar Ngeno"],
  ["Fredrick Otieno", "James Koech"],
  ["Walter Maina", "Herbert Mutiso"],
  ["Charles Barasa", "Nicholas Kamau"],
  ["Raymond Opiyo", "Daniel Kemboi"],
  ["Gerald Kimutai", "Moses Wafula"],
];

// Fixture 1: Away vs Thika Sports Club (2026-02-08)
// 30 players fielded (15 pairs)
const fixture1Pairs: [number, number][] = [
  [51, 58],  // Joel Muchanga (8.6) + Victor Noi (9.2)
  [36, 54],  // Lincolyn Wekesa (10) + Ezra Arigo (11.5)
  [61, 39],  // Lazarus Muganda (12.9) + Aloise Kizito (14.4)
  [69, 65],  // Amos Nyoike (15.3) + Anthony Rogo (15.6)
  [42, 59],  // Joseph Kitavi (16.1) + Tungani Muchiri (16.3)
  [66, 48],  // Samson Musesya (16.9) + Edwin Omollo (17.8)
  [62, 74],  // Mike Mulwa (18.1) + H. Wanyama (18)
  [72, 57],  // Philip Mwangi (20) + Billy Ocharo (20.1)
  [44, 73],  // Oscar Mwita (20.7) + Brian Kiptoo (20.7)
  [55, 56],  // Edwin Huma (21.3) + Sebastian Demello (20.8)
  [63, 34],  // Fredrick Wagura (23.6) + John Foro (24)
  [46, 41],  // Michael Zeni (24.1) + Mohamed Shariff (24)
  [50, 47],  // Alex Mulwa (25.4) + Steve Munguti (25.9)
  [38, 71],  // George Omondi (26) + Charles Kenyansa (27)
  [53, 60],  // David Too (28) + Kevin Aura (28)
];

// Fixture 1 results: 8W, 5L, 2H (solid away win)
const fixture1Results: { result: "win" | "loss" | "halved"; margin: string | null }[] = [
  { result: "win", margin: "4&3" },
  { result: "win", margin: "3&2" },
  { result: "loss", margin: "2&1" },
  { result: "win", margin: "1up" },
  { result: "halved", margin: null },
  { result: "win", margin: "2up" },
  { result: "loss", margin: "3&2" },
  { result: "win", margin: "5&4" },
  { result: "loss", margin: "1up" },
  { result: "win", margin: "2&1" },
  { result: "loss", margin: "4&3" },
  { result: "win", margin: "1up" },
  { result: "halved", margin: null },
  { result: "loss", margin: "2&1" },
  { result: "win", margin: "3&1" },
];

// Fixture 2: Away vs Royal Nairobi (2026-03-08)
// Mix up the pairings — some same partners, some new
const fixture2Pairs: [number, number][] = [
  [58, 54],  // Victor Noi (9.2) + Ezra Arigo (11.5)
  [51, 61],  // Joel Muchanga (8.6) + Lazarus Muganda (12.9)
  [39, 68],  // Aloise Kizito (14.4) + Edwin Nyabiba (14.4)
  [69, 42],  // Amos Nyoike (15.3) + Joseph Kitavi (16.1)
  [59, 66],  // Tungani Muchiri (16.3) + Samson Musesya (16.9)
  [48, 62],  // Edwin Omollo (17.8) + Mike Mulwa (18.1)
  [74, 75],  // H. Wanyama (18) + D. Mokua (18)
  [65, 72],  // Anthony Rogo (15.6) + Philip Mwangi (20)
  [57, 73],  // Billy Ocharo (20.1) + Brian Kiptoo (20.7)
  [56, 55],  // Sebastian Demello (20.8) + Edwin Huma (21.3)
  [33, 35],  // Jared Onyach (24.6) + Geoffrey Kiiru (24)
  [63, 46],  // Fredrick Wagura (23.6) + Michael Zeni (24.1)
  [40, 43],  // Phil Mutooni (24.9) + Lewis Muriithi (25.2)
  [67, 50],  // Philip Oduma (27.3) + Alex Mulwa (25.4)
  [52, 49],  // John Kibe (33) + Livingstone Odero (34.9)
];

// Fixture 2 results: 6W, 7L, 2H (tough away loss)
const fixture2Results: { result: "win" | "loss" | "halved"; margin: string | null }[] = [
  { result: "win", margin: "2&1" },
  { result: "win", margin: "5&3" },
  { result: "loss", margin: "1up" },
  { result: "win", margin: "2up" },
  { result: "loss", margin: "3&2" },
  { result: "halved", margin: null },
  { result: "loss", margin: "4&3" },
  { result: "win", margin: "1up" },
  { result: "loss", margin: "2&1" },
  { result: "win", margin: "3&2" },
  { result: "loss", margin: "1up" },
  { result: "win", margin: "2up" },
  { result: "loss", margin: "3&1" },
  { result: "halved", margin: null },
  { result: "loss", margin: "5&4" },
];

// Opponent handicaps (realistic range per match position)
function opponentHandicap(matchOrder: number): [number, number] {
  // Lower-handicap pairs at top of order
  const base = 8 + matchOrder * 1.5;
  return [
    Math.round((base + Math.random() * 4 - 2) * 10) / 10,
    Math.round((base + Math.random() * 4 - 2) * 10) / 10,
  ];
}

// Get player handicaps
const playerMap = new Map<number, number>();
const rows = db.$client.prepare("SELECT id, default_handicap FROM players").all() as any[];
for (const r of rows) playerMap.set(r.id, r.default_handicap);

function seedFixture(
  fixtureId: number,
  pairs: [number, number][],
  opponents: string[][],
  results: { result: "win" | "loss" | "halved"; margin: string | null }[],
) {
  for (let i = 0; i < 15; i++) {
    const [p1, p2] = pairs[i];
    const [opp1, opp2] = opponents[i];
    const [oh1, oh2] = opponentHandicap(i);

    db.insert(matches).values({
      fixtureId,
      player1Id: p1,
      player2Id: p2,
      player1Handicap: playerMap.get(p1)!,
      player2Handicap: playerMap.get(p2)!,
      opponent1Name: opp1,
      opponent2Name: opp2,
      opponent1Handicap: oh1,
      opponent2Handicap: oh2,
      result: results[i].result,
      margin: results[i].margin,
      matchOrder: i + 1,
    }).run();
  }
}

// Clear any existing matches first
db.$client.prepare("DELETE FROM matches").run();

seedFixture(1, fixture1Pairs, thikaOpponents, fixture1Results);
console.log("✅ Fixture 1 (vs Thika Sports Club): 15 matches seeded — 8W 5L 2H");

seedFixture(2, fixture2Pairs, royalOpponents, fixture2Results);
console.log("✅ Fixture 2 (vs Royal Nairobi): 15 matches seeded — 6W 7L 2H");

// Summary
const total = db.$client.prepare("SELECT COUNT(*) as c FROM matches").get() as any;
const wins = db.$client.prepare("SELECT COUNT(*) as c FROM matches WHERE result='win'").get() as any;
const losses = db.$client.prepare("SELECT COUNT(*) as c FROM matches WHERE result='loss'").get() as any;
const halved = db.$client.prepare("SELECT COUNT(*) as c FROM matches WHERE result='halved'").get() as any;
console.log(`\n📊 Total: ${total.c} matches — ${wins.c}W ${losses.c}L ${halved.c}H`);

// Players who appeared in both fixtures
const bothFixtures = db.$client.prepare(`
  SELECT p.name, COUNT(DISTINCT m.fixture_id) as fixtures, COUNT(*) as matches,
    SUM(CASE WHEN m.result='win' THEN 1 ELSE 0 END) as wins
  FROM matches m JOIN players p ON p.id IN (m.player1_id, m.player2_id)
  GROUP BY p.id HAVING fixtures = 2
  ORDER BY wins DESC
`).all() as any[];
console.log(`\n${bothFixtures.length} players appeared in both fixtures`);
