import { db } from "@/db";
import { fixtures, opponentClubs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { ClubsDirectory } from "@/components/club-form";

function parseOptionalNumber(value: FormDataEntryValue | null): number | null {
  if (!value || value === "") return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
}

async function createClub(formData: FormData) {
  "use server";
  const name = formData.get("name") as string;
  if (!name?.trim()) return;
  await db.insert(opponentClubs).values({
    name: name.trim(),
    par: parseOptionalNumber(formData.get("par")),
    slopeRating: parseOptionalNumber(formData.get("slopeRating")),
    courseRating: parseOptionalNumber(formData.get("courseRating")),
  });
  revalidatePath("/clubs");
  revalidatePath("/", "layout");
}

async function updateClub(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  const name = formData.get("name") as string;
  if (!id || !name?.trim()) return;
  await db
    .update(opponentClubs)
    .set({
      name: name.trim(),
      par: parseOptionalNumber(formData.get("par")),
      slopeRating: parseOptionalNumber(formData.get("slopeRating")),
      courseRating: parseOptionalNumber(formData.get("courseRating")),
    })
    .where(eq(opponentClubs.id, id));
  revalidatePath("/clubs");
  revalidatePath("/", "layout");
}

async function deleteClub(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  if (!id) return;
  await db.delete(opponentClubs).where(eq(opponentClubs.id, id));
  revalidatePath("/clubs");
  revalidatePath("/", "layout");
}

export default async function ClubsPage() {
  const [clubs, clubFixtures] = await Promise.all([
    db.select().from(opponentClubs).orderBy(opponentClubs.name),
    db.select({ clubId: fixtures.opponentClubId }).from(fixtures),
  ]);
  return <ClubsDirectory clubs={clubs.map((club) => ({
    ...club,
    fixtureCount: clubFixtures.filter((fixture) => fixture.clubId === club.id).length,
  }))} createClub={createClub} updateClub={updateClub} deleteClub={deleteClub} />;
}
