import { db } from "@/db";
import { courses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { MapPin, Pencil, Trash2, Plus } from "lucide-react";
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
import { CourseForm } from "@/components/course-form";

function parseOptionalNumber(value: FormDataEntryValue | null): number | null {
  if (!value || value === "") return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
}

async function createCourse(formData: FormData) {
  "use server";
  const name = formData.get("name") as string;
  if (!name?.trim()) return;
  await db.insert(courses).values({
    name: name.trim(),
    par: parseOptionalNumber(formData.get("par")),
    slopeRating: parseOptionalNumber(formData.get("slopeRating")),
    courseRating: parseOptionalNumber(formData.get("courseRating")),
  });
  revalidatePath("/courses");
}

async function updateCourse(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  const name = formData.get("name") as string;
  if (!id || !name?.trim()) return;
  await db
    .update(courses)
    .set({
      name: name.trim(),
      par: parseOptionalNumber(formData.get("par")),
      slopeRating: parseOptionalNumber(formData.get("slopeRating")),
      courseRating: parseOptionalNumber(formData.get("courseRating")),
    })
    .where(eq(courses.id, id));
  revalidatePath("/courses");
}

async function deleteCourse(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  if (!id) return;
  await db.delete(courses).where(eq(courses.id, id));
  revalidatePath("/courses");
}

export default async function CoursesPage() {
  const allCourses = await db.select().from(courses).orderBy(courses.name);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Courses</h1>
          <p className="text-sm text-muted-foreground">
            Manage the golf courses used in your fixtures.
          </p>
        </div>
        <Dialog>
          <DialogTrigger
            render={
              <Button>
                <Plus className="h-4 w-4" />
                Add Course
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Course</DialogTitle>
              <DialogDescription>
                Add a new golf course to your league.
              </DialogDescription>
            </DialogHeader>
            <CourseForm action={createCourse} submitLabel="Add Course" />
          </DialogContent>
        </Dialog>
      </div>

      {allCourses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <MapPin className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              No courses yet
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Add your first course to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {allCourses.map((course) => (
            <Card key={course.id} size="sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-emerald-600" />
                  {course.name}
                </CardTitle>
                {(course.par || course.slopeRating || course.courseRating) && (
                  <CardDescription className="flex flex-wrap gap-1.5 pt-1">
                    {course.par && (
                      <Badge variant="secondary">Par {course.par}</Badge>
                    )}
                    {course.slopeRating && (
                      <Badge variant="secondary">Slope {course.slopeRating}</Badge>
                    )}
                    {course.courseRating && (
                      <Badge variant="secondary">Rating {course.courseRating}</Badge>
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
                      <DialogTitle>Edit Course</DialogTitle>
                      <DialogDescription>
                        Update the course details.
                      </DialogDescription>
                    </DialogHeader>
                    <CourseForm
                      action={updateCourse}
                      defaultValues={{
                        id: course.id,
                        name: course.name,
                        par: course.par,
                        slopeRating: course.slopeRating,
                        courseRating: course.courseRating,
                      }}
                      submitLabel="Save Changes"
                    />
                  </DialogContent>
                </Dialog>
                <form action={deleteCourse}>
                  <input type="hidden" name="id" value={course.id} />
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
