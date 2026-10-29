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
import { getAllMatches } from "@/lib/actions";
import { getHandicapMatchupStats, hasCompleteHandicaps, isCompletedMatch } from "@/lib/analytics";
import type { MatchWithDetails, HandicapBucket } from "@/lib/analytics";
import { HandicapChart } from "./handicap-chart";

export default async function HandicapsPage() {
  const result = await getAllMatches();
  const allMatches = (result.data ?? []) as MatchWithDetails[];
  const buckets = getHandicapMatchupStats(allMatches);
  const completed = allMatches.filter(isCompletedMatch);
  const excluded = completed.filter((match) => !hasCompleteHandicaps(match)).length;

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
            Handicap Matchup Analysis
          </h1>
          <p className="text-muted-foreground">
            Performance by combined handicap differential (team − opponents)
          </p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Excludes {excluded} completed match{excluded === 1 ? "" : "es"} with unknown handicaps and all pending results.
      </p>

      {allMatches.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No match data yet. Record matches to see handicap analysis.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Win Rate by Handicap Differential</CardTitle>
              <CardDescription>
                Positive differential = your team has higher (worse) combined
                handicap
              </CardDescription>
            </CardHeader>
            <CardContent>
              <HandicapChart buckets={buckets} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detailed Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Differential Range</TableHead>
                    <TableHead className="text-right">Played</TableHead>
                    <TableHead className="text-right">Wins</TableHead>
                    <TableHead className="text-right">Losses</TableHead>
                    <TableHead className="text-right">Halved</TableHead>
                    <TableHead className="text-right">Win Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {buckets.map((b) => (
                    <TableRow key={b.label}>
                      <TableCell className="font-medium">{b.label}</TableCell>
                      <TableCell className="text-right">{b.played}</TableCell>
                      <TableCell className="text-right">{b.wins}</TableCell>
                      <TableCell className="text-right">{b.losses}</TableCell>
                      <TableCell className="text-right">{b.halved}</TableCell>
                      <TableCell className="text-right">
                        {b.played > 0
                          ? `${(b.winRate * 100).toFixed(1)}%`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
