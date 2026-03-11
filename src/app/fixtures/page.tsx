import Link from "next/link";
import { db } from "@/db";
import { fixtures, opponentClubs, courses } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, MapPin } from "lucide-react";

export default async function FixturesPage() {
  const fixtureList = await db
    .select({
      id: fixtures.id,
      date: fixtures.date,
      homeAway: fixtures.homeAway,
      notes: fixtures.notes,
      clubName: opponentClubs.name,
      courseName: courses.name,
    })
    .from(fixtures)
    .leftJoin(opponentClubs, eq(fixtures.opponentClubId, opponentClubs.id))
    .leftJoin(courses, eq(fixtures.courseId, courses.id))
    .orderBy(desc(fixtures.date));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Fixtures</h1>
        <Button render={<Link href="/fixtures/new" />}>
          <Plus data-icon="inline-start" />
          New Fixture
        </Button>
      </div>

      {fixtureList.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No fixtures yet. Create your first fixture to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {fixtureList.map((fixture) => (
            <Link
              key={fixture.id}
              href={`/fixtures/${fixture.id}`}
              className="block"
            >
              <Card className="transition-colors hover:bg-muted/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {fixture.clubName ?? "Unknown Club"}
                    <Badge
                      variant={
                        fixture.homeAway === "home"
                          ? "default"
                          : fixture.homeAway === "away"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {fixture.homeAway}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3.5" />
                      {new Date(fixture.date).toLocaleDateString("en-GB", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3.5" />
                      {fixture.courseName ?? "Unknown Course"}
                    </span>
                  </CardDescription>
                </CardHeader>
                {fixture.notes && (
                  <CardContent>
                    <p className="text-muted-foreground">{fixture.notes}</p>
                  </CardContent>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
