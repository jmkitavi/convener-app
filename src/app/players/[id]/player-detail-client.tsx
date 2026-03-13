"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { PlayerForm } from "@/components/player-form";
import {
  ArrowLeftIcon,
  PencilIcon,
  MailIcon,
  PhoneIcon,
  TrophyIcon,
  BarChart3Icon,
  TrendingUpIcon,
  UsersIcon,
  MapPinIcon,
  HistoryIcon,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { PlayerStats, FormMatch, VenueRecord } from "@/lib/analytics";

interface Player {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  defaultHandicap: number;
  active: boolean;
  createdAt: string;
}

type HandicapPoint = {
  date: string;
  handicap: number;
  result: "win" | "loss" | "halved";
};

type MatchHistoryEntry = {
  id: number;
  fixtureDate: string;
  venueName: string;
  opponentClubName: string;
  partnerId: number;
  partnerName: string;
  playerHandicap: number;
  partnerHandicap: number;
  opponent1Name: string;
  opponent2Name: string;
  opponent1Handicap: number;
  opponent2Handicap: number;
  result: "win" | "loss" | "halved";
  margin: string | null;
};

interface PlayerDetailClientProps {
  player: Player;
  stats: PlayerStats;
  form: FormMatch[];
  venueStats: VenueRecord[];
  handicapTrend: HandicapPoint[];
  matchHistory: MatchHistoryEntry[];
  updatePlayer: (formData: FormData) => Promise<void>;
  togglePlayerActive: (formData: FormData) => Promise<void>;
}

const RESULT_COLORS = {
  win: "#10b981",
  loss: "#ef4444",
  halved: "#f59e0b",
} as const;

function ResultBadge({ result }: { result: "win" | "loss" | "halved" }) {
  const variant =
    result === "win"
      ? "default"
      : result === "loss"
        ? "destructive"
        : "outline";
  return (
    <Badge variant={variant} className="capitalize">
      {result}
    </Badge>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatShortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function CustomDot(props: {
  cx?: number;
  cy?: number;
  payload?: HandicapPoint;
}) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={RESULT_COLORS[payload.result]}
      stroke="white"
      strokeWidth={2}
    />
  );
}

export function PlayerDetailClient({
  player,
  stats,
  form,
  venueStats,
  handicapTrend,
  matchHistory,
  updatePlayer,
  togglePlayerActive,
}: PlayerDetailClientProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const hasMatches = stats.played > 0;

  async function handleUpdate(formData: FormData) {
    formData.append("id", player.id.toString());
    await updatePlayer(formData);
    setEditDialogOpen(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/players">
          <Button variant="ghost" size="sm">
            <ArrowLeftIcon />
            Back to Players
          </Button>
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{player.name}</h1>
          <form action={togglePlayerActive}>
            <input type="hidden" name="id" value={player.id} />
            <input
              type="hidden"
              name="active"
              value={String(player.active)}
            />
            <button type="submit" className="cursor-pointer">
              <Badge variant={player.active ? "default" : "secondary"}>
                {player.active ? "Active" : "Inactive"}
              </Badge>
            </button>
          </form>
        </div>
        <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
          <PencilIcon />
          Edit Player
        </Button>
      </div>

      {/* Top cards: Player Info + Stats Summary */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Player Information</CardTitle>
            <CardDescription>Personal details and handicap</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Handicap</p>
                <p className="text-lg font-semibold">
                  {player.defaultHandicap}
                </p>
              </div>
            </div>
            <Separator />
            <div className="space-y-3">
              {player.email && (
                <div className="flex items-center gap-2 text-sm">
                  <MailIcon className="size-4 text-muted-foreground" />
                  <span>{player.email}</span>
                </div>
              )}
              {player.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <PhoneIcon className="size-4 text-muted-foreground" />
                  <span>{player.phone}</span>
                </div>
              )}
              {!player.email && !player.phone && (
                <p className="text-sm text-muted-foreground">
                  No contact information provided.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3Icon className="size-4" />
              Performance Stats
            </CardTitle>
            <CardDescription>Season statistics and trends</CardDescription>
          </CardHeader>
          <CardContent>
            {hasMatches ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Matches Played
                  </p>
                  <p className="text-2xl font-bold">{stats.played}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Win Rate</p>
                  <p className="text-2xl font-bold">
                    {(stats.winRate * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground mb-2">Record</p>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="default"
                      className="bg-emerald-500 hover:bg-emerald-600"
                    >
                      {stats.wins}W
                    </Badge>
                    <Badge variant="destructive">{stats.losses}L</Badge>
                    <Badge variant="outline">{stats.halved}H</Badge>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Performance statistics will appear here once matches are
                recorded.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabbed sections */}
      {hasMatches ? (
        <Tabs defaultValue="overview">
          <TabsList variant="line">
            <TabsTrigger value="overview">
              <TrendingUpIcon className="size-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="partners">
              <UsersIcon className="size-4" />
              Pairings
            </TabsTrigger>
            <TabsTrigger value="venues">
              <MapPinIcon className="size-4" />
              Venues
            </TabsTrigger>
            <TabsTrigger value="history">
              <HistoryIcon className="size-4" />
              Match History
            </TabsTrigger>
          </TabsList>

          {/* Overview tab: Handicap Trend + Recent Form */}
          <TabsContent value="overview" className="space-y-6">
            {/* Handicap Trend Chart */}
            {handicapTrend.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUpIcon className="size-4" />
                    Handicap Trend
                  </CardTitle>
                  <CardDescription>
                    Handicap over time —{" "}
                    <span className="text-emerald-500">●</span> win{" "}
                    <span className="text-red-500">●</span> loss{" "}
                    <span className="text-amber-500">●</span> halved
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={handicapTrend}
                        margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis
                          dataKey="date"
                          tickFormatter={formatShortDate}
                          fontSize={12}
                        />
                        <YAxis
                          domain={["dataMin - 1", "dataMax + 1"]}
                          fontSize={12}
                        />
                        <Tooltip
                          labelFormatter={(label) =>
                            formatDate(String(label))
                          }
                          formatter={(value) => [
                            Number(value).toFixed(1),
                            "Handicap",
                          ]}
                        />
                        <Line
                          type="monotone"
                          dataKey="handicap"
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={<CustomDot />}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrophyIcon className="size-4" />
                  Recent Form
                </CardTitle>
                <CardDescription>
                  Last {form.length} matches
                </CardDescription>
              </CardHeader>
              <CardContent>
                {form.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Opponent Club</TableHead>
                        <TableHead>Pairing</TableHead>
                        <TableHead>vs Opponents</TableHead>
                        <TableHead>Result</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {form.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell>{formatDate(m.fixtureDate)}</TableCell>
                          <TableCell>{m.opponentClubName}</TableCell>
                          <TableCell>
                            <span className="font-medium">{player.name}</span>
                            <span className="text-muted-foreground text-xs ml-0.5">({m.playerHandicap})</span>
                            {" / "}
                            <Link
                              href={`/players/${m.partnerId}`}
                              className="text-primary hover:underline"
                            >
                              {m.partnerName}
                            </Link>
                            <span className="text-muted-foreground text-xs ml-0.5">({m.partnerHandicap})</span>
                          </TableCell>
                          <TableCell>
                            {m.opponent1Name}
                            <span className="text-muted-foreground text-xs ml-0.5">({m.opponent1Handicap})</span>
                            {" / "}
                            {m.opponent2Name}
                            <span className="text-muted-foreground text-xs ml-0.5">({m.opponent2Handicap})</span>
                          </TableCell>
                          <TableCell>
                            <ResultBadge result={m.result} />
                            {m.margin && (
                              <span className="ml-1.5 text-xs text-muted-foreground">{m.margin}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No recent matches.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pairings tab */}
          <TabsContent value="partners">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UsersIcon className="size-4" />
                  Pairings
                </CardTitle>
                <CardDescription>
                  Match pairings and opponent matchups
                </CardDescription>
              </CardHeader>
              <CardContent>
                {matchHistory.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>vs</TableHead>
                        <TableHead>Pairing</TableHead>
                        <TableHead>Opponents</TableHead>
                        <TableHead>Result</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {matchHistory.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="text-xs">{formatDate(m.fixtureDate)}</TableCell>
                          <TableCell className="text-xs">{m.opponentClubName}</TableCell>
                          <TableCell>
                            <span className="font-medium">{player.name}</span>
                            <span className="text-muted-foreground text-xs ml-0.5">({m.playerHandicap})</span>
                            {" / "}
                            <Link
                              href={`/players/${m.partnerId}`}
                              className="text-primary hover:underline"
                            >
                              {m.partnerName}
                            </Link>
                            <span className="text-muted-foreground text-xs ml-0.5">({m.partnerHandicap})</span>
                          </TableCell>
                          <TableCell>
                            {m.opponent1Name}
                            <span className="text-muted-foreground text-xs ml-0.5">({m.opponent1Handicap})</span>
                            {" / "}
                            {m.opponent2Name}
                            <span className="text-muted-foreground text-xs ml-0.5">({m.opponent2Handicap})</span>
                          </TableCell>
                          <TableCell>
                            <ResultBadge result={m.result} />
                            {m.margin && (
                              <span className="ml-1.5 text-xs text-muted-foreground">{m.margin}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No pairing data available.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Venues tab */}
          <TabsContent value="venues">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPinIcon className="size-4" />
                  Venue Performance
                </CardTitle>
                <CardDescription>
                  Record at each venue
                </CardDescription>
              </CardHeader>
              <CardContent>
                {venueStats.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Venue</TableHead>
                        <TableHead className="text-center">Played</TableHead>
                        <TableHead className="text-center">W</TableHead>
                        <TableHead className="text-center">L</TableHead>
                        <TableHead className="text-center">H</TableHead>
                        <TableHead className="text-center">Win Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {venueStats.map((v) => (
                        <TableRow key={v.venueName}>
                          <TableCell className="font-medium">
                            {v.venueName}
                          </TableCell>
                          <TableCell className="text-center">
                            {v.played}
                          </TableCell>
                          <TableCell className="text-center text-emerald-600">
                            {v.wins}
                          </TableCell>
                          <TableCell className="text-center text-red-600">
                            {v.losses}
                          </TableCell>
                          <TableCell className="text-center text-amber-600">
                            {v.halved}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant={
                                v.winRate >= 0.5 ? "default" : "secondary"
                              }
                              className={
                                v.winRate >= 0.5
                                  ? "bg-emerald-500 hover:bg-emerald-600"
                                  : ""
                              }
                            >
                              {(v.winRate * 100).toFixed(0)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No venue data available.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Match History tab */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HistoryIcon className="size-4" />
                  Match History
                </CardTitle>
                <CardDescription>
                  All {matchHistory.length} matches — newest first
                </CardDescription>
              </CardHeader>
              <CardContent>
                {matchHistory.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Opponent Club</TableHead>
                        <TableHead>Pairing</TableHead>
                        <TableHead>vs Opponents</TableHead>
                        <TableHead>Result</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {matchHistory.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell>{formatDate(m.fixtureDate)}</TableCell>
                          <TableCell>{m.opponentClubName}</TableCell>
                          <TableCell>
                            <span className="font-medium">{player.name}</span>
                            <span className="text-muted-foreground text-xs ml-0.5">({m.playerHandicap})</span>
                            {" / "}
                            <Link
                              href={`/players/${m.partnerId}`}
                              className="text-primary hover:underline"
                            >
                              {m.partnerName}
                            </Link>
                            <span className="text-muted-foreground text-xs ml-0.5">({m.partnerHandicap})</span>
                          </TableCell>
                          <TableCell>
                            {m.opponent1Name}
                            <span className="text-muted-foreground text-xs ml-0.5">({m.opponent1Handicap})</span>
                            {" / "}
                            {m.opponent2Name}
                            <span className="text-muted-foreground text-xs ml-0.5">({m.opponent2Handicap})</span>
                          </TableCell>
                          <TableCell>
                            <ResultBadge result={m.result} />
                            {m.margin && (
                              <span className="ml-1.5 text-xs text-muted-foreground">{m.margin}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No matches recorded yet.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrophyIcon className="size-4" />
              Match History
            </CardTitle>
            <CardDescription>Past match results and pairings</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground py-8 text-center">
              Match history will appear here once matches are recorded.
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => setEditDialogOpen(open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Player</DialogTitle>
            <DialogDescription>
              Update {player.name}&apos;s details.
            </DialogDescription>
          </DialogHeader>
          <PlayerForm
            defaultValues={player}
            onSubmit={handleUpdate}
            submitLabel="Update Player"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
