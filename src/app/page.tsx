import { Building2, Calendar, Users } from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAllMatches } from "@/lib/actions";
import { type MatchWithDetails } from "@/lib/analytics";
import { db } from "@/db";
import { players } from "@/db/schema";
import { eq } from "drizzle-orm";
import { DashboardClient } from "@/components/dashboard-client";
import { Trophy } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const { data: rawMatches } = await getAllMatches();
  const allMatches = (rawMatches ?? []) as MatchWithDetails[];

  const activePlayers = await db
    .select()
    .from(players)
    .where(eq(players.active, true))
    .all();

  if (allMatches.length === 0) {
    return <EmptyState />;
  }

  return (
    <DashboardClient
      allMatches={allMatches}
      activePlayerCount={activePlayers.length}
    />
  );
}

function EmptyState() {
  const links = [
    { href: "/players", label: "Add Players", icon: Users },
    { href: "/clubs", label: "Add Clubs", icon: Building2 },
    { href: "/fixtures", label: "Create a Fixture", icon: Calendar },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Nairobi District Golf League — season overview
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Trophy className="h-12 w-12 text-emerald-600/40 mb-4" />
          <h2 className="text-lg font-semibold">Welcome to Convener!</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Get started by setting up your league. Add players, opponent clubs,
            then create your first fixture and record match results.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {links.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href}>
                <Button variant="outline">
                  <Icon className="h-4 w-4" />
                  {label}
                </Button>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
