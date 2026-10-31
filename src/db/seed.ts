import { db } from "./legacy-index";
import { players } from "./legacy-schema";

const squadPlayers = [
  "H. Wanyama",
  "D. Mokua",
  "E. Arigo",
  "A. Rogo",
  "J. Chacha",
  "M. Tungani",
  "J. Ochieng",
  "A. Kizito",
  "K. Kigen",
  "J. Kitavi",
  "P. Mwangi",
  "A. Mukundi",
  "E. Huma",
  "B. Ocharo",
  "J. Foro",
  "A. Nyoike",
  "O. Chacha",
  "M. Sharrif",
  "P. Kinyua",
  "P. Odhiambo",
  "S. Demello",
];

async function seed() {
  console.log("Seeding players...");

  for (const name of squadPlayers) {
    db.insert(players)
      .values({ name, defaultHandicap: 18, active: true })
      .onConflictDoNothing()
      .run();
  }

  const count = db.select().from(players).all().length;
  console.log(`Done. ${count} players in database.`);
}

seed();
