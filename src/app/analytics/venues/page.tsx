import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getAllMatches } from "@/lib/actions";
import { getVenueStats } from "@/lib/analytics";
import type { MatchWithDetails } from "@/lib/analytics";
import { VenueChart } from "./venue-chart";

export default async function VenuesPage() {
  const result = await getAllMatches();
  const allMatches = (result.data ?? []) as MatchWithDetails[];
  const venues = getVenueStats(allMatches);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/analytics"
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Venue Performance
          </h1>
          <p className="text-muted-foreground">
            Win rates broken down by course
          </p>
        </div>
      </div>

      {venues.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No venue data yet. Record matches at different courses to see
            performance by venue.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Win Rate by Venue</CardTitle>
              <CardDescription>
                Comparing performance across all courses played
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VenueChart venues={venues} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Venue Details</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course</TableHead>
                    <TableHead className="text-right">Played</TableHead>
                    <TableHead className="text-right">Wins</TableHead>
                    <TableHead className="text-right">Losses</TableHead>
                    <TableHead className="text-right">Halved</TableHead>
                    <TableHead className="text-right">Win Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {venues.map((v) => {
                    const pct = v.winRate * 100;
                    return (
                      <TableRow key={v.courseId}>
                        <TableCell className="font-medium">
                          {v.courseName}
                        </TableCell>
                        <TableCell className="text-right">
                          {v.played}
                        </TableCell>
                        <TableCell className="text-right">{v.wins}</TableCell>
                        <TableCell className="text-right">
                          {v.losses}
                        </TableCell>
                        <TableCell className="text-right">
                          {v.halved}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant="secondary"
                            className={
                              pct >= 60
                                ? "text-emerald-700 bg-emerald-50"
                                : pct < 40
                                  ? "text-red-600 bg-red-50"
                                  : ""
                            }
                          >
                            {pct.toFixed(1)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
