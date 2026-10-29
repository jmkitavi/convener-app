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
import { getPairingStats } from "@/lib/analytics";
import type { MatchWithDetails } from "@/lib/analytics";

export default async function PairingsPage() {
  const result = await getAllMatches();
  const allMatches = (result.data ?? []) as MatchWithDetails[];
  const pairings = getPairingStats(allMatches);

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
            Partner Compatibility
          </h1>
          <p className="text-muted-foreground">
            Win rates for every player pairing combination
          </p>
        </div>
      </div>

      {pairings.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No pairing data yet. Record matches with different player
            combinations to see compatibility stats.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Pairings</CardTitle>
            <CardDescription>
              Sorted by win rate. Green = &gt;60%, Red = &lt;40% (minimum 2
              matches).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player 1</TableHead>
                  <TableHead>Player 2</TableHead>
                  <TableHead className="text-right">Played</TableHead>
                  <TableHead className="text-right">W</TableHead>
                  <TableHead className="text-right">L</TableHead>
                  <TableHead className="text-right">H</TableHead>
                  <TableHead className="text-right">Win Rate</TableHead>
                  <TableHead className="text-right">Avg Handicap</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pairings.map((p) => {
                  const pct = p.winRate * 100;
                  const winRateColor =
                    p.played >= 2 && pct > 60
                      ? "text-emerald-700 bg-emerald-50"
                      : p.played >= 2 && pct < 40
                        ? "text-red-600 bg-red-50"
                        : "";

                  return (
                    <TableRow key={`${p.player1Id}-${p.player2Id}`}>
                      <TableCell className="font-medium">
                        {p.player1Name}
                      </TableCell>
                      <TableCell className="font-medium">
                        {p.player2Name}
                      </TableCell>
                      <TableCell className="text-right">{p.played}</TableCell>
                      <TableCell className="text-right">{p.wins}</TableCell>
                      <TableCell className="text-right">{p.losses}</TableCell>
                      <TableCell className="text-right">{p.halved}</TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="secondary"
                          className={winRateColor}
                        >
                          {pct.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {p.avgCombinedHandicap ?? "—"}
                        {p.handicapExcluded > 0 && (
                          <span className="block text-xs text-muted-foreground">
                            {p.handicapExcluded} unknown pair handicap{p.handicapExcluded === 1 ? "" : "s"} excluded
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
