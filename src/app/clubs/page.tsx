import { db } from "@/db";
import { opponentClubs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { Building2, Pencil, Trash2, Plus } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ClubForm } from "@/components/club-form";

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
}

async function deleteClub(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  if (!id) return;
  await db.delete(opponentClubs).where(eq(opponentClubs.id, id));
  revalidatePath("/clubs");
}

export default async function ClubsPage() {
  const clubs = await db.select().from(opponentClubs).orderBy(opponentClubs.name);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Opponent Clubs</h1>
          <p className="text-sm text-muted-foreground">
            Manage the clubs your team plays against. Each club is also its course.
          </p>
        </div>
        <Dialog>
          <DialogTrigger
            render={
              <Button>
                <Plus className="h-4 w-4" />
                Add Club
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Club</DialogTitle>
              <DialogDescription>
                Add a new opponent club to your league.
              </DialogDescription>
            </DialogHeader>
            <ClubForm action={createClub} submitLabel="Add Club" />
          </DialogContent>
        </Dialog>
      </div>

      {clubs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              No clubs yet
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Add your first opponent club to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clubs.map((club) => (
            <Card key={club.id} size="sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-emerald-600" />
                  {club.name}
                </CardTitle>
                {(club.par || club.slopeRating || club.courseRating) && (
                  <CardDescription className="flex flex-wrap gap-1.5 pt-1">
                    {club.par && (
                      <Badge variant="secondary">Par {club.par}</Badge>
                    )}
                    {club.slopeRating && (
                      <Badge variant="secondary">Slope {club.slopeRating}</Badge>
                    )}
                    {club.courseRating && (
                      <Badge variant="secondary">Rating {club.courseRating}</Badge>
                    )}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex items-center gap-2">
                <Dialog>
                  <DialogTrigger
                    render={
                      <Button variant="outline" size="sm">
                        <Pencil className="h-3 w-3" />
                        Edit
                      </Button>
                    }
                  />
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit Club</DialogTitle>
                      <DialogDescription>
                        Update the club details.
                      </DialogDescription>
                    </DialogHeader>
                    <ClubForm
                      action={updateClub}
                      defaultValues={{
                        id: club.id,
                        name: club.name,
                        par: club.par,
                        slopeRating: club.slopeRating,
                        courseRating: club.courseRating,
                      }}
                      submitLabel="Save Changes"
                    />
                  </DialogContent>
                </Dialog>
                <form action={deleteClub}>
                  <input type="hidden" name="id" value={club.id} />
                  <Button variant="destructive" size="sm" type="submit">
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </Button>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
