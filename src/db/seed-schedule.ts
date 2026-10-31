import { db } from "./index";
import { opponentClubs, fixtures } from "./schema";
import { eq } from "drizzle-orm";

async function seedSchedule() {
  // All 15 NDC league clubs (including our own)
  const clubNames = [
    "Limuru Country Club",
    "Vetlab Sports Club",
    "Golf Park",
    "Royal Nairobi Golf Club",
    "Karen Country Club",
    "Ruiru Sports Club",
    "Thika Greens Golf Resort",
    "Kenya Railway Golf Club",
    "Kiambu Golf Club",
    "Machakos Golf Club",
    "Sigona Golf Club",
    "Thika Sports Club",
    "Muthaiga Golf Club",
    "Kenya Air Force Golf Club",
    "Windsor Golf & Country Club",
  ];

  // Insert opponent clubs (skip if already exists)
  const clubMap: Record<string, number> = {};
  for (const name of clubNames) {
    const existing = db.select().from(opponentClubs).where(eq(opponentClubs.name, name)).get();
    if (existing) {
      clubMap[name] = existing.id;
    } else {
      const result = db.insert(opponentClubs).values({ name }).returning().get();
      clubMap[name] = result.id;
    }
  }
  console.log(`✅ ${Object.keys(clubMap).length} opponent clubs seeded`);

  // Kenya Air Force 2026 NDC Fixture Schedule
  // Format: [date, opponent, home/away]
  // Home = played at Kenya Air Force Golf Club
  // Away = played at opponent's home course
  const schedule: [string, string, "home" | "away"][] = [
    // Day 1 (18.01.2026): REST
    ["2026-02-08", "Thika Sports Club",           "away"],   // Day 2
    ["2026-03-08", "Royal Nairobi Golf Club",      "away"],   // Day 3
    ["2026-03-22", "Windsor Golf & Country Club",  "away"],   // Day 4
    ["2026-04-19", "Vetlab Sports Club",           "home"],   // Day 5
    ["2026-05-10", "Sigona Golf Club",             "home"],   // Day 6
    ["2026-05-24", "Thika Greens Golf Resort",     "away"],   // Day 7
    ["2026-06-14", "Limuru Country Club",          "away"],   // Day 8
    ["2026-06-28", "Kiambu Golf Club",             "away"],   // Day 9
    ["2026-07-05", "Kenya Railway Golf Club",      "home"],   // Day 10
    ["2026-07-19", "Karen Country Club",           "away"],   // Day 11
    // Day 12 (02.08.2026): REST
    ["2026-08-16", "Golf Park",                    "home"],   // Day 13
    ["2026-08-30", "Ruiru Sports Club",            "home"],   // Day 14
    ["2026-09-06", "Muthaiga Golf Club",           "home"],   // Day 15
    // Day 16 (20.09.2026): REST
    ["2026-10-11", "Machakos Golf Club",           "away"],   // Day 17
  ];

  // Check if fixtures already exist
  const existingFixtures = db.select().from(fixtures).all();
  if (existingFixtures.length > 0) {
    console.log(`⚠️  ${existingFixtures.length} fixtures already exist — skipping fixture seeding`);
    return;
  }

  let count = 0;
  for (const [date, opponent, homeAway] of schedule) {
    const opponentId = clubMap[opponent];

    db.insert(fixtures).values({
      date,
      opponentClubId: opponentId,
      homeAway,
      notes: `NDC 2026`,
    }).run();
    count++;
  }

  console.log(`✅ ${count} fixtures seeded for 2026 NDC season`);
  console.log("\nRest days: Day 1 (18 Jan), Day 12 (02 Aug), Day 16 (20 Sep)");
  console.log("End of Year League: 18.10.2026 at Golf Park");
}

seedSchedule();
