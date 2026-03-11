import { redirect } from "next/navigation";
import { db } from "@/db";
import { fixtures, opponentClubs, courses } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { FixtureForm } from "@/components/fixture-form";

export default async function NewFixturePage() {
  const clubs = await db
    .select({ id: opponentClubs.id, name: opponentClubs.name })
    .from(opponentClubs)
    .orderBy(opponentClubs.name);

  const courseList = await db
    .select({ id: courses.id, name: courses.name })
    .from(courses)
    .orderBy(courses.name);

  async function createFixture(formData: FormData) {
    "use server";

    const date = formData.get("date") as string;
    const opponentClubId = Number(formData.get("opponentClubId"));
    const courseId = Number(formData.get("courseId"));
    const homeAway = formData.get("homeAway") as
      | "home"
      | "away"
      | "neutral";
    const notes = (formData.get("notes") as string) || null;

    const [row] = await db
      .insert(fixtures)
      .values({ date, opponentClubId, courseId, homeAway, notes })
      .returning({ id: fixtures.id });

    revalidatePath("/fixtures");
    redirect(`/fixtures/${row.id}`);
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">New Fixture</h1>
      <FixtureForm
        clubs={clubs}
        courses={courseList}
        action={createFixture}
      />
    </div>
  );
}
