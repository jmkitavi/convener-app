import { redirect } from "next/navigation";
import { db } from "@/db";
import { fixtures, opponentClubs } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { FixtureForm } from "@/components/fixture-form";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function NewFixturePage() {
  const clubs = await db
    .select({ id: opponentClubs.id, name: opponentClubs.name })
    .from(opponentClubs)
    .orderBy(opponentClubs.name);

  async function createFixture(formData: FormData) {
    "use server";

    const date = formData.get("date") as string;
    const opponentClubId = Number(formData.get("opponentClubId"));
    const homeAway = formData.get("homeAway") as
      | "home"
      | "away"
      | "neutral";
    const notes = (formData.get("notes") as string) || null;
    const venueName = (formData.get("venueName") as string)?.trim() || null;
    const teamName = (formData.get("teamName") as string)?.trim() || null;
    const opponentTeamName = (formData.get("opponentTeamName") as string)?.trim() || null;

    const [row] = await db
      .insert(fixtures)
      .values({ date, opponentClubId, homeAway, notes, venueName, teamName, opponentTeamName })
      .returning({ id: fixtures.id });

    revalidatePath("/fixtures");
    revalidatePath("/", "layout");
    revalidatePath("/analytics", "layout");
    redirect(`/fixtures/${row.id}`);
  }

  return (
    <div className="page-shell screen-desk">
      <PageHeader title="Plan the next fixture." eyebrow="Fixtures / New" description="Set the details now. Add your lineup and results when you’re ready." actions={<Button variant="outline" render={<Link href="/fixtures" />}>Back to Fixtures</Button>} />
      <div className="desk-two-column">
      <section className="desk-panel">
        <div className="desk-panel-header"><h2 className="font-semibold">Fixture details</h2><p className="text-sm text-muted-foreground">A little preparation makes match day simpler.</p></div>
        <div>
        <FixtureForm
        clubs={clubs}
        action={createFixture}
        />
        </div>
      </section>
      <aside className="desk-panel self-start">
        <div className="desk-panel-header"><h2 className="font-semibold">Before the first tee</h2></div>
        <div className="desk-stack">
          <p className="desk-note">Future fixtures without matches appear as scheduled. Past fixtures without completed results remain in the results queue.</p>
          <dl className="space-y-4 text-sm">
            <div><dt className="text-muted-foreground">Opponent clubs available</dt><dd className="font-medium">{clubs.length}</dd></div>
            <div><dt className="text-muted-foreground">Venue</dt><dd>Leave blank to use the home course or opponent club. Set an actual venue when playing elsewhere.</dd></div>
            <div><dt className="text-muted-foreground">Results</dt><dd>Add paired matches after saving. Unknown handicaps can remain blank.</dd></div>
          </dl>
          <Button variant="outline" render={<Link href="/clubs" />}>Manage opponent clubs</Button>
        </div>
        <div className="desk-panel-footer text-xs text-muted-foreground">Selection tools stay separate from the official scorecard.</div>
      </aside>
      </div>
    </div>
  );
}
